// The labels an entry can carry: the engine's ConfidenceLabel, which has four
// values. docs/ASSUMPTIONS.md also defines "open" (no acceptable value yet), but
// no entry in the set can carry it, so the screen does not explain it.
export const CONFIDENCE_LABELS = ["sourced", "thin", "judgment", "decision"] as const;
