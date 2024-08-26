import type { WalletBalanceV5 } from "bybit-api";
import { ws, client } from "../client";

interface Wallet extends Partial<Omit<WalletBalanceV5, "coin">> {}

let wallet: Wallet = {};

function setWallet(data: WalletBalanceV5) {
  const { coin, ...property } = data;
  wallet = property;
}

function getWallet() {
  return wallet;
}

async function fetchWallet() {
  const { result } = await client.getWalletBalance({
    accountType: "UNIFIED",
    coin: "USDT",
  });
  setWallet(result.list[0]);
  return wallet;
}

ws.on("update", (message) => {
  const { data } = message as { data: WalletBalanceV5[] };
  setWallet(data[0]);
});

async function watchWallet() {
  await fetchWallet();
  ws.subscribe(["wallet"]);
}

export { watchWallet, getWallet };
