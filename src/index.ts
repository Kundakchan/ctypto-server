import { hasOrder, setTimerClearOrder, watchOrders } from "./order";
import {
  canBuyCoins,
  getAmount,
  getCoinPurchaseBalance,
  watchWallet,
} from "./wallet";
import {
  chooseBestCoin,
  fetchCoins,
  getBestCoins,
  getCoinBySymbol,
} from "./coins";
import { Ticker, watchTicker } from "./ticker";
import {
  watchPrice,
  setTickerToMatrix,
  getCoinPriceBySymbol,
  getPrices,
} from "./price";
import chalk from "chalk";
import {
  createRecursiveOrder,
  getAvailableSlots,
  positionSuccessClose,
} from "./trading";
import {
  watchPositionsInterval,
  hasPosition,
  watchPositions,
} from "./position";

export type Side = "Buy" | "Sell";

export interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}

export const SETTINGS = {
  TIME_CHECK_PRICE: 10000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 0.5, // Процент отката цены для лимитной закупки (%)
  TIMER_ORDER_CANCEL: 15, // Время отмены ордеров если он не выполнился (мин)
  // STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 5, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.005, // Минимальный процент изменения цены относительно прошлой (%)
  FIELD: "lastPrice",
  NUMBER_OF_POSITIONS: 3, // Количество закупаемых монет (шт)
  NUMBER_OF_ORDERS: 5, // Количество создаваемых ордеров для каждой монеты (шт)
  PRICE_DIFFERENCE_MULTIPLIER: 1, // На сколько единиц будет увеличен процент разницы между ценами (ед)
  UNREALIZED_PNL: 6, // Нереализованные pnl для закрытия позиции
} as const;

watchWallet({
  afterFilled: (wallet) => {},
});
watchOrders({
  afterFilled: (orders) => {
    orders.forEach((order) => {
      setTimerClearOrder(order);
    });
  },
});
watchPositions({
  afterFilled: (positions) => {},
});
watchPositionsInterval({
  afterFilled: (positions) => {
    positionSuccessClose(positions);
  },
});

fetchCoins().then(() => {
  watchTicker(setTickerToMatrix);
  watchPrice((event) => {
    const bestCoins = getBestCoins(event);
    if (!bestCoins.length) {
      console.log(chalk.yellow("Нет подходящих монет для покупки"));
      return;
    } else {
      bestCoins.forEach(async (coin, index) => {
        const availableSlots = getAvailableSlots();
        if (availableSlots <= 0 || availableSlots <= index) {
          console.log(chalk.yellow("Лимит на покупку монет превышен"));
          return;
        }

        if (!hasPosition(coin.symbol) && !hasOrder(coin.symbol)) {
          const active = chooseBestCoin([coin]);
          if (active) {
            await executeCoinPurchaseOrder({
              ...getCoinPriceBySymbol(coin.symbol),
              ...active,
            });
          }
        } else {
          console.log(
            chalk.yellow(
              `Монета - ${coin.symbol} уже есть в реестре заказов или позиции`
            )
          );
        }
      });
    }
  });
});

const executeCoinPurchaseOrder = async (active: BuyCoinParams) => {
  const fieldValue = active[SETTINGS.FIELD];

  if (!fieldValue) {
    throw new Error(`Отсутствует свойство - ${SETTINGS.FIELD}`);
  }

  const balance = getCoinPurchaseBalance();
  if (!balance) {
    console.log(chalk.yellow("Нет средств для покупки новой монеты"));
    return;
  }

  const entryPrice = parseFloat(fieldValue as string);
  const prices = getPrices({
    entryPrice,
    side: active.position,
    percentage: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
  });

  const instrumentInfo = getCoinBySymbol(active.symbol);
  const qtyStep = instrumentInfo?.lotSizeFilter?.qtyStep;

  if (!qtyStep) {
    console.error("Не удалось получить свойство qtyStep");
    return;
  }

  const amounts = getAmount({
    balance,
    prices,
    qtyStep: parseFloat(qtyStep),
  });

  if (!canBuyCoins({ amounts, symbol: active.symbol })) {
    console.log(
      chalk.yellow(
        "Объём закупок не удовлетворяет минимальным или максимальным требованиям"
      )
    );
    return;
  }

  return createRecursiveOrder({ active, amounts, prices, index: 0 });
};
