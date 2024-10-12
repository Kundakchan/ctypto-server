const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");
import type { Symbol } from "../coins/symbols";
import { getCoinsKey } from "../coins";

import type { TickerLinearInverseV5 } from "bybit-api";

export interface Ticker extends Partial<TickerLinearInverseV5> {
  symbol: Symbol;
}

const getWSParams = () => {
  try {
    const args = getCoinsKey().map((symbol) => `tickers.${symbol}`);
    const subscribe = {
      op: "subscribe",
      args: args,
    };
    return JSON.stringify(subscribe);
  } catch (error) {
    console.error(new Error("НЕ УДАЛОСЬ ПОЛУЧИТЬ ПАРАМЕТРЫ СОЕДИНЕНИЯ"));
    throw error;
  }
};

ws.onopen = () => {
  console.warn("Соединение ws tickers открыто!");
  ws.send(getWSParams());
  // Send subscription parameters once the connection is open
};

ws.onclose = () => {
  console.error("Соединение ws tickers закрыто!");
};

ws.onerror = (error: any) => {
  console.error("Ошибка Соединение ws tickers ", error);
};

interface WatchTickerAfterUpdate {
  (params: Ticker): void;
}

interface WatchTicker {
  (params: WatchTickerAfterUpdate): void;
}

const watchTicker: WatchTicker = (afterUpdate) => {
  ws.onmessage = (event: any) => {
    const data = JSON.parse(event.data).data as Ticker;
    afterUpdate(data);
  };
};

// Export the watchTicker function
export { watchTicker };
