import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
// It redirects "/" to "/id" and any path without a locale to its /id form.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next.js internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
