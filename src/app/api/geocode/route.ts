import { handleGeocodeRequest } from "../../../lib/geocoding/handler";

// GET /api/geocode?q  (SPEC 5.1)
// Never log the request or its query: it is an address typed by a person.
export async function GET(request: Request): Promise<Response> {
  return handleGeocodeRequest(request);
}
