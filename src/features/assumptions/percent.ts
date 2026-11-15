// Shares are stored as fractions (0.05, as the engine reads them) and shown
// and typed as percent (5). These two functions are the only place the
// factor of 100 appears.

const PERCENT = 100;

/** 0.05 becomes 5. The rounding to 12 digits removes float noise (0.07 * 100 is 7.000000000000001). */
export function fractionToPercent(fraction: number): number {
  return Number((fraction * PERCENT).toPrecision(12));
}

/** 5 becomes 0.05. A division, so it gives the same number as writing the fraction out (0.5 gives 0.005). */
export function percentToFraction(percent: number): number {
  return percent / PERCENT;
}
