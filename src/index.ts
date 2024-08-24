import * as dotenv from "dotenv";
dotenv.config();

import { symbols } from "./coins/symbols";
import { subscribePriceCoin, watchPriceCoin, type PriceCoins } from "./price";

const symbolList = symbols.map((symbol) => symbol.symbol);

subscribePriceCoin(symbolList);
watchPriceCoin({ time: 10000, handler: show });

function show(data: PriceCoins) {
  console.log(data);
}
