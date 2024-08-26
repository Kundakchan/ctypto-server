import { symbols } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder } from "./trading";
import { getTP, getSL, nearestLowerMultipleOfTen, getAmount } from "./utils";
import { ORDER_TYPE_MAP } from "./trading/constants";
import { getWallet } from "./wallet";
import { getBestCoins } from "./coins";
export interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const symbolList = symbols.map((symbol) => symbol.symbol);
subscribePriceCoin(symbolList, "indexPrice");
watchPriceCoin({ time: 500, handler: updatePriceCoin });

const price: Price = {
  old: {},
  new: {},
};

function updatePriceCoin(data: PriceCoins) {
  price.old = structuredClone(price.new);
  price.new = structuredClone(data);

  if (Object.values(price.old).length && Object.values(price.new).length) {
    const bestPrice = getBestCoins({ coins: symbolList, price, gap: 0.5 }); // TODO: Значения параметра gap вынести в константу

    if (bestPrice.length) {
      getWallet().then((data) => {
        const balance = Number(data.totalMarginBalance);
        if (bestPrice[0].price && bestPrice[0].changes) {
          console.log(getAmount(balance, bestPrice[0].price));
          console.table(bestPrice);

          const amount = getAmount(balance / 5, bestPrice[0].price);
          const side = bestPrice[0].changes < 0 ? "Buy" : "Sell";
          createOrder({
            symbol: bestPrice[0].symbol,
            amount: nearestLowerMultipleOfTen(amount),
            side: side,
            tp: getTP(bestPrice[0].price, 0.2, ORDER_TYPE_MAP[side]),
            sl: getSL(bestPrice[0].price, 0.2, ORDER_TYPE_MAP[side]),
          }).then((data) => {
            console.log("createOrder", data);
          });
        }
      });
    }
  }
}
