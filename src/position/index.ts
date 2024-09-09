import { PositionV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";

interface Position extends PositionV5 {
  symbol: Symbol;
}
let positions: Position[] = [];

interface WatchPositionsParams {
  afterFilled?: (params: Position[]) => void;
}
function watchPositions(params: WatchPositionsParams) {
  setHandlerWS({
    topic: "position",
    handler: (message) => {
      const data = message.data as unknown as Position[];
      data.forEach((position) => {
        if (position.side) {
          setPosition(position);
        } else {
          removePosition(position);
        }
      });
      const { afterFilled } = params;
      if (afterFilled) afterFilled(data);
    },
  });

  ws.subscribeV5("position", "linear");
}

interface ActionPosition {
  (params: Position): void;
}

const setPosition: ActionPosition = (params) => {
  const index = positions.findIndex(
    (position) => position.symbol === params.symbol
  );
  if (index === -1) {
    positions.push(params);
  } else {
    positions[index] = params;
  }
};

const removePosition: ActionPosition = (params) => {
  positions = positions.filter((position) => position.symbol !== params.symbol);
};

const findPositionBySymbol = (symbol: Symbol) => {
  return positions.find((position) => position.symbol === symbol);
};

const hasPosition = (symbol: Symbol) => !!findPositionBySymbol(symbol);
const getPositionsCount = () => positions.length;

export { watchPositions, hasPosition, getPositionsCount };
