import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";
interface Position extends Record<Symbol, Record<string, unknown>> {}

const position: Partial<Position> = {};

function checkOpenPosition(symbol: Symbol) {
  return position[symbol] ? true : false;
}

interface WatchPositionParams {
  afterOpening?: (order: Record<string, number | string>) => void;
}

function watchPosition({ afterOpening }: WatchPositionParams) {
  setHandlerWS({
    topic: "position",
    handler: (message) => {
      const coin = message.data[0];
      if (position[coin.symbol as Symbol]) {
        delete position[coin.symbol as Symbol];
      } else {
        position[coin.symbol as Symbol] = coin;
        if (afterOpening) {
          afterOpening(coin);
        }
      }
    },
  });

  ws.subscribeV5("position", "linear");
}

export { watchPosition, checkOpenPosition };
