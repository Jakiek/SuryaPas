import { CURRENT_ASSUMPTIONS } from "../../../engine";
import { getStore } from "../../../lib/store/server";
import { getSun, defaultDeps } from "../../../lib/sun/service";
import { StoreSunCache } from "../../../lib/sun/storeCache";
import { handleCreateAssessment } from "./handler";

// POST /api/assessments  { inputs, overrides, locale }  →  { id }  (SPEC 5.1)
export async function POST(request: Request): Promise<Response> {
  const store = getStore();
  // Sun data is cached in the store's sun_cache table, so a cell fetched once
  // is reused after a restart.
  const sunDeps = defaultDeps(new StoreSunCache(store));

  return handleCreateAssessment(request, {
    store,
    assumptions: CURRENT_ASSUMPTIONS,
    sunFor: async (latitude, longitude) => {
      const sun = await getSun(latitude, longitude, sunDeps);
      return { ghiWm2: sun.series, source: sun.source };
    },
  });
}
