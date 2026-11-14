import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAssessmentId, isWellFormedAssessmentId } from "./ids";
import { canonicalJson } from "./json";
import {
  AssumptionSetConflictError,
  StoreError,
  type AppEvent,
  type Assessment,
  type AssumptionSet,
  type JsonObject,
  type Locale,
  type NewAssessment,
  type Store,
  type SunCacheEntry,
  type SunSource,
} from "./types";

// The store on Supabase Postgres. It receives a ready-made client, so this
// file never reads a key and can be imported anywhere. The one place that
// builds the client from the service-role key is server.ts.

// --- Row shapes: the table columns of supabase/migrations, in snake_case ---

type AssessmentRow = {
  id: string;
  created_at: string;
  locale: Locale;
  inputs: JsonObject;
  overrides: JsonObject;
  assumption_set_version: string;
  engine_version: string;
  sun_source: SunSource;
  result: JsonObject;
  owner_id: string | null;
};

type SunCacheRow = {
  cell_id: string;
  year: number;
  fetched_at: string;
  series: number[];
};

type AssumptionSetRow = {
  version: string;
  entries: JsonObject;
  note: string;
};

// --- Row <-> object conversion (pure, so it can be tested on its own) ---

export function assessmentFromRow(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    // Postgres returns "2026-11-14T10:00:00.123456+00:00"; normalise to the
    // ISO form the memory store produces.
    createdAt: new Date(row.created_at).toISOString(),
    locale: row.locale,
    inputs: row.inputs,
    overrides: row.overrides,
    assumptionSetVersion: row.assumption_set_version,
    engineVersion: row.engine_version,
    sunSource: row.sun_source,
    result: row.result,
    ownerId: row.owner_id,
  };
}

export function assessmentToRow(
  input: NewAssessment,
  id: string,
): Omit<AssessmentRow, "created_at" | "owner_id"> {
  return {
    id,
    locale: input.locale,
    inputs: input.inputs,
    overrides: input.overrides,
    assumption_set_version: input.assumptionSetVersion,
    engine_version: input.engineVersion,
    sun_source: input.sunSource,
    result: input.result,
  };
}

export function sunCacheFromRow(row: SunCacheRow): SunCacheEntry {
  return {
    cellId: row.cell_id,
    year: row.year,
    fetchedAt: new Date(row.fetched_at).toISOString(),
    series: row.series,
  };
}

export function sunCacheToRow(entry: SunCacheEntry): SunCacheRow {
  return {
    cell_id: entry.cellId,
    year: entry.year,
    fetched_at: entry.fetchedAt,
    series: entry.series,
  };
}

// Postgres error code for "unique_violation": the primary key already exists.
const UNIQUE_VIOLATION = "23505";
// A second try is enough: two random 128-bit ids colliding is not realistic.
const ID_COLLISION_RETRIES = 1;

export class SupabaseStore implements Store {
  constructor(private readonly client: SupabaseClient) {}

  async createAssessment(input: NewAssessment): Promise<Assessment> {
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await this.client
        .from("assessments")
        .insert(assessmentToRow(input, generateAssessmentId()))
        .select()
        .single();

      if (!error) return assessmentFromRow(data as AssessmentRow);
      // Retry only on a duplicate id, with a fresh id.
      if (error.code === UNIQUE_VIOLATION && attempt < ID_COLLISION_RETRIES) {
        continue;
      }
      throw new StoreError("Could not save the assessment.", { cause: error });
    }
  }

  async getAssessment(id: string): Promise<Assessment | null> {
    // Junk and the reserved id "example" never reach the database.
    if (!isWellFormedAssessmentId(id)) return null;

    const { data, error } = await this.client
      .from("assessments")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new StoreError("Could not read the assessment.", { cause: error });
    }
    return data ? assessmentFromRow(data as AssessmentRow) : null;
  }

  async getSunCache(
    cellId: string,
    year: number,
  ): Promise<SunCacheEntry | null> {
    const { data, error } = await this.client
      .from("sun_cache")
      .select()
      .eq("cell_id", cellId)
      .eq("year", year)
      .maybeSingle();

    if (error) {
      throw new StoreError("Could not read the sun cache.", { cause: error });
    }
    return data ? sunCacheFromRow(data as SunCacheRow) : null;
  }

  async putSunCache(entry: SunCacheEntry): Promise<void> {
    const { error } = await this.client
      .from("sun_cache")
      .upsert(sunCacheToRow(entry), { onConflict: "cell_id,year" });

    if (error) {
      throw new StoreError("Could not write the sun cache.", { cause: error });
    }
  }

  async recordEvent(event: AppEvent): Promise<void> {
    const { error } = await this.client.from("events").insert({
      name: event.name,
      assessment_id: event.assessmentId ?? null,
    });

    if (error) {
      throw new StoreError("Could not record the event.", { cause: error });
    }
  }

  async upsertAssumptionSet(set: AssumptionSet): Promise<void> {
    const { data: existing, error: readError } = await this.client
      .from("assumption_sets")
      .select()
      .eq("version", set.version)
      .maybeSingle();

    if (readError) {
      throw new StoreError("Could not read the assumption set.", {
        cause: readError,
      });
    }

    const stored = existing as AssumptionSetRow | null;
    if (stored && canonicalJson(stored.entries) !== canonicalJson(set.entries)) {
      throw new AssumptionSetConflictError(set.version);
    }

    // New version, or the same entries again (only the note can differ).
    const { error } = await this.client
      .from("assumption_sets")
      .upsert(
        { version: set.version, entries: set.entries, note: set.note },
        { onConflict: "version" },
      );

    if (error) {
      throw new StoreError("Could not write the assumption set.", {
        cause: error,
      });
    }
  }
}
