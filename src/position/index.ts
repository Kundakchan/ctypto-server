import { PositionV5 } from "bybit-api";
import { ws, setHandlerWS, client } from "../client";
import type { Symbol } from "../coins/symbols";
import chalk from "chalk";
import { SETTINGS } from "..";

export interface Position extends PositionV5 {
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
const getPositionSymbol = () =>
  getPositions().map((position) => position.symbol);
const getPositions = () => positions;

const fetchPosition = async () => {
  try {
    const result = await client.getPositionInfo({
      category: "linear",
      settleCoin: "USDT",
    });

    if (result.retMsg !== "OK") {
      console.log(chalk.red(`Ошибка получения позиции: ${result.retMsg}`));
    }

    return result.result.list;
  } catch (error) {
    console.error("Error: fetchPosition", error);
  }
};

interface WatchPositionsIntervalParams extends WatchPositionsParams {}
const watchPositionsInterval = (params: WatchPositionsIntervalParams) => {
  setTimeout(async () => {
    const list = await fetchPosition();
    if (list) {
      list.forEach((position) => {
        setPosition(position as Position);
      });

      const { afterFilled } = params;

      if (afterFilled) {
        afterFilled(positions);
      }
    }

    watchPositionsInterval(params);
  }, 500);
};

const isPositionPnL = (position: Position, pnl: number) => {
  const { avgPrice, size, unrealisedPnl } = position;
  const pnlAsPercent =
    (parseFloat(unrealisedPnl) /
      ((parseFloat(size) * parseFloat(avgPrice)) / SETTINGS.LEVERAGE)) *
    100;
  return pnlAsPercent >= pnl;
};

export {
  watchPositions,
  hasPosition,
  getPositions,
  watchPositionsInterval,
  getPositionSymbol,
  isPositionPnL,
};
