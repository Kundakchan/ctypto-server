import type { AccountOrderV5, OrderStatusV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";

export interface Order extends AccountOrderV5 {
  symbol: Symbol;
}

interface WatchOrdersParams {
  afterFilled?: (params: Order[]) => void;
}

let orders: Order[] = [];

function watchOrders(params: WatchOrdersParams) {
  setHandlerWS({
    topic: "order",
    handler: (message) => {
      const data = message.data as unknown as Order[];
      data.forEach((order) => {
        const action = actionsMap[order.orderStatus];
        if (action) {
          action(order);
        }
      });

      const { afterFilled } = params;
      if (afterFilled) afterFilled(data);
    },
  });

  ws.subscribeV5("order", "linear");
}

interface ActionOrder {
  (params: Order): void;
}
const setOrder: ActionOrder = (params) => {
  const index = orders.findIndex((order) => order.orderId === params.orderId);
  if (index === -1) {
    orders.push(params);
  } else {
    orders[index] = params;
  }
};

const removeOrder: ActionOrder = (params) => {
  orders = orders.filter((order) => order.orderId !== params.orderId);
};

const actionsMap: Partial<Record<OrderStatusV5, ActionOrder>> = {
  New: setOrder,
  PartiallyFilled: setOrder,
  Untriggered: setOrder,
  Rejected: removeOrder,
  PartiallyFilledCanceled: removeOrder,
  Filled: removeOrder,
  Cancelled: removeOrder,
  Triggered: removeOrder,
  Deactivated: removeOrder,
};

const findOrdersBySymbolAndStatus = (symbol: Symbol, status: OrderStatusV5) => {
  return orders.filter(
    (order) => order.symbol === symbol && order.orderStatus === status
  );
};

const hasOrder = (symbol: Symbol) =>
  !!findOrdersBySymbolAndStatus(symbol, "New").length;

export { watchOrders, hasOrder };
