export function calculatePriceChange({
  oldPrice,
  newPrice,
}: {
  oldPrice: number;
  newPrice: number;
}) {
  return (newPrice / oldPrice) * 100 - 100;
}
