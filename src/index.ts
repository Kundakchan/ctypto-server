import {
  cancelAllOrdersOfClosedPosition,
  getOrdersSymbol,
  hasOrder,
  setTimerClearOrder,
  watchOrders,
} from "./order";
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
  setSlidingStopOrder,
  setTakeProfit,
  stopPosition,
} from "./trading";
import {
  watchPositionsInterval,
  hasPosition,
  watchPositions,
  setTimerForSuccessfulClosingPosition,
  updateTimerForSuccessfulClosingPosition,
  getPositionSymbol,
} from "./position";

export type Side = "Buy" | "Sell";

export interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}

export const SETTINGS = {
  TIME_CHECK_PRICE: 1000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 0.5, // Процент разницы между ценами (%)
  TIMER_ORDER_CANCEL: 1, // Время отмены ордеров если он не выполнился (мин)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 5, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.05, // Минимальный процент изменения цены относительно прошлого (%)
  FIELD: "lastPrice", // Поле, содержащее цену монеты
  NUMBER_OF_POSITIONS: 1, // Количество закупаемых монет (шт)
  NUMBER_OF_ORDERS: 5, // Количество создаваемых ордеров для каждой монеты (шт)
  PRICE_DIFFERENCE_MULTIPLIER: 250, // На сколько процентов будет увеличен процент разницы между ценами (%)
  STOP_LOSS: 1, // Процент от наилучшей цены позиции для установки стоп лосса после выполнения последнего ордера на закупку позиции
  TAKE_PROFIT_GAP: 0.3, // Процент от наилучшей цены позиции (%)
  TAKE_PROFIT_TRIGGER_PNL: 6, // Нереализованные pnl после которого будет установлен take profit (%)
  SUCCESS_CLOSED_POSITION_PNL: 4, //
  TIME_SUCCESS_CLOSED_POSITION: 10, //
} as const;

// Наблюдение за изменениями в кошельке
watchWallet({ afterFilled: () => {} });

// Наблюдение за ордерами и установка таймеров для их очистки
watchOrders({
  afterFilled: (orders) => {
    orders.forEach(setTimerClearOrder);
  },
  beforeFilled: (orders) => {
    cancelAllOrdersOfClosedPosition(orders);
  },
});

// Наблюдение за позициями
watchPositions({
  afterFilled: (positions) => {},
});

// Периодическая проверка позиций и закрытие успешных
watchPositionsInterval({
  afterFilled: (positions) => {
    setSlidingStopOrder(positions);
    setTakeProfit(positions);

    setTimerForSuccessfulClosingPosition(positions);
    updateTimerForSuccessfulClosingPosition(positions);
  },
});

// Получение монет и запуск наблюдателя за ценами
fetchCoins().then(() => {
  watchTicker((ticker) => {
    setTickerToMatrix(ticker);
    stopPosition(ticker);
  });
  watchPrice(handlePriceEvent);
});

// Обработка событий изменения цен для обработки возможных покупок монет
const handlePriceEvent = async (event: any) => {
  const bestCoins = getBestCoins(event);

  if (!bestCoins.length) {
    console.log(chalk.yellow("Нет подходящих монет для покупки"));
    return;
  }

  for (const [index, coin] of bestCoins.entries()) {
    if (getAvailableSlots() <= index) {
      console.log({
        positions: getPositionSymbol(),
        orders: getOrdersSymbol(),
      });
      console.log(chalk.yellow("Лимит на покупку монет превышен"), coin.symbol);
      continue;
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
