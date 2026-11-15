// The logic of POST /api/assessments (SPEC 5.1), apart from the route file so
// tests can hand it their own store and sun data.
//
// In order: validate the request, fetch a year of sun, apply the user's
// assumption changes, run the engine, save, return the new id.
import {
  applyOverrides,
  assess,
  ENGINE_VERSION,
  type AssumptionSet,
  type SunSeries,
} from "../../../engine";
import { isInsideIndonesia } from "../../../features/location/indonesia";
import { assessmentRequestSchema } from "../../../lib/schema";
import { jsonCopy } from "../../../lib/store/json";
import type { JsonObject, Store } from "../../../lib/store/types";

export interface CreateAssessmentDeps {
  store: Pick<Store, "createAssessment" | "upsertAssumptionSet">;
  /** A year of sun for the point: the sun service in the app, a fixed series in tests. */
  sunFor: (latitude: number, longitude: number) => Promise<SunSeries>;
  /** The assumption set new results use: CURRENT_ASSUMPTIONS in the app. */
  assumptions: AssumptionSet;
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

/**
 * The assumption set as one json value for the `assumption_sets` table.
 * Everything except the version, which has its own column: the scalar
 * entries, the tariff classes, the orientation table and the battery sizes,
 * so an old result can always be traced to the numbers behind it (SPEC 4.2).
 */
export function assumptionSetRow(assumptions: AssumptionSet) {
  const { version, ...everythingElse } = assumptions;
  return {
    version,
    entries: jsonCopy(everythingElse) as unknown as JsonObject,
    note: `Assumption set version ${version}, from src/engine/assumptions.`,
  };
}

// Versions this server process has already stored, so the upsert runs once per
// version and not on every request. Storing it again would be harmless.
const storedVersions = new Set<string>();

export async function handleCreateAssessment(
  request: Request,
  deps: CreateAssessmentDeps,
): Promise<Response> {
  // 1. Validate with the same schema the flow's forms use.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", 400);
  }
  const parsed = assessmentRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_request", 400);
  const { inputs, overrides, locale } = parsed.data;

  // SPEC 2.2 step 1: the pin must fall inside Indonesia. The schema checks
  // only the coordinate ranges; the flow blocks such a pin, and so does this.
  if (!isInsideIndonesia(inputs.location.latitude, inputs.location.longitude)) {
    return errorResponse("outside_indonesia", 400);
  }

  // 2. The user's changes on top of the current set. A change that is not
  //    allowed (wrong key, out of range) is refused here, before any work.
  let assumptionsInUse: AssumptionSet;
  try {
    assumptionsInUse = applyOverrides(deps.assumptions, overrides);
  } catch {
    return errorResponse("invalid_overrides", 400);
  }

  // 3. A year of sun. The service never fails: it falls back to bundled data.
  const sun = await deps.sunFor(inputs.location.latitude, inputs.location.longitude);

  // 4. The engine.
  const result = assess(inputs, sun, assumptionsInUse);

  // 5. Save. The assumption set goes in first: the database has no foreign
  //    key that would catch a result pointing at a version it does not hold.
  try {
    if (!storedVersions.has(deps.assumptions.version)) {
      await deps.store.upsertAssumptionSet(assumptionSetRow(deps.assumptions));
      storedVersions.add(deps.assumptions.version);
    }
    const saved = await deps.store.createAssessment({
      locale,
      inputs: inputs as unknown as JsonObject,
      overrides: overrides as JsonObject,
      // The base version; the user's changes are stored beside it in `overrides`.
      assumptionSetVersion: deps.assumptions.version,
      engineVersion: ENGINE_VERSION,
      sunSource: sun.source,
      result: jsonCopy(result) as unknown as JsonObject,
    });
    return Response.json({ id: saved.id }, { status: 201 });
  } catch {
    // SPEC 2.5 "Saving fails": the flow keeps the answers and offers a retry.
    return errorResponse("save_failed", 503);
  }
}

/** Forgets which versions were stored. For tests that use a fresh store each time. */
export function forgetStoredVersions(): void {
  storedVersions.clear();
}
