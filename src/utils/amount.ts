interface GetAmountParams {
  balance: number;
  price: number;
  leverage?: number;
}
export function getAmount({ balance, price, leverage = 10 }: GetAmountParams) {
  return nearestLowerMultipleOfTen((balance / price) * leverage);
}

export function nearestLowerMultipleOfTen(num: number) {
  // Находим ближайшее меньшее кратное 10
  return Math.floor(num / 10) * 10;
}
