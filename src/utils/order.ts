export type STRATEGY = "REVERSE" | "INERTIA";

interface GetSideParams {
  changes: number;
  strategy: STRATEGY;
}

export function getSide({ changes, strategy }: GetSideParams) {
  if (strategy === "INERTIA") {
    return changes > 0 ? "Buy" : "Sell";
  } else {
    return changes < 0 ? "Buy" : "Sell";
  }
}
