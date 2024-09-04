import type { AccountOrderV5, OrderStatusV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import { type Symbol } from "../coins/symbols";
import { cancelOrder } from "../trading";
import { SETTINGS } from "..";

export interface Order extends AccountOrderV5 {
  symbol: Symbol;
}

interface OrderList extends Partial<Record<Symbol, Order>> {}

interface Orders extends Record<OrderStatusV5, OrderList> {}

let orders: Orders = {
  Created: {},
  New: {},
  Rejected: {},
  PartiallyFilled: {},
  PartiallyFilledCanceled: {},
  Filled: {},
  Cancelled: {},
  Untriggered: {},
  Triggered: {},
  Deactivated: {},
  Active: {},
};
interface WatchPositionParams {
  afterFilled?: (params: Order) => void;
}

function watchOrders(params: WatchPositionParams) {
  setHandlerWS({
    topic: "order",
    handler: (message) => {
      const list = message.data as unknown as Order[];
      list.forEach((order) => {
        setOrder(order);
        setDeletionByTimer(order);
        if (order.orderStatus === "Filled") {
          if (params.afterFilled) {
            params.afterFilled(order);
          }
        }
      });
    },
  });

  ws.subscribeV5("order", "linear");
}

function setOrder(order: Order) {
  const { symbol, orderStatus } = order;

  switch (orderStatus) {
    case "New":
      orders.New[symbol] = order;
      break;
    case "Filled":
      if (orders.Filled[symbol]) {
        delete orders.Filled[symbol];
      } else {
        delete orders.New[symbol];
        orders.Filled[symbol] = order;
      }
      break;
    case "Untriggered":
      orders.Untriggered[symbol];
      break;
    case "Cancelled":
      delete orders.New[symbol];
      break;
    case "Deactivated":
      delete orders.Untriggered[symbol];
      break;
  }
}

function checkNewOrder(symbol: Symbol): boolean {
  return !!(orders.New?.[symbol] || !!orders.Filled?.[symbol]);
}

function getOrdersActiveLength() {
  return [...Object.keys(orders.New), ...Object.keys(orders.Filled)].length;
}

const orderTimer: Partial<Record<Symbol, ReturnType<typeof setTimeout>>> = {};

function setDeletionByTimer(order: Order) {
  if (order.orderStatus === "New") {
    orderTimer[order.symbol] = setTimeout(() => {
      cancelOrder({
        symbol: order.symbol,
        orderId: order.orderId,
      });
    }, SETTINGS.TIMER_ORDER_CANCEL);
  } else if (order.orderStatus === "Filled") {
    clearTimeout(orderTimer[order.symbol]);
  }
}

const getOrdersFilled = () => orders.Filled;
const getOrderFilled = (symbol: Symbol) => orders.Filled[symbol];

export {
  watchOrders,
  checkNewOrder,
  getOrdersActiveLength,
  getOrdersFilled,
  getOrderFilled,
};
