import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import type { Side } from "..";
import { PositionV5 } from "bybit-api";
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
  console.log({
    symbol,
    side,
    amount,
    price,
  });
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
    // console.warn("Ордер отменён");
    // console.table(result);
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
