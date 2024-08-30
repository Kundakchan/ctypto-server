import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";

interface Positions
  extends Partial<Record<Symbol, Record<string, string | number>>> {}

const positions: Positions = {};

interface WatchPositionParams {
  afterOpening?: (order: Record<string, number | string>) => void;
}

function watchPosition({ afterOpening }: WatchPositionParams) {
  setHandlerWS({
    topic: "position",
    handler: (message) => {
      message.data.forEach((record) => {
        if (positions[record.symbol as Symbol]) {
          delete positions[record.symbol as Symbol];
        } else {
          positions[record.symbol as Symbol] = record;
          if (afterOpening) {
            afterOpening(record);
          }
        }
      });
    },
  });

  ws.subscribeV5("position", "linear");
}

const getPositionBySymbol = (symbol: Symbol) => positions[symbol];
const checkOpenPosition = (symbol: Symbol) => !!getPositionBySymbol(symbol);

const getPositionList = () => Object.keys(positions);

export { watchPosition, checkOpenPosition, getPositionList };
