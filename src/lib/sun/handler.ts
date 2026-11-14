// The logic of GET /api/sun?lat&lon, kept apart from the route file so tests
// can give it their own cache and fake network.
import { getSun, type SunDeps } from "./service";

// A box around Indonesia (Sabang to Merauke, Miangas to Rote), with a margin.
// Geography, not a product number.
const INDONESIA_BOX = { minLat: -11.5, maxLat: 6.5, minLon: 94.5, maxLon: 141.5 };

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
  const { minLat, maxLat, minLon, maxLon } = INDONESIA_BOX;
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
    return errorResponse("outside_indonesia", 422);
  }

  const result = await getSun(lat, lon, deps);
  return Response.json({
    series: result.series,
    source: result.source,
    cellId: result.cellId,
    year: result.year,
    ...(result.fallbackCityId ? { fallbackCityId: result.fallbackCityId } : {}),
  });
}
