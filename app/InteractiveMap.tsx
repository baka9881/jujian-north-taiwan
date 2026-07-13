"use client";

import { useEffect, useRef, useState } from "react";

type MapProject = {
  id: string;
  name: string;
  region: "林口" | "A7";
  mapX: number;
  mapY: number;
  price: { median: number } | null;
};

type Props = {
  projects: MapProject[];
  activeId: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
};

function projectPoint(project: MapProject): [number, number] {
  const seed = [...project.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  const latitudeJitter = ((seed % 9) - 4) * 0.00007;
  const longitudeJitter = (((seed * 7) % 9) - 4) * 0.00007;

  if (project.region === "林口") {
    const x = (project.mapX - 25) / 19;
    const y = (project.mapY - 33) / 34;
    return [25.0885 - y * 0.0205 + latitudeJitter, 121.364 + x * 0.023 + longitudeJitter];
  }

  const x = (project.mapX - 57) / 15;
  const y = (project.mapY - 42) / 30;
  return [25.057 - y * 0.018 + latitudeJitter, 121.381 + x * 0.017 + longitudeJitter];
}

export default function InteractiveMap({ projects, activeId, onSelect, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef(new Map<string, import("leaflet").CircleMarker>());
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current) return;
      const L = leafletModule.default;
      const initial = projectPoint(projects.find((project) => project.id === activeId) || projects[0]);
      const map = L.map(containerRef.current, {
        center: initial,
        zoom: compact ? 15 : 14,
        zoomControl: true,
        scrollWheelZoom: true,
        wheelDebounceTime: 35,
        wheelPxPerZoomLevel: 55,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 11,
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      map.scrollWheelZoom.enable();
      window.requestAnimationFrame(() => map.invalidateSize());
      setReady(true);
    });

    return () => {
      cancelled = true;
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    projects.forEach((project) => {
      const active = project.id === activeId;
      const marker = L.circleMarker(projectPoint(project), {
        radius: active ? 10 : 7,
        color: "#ffffff",
        weight: active ? 3 : 2,
        fillColor: active ? "#e86732" : "#17534d",
        fillOpacity: 1,
      }).addTo(map);
      marker.bindTooltip(
        `<strong>${project.name}</strong><br>${project.price ? `${project.price.median} 萬／坪` : "成交價待補"}`,
        { direction: "top", offset: [0, -8] },
      );
      marker.on("click", () => onSelectRef.current?.(project.id));
      markersRef.current.set(project.id, marker);
    });
  }, [activeId, projects, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const active = projects.find((project) => project.id === activeId);
    if (!active) return;

    markersRef.current.forEach((marker, id) => {
      const selected = id === activeId;
      marker.setStyle({
        radius: selected ? 10 : 7,
        weight: selected ? 3 : 2,
        fillColor: selected ? "#e86732" : "#17534d",
      });
      if (selected) marker.bringToFront();
    });
    map.flyTo(projectPoint(active), Math.max(map.getZoom(), compact ? 15 : 14), { duration: 0.35 });
  }, [activeId, compact, projects, ready]);

  return (
    <div
      className={`interactive-map ${compact ? "compact" : ""}`}
      ref={containerRef}
      data-map-engine="leaflet"
      role="application"
      aria-label="可用滑鼠滾輪縮放、拖曳移動的建案地圖"
    />
  );
}
