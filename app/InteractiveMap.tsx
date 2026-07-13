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
  const markersRef = useRef(
    new Map<string, { marker: import("leaflet").Marker; element: HTMLElement | null }>(),
  );
  const onSelectRef = useRef(onSelect);
  const initialProjectsRef = useRef(projects);
  const initialActiveIdRef = useRef(activeId);
  const [ready, setReady] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const markers = markersRef.current;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const initialProjects = initialProjectsRef.current;
      const initialActiveId = initialActiveIdRef.current;
      const initial = projectPoint(initialProjects.find((project) => project.id === initialActiveId) || initialProjects[0]);
      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
        inertia: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomAnimationThreshold: 4,
        wheelDebounceTime: 80,
        wheelPxPerZoomLevel: 140,
        minZoom: 11,
        maxZoom: 19,
      });
      map.setView(initial, compact ? 15 : 14, { animate: false });
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 11,
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 3,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      leaflet.control.zoom({ position: "topright", zoomInTitle: "放大", zoomOutTitle: "縮小" }).addTo(map);
      leaflet.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

      leafletRef.current = leaflet;
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false, pan: false }));
      resizeObserver.observe(containerRef.current);
      map.on("dragend", () => setMapMoved(true));
      map.whenReady(() => {
        if (cancelled) return;
        map.invalidateSize({ animate: false, pan: false });
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map) return;

    let disposed = false;

    function renderMarkers() {
      if (disposed) return;

      const placed: Array<{ projects: MapProject[]; x: number; y: number }> = [];
      const nextMarkerIds = new Set<string>();
      const clusterDistance = compact ? 34 : 62;
      const ordered = [...projects].sort((project) => project.id === activeId ? -1 : 1);

      ordered.forEach((project) => {
        const point = projectPoint(project);
        const screen = map.latLngToContainerPoint(point);
        const nearby = project.id === activeId
          ? undefined
          : placed.find((group) =>
              !group.projects.some((item) => item.id === activeId) &&
              Math.hypot(group.x - screen.x, group.y - screen.y) < clusterDistance,
            );

        if (nearby) {
          const size = nearby.projects.length;
          nearby.x = (nearby.x * size + screen.x) / (size + 1);
          nearby.y = (nearby.y * size + screen.y) / (size + 1);
          nearby.projects.push(project);
        } else {
          placed.push({ projects: [project], x: screen.x, y: screen.y });
        }
      });

      placed.forEach((group) => {
        const latitude = group.projects.reduce((sum, project) => sum + projectPoint(project)[0], 0) / group.projects.length;
        const longitude = group.projects.reduce((sum, project) => sum + projectPoint(project)[1], 0) / group.projects.length;

        if (group.projects.length > 1) {
          const markerId = `cluster-${group.projects.map((project) => project.id).sort().join("-")}`;
          nextMarkerIds.add(markerId);
          const existing = markersRef.current.get(markerId);
          if (existing) {
            existing.marker.setLatLng([latitude, longitude]);
            return;
          }

          const label = `${group.projects.length} 個建案，點擊放大地圖`;
          const icon = leaflet.divIcon({
            className: "project-cluster-host",
            html: `<span class="project-cluster-marker">${group.projects.length}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          });
          const marker = leaflet.marker([latitude, longitude], {
            icon,
            keyboard: true,
            zIndexOffset: 200,
          }).addTo(map);
          marker.on("click", () => {
            const bounds = leaflet.latLngBounds(group.projects.map((project) => projectPoint(project)));
            const padding = compact ? 34 : 90;
            map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 17, animate: false });
          });
          const host = marker.getElement();
          host?.setAttribute("aria-label", label);
          host?.setAttribute("title", label);
          const element = host?.querySelector<HTMLElement>(".project-cluster-marker") ?? null;
          markersRef.current.set(markerId, { marker, element });
          return;
        }

        const project = group.projects[0];
        const active = project.id === activeId;
        nextMarkerIds.add(project.id);
        const existing = markersRef.current.get(project.id);
        if (existing) {
          existing.marker.setLatLng([latitude, longitude]);
          existing.marker.setZIndexOffset(active ? 1000 : 0);
          existing.element?.classList.toggle("active", active);
          return;
        }

        const priceText = project.price ? `${project.price.median} 萬` : "價格待補";
        const description = `${project.name}｜${project.price ? `${project.price.median} 萬／坪` : "成交價待補"}`;
        const icon = leaflet.divIcon({
          className: "project-map-marker-host",
          html: `<span class="project-map-marker ${active ? "active" : ""} ${project.price ? "has-price" : "price-pending"}"><span class="marker-building"><span class="marker-windows"></span></span><span class="marker-price">${priceText}</span></span>`,
          iconSize: [74, 64],
          iconAnchor: [37, 62],
        });
        const marker = leaflet.marker([latitude, longitude], {
          icon,
          keyboard: true,
          zIndexOffset: active ? 1000 : 0,
        }).addTo(map);
        marker.on("click", () => onSelectRef.current?.(project.id));
        const host = marker.getElement();
        host?.setAttribute("aria-label", `查看 ${description}`);
        host?.setAttribute("title", description);
        const element = host?.querySelector<HTMLElement>(".project-map-marker") ?? null;
        markersRef.current.set(project.id, { marker, element });
      });

      markersRef.current.forEach(({ marker }, markerId) => {
        if (nextMarkerIds.has(markerId)) return;
        marker.remove();
        markersRef.current.delete(markerId);
      });
    }

    renderMarkers();
    map.on("zoomend", renderMarkers);

    return () => {
      disposed = true;
      map.off("zoomend", renderMarkers);
    };
  }, [activeId, compact, projects, ready]);

  function recenterActive() {
    const map = mapRef.current;
    const active = projects.find((project) => project.id === activeId);
    if (!map || !active) return;
    const point = projectPoint(active);
    map.stop();
    map.panTo(point, { animate: true, duration: 0.28, easeLinearity: 0.35 });
    setMapMoved(false);
  }

  return (
    <div className={`interactive-map ${compact ? "compact" : ""}`} data-map-engine="leaflet" lang="zh-Hant-TW">
      <div
        className="interactive-map-canvas"
        ref={containerRef}
        role="application"
        aria-label="可用滑鼠滾輪縮放、拖曳移動的建案地圖"
      />
      {mapMoved && !compact && <button className="map-recenter" type="button" onClick={recenterActive}>⌖ 回到所選建案</button>}
    </div>
  );
}
