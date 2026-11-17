"use client";

// The map of the roof step: satellite photo (or, without an Esri key, the
// street map) centred on the pin from step 1, with the roof drawn on top.
// This file is loaded only when the step is shown, like the map of step 1.
//
// The map does not decide what a tap means; it reports. The parent owns the
// list of corners and says whether the shape is closed:
//   - a tap on the map reports the point, and the parent adds a corner;
//   - dragging a corner's square handle reports the whole new list.
// Taps are ignored once the shape is closed, so a stray tap cannot add a corner.

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { mapStyle } from "@/features/location/mapStyle";
import { imageryStyle } from "./imageryStyle";
import { MIN_CORNERS, type Corner } from "./roofGeometry";
import "./RoofMap.css";

// Same workaround as step 1: MapLibre cannot find its worker file under
// Turbopack, so the bundler publishes the one self-contained file and
// MapLibre is told where it is.
setWorkerUrl(
  new URL("../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

// Close enough that a 10 m roof fills a useful part of a phone screen.
const ROOF_ZOOM = 19.5;
const MAX_ZOOM = 21;
const INDONESIA_CENTER: [number, number] = [118, -2];

// The map cannot read CSS variables, so the two colours are repeated here
// (tokens `night` and `sun` of globals.css).
const NIGHT = "#0f1b3d";
const SUN = "#ffcf33";

const ROOF_SOURCE = "roof";

export interface RoofMapProps {
  /** The pin of step 1: where the map is centred. */
  center: { latitude: number; longitude: number } | null;
  corners: Corner[];
  closed: boolean;
  /** The Esri key; null draws the street map instead of the photo. */
  imageryKey: string | null;
  onTap: (corner: Corner) => void;
  onCornersChange: (corners: Corner[]) => void;
  onUnsupported: () => void;
}

/** What the roof layers draw: the filled shape and its outline. */
function roofGeoJson(corners: Corner[], closed: boolean): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (corners.length >= MIN_CORNERS) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...corners, corners[0]]] },
    });
  }
  if (corners.length >= 2) {
    // An open shape is a plain line; a closed one returns to its first corner.
    const line = closed ? [...corners, corners[0]] : corners;
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } });
  }
  return { type: "FeatureCollection", features };
}

/** One corner handle: a 44 px touch target round a small yellow square. */
function createHandleElement(label: string): HTMLElement {
  const handle = document.createElement("div");
  handle.className = "roof-handle";
  handle.setAttribute("role", "img");
  handle.setAttribute("aria-label", label);
  handle.innerHTML = `<span class="roof-handle-square"></span>`;
  // A tap on a handle must not also count as a tap on the map behind it.
  handle.addEventListener("click", (event) => event.stopPropagation());
  return handle;
}

export default function RoofMap({
  center,
  corners,
  closed,
  imageryKey,
  onTap,
  onCornersChange,
  onUnsupported,
}: RoofMapProps) {
  const t = useTranslations("roof.map");
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const handles = useRef<Marker[]>([]);
  const roofLayersReady = useRef(false);
  // The corner being dragged right now, if any: its position is the finger's.
  const draggedIndex = useRef<number | null>(null);

  // The latest props, so the listeners made once never go stale.
  const latest = useRef({ corners, closed, onTap, onCornersChange, onUnsupported, t });
  useEffect(() => {
    latest.current = { corners, closed, onTap, onCornersChange, onUnsupported, t };
  });

  // Make the map once.
  useEffect(() => {
    if (!container.current) return;

    let created: MapLibreMap;
    try {
      created = new MapLibreMap({
        container: container.current,
        style: imageryKey ? imageryStyle(imageryKey) : mapStyle,
        center: center ? [center.longitude, center.latitude] : INDONESIA_CENTER,
        zoom: center ? ROOF_ZOOM : 3.4,
        maxZoom: MAX_ZOOM,
        // The credit is printed under the map by the step, always visible.
        attributionControl: false,
        locale: {
          "NavigationControl.ZoomIn": t("zoomIn"),
          "NavigationControl.ZoomOut": t("zoomOut"),
        },
        // Rotating or tilting the photo would only confuse the tracing.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      latest.current.onUnsupported();
      return;
    }
    created.touchZoomRotate.disableRotation();
    created.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // A tap adds a corner, unless the shape is closed.
    created.on("click", (event) => {
      if (latest.current.closed) return;
      latest.current.onTap([event.lngLat.lng, event.lngLat.lat]);
    });

    // The roof's own layers, added once the style (and so the map) is ready.
    created.on("load", () => {
      created.addSource(ROOF_SOURCE, { type: "geojson", data: roofGeoJson([], false) });
      created.addLayer({
        id: "roof-fill",
        type: "fill",
        source: ROOF_SOURCE,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": SUN, "fill-opacity": 0.5 },
      });
      created.addLayer({
        id: "roof-outline",
        type: "line",
        source: ROOF_SOURCE,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-join": "miter", "line-cap": "butt" },
        paint: { "line-color": NIGHT, "line-width": 3 },
      });
      roofLayersReady.current = true;
      drawRoof();
    });

    map.current = created;
    const handleMarkers = handles.current;

    return () => {
      handleMarkers.forEach((marker) => marker.remove());
      handles.current = [];
      roofLayersReady.current = false;
      created.remove();
      map.current = null;
    };
    // The map is made once; the props are read only for its first look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Pushes the current corners into the roof layers. */
  function drawRoof() {
    const source = map.current?.getSource(ROOF_SOURCE) as GeoJSONSource | undefined;
    if (!roofLayersReady.current || !source) return;
    source.setData(roofGeoJson(latest.current.corners, latest.current.closed));
  }

  /** One draggable handle for corner number `index`. */
  function makeHandle(index: number): Marker {
    const handle = new Marker({
      element: createHandleElement(latest.current.t("corner", { number: index + 1 })),
      draggable: true,
    });
    handle.on("dragstart", () => {
      draggedIndex.current = index;
    });
    handle.on("dragend", () => {
      draggedIndex.current = null;
    });
    // Report while dragging, so the shape and the area follow the finger.
    handle.on("drag", () => {
      const moved = latest.current.corners.map((corner, i): Corner => {
        if (i !== index) return corner;
        const at = handle.getLngLat();
        return [at.lng, at.lat];
      });
      latest.current.onCornersChange(moved);
    });
    return handle;
  }

  // Keep the handles and the drawn shape on the corners the parent holds.
  useEffect(() => {
    const theMap = map.current;
    if (!theMap) return;

    // A different number of corners (one added, undone or cleared): rebuild.
    if (handles.current.length !== corners.length) {
      handles.current.forEach((marker) => marker.remove());
      handles.current = corners.map((corner, index) =>
        makeHandle(index).setLngLat(corner).addTo(theMap),
      );
    } else {
      // Same number: only positions changed. A handle being dragged is
      // already there, and setting its own position again is harmless.
      handles.current.forEach((marker, index) => {
        if (draggedIndex.current !== index) marker.setLngLat(corners[index]);
      });
    }
    drawRoof();
  }, [corners, closed]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={t("label")}
      className="roof-map h-[420px] w-full border-t-heavy border-b-heavy border-fg lg:border-heavy"
    />
  );
}
