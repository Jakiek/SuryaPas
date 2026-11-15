// Line drawings for the segmented choices on this review page, taken
// from the approved mock (mock/atap.html). They stroke with currentColor,
// so each turns white when its option is selected. The roof step (T12)
// owns the real ones.

const TALL = {
  viewBox: "0 0 60 44",
  width: 60,
  height: 44,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  "aria-hidden": true,
} as const;

const SHORT = {
  viewBox: "0 0 28 28",
  width: 28,
  height: 28,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "square",
  "aria-hidden": true,
} as const;

// Roof slope: two walls and a roof line that gets steeper.
export const slopeDrawings = {
  flat: (
    <svg {...TALL} strokeLinecap="square">
      <path d="M14 40V20M46 40V20" />
      <path d="M6 19h48" strokeWidth={5} />
    </svg>
  ),
  gentle: (
    <svg {...TALL} strokeLinecap="square">
      <path d="M14 40V24M46 40V24" />
      <path d="M5 25 30 13l25 12" strokeWidth={5} strokeLinejoin="miter" />
    </svg>
  ),
  steep: (
    <svg {...TALL} strokeLinecap="square">
      <path d="M15 40V27M45 40V27" />
      <path d="M8 28 30 5l22 23" strokeWidth={5} strokeLinejoin="miter" />
    </svg>
  ),
};

// Facing: an arrow pointing up, right, down, left.
export const facingDrawings = {
  north: (
    <svg {...SHORT}>
      <path d="M14 25V5M6 13l8-8 8 8" />
    </svg>
  ),
  east: (
    <svg {...SHORT}>
      <path d="M3 14h20M15 6l8 8-8 8" />
    </svg>
  ),
  south: (
    <svg {...SHORT}>
      <path d="M14 3v20M6 15l8 8 8-8" />
    </svg>
  ),
  west: (
    <svg {...SHORT}>
      <path d="M25 14H5M13 6l-8 8 8 8" />
    </svg>
  ),
};

// Shade: a roof, the sun (always yellow), and a tree that grows.
const sunAndRoof = (
  <>
    <circle cx={47} cy={10} r={6} className="fill-sun" />
    <path d="M8 38 28 22l20 16" strokeWidth={5} strokeLinecap="square" />
  </>
);

export const shadeDrawings = {
  none: <svg {...TALL}>{sunAndRoof}</svg>,
  some: (
    <svg {...TALL}>
      {sunAndRoof}
      <circle cx={11} cy={16} r={8} fill="currentColor" />
      <path d="M11 24v14" />
    </svg>
  ),
  heavy: (
    <svg {...TALL}>
      {sunAndRoof}
      <circle cx={18} cy={15} r={13} fill="currentColor" />
      <path d="M18 26v12" />
    </svg>
  ),
};
