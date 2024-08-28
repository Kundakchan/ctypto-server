import { calculatePriceForTargetPnL } from "./PnL";

type OrderType = "long" | "short";

export function getTPByPercent(
  price: number,
  percent: number,
  type: OrderType
) {
  if (type === "long") {
    return price + price * (percent / 100);
  } else {
    return price - price * (percent / 100);
  }
}
export function getSLByPercent(
  price: number,
  percent: number,
  type: OrderType
) {
  if (type === "long") {
    return price - price * (percent / 100);
  } else {
    return price + price * (percent / 100);
  }
}

interface TPSLParams {
  price: number;
  gap: number;
  size: number;
  side: "Buy" | "Sell";
}

export function getTPByPnL({ price, size, gap, side }: TPSLParams) {
  return calculatePriceForTargetPnL({
    entryPrice: price,
    positionSize: size,
    positionType: side === "Buy" ? "long" : "short",
    targetPnLPercentage: gap,
  });
}

export function getSLByPnL({ price, size, gap, side }: TPSLParams) {
  return calculatePriceForTargetPnL({
    entryPrice: price,
    positionSize: size,
    positionType: side === "Buy" ? "long" : "short",
    targetPnLPercentage: -gap,
  });
}
