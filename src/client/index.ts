import * as dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

const { RestClientV5, WebsocketClient } = require("bybit-api");

import {
  type RestClientV5 as RestClientV5Type,
  type WebsocketClient as WebsocketClientType,
} from "bybit-api";

type HandlersMapKey = "position" | "wallet" | "order" | "tickers";
interface HandlerWsParams {
  id: string;
  topic: HandlersMapKey;
  creationTime: number;
  data: Record<string, string | number>[];
  wsKey: string;
}
interface HandlerWs {
  (params: HandlerWsParams): void;
}
interface HandlersMap extends Partial<Record<HandlersMapKey, HandlerWs>> {}

interface SetHandlerWSParams {
  topic: HandlersMapKey;
  handler: HandlerWs;
}

const client: RestClientV5Type = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  demoTrading: false,
});

const ws: WebsocketClientType = new WebsocketClient({
  key: API_KEY,
  secret: API_SECRET,
  testnet: false,
  demoTrading: false,
  market: "v5",
});

const HANDLERS_MAP: HandlersMap = {};
const setHandlerWS = ({ topic, handler }: SetHandlerWSParams) => {
  HANDLERS_MAP[topic] = handler;
};

ws.on("update", (message: HandlerWsParams) => {
  const handler = HANDLERS_MAP[message.topic];
  if (handler) {
    handler(message);
  }
});

export { client, ws, setHandlerWS };
