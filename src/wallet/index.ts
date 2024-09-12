import type { WalletBalanceV5 } from "bybit-api";
import { client } from "../client";
import { SETTINGS } from "..";
import { getPositionSymbol } from "../position";
import { getOrdersSymbol } from "../order";
import { getAvailableSlots } from "../trading";

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
    if (result?.list?.length) {
      setWallet(result.list[0]);
    }

    return getWallet();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

interface WatchWalletParams {
  afterFilled?: (params: Wallet) => void;
}

async function watchWallet(params: WatchWalletParams) {
  const result = await fetchWallet();
  setTimeout(() => {
    watchWallet(params);
  }, 500);
  const { afterFilled } = params;
  if (afterFilled) afterFilled(result);
}

const getCoinPurchaseBalance = () => {
  const wallet = getWallet();
  const availableSlots = getAvailableSlots();
  if (wallet?.totalAvailableBalance && availableSlots > 0) {
    return parseFloat(wallet.totalAvailableBalance) / availableSlots;
  } else if (availableSlots <= 0) {
    return 0;
  } else {
    throw new Error("Не удалось получить информацию о балансе");
  }
};

const getAmount = ({
  balance,
  prices,
  qtyStep,
}: {
  balance: number;
  prices: number[];
  qtyStep: number;
}) => {
  const money = balance * SETTINGS.LEVERAGE;
  const digitsAfterDecimal = qtyStep.toString().split(".")[1]?.length ?? 0;

  const test = prices
    .map((price) => money / price)
    .map((coin, index) => calculatePowerOfTwo(coin, prices.length - index))
    .map((coin) => {
      const value = Math.trunc(coin / qtyStep) * qtyStep;

      if (digitsAfterDecimal) {
        return Math.floor(value * 10) / (10 * digitsAfterDecimal);
      } else {
        return Math.floor(value);
      }
    });

  console.log({
    test,
    qtyStep,
    digitsAfterDecimal,
  });

  return test;
};

const calculatePowerOfTwo = (number: number, power: number): number =>
  number / 2 ** power;

function roundToFirstDecimal(value: number) {
  const firstDecimal = Math.floor(value * 10) % 10;
  return firstDecimal === 0 ? Math.floor(value) : Math.round(value * 10) / 10;
}

export { watchWallet, getWallet, getCoinPurchaseBalance, getAmount };
