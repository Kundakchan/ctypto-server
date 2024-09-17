import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import { BuyCoinParams, SETTINGS, type Side } from "..";
import {
  getPositions,
  getPositionSymbol,
  isPositionPnL,
  Position,
} from "../position";
import { getOrders, getOrdersSymbol } from "../order";
import chalk from "chalk";
import { getCoinPriceBySymbol } from "../price";
import { calculatePercentage } from "../utils";

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
}

export function createOrder({
  symbol,
  side,
  amount,
  price,
}: CreateOrderParams) {
  return client
    .submitOrder({
      category: "linear",
      symbol: symbol,
      side: side,
      qty: amount.toString(),
      price: price.toString(),
      orderType: "Limit",
      timeInForce: "PostOnly",
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
          await cancelOrder({ symbol: order.symbol, orderId: order.orderId }); // Отменяем заказ
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

export const positionSuccessClose = async (positions: Position[]) => {
  for (const position of positions) {
    if (isPositionPnL(position, SETTINGS.UNREALIZED_PNL)) {
      await closePosition(position);

      const orders = await getOrders("symbol", position.symbol);
      for (const order of orders) {
        await cancelOrder({ symbol: order.symbol, orderId: order.orderId });
      }
    }
  }
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

    // Рекурсивный вызов через 300 мс
    setTimeout(() => {
      createRecursiveOrder({ active, amounts, prices, index: index + 1 });
    }, 300);
  } catch (error) {
    console.error(chalk.red("Ошибка при создании ордера"), error);
  }
};

const setSlidingStopOrder = async (positions: Position[]) => {
  for (const position of positions) {
    const orders = getOrders("symbol", position.symbol).filter(
      (order) => order.side === position.side
    );

    if (orders.length) continue;

    const currentPrice = getCoinPriceBySymbol(position.symbol)?.[
      SETTINGS.FIELD
    ];

    if (!currentPrice) continue;

    const parsedCurrentPrice = parseFloat(currentPrice);
    const stopPriceOffset = calculatePercentage({
      target: parsedCurrentPrice,
      percent: SETTINGS.STOP_LOSS,
    });

    const newStopPrice =
      position.side === "Buy"
        ? parsedCurrentPrice - stopPriceOffset
        : parsedCurrentPrice + stopPriceOffset;

    if (stopOrderCollection[position.symbol]) {
      const existingStopPrice = (
        stopOrderCollection[position.symbol] as StopOrderCollectionPosition
      ).stopPrice;

      if (existingStopPrice - newStopPrice > 0) {
        console.log(`${position.symbol}: обновление стоп лосса`, newStopPrice);
        stopOrderCollection[position.symbol] = {
          ...position,
          stopPrice: newStopPrice,
          loading: false,
        };
      }
    } else {
      console.log(`${position.symbol}: добавление стоп лосса`, newStopPrice);
      stopOrderCollection[position.symbol] = {
        ...position,
        stopPrice: newStopPrice,
        loading: false,
      };
    }
  }
};

const getStopOrderBySymbol = (symbol: Symbol) => stopOrderCollection[symbol];

const removeSlidingStopOrder = (symbol: Symbol) =>
  delete stopOrderCollection[symbol];

export { setSlidingStopOrder, getStopOrderBySymbol, removeSlidingStopOrder };
