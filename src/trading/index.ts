import { client } from "../client";
import type { Symbol } from "../coins/symbols";
// getPositionInfo Активный ордер

export interface CreateOrderParams {
  symbol: Symbol;
  side: "Buy" | "Sell";
  amount: number;
  tp: number;
  sl: number;
}

export function createOrder({
  symbol,
  side,
  amount,
  tp,
  sl,
}: CreateOrderParams) {
  console.log({
    symbol,
    side,
    amount,
    tp,
    sl,
  });
  return client
    .submitOrder({
      category: "linear",
      symbol: symbol,
      side: side,
      qty: amount.toString(),
      orderType: "Market",
      takeProfit: tp.toString(), // Уровень тейк-профита
      stopLoss: sl.toString(), // Уровень стоп-лосса
      // tpslMode: "Partial", // Режим TP/SL
    })
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("getAccountInfo error: ", err);
    });
}
