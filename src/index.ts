import { symbols } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder } from "./trading";
import {
  getAmount,
  getSide,
  getSLByPnL,
  getTPByPnL,
  type STRATEGY,
} from "./utils";
import { getWallet, watchWallet } from "./wallet";
import { getBestCoins } from "./coins";
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const UPDATE_BEST_PRICE_TIME = 1000;
const BEST_PRICE_GAP = 0.3;
const DIVERSIFICATION_COUNT = 5;
const STRATEGY: STRATEGY = "INERTIA";
const LEVERAGE = 10;
const TP_GAP = 1;
const SL_GAP = 0.5;

const symbolList = symbols.map((symbol) => symbol.symbol);
subscribePriceCoin(symbolList, "indexPrice");
watchWallet();
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

  console.table(bestPrice);

  bestPrice.forEach(async (coin, _, array) => {
    const purchaseAmount = balance | array.length;
    const amount = getAmount({
      balance: purchaseAmount,
      price: coin.price,
      leverage: LEVERAGE,
    });
    const result = await createOrder({
      symbol: coin.symbol,
      price: coin.price,
      amount: amount,
      side: getSide({ changes: coin.changes, strategy: STRATEGY }),
      tp: getTPByPnL({
        price: coin.price,
        size: amount,
        gap: TP_GAP,
        side: getSide({ changes: coin.changes, strategy: STRATEGY }),
      }),
      sl: getSLByPnL({
        price: coin.price,
        size: amount,
        gap: SL_GAP,
        side: getSide({ changes: coin.changes, strategy: STRATEGY }),
      }),
    });
    console.log("order result", result);
  });
}
