import { getStore } from "../../../lib/store/server";
import { handleSunRequest } from "../../../lib/sun/handler";
import { defaultDeps } from "../../../lib/sun/service";
import { StoreSunCache } from "../../../lib/sun/storeCache";

// GET /api/sun?lat&lon  (SPEC 5.1)
// The cache is the store's sun_cache table, shared with POST /api/assessments,
// so a cell fetched by either is reused by both and after a restart. A store
// that fails counts as a cache miss (see StoreSunCache).
export async function GET(request: Request): Promise<Response> {
  return handleSunRequest(request, defaultDeps(new StoreSunCache(getStore())));
}
