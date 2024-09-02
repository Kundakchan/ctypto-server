import type { AccountOrderV5, OrderStatusV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";

interface Order extends AccountOrderV5 {
  symbol: Symbol;
}

let orders: Order[] = [];

function watchOrders() {
  setHandlerWS({
    topic: "order",
    handler: (message) => {
      const list = message.data as unknown as Order[];
      list.forEach((order) => {
        setOrder(order);
      });
    },
  });

  ws.subscribeV5("order", "linear");
}

function setOrder(order: Order) {
  const { symbol } = order;
  const index = getIndexOrderBySymbol(symbol);
  if (index === -1) {
    orders.push(order);
  } else {
    orders[index] = order;
  }
}

function getIndexOrderBySymbol(symbol: Symbol) {
  return orders.findIndex((order) => order.symbol === symbol);
}

function getOrderByStatus(status: OrderStatusV5) {
  return orders.filter((order) => order.orderStatus === status);
}

function checkNewOrder(symbol: Symbol) {
  return !!getOrderByStatus("New").filter((order) => order.symbol === symbol)
    .length;
}

function getOrdersActive() {
  const ordersNew = getOrderByStatus("New");
  const ordersFilled = getOrderByStatus("Filled");
  return [...ordersNew, ...ordersFilled];
}

export { watchOrders, checkNewOrder, getOrdersActive };
