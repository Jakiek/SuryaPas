import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";
import { runStoreContract } from "./store.contract";
import { SupabaseStore } from "./supabase";

// Runs the contract against a real Supabase project. Skipped unless both
// variables are set, because it writes rows to that project. Use a project
// made for development, never the live one. Run it with:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run supabase.contract
//
// (vitest does not read .env.local, so the variables go on the command line.)
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && key) {
  runStoreContract("SupabaseStore", () => {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseStore(client);
  });
} else {
  describe("Store contract: SupabaseStore", () => {
    it.skip("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
}
