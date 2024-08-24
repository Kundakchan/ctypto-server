const { RestClientV5 } = require("bybit-api");
import fs from "fs";

const client = new RestClientV5({
  key: process.env.API_KEY,
  secret: process.env.API_SECRET,
});

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
