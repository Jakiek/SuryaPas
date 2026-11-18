// The only place that reads Supabase variables and builds the real client.
//
// `server-only` makes the build fail if a client component ever imports this
// file, directly or through another module. That keeps the service-role key
// out of the browser bundle. The key must also never get a NEXT_PUBLIC_ name.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { MemoryStore } from "./memory";
import { fetchWithTimeout } from "./requestTimeout";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

// Kept on globalThis so that Next.js dev-mode reloads do not throw away the
// in-memory data (and so every route handler shares one instance).
const globalForStore = globalThis as typeof globalThis & { __store?: Store };

function createStore(): Store {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (process.env.NODE_ENV === "production") {
      // Saved results would vanish on every restart, so say so loudly.
      console.warn(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing: using the in-memory store.",
      );
    }
    return new MemoryStore();
  }

  const client = createClient(url, serviceRoleKey, {
    // No user sessions: this client acts as the server, not as a visitor.
    auth: { persistSession: false, autoRefreshToken: false },
    // A time limit on every request, and no automatic retry: a failing
    // database is reported as "not saved" within seconds (requestTimeout.ts).
    global: { fetch: fetchWithTimeout() },
    db: { retry: false },
  });
  return new SupabaseStore(client);
}

export function getStore(): Store {
  globalForStore.__store ??= createStore();
  return globalForStore.__store;
}
