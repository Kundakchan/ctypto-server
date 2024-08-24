import * as dotenv from "dotenv";
dotenv.config();

import { symbols } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";

const symbolList = symbols.map((symbol) => symbol.symbol);

subscribePriceCoin(symbolList);
watchPriceCoin({ time: 10000, handler: show });

interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const price: Price = {
  old: {},
  new: {},
};

function calc(price: Price) {
  const result = symbolList.map((item) => {
    if (price["old"][item]?.price && price["new"][item]?.price) {
      return {
        symbol: item,
        price:
          (price["new"][item]?.price / price["old"][item]?.price) * 100 - 100,
        url: `https://www.bybit.com/trade/usdt/${item}`,
      };
    } else {
      return {
        symbol: item,
        price: null,
        url: `https://www.bybit.com/trade/usdt/${item}`,
      };
    }
  });

  const sorted = result
    .filter((item) => (item.price as number) > 1 || (item.price as number) < -1)
    .sort((a, b) => (b.price as number) - (a.price as number));

  if (sorted.length) {
    console.table(sorted);
  }
}

function show(data: PriceCoins) {
  price.old = structuredClone(price.new);
  price.new = structuredClone(data);

  if (Object.values(price.old).length && Object.values(price.new).length) {
    calc(price);
  }
}
