/**
 * Функция для расчёта нереализованного PnL.
 *
 * @param currentPrice - Текущая рыночная цена актива.
 * @param entryPrice - Средняя цена входа позиции.
 * @param positionSize - Размер позиции (количество контрактов).
 * @param positionType - Тип позиции ('long' или 'short').
 * @returns Нереализованный PnL.
 */
export function calculatePnL(
  currentPrice: number,
  entryPrice: number,
  positionSize: number,
  positionType: "long" | "short"
): number {
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
