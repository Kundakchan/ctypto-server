import { getOrdersActiveLength, watchOrders } from "./order";
import { watchWallet } from "./wallet";

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

export const SETTINGS = {
  TIME_CHECK_PRICE: 60000, // Время обновления проверки цены на все монеты (мс)
  DIVERSIFICATION_COUNT: 4, // Количество закупаемых ордеров (шт)
  LIMIT_ORDER_PRICE_VARIATION: 0.002, // Процент отката цены для лимитной закупки (%)
  // TRAILING_STOP: 0.5, // Скользящий стоп-ордер (%)
  TIMER_ORDER_CANCEL: 120000, // Время отмены ордера если он не выполнился (мс)
  STRATEGY: "INERTIA", // Стратегия торговли (INERTIA, REVERSE)
  LEVERAGE: 10, // Торговое плечо (число)
  // TIMER_POSITION_CLEAR: 30, // Время закрытия позиции если отсутствует рост PnL (минуты)
  // INCREASING_PNL: 3, // Процент увелечения PnL для избежания закрытия позиции
  HISTORY_CHANGES_SIZE: 5, // Количество временных отрезков для отслеживания динамики изменения цены (шт)
  DYNAMICS_PRICE_CHANGES: 0.1, // Минимальный процент изменения цены относительно прошлой (%)
} as const;

// watchWallet();
// watchOrders({
//   afterFilled: (order) => {},
// });

fetchCoins().then(() => {
  watchTicker(setTickerToMatrix);
  watchPrice((event) => {
    // if (getOrdersActiveLength()) {
    //   console.log(chalk.yellow("Пропустить закупку монет"));
    //   return;
    // }

    const bestCoins = getBestCoins(event);
    if (!bestCoins.length) {
      console.log(chalk.yellow("Нет подходящих монет для покупки"));
      return;
    } else {
      const coin = chooseBestCoin(bestCoins);

      const date = new Date();

      // Определяем массив с названиями месяцев
      const months = [
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
      ];

      // Получаем день, месяц и время
      const day = date.getDate();
      const month = months[date.getMonth()];
      const hours = String(date.getHours()).padStart(2, "0"); // Форматируем часы
      const minutes = String(date.getMinutes()).padStart(2, "0"); // Форматируем минуты

      console.log({
        url: `https://www.bybit.com/trade/usdt/${coin?.symbol}`,
        side: coin?.position,
        createAt: `${day} ${month} ${hours}:${minutes}`,
      });
      // if (coin) {
      //   const active = { ...getCoinPriceBySymbol(coin.symbol), ...coin };
      //   buyCoin(active);
      // } else {
      //   console.log(chalk.red("Не удалось корректно выбрать монету"));
      // }
    }
  });
});

interface BuyCoinParams extends Ticker {
  value: number;
  position: Side;
}
const buyCoin = async (active: BuyCoinParams) => {
  if (!active.lastPrice) {
    throw new Error("Отсутствует свойства lastPrice");
  }

  try {
    const result = await createOrder({
      symbol: active.symbol,
      side: active.position,
      amount: getAmount({
        balance: 100,
        lastPrice: parseFloat(active.lastPrice),
      })[0],
      price: getPrice({
        lastPrice: parseFloat(active.lastPrice),
        side: active.position,
        percentage: SETTINGS.LIMIT_ORDER_PRICE_VARIATION,
      }),
    });
    console.log(`https://www.bybit.com/trade/usdt/${active.symbol}`);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
};

const getAmount = ({
  balance,
  lastPrice,
}: {
  balance: number;
  lastPrice: number;
}) => {
  const money = decreaseByPercentage(balance * SETTINGS.LEVERAGE, 6);
  const amount = money / lastPrice;
  if (lastPrice < 1) {
    return divideNumber(amount, SETTINGS.DIVERSIFICATION_COUNT).map((item) =>
      Math.round(item)
    );
  } else {
    return divideNumber(amount, SETTINGS.DIVERSIFICATION_COUNT).map((item) =>
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

const getPrice = ({
  lastPrice,
  side,
  percentage,
}: {
  lastPrice: number;
  side: Side;
  percentage: number;
}): number => {
  const adjustment = (lastPrice * percentage) / 100;

  if (side === "Sell") {
    return lastPrice + adjustment; // Увеличиваем на процент для Sell
  } else if (side === "Buy") {
    return lastPrice - adjustment; // Уменьшаем на процент для Buy
  } else {
    throw new Error("Invalid side. Use 'Buy' or 'Sell'.");
  }
};

// function calculatePercentagePnL({
//   unrealisedPnl,
//   positionIM,
// }: {
//   positionIM: number;
//   unrealisedPnl: number;
// }) {
//   if (positionIM === 0) {
//     console.error(new Error("Ошибка: деление на ноль"));
//     return 0;
//   }
//   return (unrealisedPnl / positionIM) * 100;
// }
