import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

// /sitemap.xml: the public pages in both languages. The example result
// (/r/example) is the only result page that is the same for every visitor.
const PATHS = ["", "/r/example", "/assumptions"];
const LOCALES = ["id", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl().origin;
  return LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({ url: `${origin}/${locale}${path}` })),
  );
}
