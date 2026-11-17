// The line drawings of the roof questions. Each is an <svg> that strokes
// with currentColor, so it turns white when its option is selected
// (SegmentedChoice). They are decoration: the label says what the option is.

import type { ReactNode } from "react";

const DRAWING = {
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "square",
} as const;

/** Walls and a roof in side view; the pitch is the only difference between the three. */
function House({ walls, roof }: { walls: string; roof: string }) {
  return (
    <svg viewBox="0 0 60 44" width={60} height={44} {...DRAWING}>
      <path d={walls} />
      <path d={roof} strokeWidth={5} strokeLinejoin="miter" />
    </svg>
  );
}

// Flat is under about 10 degrees, gentle about 10 to 35, steep above about 35
// (SPEC 3.2 step 3). The drawn pitches sit inside those ranges.
export const slopePictures: Record<"flat" | "gentle" | "steep", ReactNode> = {
  flat: <House walls="M14 40V20M46 40V20" roof="M6 19h48" />,
  gentle: <House walls="M14 40V24M46 40V24" roof="M5 25 30 13l25 12" />,
  steep: <House walls="M15 40V27M45 40V27" roof="M8 28 30 5l22 23" />,
};

function Arrow({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} {...DRAWING}>
      <path d={path} />
    </svg>
  );
}

export const facingPictures = {
  N: <Arrow path="M14 25V5M6 13l8-8 8 8" />,
  E: <Arrow path="M3 14h20M15 6l8 8-8 8" />,
  S: <Arrow path="M14 3v20M6 15l8 8 8-8" />,
  W: <Arrow path="M25 14H5M13 6l-8 8 8 8" />,
};

/** The sun, a roof, and a tree that grows with the amount of shade. */
function ShadeDrawing({ treeRadius }: { treeRadius: number }) {
  return (
    <svg viewBox="0 0 60 44" width={60} height={44} {...DRAWING}>
      <circle cx={47} cy={10} r={6} fill="#ffcf33" />
      <path d="M8 38 28 22l20 16" strokeWidth={5} />
      {treeRadius > 0 && (
        <>
          <circle cx={treeRadius + 3} cy={treeRadius + 8} r={treeRadius} fill="currentColor" />
          <path d={`M${treeRadius + 3} ${2 * treeRadius + 8}V38`} />
        </>
      )}
    </svg>
  );
}

export const shadePictures = {
  none: <ShadeDrawing treeRadius={0} />,
  some: <ShadeDrawing treeRadius={8} />,
  heavy: <ShadeDrawing treeRadius={13} />,
};
