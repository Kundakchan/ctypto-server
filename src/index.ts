import { symbols, Symbol } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder, setTrailingStopOrder } from "./trading";
import { watchPosition, checkOpenPosition } from "./position";
import {
  calculatePercentage,
  getAmount,
  getLimitPrice,
  getSide,
  type STRATEGY,
} from "./utils";
import { getWallet, watchWallet } from "./wallet";
import { getBestCoins } from "./coins";
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const UPDATE_BEST_PRICE_TIME = 500;
const BEST_PRICE_GAP = 0.4;
const DIVERSIFICATION_COUNT = 10;
const GAP_FOR_LIMIT_PRICE = 0.1;
const STRATEGY: STRATEGY = "INERTIA";
const LEVERAGE = 10;

const symbolList = symbols.map((symbol) => symbol.symbol);
watchWallet();
watchPosition({ afterOpening: setStopOrder });
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

  const { totalMarginBalance } = getWallet();
  const balance = Number(totalMarginBalance) / DIVERSIFICATION_COUNT;

  bestPrice.forEach((coin, _, array) => {
    if (checkOpenPosition(coin.symbol)) {
      console.log("skip", coin.symbol);
      return;
    }

    const purchaseAmount = balance | array.length;
    const amount = getAmount({
      balance: purchaseAmount,
      price: coin.price,
      leverage: LEVERAGE,
    });
    const side = getSide({ changes: coin.changes, strategy: STRATEGY });
    createOrder({
      symbol: coin.symbol,
      amount: amount,
      side: side,
      price: getLimitPrice({
        entryPrice: coin.price,
        side: side,
        percent: GAP_FOR_LIMIT_PRICE,
      }),
    });
  });
}

function setStopOrder(order: Record<string, string | number>) {
  const trailingStopSum = calculatePercentage({
    entryPrice: Number(order.entryPrice),
    percentage: 1,
  });
  setTrailingStopOrder({
    symbol: order.symbol as unknown as Symbol,
    trailingStopSum: trailingStopSum,
  });
}
