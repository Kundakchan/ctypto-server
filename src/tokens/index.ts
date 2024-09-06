import type { LinearInverseInstrumentInfoV5 } from "bybit-api";
import { client } from "../client";
import type { Symbol } from "../coins/symbols";
import chalk from "chalk";

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

const getCoins = () => instrumentsInfo;
const getCoinsKey = () => Object.keys(instrumentsInfo);
const getCoinBySymbol = (symbol: Symbol) => instrumentsInfo[symbol];

export { fetchCoins, getCoins, getCoinsKey, getCoinBySymbol };
