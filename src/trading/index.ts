import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import type { Side } from "..";
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

export const setTrailingStopOrder = async ({
  symbol,
  trailingStopSum,
}: {
  symbol: Symbol;
  trailingStopSum: number;
}) => {
  try {
    const data = await client.setTradingStop({
      category: "linear",
      symbol: symbol,
      trailingStop: trailingStopSum.toString(),
      positionIdx: 0,
    });
    return data;
  } catch (error) {
    console.error("Ошибка при установке скользящего стоп-ордера:", error);
  }
};

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
