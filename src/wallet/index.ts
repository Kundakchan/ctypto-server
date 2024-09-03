import type { WalletBalanceV5 } from "bybit-api";
import { client } from "../client";

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
  try {
    const { result } = await client.getWalletBalance({
      accountType: "UNIFIED",
      coin: "USDT",
    });
    if (result?.list.length) {
      setWallet(result.list[0]);
    }

    return wallet;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function watchWallet() {
  await fetchWallet();
  setTimeout(() => {
    watchWallet();
  }, 500);
}

export { watchWallet, getWallet };
