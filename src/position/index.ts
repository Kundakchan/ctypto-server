import { client } from "../client";
import type { Symbol } from "../coins/symbols";

const getPosition = async ({ symbol }: { symbol: Symbol }) => {
  const { result } = await client.getPositionInfo({
    category: "linear",
    symbol: symbol,
  });
  return result?.list ?? [];
};

export { getPosition };
