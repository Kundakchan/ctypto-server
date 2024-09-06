import { Symbol } from "./coins/symbols";
import { closePosition, createOrder, setTrailingStopOrder } from "./trading";
import {
  watchOrders,
  checkNewOrder,
  getOrdersActiveLength,
  Order,
  getOrderFilled,
} from "./order";
import {
  calculatePercentage,
  getAmount,
  getLimitPrice,
  getSide,
} from "./utils";
import { getWallet, watchWallet } from "./wallet";
import { logger } from "./utils";
import { getPosition } from "./position";
export type Side = "Buy" | "Sell";

export enum SIDE {
  long = "Buy",
  short = "Sell",
}

import { fetchCoins, getCoinsKey } from "./tokens";
import { watchTicker } from "./ticker";
import {
  watchPrice,
  setTickerToMatrix,
  hasConsistentChange,
  MatrixChanges,
  getCoinPriceBySymbol,
} from "./pice";
import chalk from "chalk";

export const SETTINGS = {
  TIME_CHECK_PRICE: 60000, // Время обновления проверки цены на все монеты (мс)
  DIVERSIFICATION_COUNT: 10, // Количество закупаемых монет (шт)
  LIMIT_ORDER_PRICE_VARIATION: 0.002, // Процент отката цены для лимитной закупки (%)
  TRAILING_STOP: 0.5, // Скользящий стоп-ордер (%)
  TIMER_ORDER_CANCEL: 120000, // Время отмены ордера если он не выполнился (мс)
  STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  TIMER_POSITION_CLEAR: 30, // Время закрытия позиции если отсутствует рост PnL (минуты)
  INCREASING_PNL: 3, // Процент увелечения PnL для избежания закрытия позиции
  HISTORY_CHANGES_SIZE: 5, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.2, // Минимальный процент изменения цены относительно прошлой (%)
} as const;

watchWallet();
watchOrders({
  afterFilled: (order) => {
    setStopOrder(order);
    setClearTimer(order);
  },
});

fetchCoins().then(() => {
  watchTicker(setTickerToMatrix);
  watchPrice((event) => {
    const bestCoins = getBestCoins(event);
    if (!bestCoins.length) {
      console.log(chalk.yellow("Нет подходящих монет для покупки"));
      return;
    }

    const { totalAvailableBalance } = getWallet();
    const divider = SETTINGS.DIVERSIFICATION_COUNT - getOrdersActiveLength();
    const balance = Number(totalAvailableBalance) / (divider ? divider : 1);

    bestCoins.forEach(async (coin) => {
      const bestCoin = getCoinPriceBySymbol(coin.symbol);
      const changes = coin.historyChanges.at(coin.historyChanges.length - 1);

      if (!bestCoin || !bestCoin.lastPrice || !changes) {
        console.log(chalk.red(`${coin.symbol} - Нет данных`));
        console.log({
          changes,
          bestCoin,
        });
        return;
      }

      if (checkNewOrder(bestCoin.symbol)) {
        console.log(
          chalk.yellow(
            `${bestCoin.symbol} - Монета уже существует в реестре ордеров`
          )
        );
        return;
      }
      if (balance < 1) {
        console.log(
          chalk.yellow("Недостаточно средств для покупки монеты!", {
            symbol: bestCoin.symbol,
            balance: totalAvailableBalance,
          })
        );
        return;
      }

      const amount = getAmount({
        balance: balance,
        price: parseFloat(bestCoin.lastPrice),
        leverage: SETTINGS.LEVERAGE,
      });
      const side = getSide({
        changes: changes,
        strategy: SETTINGS.STRATEGY,
      });
      const price = getLimitPrice({
        entryPrice: parseFloat(bestCoin.lastPrice),
        side: side,
        percent: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
      });

      try {
        const result = await createOrder({
          symbol: bestCoin.symbol,
          amount: amount,
          side: side,
          price: price,
        });

        if (result) {
          logger.createOrder({
            result: result,
            symbol: bestCoin.symbol,
            side,
            price,
            amount,
            entryPrice: parseFloat(bestCoin.lastPrice),
            changes: changes,
          });
        }
      } catch (error) {
        console.error(error);
      }
    });
  });
});

async function setStopOrder(params: Order) {
  const trailingStopSum = calculatePercentage({
    entryPrice: Number(params.price),
    percentage: SETTINGS.TRAILING_STOP,
  });

  try {
    const result = await setTrailingStopOrder({
      symbol: params.symbol,
      trailingStopSum: trailingStopSum,
    });

    if (result) {
      logger.setStopOrder({
        result: result,
        symbol: params.symbol,
        entryPrice: Number(params.price),
        trailingStopSum: trailingStopSum,
      });
    }
  } catch (error) {
    console.error(error);
  }
}

async function setClearTimer(order: Order) {
  setTimeout(async () => {
    const orderFilled = getOrderFilled(order.symbol);
    if (!orderFilled) return;

    try {
      const positions = await getPosition({ symbol: orderFilled.symbol });
      await positions.forEach(async (position) => {
        const percentPnL = calculatePercentagePnL({
          positionIM: Number(position.positionIM),
          unrealisedPnl: Number(position.unrealisedPnl),
        });
        if (percentPnL < SETTINGS.INCREASING_PNL) {
          console.warn(`Closed position ${position.symbol}`);
          await closePosition(position);
        }
      });
      if (getOrderFilled(order.symbol)) {
        setClearTimer(order);
      }
    } catch (error) {
      console.error(error);
    }
  }, minutesToMilliseconds(SETTINGS.TIMER_POSITION_CLEAR));
}

function minutesToMilliseconds(minutes: number) {
  return minutes * 60 * 1000;
}

function calculatePercentagePnL({
  unrealisedPnl,
  positionIM,
}: {
  positionIM: number;
  unrealisedPnl: number;
}) {
  if (positionIM === 0) {
    console.error(new Error("Ошибка: деление на ноль"));
    return 0;
  }
  return (unrealisedPnl / positionIM) * 100;
}

function getBestCoins(event: MatrixChanges) {
  return getCoinsKey()
    .map((item) => {
      const { check, historyChanges } = hasConsistentChange({
        data: event[item as Symbol],
        field: "indexPrice",
        step: SETTINGS.DYNAMICS_PRICE_CHANGES,
      });
      return {
        symbol: item as Symbol,
        check,
        historyChanges,
      };
    })
    .filter((item) => item.check);
}
