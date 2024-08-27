import { ws, client } from "../client";
import type { Symbol } from "../coins/symbols";
interface Position extends Record<Symbol, Record<string, unknown>> {}

const position: Partial<Position> = {};

ws.on("update", (message) => {
  const coin = message.data[0];
  if (position[coin.symbol as Symbol]) {
    delete position[coin.symbol as Symbol];
  } else {
    position[coin.symbol as Symbol] = coin;
  }
});

function checkOpenPosition(symbol: Symbol) {
  return position[symbol] ? true : false;
}

function watchPosition() {
  ws.subscribeV5("position", "linear");
}

export { watchPosition, checkOpenPosition };
