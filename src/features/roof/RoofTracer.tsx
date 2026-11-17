"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Label } from "@/components";
import { MIN_CORNERS, type Corner } from "./roofGeometry";

// MapLibre is large, so the map is fetched only when this block is shown,
// and it cannot be drawn on the server.
const RoofMap = dynamic(() => import("./RoofMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] border-t-heavy border-b-heavy border-fg" aria-hidden="true" />,
});

interface RoofTracerProps {
  center: { latitude: number; longitude: number } | null;
  corners: Corner[];
  closed: boolean;
  /** Area of the traced shape, or null before there are three corners. */
  areaM2: number | null;
  imageryKey: string | null;
  onTap: (corner: Corner) => void;
  onCornersChange: (corners: Corner[]) => void;
  onUndo: () => void;
  onClear: () => void;
  onToggleClosed: () => void;
  onUnsupported: () => void;
}

// The tracing half of the area question: the map, the readout pinned to its
// top-left corner, the tool buttons on its bottom-left, and the credit under it
// (docs/DESIGN.md "Map"). Every control is a labelled button; nothing needs a
// double tap or a hover.
export function RoofTracer(props: RoofTracerProps) {
  const t = useTranslations("roof");
  const locale = useLocale();
  const { corners, closed, areaM2, imageryKey } = props;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const canClose = closed || corners.length >= MIN_CORNERS;

  return (
    <div>
      <p className="text-[19px] font-extrabold tracking-[-0.01em]">{t("area.traceLegend")}</p>
      <p className="pt-0.5 text-sm text-soft">{t("area.traceHelp")}</p>

      {/* Edge to edge on phones: pull out of the page gutters. */}
      <div className="relative -mx-gutter mt-3 lg:mx-0">
        <RoofMap
          center={props.center}
          corners={corners}
          closed={closed}
          imageryKey={imageryKey}
          onTap={props.onTap}
          onCornersChange={props.onCornersChange}
          onUnsupported={props.onUnsupported}
        />

        <div className="pointer-events-none absolute left-0 top-0 bg-night px-3.5 pb-2 pt-2 text-paper">
          <Label as="p" className="opacity-75">{t("tag.label")}</Label>
          <p className="type-figure text-figure-md leading-none">
            {areaM2 === null ? t("tag.none") : <>{number.format(areaM2)} <small className="text-[0.5em]">m²</small></>}
          </p>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
          <ToolButton onClick={props.onUndo} disabled={corners.length === 0}>
            {t("tools.undo")}
          </ToolButton>
          <ToolButton onClick={props.onClear} disabled={corners.length === 0}>
            {t("tools.clear")}
          </ToolButton>
          <ToolButton onClick={props.onToggleClosed} disabled={!canClose} solid={!closed}>
            {closed ? t("tools.reopen") : t("tools.close")}
          </ToolButton>
        </div>
      </div>

      {/* Read out by screen readers whenever a corner is added or removed. */}
      <p role="status" className="mt-3 text-sm font-semibold">
        {t("status", { count: corners.length })}
      </p>

      <div className="mt-3 text-xs text-soft">
        <p>{imageryKey ? <EsriCredit /> : <StreetCredit />}</p>
        {!imageryKey && <p className="mt-2 text-sm font-semibold text-fg">{t("area.noImagery")}</p>}
      </div>
    </div>
  );
}

// A button laid over the map: square, hairline-heavy navy outline, 44 px tall.
function ToolButton({
  onClick,
  disabled,
  solid = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "min-h-11 cursor-pointer border-heavy border-night px-3.5 text-sm font-extrabold text-night " +
        "disabled:cursor-not-allowed disabled:opacity-45 " +
        (solid ? "bg-sun" : "bg-paper")
      }
    >
      {children}
    </button>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

// Esri's terms ask for "Powered by Esri" and the names of the imagery's
// data providers, always visible (sources in the README).
function EsriCredit() {
  const t = useTranslations("roof.attribution");
  return t.rich("esri", {
    esri: (chunks) => (
      <ExternalLink href="https://developers.arcgis.com/documentation/esri-and-data-attribution/">
        {chunks}
      </ExternalLink>
    ),
  });
}

function StreetCredit() {
  const t = useTranslations("roof.attribution");
  return t.rich("street", {
    ofm: (chunks) => <ExternalLink href="https://openfreemap.org">{chunks}</ExternalLink>,
    omt: (chunks) => <ExternalLink href="https://openmaptiles.org">{chunks}</ExternalLink>,
    osm: (chunks) => <ExternalLink href="https://www.openstreetmap.org/copyright">{chunks}</ExternalLink>,
  });
}
