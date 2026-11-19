import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

// /robots.txt. Everything may be crawled except the JSON routes and the
// development pages. The locale proxy skips any path with a dot in it
// (see src/proxy.ts), so this file is never routed into a locale.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] },
    sitemap: `${siteUrl().origin}/sitemap.xml`,
  };
}
