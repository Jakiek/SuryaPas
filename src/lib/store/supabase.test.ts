import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  assessmentFromRow,
  assessmentToRow,
  sunCacheFromRow,
  sunCacheToRow,
  SupabaseStore,
} from "./supabase";
import { StoreError, type NewAssessment } from "./types";

// A stand-in for the Supabase client. Every query chain (.from().insert()
// .select().single() and so on) ends in a result taken from `results`, and
// every table name and method used is written to `log`. It lets us test our
// own logic around the client without a database; the real client is checked
// by supabase.contract.test.ts when a project is available.
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(results: QueryResult[]) {
  const log: string[] = [];
  const client = {
    from(table: string) {
      log.push(`from:${table}`);
      const chain: Record<string, unknown> = {};
      for (const method of ["insert", "upsert", "select", "eq"]) {
        chain[method] = () => {
          log.push(method);
          return chain;
        };
      }
      const finish = () => Promise.resolve(results.shift() ?? { data: null, error: null });
      chain.single = finish;
      chain.maybeSingle = finish;
      // insert/upsert without .select() are awaited directly.
      chain.then = (resolve: (r: QueryResult) => unknown) => finish().then(resolve);
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, log };
}

const input: NewAssessment = {
  locale: "en",
  inputs: { roof: { areaM2: 30 } },
  overrides: {},
  assumptionSetVersion: "v1",
  engineVersion: "0.1.0",
  sunSource: "fallback",
  result: { ok: true },
};

describe("row conversion", () => {
  it("maps an assessment to snake_case columns and back", () => {
    const row = {
      ...assessmentToRow(input, "A".repeat(22)),
      created_at: "2026-11-14T10:00:00.123456+00:00",
      owner_id: null,
    };
    expect(row.assumption_set_version).toBe("v1");
    expect(row.sun_source).toBe("fallback");

    expect(assessmentFromRow(row)).toEqual({
      ...input,
      id: "A".repeat(22),
      createdAt: "2026-11-14T10:00:00.123Z",
      ownerId: null,
    });
  });

  it("maps a sun cache entry to columns and back", () => {
    const entry = {
      cellId: "c1",
      year: 2025,
      fetchedAt: "2026-11-14T10:00:00.000Z",
      series: [1, 2],
    };
    expect(sunCacheFromRow(sunCacheToRow(entry))).toEqual(entry);
  });
});

describe("SupabaseStore", () => {
  it("answers null for junk ids without calling the database", async () => {
    const { client, log } = fakeClient([]);
    const store = new SupabaseStore(client);

    expect(await store.getAssessment("example")).toBeNull();
    expect(await store.getAssessment("")).toBeNull();
    expect(log).toEqual([]);
  });

  it("answers null when the row does not exist", async () => {
    const { client } = fakeClient([{ data: null, error: null }]);
    const store = new SupabaseStore(client);
    expect(await store.getAssessment("A".repeat(22))).toBeNull();
  });

  it("wraps a database failure in a StoreError", async () => {
    const { client } = fakeClient([{ data: null, error: { message: "boom" } }]);
    const store = new SupabaseStore(client);
    await expect(store.getAssessment("A".repeat(22))).rejects.toBeInstanceOf(StoreError);
  });

  it("retries once with a new id when the id is already taken", async () => {
    const saved = {
      ...assessmentToRow(input, "B".repeat(22)),
      created_at: "2026-11-14T10:00:00Z",
      owner_id: null,
    };
    const { client, log } = fakeClient([
      { data: null, error: { code: "23505", message: "duplicate key" } },
      { data: saved, error: null },
    ]);
    const store = new SupabaseStore(client);

    const created = await store.createAssessment(input);
    expect(created.id).toBe("B".repeat(22));
    expect(log.filter((entry) => entry === "insert")).toHaveLength(2);
  });

  it("does not retry other insert errors", async () => {
    const { client, log } = fakeClient([
      { data: null, error: { code: "42501", message: "denied" } },
    ]);
    const store = new SupabaseStore(client);

    await expect(store.createAssessment(input)).rejects.toBeInstanceOf(StoreError);
    expect(log.filter((entry) => entry === "insert")).toHaveLength(1);
  });
});
