// Placeholder so the engine folder has something to test. T04 replaces it
// with the real pipeline.
export function kilowattHoursFromWattHours(wattHours: number): number {
  const WATT_HOURS_PER_KWH = 1000; // unit conversion
  return wattHours / WATT_HOURS_PER_KWH;
}
