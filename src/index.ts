import { symbols, Symbol } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
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
  type STRATEGY,
} from "./utils";
import { getWallet, watchWallet } from "./wallet";
import { getBestCoins } from "./coins";
import { logger } from "./utils";
import { getPosition } from "./position";
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}
export type Side = "Buy" | "Sell";

export enum SIDE {
  long = "Buy",
  short = "Sell",
}

export const SETTINGS = {
  TIME_CHECK_PRICE: 120000, // Время обновления проверки цены на все монеты (мс)
  PRICE_DIFFERENCE: 1, // Разница цены от предыдущей проверки (%)
  DIVERSIFICATION_COUNT: 5, // Количество закупаемых монет (шт)
  LIMIT_ORDER_PRICE_VARIATION: 0.002, // Процент отката цены для лимитной закупки (%)
  TRAILING_STOP: 1, // Скользящий стоп-ордер (%)
  TIMER_ORDER_CANCEL: 120000, // Время отмены ордера если он не выполнился (мс)
  STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  TIMER_POSITION_CLEAR: 30, // Время закрытия позиции если отсутствует рост PnL (минуты)
  INCREASING_PNL: 3, // Процент увелечения PnL для избежания закрытия позиции
} as const;

const symbolList = symbols.map((symbol) => symbol.symbol);
watchWallet();
watchOrders({
  afterFilled: (order) => {
    setStopOrder(order);
    setClearTimer(order);
  },
});
subscribePriceCoin(symbolList, "indexPrice");
watchPriceCoin({ time: SETTINGS.TIME_CHECK_PRICE, handler: updatePriceCoin });

const price: Price = {
  old: {},
  new: {},
};

function updatePriceCoin(data: PriceCoins) {
  price.old = structuredClone(price.new);
  price.new = structuredClone(data);

  if (!Object.values(price.old).length || !Object.values(price.new).length)
    return;

  const bestPrice = getBestCoins({
    coins: symbolList,
    price,
    gap: SETTINGS.PRICE_DIFFERENCE,
  });
  if (!bestPrice.length) return;

  const { totalAvailableBalance } = getWallet();
  const divider = SETTINGS.DIVERSIFICATION_COUNT - getOrdersActiveLength();
  const balance = Number(totalAvailableBalance) / (divider ? divider : 1);

  bestPrice.forEach(async (coin) => {
    if (checkNewOrder(coin.symbol)) {
      console.log("skip", coin.symbol);
      return;
    }
    if (balance < 1) {
      console.warn("НЕДОСТАТОЧНО СРЕДСТВ!", {
        symbols: coin.symbol,
        balance: totalAvailableBalance,
      });
      return;
    }

    const amount = getAmount({
      balance: balance,
      price: coin.price,
      leverage: SETTINGS.LEVERAGE,
    });
    const side = getSide({
      changes: coin.changes,
      strategy: SETTINGS.STRATEGY,
    });
    const price = getLimitPrice({
      entryPrice: coin.price,
      side: side,
      percent: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
    });

    try {
      const result = await createOrder({
        symbol: coin.symbol,
        amount: amount,
        side: side,
        price: price,
      });

      if (result) {
        logger.createOrder({
          result: result,
          symbol: coin.symbol,
          side,
          price,
          amount,
          entryPrice: coin.price,
          changes: coin.changes,
        });
      }
    } catch (error) {
      console.error(error);
    }
  });
}

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
