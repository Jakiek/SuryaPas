// Moving a sun series from UTC to the home's clock (SPEC 3.4, "Requested in UTC").
//
// The home's use of electricity is described in clock time ("between 06:00
// and 18:00"), so the engine must receive the sun in clock time too. NASA
// POWER gives the hours in UTC; Indonesian clocks are UTC+7 (WIB), UTC+8
// (WITA) or UTC+9 (WIT). On a UTC+7 clock, 12:00 is 05:00 UTC, so:
//
//   hour h of the result = UTC hour (h − offset), counted round the year
//
// "Counted round the year" means the first `offset` hours of the result come
// from the last `offset` UTC hours of 31 December: the hours after midnight on
// the home's clock. Nothing is dropped and nothing is added, so the yearly
// total, and with it the long-term scaling (SPEC 3.4), is unchanged.
//
// Pure: no I/O, no clock. The offset arrives as an argument.

/**
 * The series rotated from UTC to a clock `utcOffsetHours` ahead of UTC.
 * Works on any length: 8,760 for a year, 24 for the hand-worked test.
 */
export function rotateUtcToLegalTime(
  seriesUtc: ReadonlyArray<number>,
  utcOffsetHours: number,
): number[] {
  const length = seriesUtc.length;
  return seriesUtc.map((_, clockHour) => {
    // "% length" alone gives a negative index for the first hours; adding
    // length once more brings it back into 0 … length − 1.
    const utcHour = (((clockHour - utcOffsetHours) % length) + length) % length;
    return seriesUtc[utcHour];
  });
}
