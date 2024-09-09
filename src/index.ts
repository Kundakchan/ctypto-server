import { hasOrder, watchOrders } from "./order";
import { getWallet, watchWallet } from "./wallet";

export type Side = "Buy" | "Sell";

export enum SIDE {
  long = "Buy",
  short = "Sell",
}

import { chooseBestCoin, fetchCoins, getBestCoins } from "./coins";
import { Ticker, watchTicker } from "./ticker";
import { watchPrice, setTickerToMatrix, getCoinPriceBySymbol } from "./pice";
import chalk from "chalk";
import { createOrder } from "./trading";
import { getPositionsCount, hasPosition, watchPositions } from "./position";

export const SETTINGS = {
  TIME_CHECK_PRICE: 6000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 1, // Процент отката цены для лимитной закупки (%)
  TIMER_ORDER_CANCEL: 120000, // Время отмены ордера если он не выполнился (мс)
  STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 3, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.1, // Минимальный процент изменения цены относительно прошлой (%)
  FIELD: "lastPrice",
  NUMBER_OF_POSITIONS: 10,
  NUMBER_OF_ORDERS: 5,
} as const;

watchWallet();
watchOrders({
  afterFilled: (order) => {},
});
watchPositions({
  afterFilled: (position) => {},
});

fetchCoins().then(() => {
  watchTicker(setTickerToMatrix);
  watchPrice((event) => {
    const bestCoins = getBestCoins(event);
    if (!bestCoins.length) {
      console.log(chalk.yellow("Нет подходящих монет для покупки"));
      return;
    } else {
      bestCoins.forEach(async (coin) => {
        if (!hasPosition(coin.symbol) && !hasOrder(coin.symbol)) {
          const active = chooseBestCoin([coin]);
          if (active) {
            await buyCoin({ ...getCoinPriceBySymbol(coin.symbol), ...active });
          }
        } else {
          console.log(
            chalk.yellow(
              `Монета - ${coin.symbol} уже есть в реестре заказов или позиции`
            )
          );
        }
      });
    }
  });
});

interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}
const buyCoin = async (active: BuyCoinParams) => {
  if (!active[SETTINGS.FIELD]) {
    throw new Error(`Отсутствует свойства - ${SETTINGS.FIELD}`);
  }

  // Нужно чтобы возвращал массив с количеством монет где следующий элемент в 2 раза больше предыдущего
  const amounts = getAmount({
    balance: getCoinPurchaseBalance(),
    entryPrice: parseFloat(active[SETTINGS.FIELD] as string),
  });
  // Нужно чтобы возвращал массив цен где следующая цена в 2 раза больше/меньше чем предыдущая в зависимости от position (Buy/Sell)
  const prices = getPrices({
    entryPrice: parseFloat(active[SETTINGS.FIELD] as string),
    side: active.position,
    percentage: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
  });
  return await createRecursiveOrder({ active, amounts, prices, index: 0 });
};

const getCoinPurchaseBalance = () => {
  const wallet = getWallet();
  if (wallet?.totalMarginBalance) {
    return (
      parseFloat(wallet.totalMarginBalance) /
      (SETTINGS.NUMBER_OF_POSITIONS - getPositionsCount())
    );
  } else {
    throw new Error("Не удалось получить информацию о балансе");
  }
};

const getAmount = ({
  balance,
  entryPrice,
}: {
  balance: number;
  entryPrice: number;
}) => {
  const money = decreaseByPercentage(balance * SETTINGS.LEVERAGE, 6);
  const amount = money / entryPrice;
  if (entryPrice < 1) {
    return divideNumber(amount, SETTINGS.NUMBER_OF_ORDERS).map((item) =>
      Math.round(item)
    );
  } else {
    return divideNumber(amount, SETTINGS.NUMBER_OF_ORDERS).map((item) =>
      roundToFirstDecimal(item)
    );
  }
};

function roundToFirstDecimal(value: number) {
  const firstDecimal = Math.floor(value * 10) % 10;
  return firstDecimal === 0 ? Math.floor(value) : Math.round(value * 10) / 10;
}

const decreaseByPercentage = (value: number, percentage: number): number => {
  if (value < 0 || percentage < 0 || percentage > 100) {
    throw new Error("Некорректные входные данные.");
  }
  return value * (1 - percentage / 100);
};

const divideNumber = (total: number, parts: number): number[] => {
  if (parts <= 0) throw new Error("Количество частей должно быть больше 0");

  const firstPart = total / (Math.pow(2, parts) - 1);
  return Array.from({ length: parts }, (_, i) => firstPart * Math.pow(2, i));
};

interface GetPrices {
  entryPrice: number;
  side: Side;
  percentage: number;
}
const getPrices = ({ entryPrice, side, percentage }: GetPrices) => {
  const prices = [];
  let multiplier = 1 + percentage / 100;

  // Вычисляем первую цену в зависимости от side
  const firstPrice =
    side === "Sell" ? entryPrice * multiplier : entryPrice / multiplier;

  prices.push(firstPrice);

  // Добавляем последующие цены, изменяя их от предыдущего элемента
  for (let i = 1; i < SETTINGS.NUMBER_OF_ORDERS; i++) {
    // Например, создадим 5 цен
    const previousPrice: number = prices[i - 1];
    const nextPrice =
      side === "Sell" ? previousPrice * multiplier : previousPrice / multiplier;
    multiplier = multiplier + 0.01;
    prices.push(nextPrice);
  }

  return prices;
};

const createRecursiveOrder = async ({
  active,
  amounts,
  prices,
  index,
}: {
  active: BuyCoinParams;
  amounts: number[];
  prices: number[];
  index: number;
}) => {
  if (index >= SETTINGS.NUMBER_OF_ORDERS) {
    console.log(chalk.green(`Все ордера ${active.symbol} успешно создан`));
    return;
  }

  try {
    const result = await createOrder({
      symbol: active.symbol,
      side: active.position,
      amount: amounts[index],
      price: prices[index],
    });

    if (!result) {
      console.log(chalk.red(`Отсутствует result ${result}`));
      return;
    }

    if (result.retMsg !== "OK") {
      console.log(chalk.red(`Ошибка создания ордера: ${active.symbol}`));
      console.log(chalk.red(result.retMsg));
      return;
    }

    console.log(
      chalk.green(`Ордер ${active.symbol} успешно создан, index: ${index}`)
    );
    console.table(result.result);

    await createRecursiveOrder({
      active,
      amounts,
      prices,
      index: index + 1,
    });
    return;
  } catch (error) {
    console.error("Error createRecursiveOrder", error);
  }
};
