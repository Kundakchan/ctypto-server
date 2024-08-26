// function getBestCoins({
//   coins,
//   price,
//   gap,
// }: {
//   coins: Coin[];
//   price: Price;
//   gap: number;
// }) {
//   const result = coins.map((symbol) => {
//     if (price["old"][symbol]?.price && price["new"][symbol]?.price) {
//       return {
//         symbol: symbol,
//         changes: calculatePriceChange({
//           oldPrice: price["old"][symbol]?.price,
//           newPrice: price["new"][symbol]?.price,
//         }),
//         url: `https://www.bybit.com/trade/usdt/${symbol}`,
//         price: price["new"][symbol]?.price,
//       };
//     } else {
//       return {
//         symbol: symbol,
//         changes: null,
//         url: `https://www.bybit.com/trade/usdt/${symbol}`,
//         price: price["new"][symbol]?.price,
//       };
//     }
//   });

//   return result
//     .filter(
//       (item) =>
//         (item.changes as number) > gap || (item.changes as number) < -gap
//     )
//     .sort((a, b) => (b.changes as number) - (a.changes as number));
// }
