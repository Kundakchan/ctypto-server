import { Side } from "..";

interface CalculatePriceChange {
  (params: { oldPrice: number; newPrice: number }): number;
}
interface CalculatePercentage {
  (params: { entryPrice: number; percentage: number }): number;
}

interface GetLimitPrice {
  (params: { side: Side; entryPrice: number; percent: number }): number;
}

const calculatePriceChange: CalculatePriceChange = (params) => {
  return (params.newPrice / params.oldPrice) * 100 - 100;
};

const calculatePercentage: CalculatePercentage = (params) => {
  return (params.percentage / 100) * params.entryPrice;
};

const getLimitPrice: GetLimitPrice = (params) => {
  const difference = calculatePercentage({
    entryPrice: params.entryPrice,
    percentage: params.percent,
  });
  if (params.side === "Buy") {
    return params.entryPrice + difference;
  } else {
    return params.entryPrice - difference;
  }
};

export { calculatePercentage, calculatePriceChange, getLimitPrice };
