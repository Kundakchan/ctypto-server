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
  closePosition,
  createRecursiveOrder,
  getAvailableSlots,
  getStopOrderBySymbol,
  positionSuccessClose,
  removeSlidingStopOrder,
  setSlidingStopOrder,
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
  TIME_CHECK_PRICE: 6000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 0.5, // Процент разницы между ценами (%)
  TIMER_ORDER_CANCEL: 15, // Время отмены ордеров если он не выполнился (мин)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 4, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.3, // Минимальный процент изменения цены относительно прошлого (%)
  FIELD: "lastPrice", // Поле, содержащее цену монеты
  NUMBER_OF_POSITIONS: 3, // Количество закупаемых монет (шт)
  NUMBER_OF_ORDERS: 5, // Количество создаваемых ордеров для каждой монеты (шт)
  PRICE_DIFFERENCE_MULTIPLIER: 100, // На сколько процентов будет увеличен процент разницы между ценами (%)
  UNREALIZED_PNL: 6, // Нереализованные pnl для закрытия позиции
  STOP_LOSS: 0.1,
} as const;

// Наблюдение за изменениями в кошельке
watchWallet({ afterFilled: () => {} });

// Наблюдение за ордерами и установка таймеров для их очистки
watchOrders({
  afterFilled: (orders) => orders.forEach(setTimerClearOrder),
});

// Наблюдение за позициями
watchPositions({ afterFilled: () => {} });

// Периодическая проверка позиций и закрытие успешных
watchPositionsInterval({
  afterFilled: (positions) => {
    // TODO: Реализовать другой принцип закрытия успешной позиции
    positionSuccessClose(positions);
    setSlidingStopOrder(positions);
  },
});

// Получение монет и запуск наблюдателя за ценами
fetchCoins().then(() => {
  watchTicker((ticker) => {
    setTickerToMatrix(ticker);
    stopPosition(ticker);
  });
  // watchPrice(handlePriceEvent);
});

// Обработка событий изменения цен для обработки возможных покупок монет
const handlePriceEvent = async (event: any) => {
  const bestCoins = getBestCoins(event);

  if (!bestCoins.length) {
    console.log(chalk.yellow("Нет подходящих монет для покупки"));
    return;
  }

  for (const [index, coin] of bestCoins.entries()) {
    console.log(index, getAvailableSlots());
    if (getAvailableSlots() <= index) {
      console.log(chalk.yellow("Лимит на покупку монет превышен"), coin.symbol);
      return;
    }

    if (hasPosition(coin.symbol) || hasOrder(coin.symbol)) {
      console.log(
        chalk.yellow(
          `Монета ${coin.symbol} уже есть в реестре заказов или позициях`
        )
      );
      continue;
    }

    const active = chooseBestCoin([coin]);
    if (active) {
      await executeCoinPurchaseOrder({
        ...getCoinPriceBySymbol(coin.symbol),
        ...active,
      });
    }
  }
};

// Выполнение ордера на покупку монеты
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
      chalk.yellow("Объём закупок не удовлетворяет требованиям"),
      active.symbol
    );
    return;
  }

  await createRecursiveOrder({ active, amounts, prices, index: 0 });
};

const stopPosition = async (ticker: Ticker) => {
  const stopOrder = getStopOrderBySymbol(ticker?.symbol);
  const currentPriceStr = ticker?.[SETTINGS.FIELD];

  if (!stopOrder || typeof currentPriceStr !== "string") return;

  if (stopOrder.loading) {
    console.log(chalk.yellow("Идёт процесс закрытия позиции по стоп лоссу"));
    return;
  }

  const currentPrice = parseFloat(currentPriceStr);

  if (isNaN(currentPrice)) return;

  const isTriggerConditionMet =
    stopOrder.side === "Buy"
      ? currentPrice <= stopOrder.stopPrice
      : currentPrice >= stopOrder.stopPrice;

  if (isTriggerConditionMet) {
    stopOrder.loading = true;
    const result = await closePosition(stopOrder);

    if (result?.retMsg === "OK") {
      console.log(
        chalk.green(`Позиция: ${stopOrder.symbol} закрыто по стоп-лосу`)
      );
      removeSlidingStopOrder(stopOrder.symbol);
    } else {
      console.error(`Ошибка закрытия позиции по стоп-лосу: ${result?.retMsg}`);
      stopOrder.loading = false;
    }
  }
};
