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
// The only font ImageResponse carries is Geist Regular, which is not Archivo;
// a text stroke thickens it towards the heavy poster look.

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

const heavy = { WebkitTextStroke: `4px ${NIGHT}` } as const;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { landing, common } = messagesFor(locale);
  const word = { textTransform: "uppercase", color: NIGHT, ...heavy } as const;
  // The headline is set in two rows so the boxed word sits in the middle of it, as on the page.
  const headline = { display: "flex", alignItems: "center", fontSize: 76, lineHeight: 1.1, letterSpacing: -1, ...word } as const;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: SUN }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", fontSize: 36, ...word }}>
            <span>SURYA</span>
            <span style={{ display: "flex", marginLeft: 8, padding: "0 8px", border: `4px solid ${NIGHT}` }}>PAS</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 78 }}>
            <div style={headline}>{landing.share.before}</div>
            <div style={headline}>
              <span style={{ display: "flex", padding: "0 14px", marginRight: 26, border: `7px solid ${NIGHT}` }}>
                {landing.share.boxed}
              </span>
              <span>{landing.share.after}</span>
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
    { ...size },
  );
}
