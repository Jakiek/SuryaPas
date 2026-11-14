// The store interface: every read and write the app makes against saved data.
// Two implementations exist (memory.ts and supabase.ts); the contract tests in
// store.contract.ts hold both to the same behaviour (SPEC 4).
//
// This file has no imports and is safe to import from client code as types.

// Anything that survives JSON.stringify. Inputs, results and assumption
// entries are stored as json columns, so this is the honest type for them.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type SunSource = "live" | "fallback";

export type Locale = "id" | "en";

// What the caller supplies when saving a result (SPEC 4.1, `assessments`).
// The id and the timestamp are not here on purpose: the store makes both, so a
// client can never choose its own id.
export type NewAssessment = {
  locale: Locale;
  // location, roof, electricity and lifestyle answers
  inputs: JsonObject;
  // assumptions the user changed on top of the versioned set
  overrides: JsonObject;
  assumptionSetVersion: string;
  engineVersion: string;
  sunSource: SunSource;
  // the full engine output, exactly as shown (SPEC 4.2)
  result: JsonObject;
};

export type Assessment = NewAssessment & {
  id: string;
  createdAt: string; // ISO 8601
  ownerId: string | null; // always null until stage 2
};

// One 0.5 degree grid cell's hourly sun series for one year (SPEC 3.4).
export type SunCacheEntry = {
  cellId: string;
  year: number;
  fetchedAt: string; // ISO 8601
  series: number[];
};

// One anonymous count (SPEC 4.1, `events`).
export type AppEvent = {
  name: string;
  assessmentId?: string | null;
};

// One version of the assumptions (SPEC 4.1, `assumption_sets`).
export type AssumptionSet = {
  version: string;
  entries: JsonObject;
  note: string;
};

// Thrown when someone tries to change the entries of a version that is
// already stored. SPEC 4.2: a changed value means a new version, never an edit.
export class AssumptionSetConflictError extends Error {
  constructor(version: string) {
    super(
      `Assumption set "${version}" already exists with different entries. ` +
        "Publish the change as a new version instead of editing this one.",
    );
    this.name = "AssumptionSetConflictError";
  }
}

// Thrown when the database (or any other backing service) fails. Callers show
// the "saving failed" behaviour of SPEC 2.5 when they catch this.
export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StoreError";
  }
}

export interface Store {
  // Saves a result under a new random id and returns it with that id.
  createAssessment(input: NewAssessment): Promise<Assessment>;
  // Returns null for an id that does not exist or is not even well formed.
  // Never throws "not found".
  getAssessment(id: string): Promise<Assessment | null>;

  getSunCache(cellId: string, year: number): Promise<SunCacheEntry | null>;
  // Inserts, or replaces the entry for the same cell and year.
  putSunCache(entry: SunCacheEntry): Promise<void>;

  recordEvent(event: AppEvent): Promise<void>;

  // Inserts a new version. Storing the same version again with identical
  // entries is allowed (a deploy can run twice); different entries throw
  // AssumptionSetConflictError.
  upsertAssumptionSet(set: AssumptionSet): Promise<void>;
}
