import * as dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.DEMO_API_KEY;
const API_SECRET = process.env.DEMO_API_SECRET;

const { RestClientV5, WebsocketClient } = require("bybit-api");
import type {
  RestClientV5 as RestClientV5Type,
  WebsocketClient as WebsocketClientType,
} from "bybit-api";

export const client: RestClientV5Type = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  demoTrading: true,
});

// export const ws: WebsocketClientType = new WebsocketClient({
//   key: API_KEY,
//   secret: API_SECRET,
//   market: "v5", // Используйте v5 для новых функций
//   demoTrading: true,
//   testnet: false,
//   wsUrl: "wss://stream-demo.bybit.com/v5/private",
// });
