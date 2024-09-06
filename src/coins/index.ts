import type { LinearInverseInstrumentInfoV5 } from "bybit-api";
import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import chalk from "chalk";
import { SETTINGS, Side } from "..";
import { hasConsistentChange, MatrixChanges } from "../pice";

interface InstrumentsInfo
  extends Partial<Record<Symbol, LinearInverseInstrumentInfoV5>> {}

const instrumentsInfo: InstrumentsInfo = {};

const fetchCoins = async () => {
  try {
    console.log(chalk.blue("Получения списка монет..."));
    const { result } = await client.getInstrumentsInfo({
      category: "linear",
      status: "Trading",
    });
    result.list.forEach((coin) => {
      if (coin.quoteCoin === "USDT") {
        instrumentsInfo[coin.symbol as Symbol] = coin;
      }
    });
    console.log(chalk.green("Монеты успешно получены!"));
    return instrumentsInfo;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getBestCoins = (event: MatrixChanges) => {
  return getCoinsKey()
    .map((item) => {
      const { check, historyChanges } = hasConsistentChange({
        data: event[item as Symbol],
        field: "lastPrice", // "volume24h", // "indexPrice", // turnover24h
        step: SETTINGS.DYNAMICS_PRICE_CHANGES,
      });
      return {
        symbol: item as Symbol,
        check,
        historyChanges,
      };
    })
    .filter((item) => item.check);
};

function chooseBestCoin(list: ReturnType<typeof getBestCoins>) {
  const coins = list.map((coin) => ({
    symbol: coin.symbol,
    value: calculateAverage(coin.historyChanges),
  }));

  return findExtremeValueObject(coins);
}

const calculateAverage = (numbers: number[]) =>
  numbers.length ? numbers.reduce((sum, num) => sum + num) / numbers.length : 0;

interface FindExtremeValueObjectData {
  symbol: Symbol;
  value: number;
}
interface FindExtremeValueObject {
  (data: FindExtremeValueObjectData[]): {
    symbol: Symbol;
    value: number;
    position: Side;
  } | null;
}

const findExtremeValueObject: FindExtremeValueObject = (data) => {
  // Проверяем, пустой ли массив данных
  if (data.length === 0) {
    return null; // Возвращаем null, если нет объектов для оценки
  }

  // Инициализируем крайний объект первым элементом массива
  let extremeObj = data[0];

  // Проходим по каждому объекту в массиве данных
  for (const currentObj of data) {
    // Преобразуем значения в положительные числа
    const currentValue = Math.abs(currentObj.value);
    const extremeValue = Math.abs(extremeObj.value);

    // Обновляем крайний объект, если текущий объект имеет большее положительное значение
    if (currentValue > extremeValue) {
      extremeObj = currentObj;
    }
  }

  // Определяем позицию в зависимости от исходного значения
  const position = Math.sign(extremeObj.value) === -1 ? "Sell" : "Buy";

  // Возвращаем найденный крайний объект с дополнительным свойством position
  return {
    symbol: extremeObj.symbol,
    value: Math.abs(extremeObj.value),
    position,
  };
};

const getCoins = () => instrumentsInfo;
const getCoinsKey = () => Object.keys(instrumentsInfo);
const getCoinBySymbol = (symbol: Symbol) => instrumentsInfo[symbol];

export {
  fetchCoins,
  getCoins,
  getCoinsKey,
  getCoinBySymbol,
  getBestCoins,
  chooseBestCoin,
};
