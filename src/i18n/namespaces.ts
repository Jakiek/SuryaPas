// Message files live in messages/<locale>/<namespace>.json (SPEC 5).
// Each task that owns a screen adds its namespace here and creates the
// file in BOTH locales. The messages test fails if the two disagree.
export const namespaces = ["common"] as const;

export type Namespace = (typeof namespaces)[number];
