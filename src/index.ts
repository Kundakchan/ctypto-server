import { symbols } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";
import { createOrder } from "./trading";
type OrderType = "long" | "short";
const OrderTypeMap = {
  Buy: "long",
  Sell: "short",
} as const;

import { getWallet } from "./wallet";
// import { calculatePnL } from "./utils";

const symbolList = symbols.map((symbol) => symbol.symbol);

subscribePriceCoin(symbolList, "indexPrice");
watchPriceCoin({ time: 5000, handler: show });

interface Price {
  old: PriceCoins;
  new: PriceCoins;
}

const price: Price = {
  old: {},
  new: {},
};

function calc(price: Price, gap = 1) {
  const result = symbolList.map((item) => {
    if (price["old"][item]?.price && price["new"][item]?.price) {
      return {
        symbol: item,
        changes:
          (price["new"][item]?.price / price["old"][item]?.price) * 100 - 100,
        url: `https://www.bybit.com/trade/usdt/${item}`,
        price: price["new"][item]?.price,
      };
    } else {
      return {
        symbol: item,
        changes: null,
        url: `https://www.bybit.com/trade/usdt/${item}`,
        price: price["new"][item]?.price,
      };
    }
  });

  return result
    .filter(
      (item) =>
        (item.changes as number) > gap || (item.changes as number) < -gap
    )
    .sort((a, b) => (b.changes as number) - (a.changes as number));
}

function show(data: PriceCoins) {
  price.old = structuredClone(price.new);
  price.new = structuredClone(data);

  if (Object.values(price.old).length && Object.values(price.new).length) {
    const bestPrice = calc(price, 0.5);
    if (bestPrice.length) {
      getWallet().then((data) => {
        const balance = Number(data.totalMarginBalance);
        if (bestPrice[0].price && bestPrice[0].changes) {
          console.log(getAmount(balance, bestPrice[0].price));
          console.table(bestPrice);

          const amount = getAmount(balance / 10, bestPrice[0].price);
          const side = bestPrice[0].changes < 0 ? "Buy" : "Sell";
          createOrder({
            symbol: bestPrice[0].symbol,
            amount: nearestLowerMultipleOfTen(amount),
            side: side,
            tp: getTP(bestPrice[0].price, 1, OrderTypeMap[side]),
            sl: getSL(bestPrice[0].price, 0.2, OrderTypeMap[side]),
          }).then((data) => {
            console.log("createOrder", data);
          });
        }
      });
    }
  }
}

function getAmount(balance: number, price: number) {
  return (balance / price) * 10;
}

function getTP(price: number, percent: number, type: OrderType) {
  if (type === "long") {
    return price + price * (percent / 100);
  } else {
    return price - price * (percent / 100);
  }
}
function getSL(price: number, percent: number, type: OrderType) {
  if (type === "long") {
    return price - price * (percent / 100);
  } else {
    return price + price * (percent / 100);
  }
}

function nearestLowerMultipleOfTen(num: number) {
  // Находим ближайшее меньшее кратное 10
  return Math.floor(num / 10) * 10;
}

// // Пример использования функции
// const currentPrice: number = 0.008279; // Текущая цена
// const entryPrice: number = 0.008431; // Средняя цена входа
// const positionSize: number = 29; // Размер позиции
// const positionType: "long" | "short" = ""short""; // Тип позиции

// const pnl: number = calculatePnL(
//   currentPrice,
//   entryPrice,
//   positionSize,
//   positionType
// );
// console.log(`Нереализованный PnL: ${pnl} USDT`);
