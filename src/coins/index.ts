import { client } from "../client";
import fs from "fs";
import { calculatePriceChange } from "../utils";
import { Price } from "..";
import type { Symbol as Coin } from "./symbols";

function writeSymbolsToFile(symbols: string[]): void {
  const data = `export default ${JSON.stringify(symbols)} as const`;

  fs.writeFile("src/coins/symbols.ts", data, (err) => {
    if (err) {
      console.error("Ошибка при записи файла:", err);
    } else {
      console.log("Данные успешно записаны в файл symbols.json");
    }
  });
}

export function getCoins() {
  return client
    .getInstrumentsInfo({ category: "linear" })
    .then((data: any) => {
      const list = data.result.list.map((coin: any) => coin) as any[];
      writeSymbolsToFile(
        list.filter(
          (item) =>
            item.contractType === "LinearPerpetual" && item.quoteCoin === "USDT"
        )
      );
    })
    .catch((error: any) => {
      console.log("error", error);
    });
}

export function getBestCoins({
  coins,
  price,
  gap,
}: {
  coins: Coin[];
  price: Price;
  gap: number;
}) {
  return coins
    .map((symbol) => {
      const oldPrice = price["old"][symbol]?.price;
      const newPrice = price["new"][symbol]?.price;

      const changes =
        oldPrice && newPrice
          ? calculatePriceChange({ oldPrice, newPrice })
          : null;

      return {
        symbol,
        changes,
        url: `https://www.bybit.com/trade/usdt/${symbol}`,
        price: newPrice,
      };
    })
    .filter((item) => Math.abs(item.changes as number) > gap)
    .sort((a, b) => (b.changes as number) - (a.changes as number));
}
