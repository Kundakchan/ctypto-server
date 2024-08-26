const socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");
import type { Symbol } from "../coins/symbols";

export interface CoinData {
  symbol: Symbol;
  price: number;
}

export interface PriceCoins extends Partial<Record<Symbol, CoinData>> {}
export type PriceType = "indexPrice" | "lastPrice";

export const priceCoins: PriceCoins = {};

export function subscribePriceCoin(symbols: Symbol[], priceType: PriceType) {
  const args = symbols.map((symbol) => `tickers.${symbol}`);
  const subscribeMessage = {
    op: "subscribe",
    args: args,
  };

  socket.onopen = function (e) {
    socket.send(JSON.stringify(subscribeMessage));
  };

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    const coin = data?.data;
    if (coin?.[priceType]) {
      priceCoins[coin.symbol as Symbol] = {
        symbol: coin.symbol as Symbol,
        price: Number(coin[priceType]),
      };
    }
  };

  socket.onclose = function (event) {
    console.log("close", event);
  };

  socket.onerror = function (error) {
    console.log("error", error);
  };
}

export interface WatchPriceCoinHandler {
  (priceCoins: PriceCoins): void;
}

export function watchPriceCoin({
  time = 1000,
  handler,
}: {
  time?: number;
  handler: WatchPriceCoinHandler;
}) {
  setTimeout(() => {
    watchPriceCoin({ time, handler });
    handler(priceCoins);
  }, time);
}
