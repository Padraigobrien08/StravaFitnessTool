"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteGeometry, OverlaySegment, TimelinePoint } from "@/lib/route-intelligence/types";
import { positionAtTime } from "@/lib/route-intelligence/geometry";
import { useThemeStore } from "@/stores/theme-store";

const MAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

const OVERLAY_COLORS: Record<string, string> = {
  interval: "#2dd4bf",
  recovery: "#52525b",
  fade: "#f59e0b",
  pause: "#71717a",
  pace_spike: "#a78bfa",
  climb: "#34d399",
  descent: "#60a5fa",
};

export function RouteMap({
  geometry,
  timeline,
  currentSec,
  overlays,
  className,
}: {
  geometry: RouteGeometry;
  timeline: TimelinePoint[];
  currentSec: number;
  overlays: OverlaySegment[];
  className?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const mapStyle = MAP_STYLES[theme];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    loadedRef.current = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [
        (geometry.bounds.minLon + geometry.bounds.maxLon) / 2,
        (geometry.bounds.minLat + geometry.bounds.maxLat) / 2,
      ],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      loadedRef.current = true;
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: geometry.coordinates,
          },
        },
      });

      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#14b8a6",
          "line-width": 8,
          "line-opacity": 0.15,
          "line-blur": 4,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#5eead4",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      const bounds = new maplibregl.LngLatBounds();
      for (const [lon, lat] of geometry.coordinates) {
        bounds.extend([lon, lat]);
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    });

    mapRef.current = map;
    markerRef.current = new maplibregl.Marker({
      color: "#5eead4",
      scale: 0.9,
    });

    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [geometry, mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geometry) return;

    const pos = positionAtTime(timeline, currentSec);
    if (!pos) return;
    if (!markerRef.current) return;
    markerRef.current.setLngLat([pos.lon, pos.lat]).addTo(map);
  }, [currentSec, timeline]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const features = overlays.map((o) => ({
      type: "Feature" as const,
      properties: {
        kind: o.kind,
        color: OVERLAY_COLORS[o.kind] ?? "#71717a",
      },
      geometry: {
        type: "LineString" as const,
        coordinates: sliceCoordsForOverlay(geometry, o),
      },
    }));

    const src = map.getSource("overlays") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({ type: "FeatureCollection", features });
    } else {
      map.addSource("overlays", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: "overlay-lines",
        type: "line",
        source: "overlays",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": 0.55,
        },
      });
    }
  }, [overlays, geometry]);

  return (
    <div ref={containerRef} className={className ?? "h-full min-h-[280px] w-full rounded-xl"} />
  );
}

function sliceCoordsForOverlay(
  geometry: RouteGeometry,
  overlay: OverlaySegment,
): [number, number][] {
  const n = geometry.coordinates.length;
  const startIdx = Math.floor((overlay.startSec / geometry.durationSec) * (n - 1));
  const endIdx = Math.ceil((overlay.endSec / geometry.durationSec) * (n - 1));
  return geometry.coordinates.slice(Math.max(0, startIdx), Math.min(n, endIdx + 1));
}
