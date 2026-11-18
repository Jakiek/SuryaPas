import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import commonEn from "../../../messages/en/common.json";
import commonId from "../../../messages/id/common.json";
import landingEn from "../../../messages/en/landing.json";
import landingId from "../../../messages/id/landing.json";

// The picture that appears when a link to the site is shared (SPEC 2.1 and
// T15): the landing page's poster headline in the design's two colours, with
// the day band under it. It is drawn here from flat shapes and the same words
// as the page, in the language of the URL.
//
// The headline is set in the design's poster style (Archivo, width 62%, weight
// 800). ImageResponse carries only Geist, so the Archivo file is read from
// src/app/fonts (a static width-62, weight-800 copy of the OFL-licensed
// variable font, cut from it for this image). No network is needed. If
// that fails, the image falls back to Geist with a text stroke, so the share
// image never breaks the build.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The words come straight from the message files: next-intl's getTranslations
// cannot run while Next.js is listing a route's images, which has no request.
const MESSAGES = {
  id: { landing: landingId, common: commonId },
  en: { landing: landingEn, common: commonEn },
} as const;

function messagesFor(locale: string) {
  return locale === "en" ? MESSAGES.en : MESSAGES.id;
}

// One image per language; `alt` is each language's own description.
export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return [{ id: "share", alt: messagesFor(locale).landing.meta.imageAlt, size, contentType }];
}

// The design's colours (docs/DESIGN.md "Colour"), written out because an
// image cannot read the stylesheet's tokens.
const SUN = "#FFCF33";
const NIGHT = "#0F1B3D";
const PAPER = "#FFFFFF";

// The static poster-style Archivo (width 62%, weight 800), kept in the repo.
// ImageResponse cannot read the variable woff2 the page uses, hence this copy.
// It is read from disk, as Next.js's opengraph-image page shows; Node's fetch
// does not accept file: URLs. The path is relative to the project root, which
// is the working directory of both `next build` and `next start`.
const POSTER_FONT_PATH = join(process.cwd(), "src/app/fonts/Archivo-poster-62-800.ttf");

async function loadPosterFont(): Promise<Buffer | null> {
  try {
    return await readFile(POSTER_FONT_PATH);
  } catch (error) {
    // The image still renders (in Geist), but the failure must be visible.
    console.error(`[opengraph-image] could not read ${POSTER_FONT_PATH}; falling back to Geist`, error);
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { landing, common } = messagesFor(locale);
  const posterFont = await loadPosterFont();
  const poster = posterFont
    ? ({ fontFamily: "Archivo", fontWeight: 800 } as const)
    : ({ WebkitTextStroke: `4px ${NIGHT}` } as const);
  const word = { color: NIGHT, ...poster } as const;
  // The headline is set in two rows so the boxed word sits in the middle of it, as on the page.
  const headline = { display: "flex", alignItems: "center", fontSize: posterFont ? 104 : 76, lineHeight: 1.05, letterSpacing: posterFont ? 0 : -1, ...word } as const;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: SUN }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", fontSize: 36, ...word }}>
            <span>SURYA</span>
            <span style={{ display: "flex", marginLeft: 8, padding: "0 8px", border: `4px solid ${NIGHT}` }}>PAS</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 78 }}>
            <div style={headline}>{landing.share.before.toUpperCase()}</div>
            <div style={headline}>
              <span style={{ display: "flex", padding: "0 14px", marginRight: 26, border: `7px solid ${NIGHT}` }}>
                {landing.share.boxed.toUpperCase()}
              </span>
              <span>{landing.share.after.toUpperCase()}</span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 34, color: NIGHT }}>{landing.share.line}</div>
        </div>
        {/* The day band: night, day, night in the proportions 6:12:6. */}
        <div style={{ display: "flex", height: 54 }}>
          <div style={{ display: "flex", flex: 6, background: NIGHT, color: PAPER, fontSize: 22, padding: "12px 64px", letterSpacing: 4 }}>
            {common.dayBand.night.toUpperCase()}
          </div>
          <div style={{ display: "flex", flex: 12, background: PAPER, color: NIGHT, fontSize: 22, padding: "12px 0", justifyContent: "center", letterSpacing: 4 }}>
            {landing.hero.dayLabel.toUpperCase()}
          </div>
          <div style={{ display: "flex", flex: 6, background: NIGHT, color: PAPER, fontSize: 22, padding: "12px 64px", justifyContent: "flex-end", letterSpacing: 4 }}>
            {common.dayBand.night.toUpperCase()}
          </div>
        </div>
      </div>
    ),
    // Passing no `fonts` at all keeps ImageResponse's own Geist; an empty list would remove it.
    { ...size, ...(posterFont && { fonts: [{ name: "Archivo", data: posterFont, weight: 800 as const, style: "normal" as const }] }) },
  );
}
