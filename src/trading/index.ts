import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import { SETTINGS, type Side } from "..";
import { PositionV5 } from "bybit-api";
import { getPositions, getPositionSymbol } from "../position";
import { getOrders, getOrdersSymbol } from "../order";
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

export const closePosition = async (position: PositionV5) => {
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
