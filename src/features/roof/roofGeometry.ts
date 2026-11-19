// The numbers behind the roof step, kept apart from the screen so they can
// be tested with fixed coordinates.

import area from "@turf/area";
import { MAX_SANE_ROOF_AREA_M2, MIN_SANE_ROOF_AREA_M2 } from "@/lib/schema";

/** A corner of the traced roof: [longitude, latitude], the order GeoJSON and MapLibre use. */
export type Corner = [longitude: number, latitude: number];

/** A roof needs three corners to enclose anything. */
export const MIN_CORNERS = 3;

/**
 * Area in square metres of the shape the corners enclose, as seen from
 * above (the footprint). It is NOT corrected for the slope of the roof:
 * SPEC 2.2 step 2 leaves it uncorrected in stage 1.
 *
 * Turf measures on the Earth's surface, so a house-sized shape is accurate
 * to well under 1%. Fewer than three corners enclose nothing: returns null.
 */
export function footprintAreaM2(corners: Corner[]): number | null {
  if (corners.length < MIN_CORNERS) return null;
  // A GeoJSON polygon ring repeats its first corner at the end.
  const ring = [...corners, corners[0]];
  return area({ type: "Polygon", coordinates: [ring] });
}

/** Whole tenths of a square metre: precise enough, and short to read. */
export function roundArea(areaM2: number): number {
  return Math.round(areaM2 * 10) / 10;
}

export type AreaWarning = "tooSmall" | "tooLarge" | null;

/** SPEC 2.2 step 2: the sanity limits on the area. */
export function areaWarning(areaM2: number | null): AreaWarning {
  if (areaM2 === null || areaM2 <= 0) return null;
  if (areaM2 < MIN_SANE_ROOF_AREA_M2) return "tooSmall";
  if (areaM2 > MAX_SANE_ROOF_AREA_M2) return "tooLarge";
  return null;
}

/** The part of the roof that can hold panels: area × usable fraction. */
export function usableAreaM2(areaM2: number, usableFraction: number): number {
  return areaM2 * usableFraction;
}
