/**
 * Функция для расчёта нереализованного PnL.
 *
 * @param currentPrice - Текущая рыночная цена актива.
 * @param entryPrice - Средняя цена входа позиции.
 * @param positionSize - Размер позиции (количество контрактов).
 * @param positionType - Тип позиции ('long' или 'short').
 * @returns Нереализованный PnL.
 */

interface CalculatePnLParams {
  currentPrice: number;
  entryPrice: number;
  positionSize: number;
  positionType: "long" | "short";
}
export function calculatePnL({
  currentPrice,
  entryPrice,
  positionSize,
  positionType,
}: CalculatePnLParams): number {
  let unrealizedPnL: number;

  if (positionType === "long") {
    unrealizedPnL = (currentPrice - entryPrice) * positionSize;
  } else if (positionType === "short") {
    unrealizedPnL = (entryPrice - currentPrice) * positionSize;
  } else {
    throw new Error("Неверный тип позиции. Используйте 'long' или 'short'.");
  }

  return unrealizedPnL;
}

/**
 * Функция для расчёта цены монеты при достижении указанного нереализованного PnL.
 *
 * @param entryPrice - Средняя цена входа позиции.
 * @param positionSize - Размер позиции (количество контрактов).
 * @param positionType - Тип позиции ('long' или 'short').
 * @param targetPnL - Целевой нереализованный PnL.
 * @returns Цена монеты при достижении указанного PnL.
 */

interface CalculatePriceForTargetPnLParams {
  entryPrice: number;
  positionSize: number;
  positionType: "long" | "short";
  targetPnL: number;
}
export function calculatePriceForTargetPnL({
  entryPrice,
  positionSize,
  positionType,
  targetPnL,
}: CalculatePriceForTargetPnLParams): number {
  let targetPrice: number;

  if (positionType === "long") {
    targetPrice = targetPnL / positionSize + entryPrice;
  } else if (positionType === "short") {
    targetPrice = entryPrice - targetPnL / positionSize;
  } else {
    throw new Error("Неверный тип позиции. Используйте 'long' или 'short'.");
  }

  return targetPrice;
}
