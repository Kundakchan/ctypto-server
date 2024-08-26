export function getAmount(balance: number, price: number) {
  return (balance / price) * 10;
}

export function nearestLowerMultipleOfTen(num: number) {
  // Находим ближайшее меньшее кратное 10
  return Math.floor(num / 10) * 10;
}
