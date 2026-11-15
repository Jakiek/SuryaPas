"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Button, Caveat, Label, QuestionList } from "@/components";
import type { LocationDraft } from "@/features/plan/draft";
import type { StepProps } from "@/features/plan/step";
import type { Place } from "@/lib/geocoding/photon";
import { locationSchema } from "@/lib/schema";
import { AddressSearch } from "./AddressSearch";
import { isInsideIndonesia } from "./indonesia";
import type { PinPoint } from "./LocationMap";

// The map is fetched only when this step is on screen (MapLibre is large;
// the landing page must stay light). It cannot be drawn on the server.
const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => <div className="h-[360px] border-t-heavy border-b-heavy border-fg lg:h-[440px] lg:border-heavy" aria-hidden="true" />,
});

// The landing page sends the typed address as ?q= (SPEC 2.1).
const LANDING_ADDRESS_PARAM = "q";

/** Reads the address the landing page sent, if any. Browser only. */
function readLandingAddress(): string {
  return new URLSearchParams(window.location.search).get(LANDING_ADDRESS_PARAM)?.trim() ?? "";
}

/** An address is personal data (SPEC 2.6): once read, take it out of the URL. */
function removeLandingAddressFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LANDING_ADDRESS_PARAM)) return;
  url.searchParams.delete(LANDING_ADDRESS_PARAM);
  window.history.replaceState(window.history.state, "", url);
}

// Six decimals is about 10 cm; more would only store noise.
const roundCoordinate = (degrees: number) => Math.round(degrees * 1e6) / 1e6;

type DeviceLocationState = "idle" | "working" | "found" | "denied";

// Step 1 (SPEC 2.2): one pin, set by searching, by the device's location or
// by dragging. All three change the same `value`. The step is valid when a
// pin exists and lies inside Indonesia (SPEC 2.5).
export function LocationStep({ value, onChange, onValidChange }: StepProps<LocationDraft>) {
  const t = useTranslations("location");
  const locale = useLocale();

  // Read once, on the first render in the browser (the flow shell renders
  // its steps only there). The search box starts filled with it.
  const [landingAddress] = useState(readLandingAddress);
  useEffect(removeLandingAddressFromUrl, []);

  const [deviceLocation, setDeviceLocation] = useState<DeviceLocationState>("idle");
  const [mapUnsupported, setMapUnsupported] = useState(false);
  const markMapUnsupported = useCallback(() => setMapUnsupported(true), []);

  const pin: PinPoint | null =
    value.latitude !== null && value.longitude !== null
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;
  const outsideIndonesia = pin !== null && !isInsideIndonesia(pin.latitude, pin.longitude);
  const valid = locationSchema.safeParse(value).success && pin !== null && !outsideIndonesia;

  useEffect(() => {
    onValidChange(valid);
  }, [valid, onValidChange]);

  function movePin(point: PinPoint) {
    onChange({
      latitude: roundCoordinate(point.latitude),
      longitude: roundCoordinate(point.longitude),
    });
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setDeviceLocation("denied");
      return;
    }
    setDeviceLocation("working");
    // Permission is asked here, on the tap, and never on page load.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation("found");
        movePin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      // Refused, switched off, no signal or too slow: the user's way forward
      // is the same, so one calm message covers all of them.
      () => setDeviceLocation("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 5 });

  return (
    <QuestionList>
      <div>
        <AddressSearch
          initialText={landingAddress}
          onChoose={(place: Place) => movePin({ latitude: place.lat, longitude: place.lon })}
        />

        <div className="mt-4">
          <Button variant="outline" arrow={false} onClick={requestDeviceLocation}>
            {t("device.button")}
          </Button>
          <p role="status" className="mt-2.5 min-h-6 text-sm text-soft">
            {deviceLocation === "working" && t("device.working")}
            {deviceLocation === "found" && t("device.found")}
            {deviceLocation === "denied" && t("device.denied")}
          </p>
        </div>
      </div>

      <div>
        {mapUnsupported ? (
          <p className="text-[17px] font-semibold">{t("map.unsupported")}</p>
        ) : (
          <>
            {/* Edge to edge on phones: pull out of the page gutters. */}
            <div className="-mx-gutter lg:mx-0">
              <LocationMap pin={pin} onPinMoved={movePin} onUnsupported={markMapUnsupported} />
            </div>
            <p className="mt-3 text-sm text-soft">{t("map.hint")}</p>
          </>
        )}

        {/* The same position in words: the map's text alternative. */}
        <div className="mt-4 border-t border-rule pt-3">
          <Label as="p">{t("position.label")}</Label>
          <p className="mt-1 text-[17px] font-bold tabular-nums">
            {pin
              ? t("position.value", {
                  latitude: number.format(pin.latitude),
                  longitude: number.format(pin.longitude),
                })
              : t("position.none")}
          </p>
        </div>

        {outsideIndonesia && (
          <div role="alert" className="mt-5">
            <Caveat title={t("outside.title")}>
              <p>{t("outside.body")}</p>
            </Caveat>
          </div>
        )}

        {/* Credit for both OpenStreetMap-based services. Always on screen. */}
        <div className="mt-5 space-y-1 text-xs text-soft">
          <p>
            {t.rich("attribution.map", {
              ofm: (chunks) => <ExternalLink href="https://openfreemap.org">{chunks}</ExternalLink>,
              omt: (chunks) => <ExternalLink href="https://openmaptiles.org">{chunks}</ExternalLink>,
              osm: (chunks) => (
                <ExternalLink href="https://www.openstreetmap.org/copyright">{chunks}</ExternalLink>
              ),
            })}
          </p>
          <p>
            {t.rich("attribution.search", {
              photon: (chunks) => <ExternalLink href="https://photon.komoot.io">{chunks}</ExternalLink>,
              osm: (chunks) => (
                <ExternalLink href="https://www.openstreetmap.org/copyright">{chunks}</ExternalLink>
              ),
            })}
          </p>
        </div>
      </div>
    </QuestionList>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}
