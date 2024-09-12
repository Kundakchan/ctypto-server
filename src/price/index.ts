import { SETTINGS, Side } from "..";
import { type Symbol } from "../coins/symbols";
import type { Ticker } from "../ticker";
import { getCoinsKey } from "../coins";
import chalk from "chalk";
import { calculatePercentage } from "../utils";

interface Coins extends Partial<Record<Symbol, Ticker>> {}
export interface MatrixChanges extends Partial<Record<Symbol, Ticker[]>> {}

const coins: Coins = {};
let matrix: Coins[] = [];
let matrixChanges: MatrixChanges = {};

const setTickerToMatrix = (ticker?: Ticker) => {
  if (ticker?.symbol) {
    coins[ticker.symbol] = coins[ticker.symbol]
      ? { ...coins[ticker.symbol], ...ticker }
      : ticker;
  }
};

interface WatchPriceAfterUpdate {
  (params: MatrixChanges): void;
}
interface WatchPrice {
  (params: WatchPriceAfterUpdate): void;
}

interface ResultData
  extends Partial<Record<Symbol, Record<string, string | number>[]>> {}

const calculatePercentageDifference = (
  previousEntry: Ticker,
  currentEntry: Ticker,
  key: keyof Ticker
): string => {
  if (!previousEntry[key] || !currentEntry[key]) return "0";

  const previousValue = parseFloat(previousEntry[key]);
  const currentValue = parseFloat(currentEntry[key]);

  if (isNaN(previousValue) || isNaN(currentValue)) {
    return currentEntry[key]; // Возвращаем значение как есть, если оно не является числом
  }

  const difference = ((currentValue - previousValue) / previousValue) * 100;
  return difference.toString();
};

const initializeDifferences = (entries: Ticker[]) => {
  return entries.map((entry) => {
    const result: Partial<Ticker> = {};
    for (const key in entry) {
      const property = key as keyof Ticker;
      if (property === "symbol") {
        result[property] = entry.symbol;
      } else {
        result[property] =
          entry[property] === "" || isNaN(Number(entry[property]))
            ? entry[property]
            : "0"; // Инициализируем все свойства значением "0"
      }
    }
    return result;
  });
};

const calculatePriceDifferences = (data: MatrixChanges): ResultData => {
  const result: ResultData = {};

  for (const symbol in data) {
    const prices = data[symbol as Symbol];
    if (!prices) break;

    const differences = initializeDifferences(prices);

    for (let i = 1; i < prices.length; i++) {
      const previousEntry = prices[i - 1];
      const currentEntry = prices[i];

      for (const key in previousEntry) {
        const property = key as keyof Ticker;
        const value = calculatePercentageDifference(
          previousEntry,
          currentEntry,
          property
        );
        if (property === "symbol") {
          differences[i][property] = value as Symbol;
        } else {
          differences[i][property] = value;
        }
      }
    }

    result[symbol as Symbol] = differences;
  }

  return result;
};

const watchPrice: WatchPrice = (afterUpdate) => {
  if (matrix.length < SETTINGS.HISTORY_CHANGES_SIZE) {
    console.log(chalk.blue("Заполнения матрицы ценами...", matrix.length));
  }
  setTimeout(() => {
    matrix.push(structuredClone(coins));
    if (matrix.length > SETTINGS.HISTORY_CHANGES_SIZE) {
      matrix = matrix.slice(-SETTINGS.HISTORY_CHANGES_SIZE);
    }
    if (matrix.length === SETTINGS.HISTORY_CHANGES_SIZE) {
      matrixChanges = {};
      getCoinsKey().forEach((symbol) => {
        const key = symbol as Symbol;
        matrix.forEach((item, index) => {
          if (!matrixChanges[key]) {
            matrixChanges[key] = [];
          }
          if (item[key]) {
            matrixChanges[key][index] = item[key];
          }
        });
      });
      console.log(chalk.green("Обновления матрицы цен..."));
      afterUpdate(calculatePriceDifferences(matrixChanges) as MatrixChanges);
    }
    watchPrice(afterUpdate);
  }, SETTINGS.TIME_CHECK_PRICE);
};

function hasConsistentChange({
  data,
  field,
  step,
}: {
  data?: Ticker[];
  field: keyof Ticker;
  step: number;
}) {
  if (!data) return { check: false, historyChanges: [] };
  const filteredValues = data
    .map((item) => parseFloat(item[field] || "0")) // Преобразуем indexPrice в число, заменяя отсутствующие на 0
    .filter((value) => value !== 0); // Фильтруем нулевые значения

  // Проверяем условия
  const result =
    filteredValues.length === SETTINGS.HISTORY_CHANGES_SIZE - 1 &&
    checkArraySigns(filteredValues, step);

  return { check: result, historyChanges: filteredValues };
}

function checkArraySigns(arr: number[], step: number): boolean {
  if (arr.length === 0) return false;

  const allPositive = arr.every((num) => num > 0);
  const allNegative = arr.every((num) => num < 0);

  if (allPositive) {
    return arr.every((num) => num >= step);
  } else if (allNegative) {
    return arr.every((num) => num <= -step);
  }

  return false; // Если элементы имеют разные знаки
}

const getCoinPriceBySymbol = (symbol: Symbol) => coins[symbol];

interface GetPrices {
  entryPrice: number;
  side: Side;
  percentage: number;
}
const getPrices = ({ entryPrice, side, percentage }: GetPrices) => {
  let multiplier = percentage;

  const firstPrice =
    side === "Buy"
      ? entryPrice -
        calculatePercentage({ target: entryPrice, percent: multiplier / 2 })
      : entryPrice +
        calculatePercentage({ target: entryPrice, percent: multiplier / 2 });

  const prices: number[] = Array.from({
    length: SETTINGS.NUMBER_OF_ORDERS,
  }).reduce<number[]>((acc, current, index) => {
    if (index === 0) {
      acc.push(firstPrice);
    } else {
      const price =
        side === "Buy"
          ? acc[index - 1] -
            calculatePercentage({ target: acc[index - 1], percent: multiplier })
          : acc[index - 1] +
            calculatePercentage({
              target: acc[index - 1],
              percent: multiplier,
            });
      multiplier = multiplier + SETTINGS.PRICE_DIFFERENCE_MULTIPLIER;
      acc.push(price);
    }
    return acc;
  }, []);

  return prices;
};

export {
  setTickerToMatrix,
  watchPrice,
  hasConsistentChange,
  getCoinPriceBySymbol,
  getPrices,
};
