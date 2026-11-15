import { getStore } from "../../../lib/store/server";
import { handleEventRequest } from "./handler";

// POST /api/events  { name, assessmentId? }  →  204  (SPEC 5.1)
export async function POST(request: Request): Promise<Response> {
  return handleEventRequest(request, getStore());
}
