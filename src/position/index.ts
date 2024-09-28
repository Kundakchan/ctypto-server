import { PositionV5 } from "bybit-api";
import { ws, setHandlerWS, client } from "../client";
import type { Symbol } from "../coins/symbols";
import chalk from "chalk";
import { SETTINGS } from "..";
import { createOrder, getStopOrderBySymbol } from "../trading";
import { calculateMarkupPrice } from "../utils";
import { addCreatedOrderStatus, getOrders } from "../order";

export interface Position extends PositionV5 {
  symbol: Symbol;
  loading: boolean;
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

    removeTimerForSuccessfulClosingPosition(position.symbol);
    timerForSuccessfulClosingPosition[position.symbol] = setTimeout(
      async () => {
        if (getStopOrderBySymbol(position.symbol)) return;
        if (position.loading) return;
        position.loading = true;
        await setOrderForSuccessfulClosingPosition(position);
        position.loading = false;
      },
      SETTINGS.TIME_SUCCESS_CLOSED_POSITION * 60000
    );
  });
};

const removeTimerForSuccessfulClosingPosition = (symbol: Symbol) => {
  clearTimeout(timerForSuccessfulClosingPosition[symbol]);
  delete timerForSuccessfulClosingPosition[symbol];
};

const setOrderForSuccessfulClosingPosition = async (position: Position) => {
  const price = calculateMarkupPrice({
    avgPrice: parseFloat(position.avgPrice),
    leverage: parseFloat(position.leverage ?? SETTINGS.LEVERAGE.toString()),
    side: position.side,
    pnl: SETTINGS.SUCCESS_CLOSED_POSITION_PNL,
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

const updateTimerForSuccessfulClosingPosition = async (
  positions: Position[]
) => {
  for (const position of positions) {
    const order = getOrders("symbol", position.symbol).find(
      (item) => item.status === "cancel"
    );

    if (!order?.price) continue;

    const price = calculateMarkupPrice({
      avgPrice: parseFloat(position.avgPrice),
      leverage: parseFloat(position.leverage ?? SETTINGS.LEVERAGE.toString()),
      side: position.side,
      pnl: SETTINGS.SUCCESS_CLOSED_POSITION_PNL,
    });

    // const test =
    //   order.side === "Buy"
    //     ? price < parseFloat(order.price)
    //     : price > parseFloat(order.price);

    // if (test) continue;

    // console.log(price, parseFloat(order.price));

    const result = await client.amendOrder({
      category: "linear",
      symbol: position.symbol,
      orderId: order.orderId,
      qty: position.size,
      price: price.toString(),
    });

    if (!result || result.retMsg !== "OK") {
      // console.error(
      //   chalk.red(
      //     `Ошибка обновления ордера на закрытия позиции ${position.symbol}: ${
      //       result?.retMsg || "Неизвестная ошибка"
      //     }`
      //   )
      // );
      continue;
    }

    console.log(
      chalk.green(
        `Ордер на закрытия позиции ${position.symbol} успешно обновлён`
      )
    );
  }
};

export {
  removeTimerForSuccessfulClosingPosition,
  updateTimerForSuccessfulClosingPosition,
  setTimerForSuccessfulClosingPosition,
  watchPositions,
  hasPosition,
  getPositions,
  watchPositionsInterval,
  getPositionSymbol,
  isPositionPnL,
  findPositionBySymbol,
};
