import type { AccountOrderV5, OrderStatusV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import { symbols, type Symbol } from "../coins/symbols";
import { hasPosition } from "../position";
import chalk from "chalk";
import { SETTINGS } from "..";
import { cancelOrder } from "../trading";

export interface Order extends AccountOrderV5 {
  symbol: Symbol;
}
interface ActionOrder {
  (params: Order): void;
}
interface GetOrders {
  (params: Order, field: keyof Order): Order[];
}
interface WatchOrdersParams {
  afterFilled?: (params: Order[]) => void;
}

interface ActionsMap extends Partial<Record<OrderStatusV5, ActionOrder>> {}

let orders: Order[] = [];
const ordersToDelete: Partial<Record<Symbol, ReturnType<typeof setTimeout>>> =
  {};

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
const getOrders: GetOrders = (params, field = "orderId") => {
  return orders.filter((order) => order[field] === params[field]);
};

const actionsMap: ActionsMap = {
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

const setTimerClearOrder = (order: Order) => {
  if (ordersToDelete[order.symbol]) {
    clearTimeout(ordersToDelete[order.symbol]);
  }
  ordersToDelete[order.symbol] = setTimeout(() => {
    if (!hasPosition(order.symbol)) {
      let intervalTimeForCancelOrder = 0;
      getOrders(order, "symbol").forEach((order) => {
        setTimeout(async () => {
          await cancelOrder({
            symbol: order.symbol,
            orderId: order.orderId,
          });
        }, intervalTimeForCancelOrder);
        intervalTimeForCancelOrder = intervalTimeForCancelOrder + 500;
      });
      delete ordersToDelete[order.symbol];
      console.log(chalk.yellow(`Ордера ${order.symbol} успешно удалены`));
    }
  }, 60000 * SETTINGS.TIMER_ORDER_CANCEL);
};
export { watchOrders, hasOrder, setTimerClearOrder };
