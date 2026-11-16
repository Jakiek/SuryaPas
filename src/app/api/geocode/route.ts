import { handleGeocodeRequest } from "../../../lib/geocoding/handler";

// POST /api/geocode  { "q": "<search text>" }  (SPEC 5.1)
// A POST so the address is in the body and not in a URL that logs keep.
// Never log the request or its body: it is an address typed by a person.
export async function POST(request: Request): Promise<Response> {
  return handleGeocodeRequest(request);
}
