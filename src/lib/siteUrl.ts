// The public address of the site, used for og:image, the sitemap and robots.txt.
// Order: NEXT_PUBLIC_SITE_URL (set by hand), then the production domain Vercel
// supplies, then localhost for development.
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
