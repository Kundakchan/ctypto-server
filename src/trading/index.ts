import { client } from "../client";
import type { Symbol } from "../coins/symbols";
// getPositionInfo Активный ордер

export interface CreateOrderParams {
  symbol: Symbol;
  side: "Buy" | "Sell";
  amount: number;
  price?: number;
  tp: number;
  sl: number;
}

export function createOrder({
  symbol,
  side,
  amount,
  price,
  tp,
  sl,
}: CreateOrderParams) {
  return client
    .submitOrder({
      category: "linear",
      symbol: symbol,
      side: side,
      qty: amount.toString(),
      orderType: "Market",
      // price: price.toString(),
      timeInForce: "PostOnly",
      takeProfit: tp.toString(), // Уровень тейк-профита
      stopLoss: sl.toString(), // Уровень стоп-лосса
    })
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("order submit error: ", err);
    });
}
