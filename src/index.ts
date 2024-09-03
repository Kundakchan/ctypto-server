import { symbols, Symbol } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder, setTrailingStopOrder } from "./trading";
import { watchOrders, checkNewOrder, getOrdersActiveLength } from "./order";
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
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}
export type Side = "Buy" | "Sell";

export enum SIDE {
  long = "Buy",
  short = "Sell",
}

const UPDATE_BEST_PRICE_TIME = 500;
const BEST_PRICE_GAP = 0.2;
const DIVERSIFICATION_COUNT = 5;
const GAP_FOR_LIMIT_PRICE = 0.002;
const TRAILING_STOP_SUM = 0.5;
export const TIME_CANCEL_ORDER = 60000;
const STRATEGY: STRATEGY = "INERTIA";
const LEVERAGE = 10;

const symbolList = symbols.map((symbol) => symbol.symbol);
watchWallet();
watchOrders({ afterFilled: setStopOrder });
subscribePriceCoin(symbolList, "indexPrice");
watchPriceCoin({ time: UPDATE_BEST_PRICE_TIME, handler: updatePriceCoin });

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
    gap: BEST_PRICE_GAP,
  });
  if (!bestPrice.length) return;

  const { totalAvailableBalance } = getWallet();
  console.warn("Кошелёк", getWallet());
  console.warn(DIVERSIFICATION_COUNT);
  console.warn(getOrdersActiveLength());
  const balance =
    Number(totalAvailableBalance) /
    (DIVERSIFICATION_COUNT - getOrdersActiveLength());

  bestPrice.forEach(async (coin) => {
    if (checkNewOrder(coin.symbol)) {
      console.log("skip", coin.symbol);
      return;
    }

    console.warn("Сумма покупки", balance);

    const amount = getAmount({
      balance: balance,
      price: coin.price,
      leverage: LEVERAGE,
    });
    const side = getSide({ changes: coin.changes, strategy: STRATEGY });
    const price = getLimitPrice({
      entryPrice: coin.price,
      side: side,
      percent: GAP_FOR_LIMIT_PRICE,
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

async function setStopOrder({
  symbol,
  entryPrice,
}: {
  symbol: Symbol;
  entryPrice: number;
}) {
  const trailingStopSum = calculatePercentage({
    entryPrice: entryPrice,
    percentage: TRAILING_STOP_SUM,
  });

  try {
    const result = await setTrailingStopOrder({
      symbol: symbol,
      trailingStopSum: trailingStopSum,
    });

    if (result) {
      logger.setStopOrder({
        result: result,
        symbol: symbol,
        entryPrice: entryPrice,
        trailingStopSum: trailingStopSum,
      });
    }
  } catch (error) {
    console.error(error);
  }
}
