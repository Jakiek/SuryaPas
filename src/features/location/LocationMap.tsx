"use client";

// The map of step 1: a draggable pin on OpenFreeMap tiles. This file is
// loaded only when the step is shown (see LocationStep), because MapLibre is
// large and the landing page must stay light.
//
// Three things move the pin, and all of them end up here as a change of the
// `pin` prop: a search result and the device location come from outside;
// dragging the pin or tapping the map comes from inside and is reported
// through `onPinMoved`.

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type LngLat } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import "./LocationMap.css";
import { mapStyle } from "./mapStyle";

export interface PinPoint {
  latitude: number;
  longitude: number;
}

// MapLibre runs its heavy work in a Web Worker and finds the worker file by
// a path that a bundler breaks. The worker file is one self-contained file,
// so the bundler is asked to publish it as it is and MapLibre is told where.
setWorkerUrl(
  new URL("../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

// Roughly the middle of Indonesia, zoomed out to show the archipelago.
const INDONESIA_CENTER: [number, number] = [118, -2];
const INDONESIA_ZOOM = 3.4;
// Close enough to tell one house from the next.
const HOUSE_ZOOM = 16;

/** The pin: a yellow square on a navy stem, built as plain DOM for MapLibre. */
function createPinElement(label: string): HTMLElement {
  const pin = document.createElement("div");
  pin.className = "location-pin";
  pin.setAttribute("role", "img");
  pin.setAttribute("aria-label", label);
  pin.innerHTML = `<span class="location-pin-head"></span><span class="location-pin-stem"></span>`;
  return pin;
}

export default function LocationMap({
  pin,
  onPinMoved,
  onUnsupported,
}: {
  pin: PinPoint | null;
  onPinMoved: (point: PinPoint) => void;
  onUnsupported: () => void;
}) {
  const t = useTranslations("location.map");
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  // The last point the user set on the map itself. When the `pin` prop
  // equals it, the change came from here and the map must not fly again.
  const pointSetOnMap = useRef<PinPoint | null>(null);
  // The latest callbacks, so the map's listeners (made once) never go stale.
  const callbacks = useRef({ onPinMoved, onUnsupported });

  useEffect(() => {
    callbacks.current = { onPinMoved, onUnsupported };
  });

  // Make the map once. The pin it starts with is read from the first render.
  // Effects run in the order written, so the one below finds the map made.
  useEffect(() => {
    if (!container.current) return;

    const reportPinMoved = (lngLat: LngLat) => {
      const point = { latitude: lngLat.lat, longitude: lngLat.lng };
      pointSetOnMap.current = point;
      callbacks.current.onPinMoved(point);
    };

    let created: MapLibreMap;
    try {
      created = new MapLibreMap({
        container: container.current,
        style: mapStyle,
        center: pin ? [pin.longitude, pin.latitude] : INDONESIA_CENTER,
        zoom: pin ? HOUSE_ZOOM : INDONESIA_ZOOM,
        // Our own attribution line sits under the map, always visible.
        attributionControl: false,
        // Two fingers rotate and tilt the map; a house locator needs neither.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      // No WebGL (an old phone, a locked-down browser). Searching still works.
      callbacks.current.onUnsupported();
      return;
    }
    created.touchZoomRotate.disableRotation();
    created.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // Tapping the map moves the pin there.
    created.on("click", (event) => reportPinMoved(event.lngLat));

    const draggablePin = new Marker({
      element: createPinElement(t("pin")),
      anchor: "bottom",
      draggable: true,
    });
    draggablePin.on("dragend", () => reportPinMoved(draggablePin.getLngLat()));

    map.current = created;
    marker.current = draggablePin;

    return () => {
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is made once; `pin` and `t` are read only for its first look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin on the `pin` prop; jump there if the change came from outside.
  useEffect(() => {
    const theMap = map.current;
    const thePin = marker.current;
    if (!theMap || !thePin) return;

    if (!pin) {
      thePin.remove();
      return;
    }
    thePin.setLngLat([pin.longitude, pin.latitude]).addTo(theMap);

    const last = pointSetOnMap.current;
    // The step rounds coordinates to six decimals, so compare with a margin.
    const cameFromTheMap =
      last !== null &&
      Math.abs(last.latitude - pin.latitude) < 1e-5 &&
      Math.abs(last.longitude - pin.longitude) < 1e-5;
    if (!cameFromTheMap) {
      // A jump, not a flight: the new place is often hundreds of kilometres
      // away, and DESIGN.md allows no decorative motion.
      theMap.jumpTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(theMap.getZoom(), HOUSE_ZOOM) });
    }
  }, [pin]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={t("label")}
      className={`location-map h-[360px] w-full border-t-heavy border-b-heavy border-fg lg:h-[440px] lg:border-heavy`}
    />
  );
}
