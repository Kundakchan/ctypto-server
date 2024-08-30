import { APIResponseV3WithTime, OrderResultV5 } from "bybit-api";
import { Symbol } from "../coins/symbols";
import { Side } from "..";
interface SetStopOrder {
  (params: {
    symbol: Symbol;
    entryPrice: number;
    trailingStopSum: number;
    result: APIResponseV3WithTime<{}>;
  }): void;
}

interface CreateOrder {
  (params: {
    result: APIResponseV3WithTime<OrderResultV5>;
    symbol: Symbol;
    side: Side;
    price: number;
    amount: number;
    entryPrice: number;
  }): void;
}

const setStopOrder: SetStopOrder = (params) => {
  if (params.result.retMsg === "OK") {
    console.table({
      message: "Успешно добавлен скользящей стоп-ордер!",
      symbol: params.symbol,
      url: `https://www.bybit.com/trade/usdt/${params.symbol}`,
    });
  } else {
    console.error("Ошибка добавления скользящего стоп-ордера!");
    console.table({
      symbol: params.symbol,
      entryPrice: params.entryPrice,
      trailingStopSum: params.trailingStopSum,
      url: `https://www.bybit.com/trade/usdt/${params.symbol}`,
      ...params.result,
    });
  }
};

const createOrder: CreateOrder = (params) => {
  if (params.result.retMsg === "OK") {
    console.table({
      message: "Успешно создан ордер!",
      symbol: params.symbol,
      url: `https://www.bybit.com/trade/usdt/${params.symbol}`,
    });
  } else {
    console.error("Ошибка создания ордера!");
    console.table({
      symbol: params.symbol,
      "Направления покупки (side)": params.side,
      "Количество токенов (amount)": params.amount,
      "Цена покупки (price)": params.price,
      "Текущая рыночная цена (entryPrice)": params.entryPrice,
      ...params.result,
    });
  }
};

export const logger = {
  setStopOrder,
  createOrder,
};
