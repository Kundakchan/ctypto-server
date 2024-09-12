interface CalculatePercentage {
  (params: { target: number; percent: number }): number;
}
const calculatePercentage: CalculatePercentage = ({ target, percent }) =>
  target * (percent / 100);

export { calculatePercentage };
