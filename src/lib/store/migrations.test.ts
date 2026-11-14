import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Applies the real migration files, in file-name order, to an empty
// in-process Postgres (PGlite). This catches SQL mistakes without a Supabase
// project. It does not prove anything about Supabase itself (roles, the API
// layer); the owner's project covers that.
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const EXPECTED_TABLES = [
  "assessments",
  "assumption_sets",
  "events",
  "installers",
  "profiles",
  "quote_requests",
  "sun_cache",
];

describe("SQL migrations", () => {
  const db = new PGlite();

  beforeAll(async () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    }
  });

  it("creates the seven tables of SPEC 4.1 and 4.3", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    expect(rows.map((r) => r.tablename)).toEqual(EXPECTED_TABLES);
  });

  it("turns row-level security on for every table", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(EXPECTED_TABLES.length);
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} has row-level security`).toBe(true);
    }
  });

  it("defines no policies, so no public role can read or write", async () => {
    const { rows } = await db.query("select * from pg_policies");
    expect(rows).toEqual([]);
  });

  it("refuses an assessment id that is not 22 URL-safe characters", async () => {
    const insert = (id: string) =>
      db.query(
        `insert into assessments (id, locale, inputs, assumption_set_version, engine_version, sun_source, result)
         values ($1, 'id', '{}', 'v1', '0.1.0', 'live', '{}')`,
        [id],
      );
    await expect(insert("example")).rejects.toThrow();
    await expect(insert("A".repeat(22))).resolves.toBeDefined();
  });

  it("allows an event without an assessment id and a repeat sun-cache cell only once per year", async () => {
    await db.query("insert into events (name) values ('landing_viewed')");
    const put = (year: number) =>
      db.query("insert into sun_cache (cell_id, year, series) values ('c', $1, '[1]')", [year]);
    await put(2025);
    await put(2024);
    await expect(put(2025)).rejects.toThrow();
  });
});
