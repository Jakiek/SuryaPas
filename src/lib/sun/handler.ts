// The logic of GET /api/sun?lat&lon, kept apart from the route file so tests
// can give it their own cache and fake network.
import { isInsideIndonesia } from "../../features/location/indonesia";
import { PinOutsideIndonesiaError } from "../timezone/legalTimeZone";
import { getSun, type SunDeps } from "./service";

// Plain decimal numbers only: "-7.75", "110". Rejects "", "abc", "1e2", "0x10".
const DECIMAL = /^-?\d+(\.\d+)?$/;

function parseCoordinate(text: string | null): number | null {
  if (text === null || !DECIMAL.test(text)) return null;
  return Number(text);
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function handleSunRequest(request: Request, deps: SunDeps): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = parseCoordinate(params.get("lat"));
  const lon = parseCoordinate(params.get("lon"));

  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return errorResponse("invalid_coordinates", 400);
  }
  // SPEC 2.2 step 1: the pin must fall inside Indonesia, the same check and
  // the same answer as POST /api/assessments.
  if (!isInsideIndonesia(lat, lon)) {
    return errorResponse("outside_indonesia", 400);
  }

  let result;
  try {
    result = await getSun(lat, lon, deps);
  } catch (error) {
    // The legal time zone comes from a separate province outline (SPEC 3.4).
    // At a coast the two outlines can disagree by a little; a pin with no
    // legal time zone is answered as outside Indonesia too.
    if (error instanceof PinOutsideIndonesiaError) return errorResponse("outside_indonesia", 400);
    throw error;
  }
  return Response.json({
    series: result.series,
    source: result.source,
    cellId: result.cellId,
    year: result.year,
    ...(result.fallbackCityId ? { fallbackCityId: result.fallbackCityId } : {}),
  });
}
