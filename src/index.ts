import { symbols, Symbol } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder, setTrailingStopOrder } from "./trading";
import { watchPosition, checkOpenPosition } from "./position";
import { getAmount, getSide, type STRATEGY } from "./utils";
import { getWallet, watchWallet } from "./wallet";
import { getBestCoins } from "./coins";
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const UPDATE_BEST_PRICE_TIME = 1000;
const BEST_PRICE_GAP = 0.2;
const DIVERSIFICATION_COUNT = 20;
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

  // console.table(bestPrice);

  bestPrice.forEach(async (coin, _, array) => {
    if (checkOpenPosition(coin.symbol)) return;

    const purchaseAmount = balance | array.length;
    // TODO: Нужно сделать тип покупки лимитный
    const amount = getAmount({
      balance: purchaseAmount,
      price: coin.price,
      leverage: LEVERAGE,
    });
    const result = await createOrder({
      symbol: coin.symbol,
      amount: amount,
      side: getSide({ changes: coin.changes, strategy: STRATEGY }),
    });
  });
}

function setStopOrder(order: Record<string, string | number>) {
  const trailingStopSum = calculatePercentage({
    entryPrice: Number(order.entryPrice),
    percentage: 2,
  });
  setTrailingStopOrder({
    symbol: order.symbol as unknown as Symbol,
    trailingStopSum: trailingStopSum,
  }).then((data) => {
    const record = {
      symbol: order.symbol,
      message: data?.retMsg,
      stopOrder: trailingStopSum,
      url: `https://www.bybit.com/trade/usdt/${order.symbol}`,
      ...order,
    };
    console.table(record);
  });
}

function calculatePercentage({
  entryPrice,
  percentage,
}: {
  entryPrice: number;
  percentage: number;
}) {
  return (percentage / 100) * entryPrice;
}
