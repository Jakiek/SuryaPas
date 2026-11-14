// The 0.5° grid used to share one sun-data fetch between nearby users.
// Value from docs/ASSUMPTIONS.md, key `sun.cacheCellDegrees`.
//
// This file imports nothing, because scripts/build-sun-fallback.mjs loads it
// directly with Node.
export const CELL_DEGREES = 0.5;

export interface GridCell {
  /** Stable text id, used as the cache key, for example "-7.75,110.25". */
  cellId: string;
  /** Centre of the cell; this is the point we ask NASA POWER about. */
  centreLat: number;
  centreLon: number;
}

// Centre of the cell that contains one coordinate.
// Example: -7.7956 lies in the cell from -8.0 to -7.5, so the centre is -7.75.
function cellCentre(degrees: number): number {
  const cellIndex = Math.floor(degrees / CELL_DEGREES);
  return (cellIndex + 0.5) * CELL_DEGREES;
}

export function gridCellFor(lat: number, lon: number): GridCell {
  const centreLat = cellCentre(lat);
  const centreLon = cellCentre(lon);
  return { cellId: `${centreLat},${centreLon}`, centreLat, centreLon };
}
