import { client } from "../client";
import { type Symbol } from "../coins/symbols";
import { BuyCoinParams, SETTINGS, type Side } from "..";
import {
  getPositions,
  getPositionSymbol,
  isPositionPnL,
  Position,
  removeTimerForSuccessfulClosingPosition,
} from "../position";
import { addCreatedOrderStatus, getOrders, getOrdersSymbol } from "../order";
import chalk from "chalk";
import { getCoinPriceBySymbol } from "../price";
import { calculatePercentage } from "../utils";
import { OrderTimeInForceV5 } from "bybit-api";
import { Ticker } from "../ticker";

interface StopOrderCollectionPosition extends Position {
  stopPrice: number;
  loading: boolean;
}
interface StopOrderCollection
  extends Partial<Record<Symbol, StopOrderCollectionPosition>> {}
const stopOrderCollection: StopOrderCollection = {};

export interface CreateOrderParams {
  symbol: Symbol;
  side: Side;
  amount: number;
  price: number;
  timeInForce?: OrderTimeInForceV5;
}

export function createOrder({
  symbol,
  side,
  amount,
  price,
  timeInForce = "PostOnly",
}: CreateOrderParams) {
  return client
    .submitOrder({
      category: "linear",
      symbol: symbol,
      side: side,
      qty: amount.toString(),
      price: price.toString(),
      orderType: "Limit",
      timeInForce: timeInForce,
    })
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("order submit error: ", err);
    });
}

export const cancelOrder = async ({
  symbol,
  orderId,
}: {
  symbol: Symbol;
  orderId: string;
}) => {
  try {
    const result = await client.cancelOrder({
      category: "linear",
      symbol: symbol,
      orderId: orderId,
    });
    console.warn("Ордер отменён");
    console.table(result);
    return result;
  } catch (error) {
    console.error(error);
  }
};

export const closePosition = async (position: Position) => {
  try {
    const result = await client.submitOrder({
      category: "linear",
      orderType: "Market",
      qty: position.size,
      side: position.side === "Buy" ? "Sell" : "Buy",
      symbol: position.symbol,
    });
    if (result.retMsg !== "OK") {
      console.error("Ошибка закрытия позиции");
      console.table(result);
    }
    return result;
  } catch (error) {
    console.error(error);
  }
};

export const closeAllPosition = async () => {
  try {
    const positions = await getPositions(); // Получаем позиции

    for (const position of positions) {
      const result = await closePosition(position); // Закрываем позицию

      if (result) {
        // Проверяем, успешно ли закрыта позиция
        const orders = await getOrders("symbol", position.symbol); // Получаем заказы

        for (const order of orders) {
          await cancelOrder({
            symbol: order.symbol,
            orderId: order.orderId as string,
          }); // Отменяем заказ
        }
      }
    }
  } catch (error) {
    console.error("Ошибка закрытия всех позиций", error);
  }
};

export const getAvailableSlots = () => {
  const position = getPositionSymbol();
  const orders = getOrdersSymbol();
  const positionAndOrders = [...new Set([...position, ...orders])];
  return SETTINGS.NUMBER_OF_POSITIONS - positionAndOrders.length;
};

export const createRecursiveOrder = async ({
  active,
  amounts,
  prices,
  index = 0,
}: {
  active: BuyCoinParams;
  amounts: number[];
  prices: number[];
  index?: number;
}) => {
  // Завершаем рекурсию, если достигнуто максимальное количество ордеров
  if (index >= SETTINGS.NUMBER_OF_ORDERS) {
    console.log(chalk.green(`Все ордера ${active.symbol} успешно созданы`));
    return;
  }

  try {
    // Создаём ордер
    const result = await createOrder({
      symbol: active.symbol,
      side: active.position,
      amount: amounts[index],
      price: prices[index],
      timeInForce: "GTC",
    });

    // Проверяем результат
    if (!result || result.retMsg !== "OK") {
      console.error(
        chalk.red(
          `Ошибка создания ордера ${active.symbol}: ${
            result?.retMsg || "Неизвестная ошибка"
          }`
        )
      );
      return;
    }

    console.log(
      chalk.green(`Ордер ${active.symbol} успешно создан, index: ${index}`)
    );
    console.table(result.result);

    addCreatedOrderStatus({
      id: result.result.orderId,
      symbol: active.symbol,
      status: "open",
    });

    // Рекурсивный вызов через 300 мс
    setTimeout(() => {
      createRecursiveOrder({ active, amounts, prices, index: index + 1 });
    }, 300);
  } catch (error) {
    console.error(chalk.red("Ошибка при создании ордера"), error);
  }
};

const setSlidingStopOrder = async (positions: Position[]) => {
  // Проходим по каждой позиции
  positions.forEach((position) => {
    // Проверяем, есть ли активные ордера по символу и стороне (Buy/Sell)
    const existingOrders = getOrders("symbol", position.symbol).some(
      (order) => order.side === position.side
    );
    // Если есть активные ордера, пропускаем эту позицию
    if (existingOrders) return;

    // Получаем текущую цену актива по символу
    const currentPrice = parseFloat(
      getCoinPriceBySymbol(position.symbol)?.[SETTINGS.FIELD] || ""
    );
    // Если цена не найдена, пропускаем эту позицию
    if (!currentPrice) return;

    // Рассчитываем значение стоп-лосса как процент от текущей цены
    const stopPriceOffset = calculatePercentage({
      target: currentPrice,
      percent: SETTINGS.STOP_LOSS,
    });

    // Вычисляем новую цену для стоп-лосса в зависимости от направления позиции (покупка или продажа)
    const newStopPrice =
      position.side === "Buy"
        ? currentPrice - stopPriceOffset // Для покупки уменьшаем цену
        : currentPrice + stopPriceOffset; // Для продажи увеличиваем цену

    // Получаем существующую стоп-лосс цену для символа из коллекции (если она есть)
    const existingStop = stopOrderCollection[
      position.symbol
    ] as StopOrderCollectionPosition;

    // Определяем, нужно ли обновить стоп-лосс
    const shouldUpdate =
      position.side === "Buy"
        ? newStopPrice > existingStop?.stopPrice // Для покупки обновляем, если новая цена больше
        : newStopPrice < existingStop?.stopPrice; // Для продажи обновляем, если новая цена меньше

    if (existingStop && shouldUpdate) {
      // Если стоп-лосс уже есть и его нужно обновить
      console.log(`${position.symbol}: обновление стоп лосса`, newStopPrice);
      stopOrderCollection[position.symbol] = {
        ...position,
        stopPrice: newStopPrice,
        loading: false,
      };
    } else if (!existingStop) {
      // Если стоп-лосса для позиции еще нет, создаем новый
      console.log(`${position.symbol}: добавление стоп лосса`, newStopPrice);
      stopOrderCollection[position.symbol] = {
        ...position,
        stopPrice: newStopPrice,
        loading: false,
      };
    }
  });
};

const getStopOrderBySymbol = (symbol: Symbol) => stopOrderCollection[symbol];

const removeSlidingStopOrder = (symbol: Symbol) =>
  delete stopOrderCollection[symbol];

const setTakeProfit = async (positions: Position[]) => {
  // Проходим по каждой позиции
  positions.forEach((position) => {
    // Проверяем, достиг ли PnL значения, чтобы сработал триггер тейк-профита
    if (!isPositionPnL(position, SETTINGS.TAKE_PROFIT_TRIGGER_PNL)) return;

    // Получаем текущую цену актива по символу
    const currentPrice = parseFloat(
      getCoinPriceBySymbol(position.symbol)?.[SETTINGS.FIELD] || ""
    );
    // Если цена не найдена, пропускаем эту позицию
    if (!currentPrice) return;

    // Рассчитываем значение тейк-профита как процент от текущей цены
    const takeProfitPriceOffset = calculatePercentage({
      target: currentPrice,
      percent: SETTINGS.TAKE_PROFIT_GAP,
    });

    // Вычисляем новую цену для тейк-профита в зависимости от направления позиции (покупка или продажа)
    const newTakeProfitPrice =
      position.side === "Buy"
        ? currentPrice - takeProfitPriceOffset // Для покупки увеличиваем цену
        : currentPrice + takeProfitPriceOffset; // Для продажи уменьшаем цену

    // Получаем существующую тейк-профит цену для символа из коллекции (если она есть)
    const existingStop = stopOrderCollection[
      position.symbol
    ] as StopOrderCollectionPosition;

    // Определяем, нужно ли обновить тейк-профит
    const shouldUpdate =
      position.side === "Buy"
        ? newTakeProfitPrice > existingStop?.stopPrice // Для покупки обновляем, если новая цена меньше
        : newTakeProfitPrice < existingStop?.stopPrice; // Для продажи обновляем, если новая цена больше

    if (existingStop && shouldUpdate) {
      // Если тейк-профит уже есть и его нужно обновить
      console.log(
        `${position.symbol}: обновление тейк-профита`,
        newTakeProfitPrice
      );
      stopOrderCollection[position.symbol] = {
        ...position,
        stopPrice: newTakeProfitPrice,
        loading: false,
      };
    } else if (!existingStop) {
      // Если тейк-профита для позиции еще нет, создаем новый
      console.log(
        `${position.symbol}: добавление тейк-профита`,
        newTakeProfitPrice
      );
      stopOrderCollection[position.symbol] = {
        ...position,
        stopPrice: newTakeProfitPrice,
        loading: false,
      };
    }
  });
};

interface PositionClosingByTimer
  extends Partial<Record<Symbol, ReturnType<typeof setTimeout>>> {}
const positionClosingByTimer: PositionClosingByTimer = {};

interface UpdateOrder {
  (params: {
    symbol: Symbol;
    orderId: string;
    qty: number;
    price: number;
  }): ReturnType<typeof client.amendOrder>;
}
const updateOrder: UpdateOrder = async ({ symbol, orderId, qty, price }) => {
  return await client.amendOrder({
    category: "linear",
    symbol: symbol,
    orderId: orderId,
    qty: qty.toString(),
    price: price.toString(),
  });
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

    const orders = getOrders("symbol", stopOrder.symbol);

    removeTimerForSuccessfulClosingPosition(stopOrder.symbol);
    for (const order of orders) {
      await cancelOrder({
        symbol: order.symbol,
        orderId: order.orderId as string,
      });
    }

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

export {
  updateOrder,
  setSlidingStopOrder,
  getStopOrderBySymbol,
  removeSlidingStopOrder,
  setTakeProfit,
  stopPosition,
};
