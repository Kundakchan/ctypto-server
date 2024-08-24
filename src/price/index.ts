const socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");
import type { Symbol } from "../coins/symbols";

export interface PriceCoins
  extends Partial<Record<Symbol, { symbol: Symbol; price: number }>> {}

export const priceCoins: PriceCoins = {};

export function subscribePriceCoin(symbols: Symbol[]) {
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
    if (coin?.indexPrice) {
      priceCoins[coin.symbol as Symbol] = {
        symbol: coin.symbol as Symbol,
        price: Number(coin.indexPrice),
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
