export function computeCommissionAmounts(input: {
  amountVnd: number;
  firstTouchPct: number;
  closerPct: number;
}): { first_touch_amt: number; closer_amt: number } {
  const total = Math.max(0, Math.round(input.amountVnd));
  const first_touch_amt = Math.round((total * input.firstTouchPct) / 100);
  const closer_amt = Math.max(0, total - first_touch_amt);
  return { first_touch_amt, closer_amt };
}
