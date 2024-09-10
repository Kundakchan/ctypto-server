import type { WalletBalanceV5 } from "bybit-api";
import { client } from "../client";
import { SETTINGS } from "..";
import { getPositionsCount } from "../position";

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

const getCoinPurchaseBalance = () => {
  const wallet = getWallet();
  if (wallet?.totalMarginBalance) {
    return (
      parseFloat(wallet.totalMarginBalance) /
      (SETTINGS.NUMBER_OF_POSITIONS - getPositionsCount())
    );
  } else {
    throw new Error("Не удалось получить информацию о балансе");
  }
};

const getAmount = ({
  balance,
  entryPrice,
}: {
  balance: number;
  entryPrice: number;
}) => {
  const money = decreaseByPercentage(balance * SETTINGS.LEVERAGE, 6);
  const amount = money / entryPrice;

  // Calculate the number of orders
  const numberOfOrders = SETTINGS.NUMBER_OF_ORDERS;

  // Initialize the result array
  const result: number[] = [];

  // Calculate the first amount
  let currentAmount = amount / (Math.pow(2, numberOfOrders) - 1);

  for (let i = 0; i < numberOfOrders; i++) {
    // If it's the first element, just push the current amount
    if (i === 0) {
      result.push(currentAmount);
    } else {
      // Each subsequent amount is double the sum of all previous amounts
      currentAmount = result.reduce((acc, val) => acc + val, 0) * 2;
      result.push(currentAmount);
    }
  }

  // Round the amounts based on the entry price
  return result.map((item) =>
    entryPrice < 1 ? Math.round(item) : roundToFirstDecimal(item)
  );
};

const decreaseByPercentage = (value: number, percentage: number): number => {
  if (value < 0 || percentage < 0 || percentage > 100) {
    throw new Error("Некорректные входные данные.");
  }
  return value * (1 - percentage / 100);
};

function roundToFirstDecimal(value: number) {
  const firstDecimal = Math.floor(value * 10) % 10;
  return firstDecimal === 0 ? Math.floor(value) : Math.round(value * 10) / 10;
}

export { watchWallet, getWallet, getCoinPurchaseBalance, getAmount };
