type OrderType = "long" | "short";

export function getTP(price: number, percent: number, type: OrderType) {
  if (type === "long") {
    return price + price * (percent / 100);
  } else {
    return price - price * (percent / 100);
  }
}
export function getSL(price: number, percent: number, type: OrderType) {
  if (type === "long") {
    return price - price * (percent / 100);
  } else {
    return price + price * (percent / 100);
  }
}
