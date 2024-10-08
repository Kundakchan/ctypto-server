import type { AccountOrderV5, OrderStatusV5 } from "bybit-api";
import { ws, setHandlerWS } from "../client";
import type { Symbol } from "../coins/symbols";
import {
  hasPosition,
  removeTimerForSuccessfulClosingPosition,
} from "../position";
import chalk from "chalk";
import { SETTINGS } from "..";
import { cancelOrder } from "../trading";

export interface Order extends Partial<AccountOrderV5> {
  symbol: Symbol;
  status: "open" | "cancel";
}
interface ActionOrder {
  (params: Partial<Order>): void;
}
interface GetOrders {
  (field: keyof Order, value: Order[keyof Order]): Order[];
}
interface WatchOrdersParams {
  afterFilled?: (params: Order[]) => void;
  beforeFilled?: (params: Order[]) => void;
}

interface ActionsMap extends Partial<Record<OrderStatusV5, ActionOrder>> {}

let orders: Order[] = [];
const ordersToDelete: Partial<Record<Symbol, ReturnType<typeof setTimeout>>> =
  {};

function watchOrders(params: WatchOrdersParams) {
  setHandlerWS({
    topic: "order",
    handler: (message) => {
      const { afterFilled, beforeFilled } = params;
      const data = message.data as unknown as Order[];

      if (beforeFilled) {
        beforeFilled(data);
      }

      data.forEach((order) => {
        const action = actionsMap[order.orderStatus as OrderStatusV5];
        if (action) {
          action(order);
        }
      });

      if (afterFilled) afterFilled(data);
    },
  });

  ws.subscribeV5("order", "linear");
}

const setOrder: ActionOrder = (params) => {
  const index = orders.findIndex((order) => order.orderId === params.orderId);
  if (index === -1) {
    orders.push(params as Order);
  } else {
    orders[index] = { ...orders[index], ...params };
  }
};

const removeOrder: ActionOrder = (params) => {
  orders = orders.filter((order) => order.orderId !== params.orderId);
};
const getOrders: GetOrders = (field = "orderId", value) => {
  return orders.filter((order) => order[field] === value);
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
      getOrders("symbol", order.symbol).forEach((order) => {
        setTimeout(async () => {
          await cancelOrder({
            symbol: order.symbol,
            orderId: order.orderId as string,
          });
        }, intervalTimeForCancelOrder);
        intervalTimeForCancelOrder = intervalTimeForCancelOrder + 500;
      });
      delete ordersToDelete[order.symbol];
      console.log(chalk.yellow(`Ордера ${order.symbol} успешно удалены`));
    }
  }, 60000 * SETTINGS.TIMER_ORDER_CANCEL);
};

const getOrdersSymbol = () => [...new Set(orders.map((order) => order.symbol))];

interface AddCreatedOrderStatusParams {
  id: string;
  status: Order["status"];
  symbol: Symbol;
}
const addCreatedOrderStatus = ({
  id,
  symbol,
  status,
}: AddCreatedOrderStatusParams) => {
  orders.push({ orderId: id, symbol, status });
};

const cancelAllOrdersOfClosedPosition = async (orderList: Order[]) => {
  // Проходим по каждому ордеру из списка ордеров
  for (const order of orderList) {
    // Пропускаем ордера, которые не имеют статус "Filled"
    if (order.orderStatus !== "Filled") continue;

    // Получаем данные для текущего ордера по его ID
    const orderDetails = getOrders("orderId", order.orderId);

    removeTimerForSuccessfulClosingPosition(order.symbol);
    // Проходим по каждому элементу в полученных данных
    for (const orderDetail of orderDetails) {
      // Пропускаем элементы, если их статус не "cancel"
      if (orderDetail.status !== "cancel") continue;

      // Получаем список всех открытых ордеров для данного символа
      const openOrdersForSymbol = getOrders("symbol", order.symbol);

      // Проходим по каждому открытому ордеру и асинхронно отменяем его
      for (const openOrder of openOrdersForSymbol) {
        // Асинхронно отменяем ордер
        await cancelOrder({
          symbol: openOrder.symbol, // Символ текущего открытого ордера
          orderId: openOrder.orderId as string, // ID текущего открытого ордера
        });
      }
    }
  }
};

export {
  cancelAllOrdersOfClosedPosition,
  addCreatedOrderStatus,
  watchOrders,
  hasOrder,
  setTimerClearOrder,
  getOrders,
  getOrdersSymbol,
  removeOrder,
};
