import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";
interface Order extends Record<string, string | number> {}

let orders: Order[] = [];

function watchOrders() {
  setHandlerWS({
    topic: "order",
    handler: (message) => {
      orders = message.data;
      console.log("order", message);
    },
  });

  ws.subscribeV5("order", "linear");
}

type OrderStatus =
  | "New"
  | "PartiallyFilled"
  | "Untriggered"
  | "Rejected"
  | "PartiallyFilledCanceled"
  | "Filled"
  | "Cancelled"
  | "Triggered"
  | "Deactivated";

const getOrdersByStatus = (status: OrderStatus) =>
  orders.filter((order) => order.orderStatus === status);

const checkOpenOrder = (symbol: Symbol) => {
  return !!getOrdersByStatus("New").filter((order) => order.symbol === symbol)
    .length;
};

const getOrderList = () =>
  getOrdersByStatus("New").map((order) => order.symbol);

export { watchOrders, checkOpenOrder, getOrderList };
