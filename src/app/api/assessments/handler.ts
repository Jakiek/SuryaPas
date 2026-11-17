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
 * The largest request body, in bytes, the route reads (SPEC 5.1). It is a
 * transport limit that keeps a stranger from making the server hold a huge
 * body; it is not a product number, so it is not in the assumption set.
 *
 * The largest valid request is far below it: twelve monthly bills (about 8
 * characters each), the four answer groups (a few hundred characters), and an
 * override for every adjustable assumption (a key of about 40 characters and a
 * number, under 80 characters per entry; there are fewer than 60 entries).
 * That adds up to roughly 6 KB. 16 KiB leaves more than double that room. The
 * test "accepts the largest valid request" builds that request from the
 * assumption set and checks it stays under this limit.
 */
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;

/**
 * Reads the body as text, giving up as soon as it passes the limit. The
 * declared Content-Length is checked first, and the bytes actually received
 * are counted as well, because the header can be missing or wrong.
 * Returns null when the body is too large.
 */
async function readBodyWithinLimit(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) return null;
  if (request.body === null) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
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
  // 0. A body over the limit is refused before it is parsed.
  const text = await readBodyWithinLimit(request);
  if (text === null) return errorResponse("request_too_large", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
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
  //    SPEC 2.5 "Saving fails": if the store cannot be written (a free
  //    database project pauses when idle), the result is still returned,
  //    marked as not saved, and the browser keeps it for the session.
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
    return Response.json({ saved: false, assessment: jsonCopy(result) }, { status: 200 });
  }
}

/** Forgets which versions were stored. For tests that use a fresh store each time. */
export function forgetStoredVersions(): void {
  storedVersions.clear();
}
