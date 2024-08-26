import { client } from "../client";

export function getWallet() {
  return client
    .getWalletBalance({ accountType: "UNIFIED", coin: "USDT" })
    .then((data) => {
      return data.result.list[0];
    });
}
