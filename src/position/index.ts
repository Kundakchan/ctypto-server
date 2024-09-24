import { PositionV5 } from "bybit-api";
import { ws, setHandlerWS, client } from "../client";
import type { Symbol } from "../coins/symbols";
import chalk from "chalk";
import { SETTINGS } from "..";
import { createOrder, getStopOrderBySymbol } from "../trading";
import { calculateMarkupPrice } from "../utils";
import { addCreatedOrderStatus } from "../order";
import { getCoinPriceBySymbol } from "../price";

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
  }, 300);
};

const isPositionPnL = (position: Position, pnl: number) => {
  const { avgPrice, size, unrealisedPnl } = position;
  const pnlAsPercent =
    (parseFloat(unrealisedPnl) /
      ((parseFloat(size) * parseFloat(avgPrice)) / SETTINGS.LEVERAGE)) *
    100;
  return pnlAsPercent >= pnl;
};

interface TimerForSuccessfulClosingPosition
  extends Partial<Record<Symbol, ReturnType<typeof setTimeout>>> {}
const timerForSuccessfulClosingPosition: TimerForSuccessfulClosingPosition = {};

const setTimerForSuccessfulClosingPosition = (positions: Position[]) => {
  positions.forEach((position) => {
    if (timerForSuccessfulClosingPosition[position.symbol]) return;

    timerForSuccessfulClosingPosition[position.symbol] = setTimeout(() => {
      if (getStopOrderBySymbol(position.symbol)) return;

      setOrderForSuccessfulClosingPosition(position);
    }, 1 * 60000); // TODO: Вынести время в константу
  });
};

const setOrderForSuccessfulClosingPosition = async (position: Position) => {
  const price = calculateMarkupPrice({
    avgPrice: parseFloat(position.avgPrice),
    leverage: parseFloat(position.leverage ?? SETTINGS.LEVERAGE.toString()),
    side: position.side,
    pnl: 2, // TODO: Вынести pnl в константу
  });

  const result = await createOrder({
    symbol: position.symbol,
    side: position.side === "Buy" ? "Sell" : "Buy",
    amount: parseFloat(position.size),
    price: price,
    timeInForce: "GTC",
  });

  // Проверяем результат
  if (!result || result.retMsg !== "OK") {
    console.error(
      chalk.red(
        `Ошибка создания ордера на закрытия позиции ${position.symbol}: ${
          result?.retMsg || "Неизвестная ошибка"
        }`
      )
    );
    return;
  }

  console.log(
    chalk.green(`Ордер на закрытия позиции ${position.symbol} успешно создан`)
  );

  addCreatedOrderStatus({
    id: result.result.orderId,
    symbol: position.symbol,
    status: "cancel",
  });
};

export {
  setTimerForSuccessfulClosingPosition,
  watchPositions,
  hasPosition,
  getPositions,
  watchPositionsInterval,
  getPositionSymbol,
  isPositionPnL,
  findPositionBySymbol,
};
