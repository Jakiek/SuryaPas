import { MemorySunCache } from "../../../lib/sun/cache";
import { handleSunRequest } from "../../../lib/sun/handler";
import { defaultDeps } from "../../../lib/sun/service";

// One cache for the life of the server process. T09 swaps in the database one.
const deps = defaultDeps(new MemorySunCache());

// GET /api/sun?lat&lon  (SPEC 5.1)
export async function GET(request: Request): Promise<Response> {
  return handleSunRequest(request, deps);
}
