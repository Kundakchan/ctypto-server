import { client } from "../client";
import type { Symbol } from "../coins/symbols";

export interface CreateOrderParams {
  symbol: Symbol;
  side: "Buy" | "Sell";
  amount: number;
}

export function createOrder({ symbol, side, amount }: CreateOrderParams) {
  return client
    .submitOrder({
      category: "linear",
      symbol: symbol,
      side: side,
      qty: amount.toString(),
      orderType: "Market",
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
