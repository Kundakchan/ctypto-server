import { getOrders, hasOrder, setTimerClearOrder, watchOrders } from "./order";
import { getAmount, getCoinPurchaseBalance, watchWallet } from "./wallet";
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
  cancelOrder,
  closePosition,
  createOrder,
  getAvailableSlots,
} from "./trading";
import {
  watchPositionsInterval,
  hasPosition,
  watchPositions,
  Position,
} from "./position";
import type { Symbol } from "./coins/symbols";

export type Side = "Buy" | "Sell";

interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}

export const SETTINGS = {
  TIME_CHECK_PRICE: 60000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 0.5, // Процент отката цены для лимитной закупки (%)
  TIMER_ORDER_CANCEL: 15, // Время отмены ордеров если он не выполнился (мин)
  // STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 4, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.3, // Минимальный процент изменения цены относительно прошлой (%)
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
    positions.forEach(async (position) => {
      if (isPositionPnL(position, SETTINGS.UNREALIZED_PNL)) {
        await closePosition(position);
        const orders = await getOrders("symbol", position.symbol);
        for (const order of orders) {
          await cancelOrder({ symbol: order.symbol, orderId: order.orderId }); // Отменяем заказ
        }
      }
    });
  },
});

const isPositionPnL = (position: Position, pnl: number) => {
  const { avgPrice, size, unrealisedPnl } = position;
  const pnlAsPercent =
    (parseFloat(unrealisedPnl) /
      ((parseFloat(size) * parseFloat(avgPrice)) / SETTINGS.LEVERAGE)) *
    100;
  return pnlAsPercent >= pnl;
};

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
            await buyCoin({ ...getCoinPriceBySymbol(coin.symbol), ...active });
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

const buyCoin = async (active: BuyCoinParams) => {
  if (!active[SETTINGS.FIELD]) {
    throw new Error(`Отсутствует свойства - ${SETTINGS.FIELD}`);
  }

  const balance = getCoinPurchaseBalance();

  if (!balance) {
    console.log(chalk.yellow("Нет средств для покупки новой монеты"));
    return;
  }

  const prices = getPrices({
    entryPrice: parseFloat(active[SETTINGS.FIELD] as string),
    side: active.position,
    percentage: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
  });

  const instrumentInfo = getCoinBySymbol(active.symbol);

  if (!instrumentInfo?.lotSizeFilter?.qtyStep) {
    console.error("Не удалось получить свойства qtyStep");
    return;
  }

  const amounts = getAmount({
    balance: balance,
    prices: prices,
    qtyStep: parseFloat(instrumentInfo.lotSizeFilter.qtyStep),
  });

  if (!canBuyCoins({ amounts, symbol: active.symbol })) {
    console.log(
      chalk.yellow(
        "Объём закупок не удовлетворяет минимальным или максимальным требованиям"
      )
    );
    return;
  }

  return await createRecursiveOrder({ active, amounts, prices, index: 0 });
};

const createRecursiveOrder = async ({
  active,
  amounts,
  prices,
  index,
}: {
  active: BuyCoinParams;
  amounts: number[];
  prices: number[];
  index: number;
}) => {
  if (index >= SETTINGS.NUMBER_OF_ORDERS) {
    console.log(chalk.green(`Все ордера ${active.symbol} успешно создан`));
    return;
  }

  try {
    const result = await createOrder({
      symbol: active.symbol,
      side: active.position,
      amount: amounts[index],
      price: prices[index],
    });

    if (!result) {
      console.log(chalk.red(`Отсутствует result ${result}`));
      return;
    }

    if (result.retMsg !== "OK") {
      console.log(chalk.red(`Ошибка создания ордера: ${active.symbol}`));
      console.log(chalk.red(result.retMsg));
      return;
    }

    console.log(
      chalk.green(`Ордер ${active.symbol} успешно создан, index: ${index}`)
    );
    console.table(result.result);
    setTimeout(async () => {
      await createRecursiveOrder({
        active,
        amounts,
        prices,
        index: index + 1,
      });
    }, 300);

    return;
  } catch (error) {
    console.error("Error createRecursiveOrder", error);
  }
};

const canBuyCoins = ({
  amounts,
  symbol,
}: {
  amounts: number[];
  symbol: Symbol;
}) => {
  const instrumentsInfo = getCoinBySymbol(symbol);
  if (instrumentsInfo) {
    const { lotSizeFilter } = instrumentsInfo;
    return amounts.every(
      (num) =>
        num >= parseFloat(lotSizeFilter.minOrderQty) &&
        num <= parseFloat(lotSizeFilter.maxOrderQty)
    );
  } else {
    return false;
  }
};
