import { describe, expect, it } from "vitest";
import { eventBody } from "../../../lib/events";
import { generateAssessmentId } from "../../../lib/store/ids";
import { MemoryStore } from "../../../lib/store/memory";
import { handleEventRequest } from "./handler";

function post(body: unknown): Request {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/events", () => {
  it("records one event with its name and result id, and answers 204", async () => {
    const store = new MemoryStore();
    const id = generateAssessmentId();

    const response = await handleEventRequest(post({ name: "quote_interest", assessmentId: id }), store);

    expect(response.status).toBe(204);
    const events = store.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: "quote_interest", assessmentId: id });
  });

  it("records an event without a result id", async () => {
    const store = new MemoryStore();
    expect((await handleEventRequest(post({ name: "quote_interest" }), store)).status).toBe(204);
    expect(store.listEvents()[0].assessmentId).toBeNull();
  });

  it("refuses a body that carries anything else, such as a location", async () => {
    const store = new MemoryStore();
    const withLocation = { name: "quote_interest", latitude: -7.79, longitude: 110.37 };

    expect((await handleEventRequest(post(withLocation), store)).status).toBe(400);
    expect(store.listEvents()).toHaveLength(0);
  });

  it("refuses unknown names, malformed ids and broken JSON", async () => {
    const store = new MemoryStore();
    expect((await handleEventRequest(post({ name: "anything" }), store)).status).toBe(400);
    expect((await handleEventRequest(post({ name: "quote_interest", assessmentId: "example" }), store)).status).toBe(400);
    expect((await handleEventRequest(post("{not json"), store)).status).toBe(400);
    expect(store.listEvents()).toHaveLength(0);
  });
});

describe("eventBody", () => {
  it("drops the reserved example id so the body stays valid", () => {
    expect(eventBody("quote_interest", "example")).toEqual({ name: "quote_interest" });
  });
});
