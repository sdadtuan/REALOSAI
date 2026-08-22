export function splitOnSlaHop(input: { firstTouchPct: number; closerPct: number }): {
  first_touch_pct: number;
  closer_pct: number;
} {
  return { first_touch_pct: input.firstTouchPct, closer_pct: input.closerPct };
}
