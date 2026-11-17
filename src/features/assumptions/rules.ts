// The three rules built into the engine that a reader of the assumptions screen
// should see (docs/ASSUMPTIONS.md, "Rules built into the engine"; SPEC 3.2 steps 4, 5 and 7).
// They are not entries of the assumption set, so they cannot be changed here.
//
// Citations are kept exactly as docs/ASSUMPTIONS.md writes them, in English, in both
// languages: a regulation is cited by its own name, not translated.

export type RuleId = "exportsEarnNothing" | "minimumCharge" | "noSizeCap";

export type Citation = { text: string; url: string };

const PERMEN_2_2024 = "https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%202%20Tahun%202024.pdf";
const PERMEN_7_2024 = "https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%207%20Tahun%202024.pdf";

export const RULE_ORDER: RuleId[] = ["exportsEarnNothing", "minimumCharge", "noSizeCap"];

export const RULE_CITATIONS: Record<RuleId, Citation[]> = {
  exportsEarnNothing: [
    { text: "Energy Ministry Regulation 2/2024, Article 13", url: PERMEN_2_2024 },
    {
      text: "ABNR: Indonesia issues new rules on operation of rooftop solar, abolishes net metering",
      url: "https://www.abnrlaw.com/news/indonesia-issues-new-rules-on-operation-of-rooftop-solar-abolishes-net-metering",
    },
  ],
  minimumCharge: [
    { text: "Energy Ministry Regulation 2/2024, Article 16", url: PERMEN_2_2024 },
    { text: "Energy Ministry Regulation 7/2024, Annex II, footnote *)", url: PERMEN_7_2024 },
  ],
  noSizeCap: [
    { text: "Energy Ministry Regulation 2/2024, Articles 9 and 12", url: PERMEN_2_2024 },
    {
      text: "ESDM: Aturan terbaru PLTS atap terbit, kini kapasitas pemasangan tidak dibatasi",
      url: "https://www.esdm.go.id/id/media-center/arsip-berita/aturan-terbaru-plts-atap-terbit-kini-kapasitas-pemasangan-tidak-dibatasi",
    },
  ],
};
