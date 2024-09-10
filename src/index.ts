import { hasOrder, setTimerClearOrder, watchOrders } from "./order";
import { getAmount, getCoinPurchaseBalance, watchWallet } from "./wallet";
import { chooseBestCoin, fetchCoins, getBestCoins } from "./coins";
import { Ticker, watchTicker } from "./ticker";
import {
  watchPrice,
  setTickerToMatrix,
  getCoinPriceBySymbol,
  getPrices,
} from "./price";
import chalk from "chalk";
import { createOrder } from "./trading";
import {
  watchPositionsInterval,
  hasPosition,
  watchPositions,
} from "./position";

export type Side = "Buy" | "Sell";

interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}

export const SETTINGS = {
  TIME_CHECK_PRICE: 6000, // Время обновления проверки цены на все монеты (мс)
  LIMIT_ORDER_PRICE_VARIATION: 1, // Процент отката цены для лимитной закупки (%)
  TIMER_ORDER_CANCEL: 1, // Время отмены ордеров если он не выполнился (мин)
  // STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  HISTORY_CHANGES_SIZE: 3, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.2, // Минимальный процент изменения цены относительно прошлой (%)
  FIELD: "lastPrice",
  NUMBER_OF_POSITIONS: 10, // Количество закупаемых монет (шт)
  NUMBER_OF_ORDERS: 5, // Количество создаваемых ордеров для каждой монеты (шт)
} as const;

watchWallet();
watchOrders({
  afterFilled: (orders) => {
    orders.forEach((order) => {
      setTimerClearOrder(order);
    });
  },
});
watchPositions({
  afterFilled: (positions) => {},
});
watchPositionsInterval({
  afterFilled: (positions) => {
    positions.forEach((position) => {
      // console.log(`${position.symbol}: PnL: ${position.unrealisedPnl}`);
    });
  },
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
