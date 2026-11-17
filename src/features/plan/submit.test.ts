import { describe, expect, it } from "vitest";
import { assessmentRequestSchema } from "../../lib/schema";
import { emptyDraft, type PlanDraft } from "./draft";
import { UNSAVED_KEY } from "../result/unsavedStore";
import { buildRequest, submitAssessment } from "./submit";

/** A draft with all four steps filled in validly. */
function completeDraft(): PlanDraft {
  const draft = emptyDraft();
  draft.step = 4;
  draft.location = { latitude: -7.78, longitude: 110.37 };
  draft.roof = { ...draft.roof, areaM2: 48, facing: "E", slope: "gentle", shade: "none" };
  draft.electricity = {
    billing: "postpaid",
    connectedVa: 2200,
    subsidised: false,
    monthlySpendRp: [650000],
  };
  draft.lifestyle = {
    homeOnWeekdays: true,
    daytimeAc: false,
    workFromHome: true,
    electricVehicle: false,
  };
  return draft;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("submitting the flow", () => {
  it("sends a body that passes the whole-input schema", async () => {
    let sentBody: unknown;
    const send: typeof fetch = async (_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse(200, { id: "abc123" });
    };

    const result = await submitAssessment(completeDraft(), "id", send);

    expect(result).toEqual({ ok: true, saved: true, id: "abc123" });
    expect(assessmentRequestSchema.safeParse(sentBody).success).toBe(true);
  });

  it("does not send an incomplete draft", async () => {
    let called = false;
    const send: typeof fetch = async () => {
      called = true;
      return jsonResponse(200, { id: "x" });
    };
    const result = await submitAssessment(emptyDraft(), "id", send);
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(called).toBe(false);
    expect(buildRequest(emptyDraft(), "en")).toBeNull();
  });

  it("reports a network failure so the screen can offer a retry", async () => {
    const send: typeof fetch = async () => {
      throw new TypeError("offline");
    };
    expect(await submitAssessment(completeDraft(), "en", send)).toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("reports a server error", async () => {
    const send: typeof fetch = async () => jsonResponse(500, {});
    expect(await submitAssessment(completeDraft(), "id", send)).toEqual({
      ok: false,
      reason: "server",
    });
  });

  it("returns a result the server could not save, with the request for a retry", async () => {
    const assessment = { assumptionSetVersion: "v2" };
    const send: typeof fetch = async () => jsonResponse(200, { saved: false, assessment });
    const kept = new Map<string, string>();
    const storage = {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
      removeItem: (key: string) => void kept.delete(key),
    };
    const result = await submitAssessment(completeDraft(), "en", send, storage);
    expect(result).toEqual({
      ok: true,
      saved: false,
      id: "unsaved",
      assessment,
      request: buildRequest(completeDraft(), "en"),
    });
    // Kept under its own key only, for the not-saved page to read.
    expect([...kept.keys()]).toEqual([UNSAVED_KEY]);
  });

  it("treats an answer with neither an id nor a result as a server error", async () => {
    const send: typeof fetch = async () => jsonResponse(200, { saved: false });
    expect(await submitAssessment(completeDraft(), "id", send)).toEqual({ ok: false, reason: "server" });
  });
});
