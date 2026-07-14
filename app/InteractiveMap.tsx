"use client";

import { useEffect, useRef, useState } from "react";

type MapProject = {
  id: string;
  name: string;
  region: "林口" | "A7";
  mapX: number;
  mapY: number;
  price: { median: number } | null;
  priceEvidence?: { status: "matched" | "official-no-match" | "source-no-match"; statusLabel: string };
  firstRegistrationDate: string | null;
  latitude?: number;
  longitude?: number;
};

type AmenityCategory = "convenience" | "pxmart" | "costco" | "station" | "school" | "medical";

type AmenityPoi = {
  id: string;
  name: string;
  category: AmenityCategory;
  latitude: number;
  longitude: number;
};

type Props = {
  projects: MapProject[];
  activeId: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
  pois?: AmenityPoi[];
  visibleAmenityCategories?: AmenityCategory[];
};

function projectPoint(project: MapProject): [number, number] {
  if (Number.isFinite(project.latitude) && Number.isFinite(project.longitude)) {
    return [project.latitude as number, project.longitude as number];
  }
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

function projectStage(project: MapProject) {
  return project.firstRegistrationDate ? "completed" : "presale";
}

const amenitySymbols: Record<AmenityCategory, string> = {
  convenience: "商",
  pxmart: "全",
  costco: "好",
  station: "站",
  school: "學",
  medical: "醫",
};

export default function InteractiveMap({ projects, activeId, onSelect, compact = false, pois = [], visibleAmenityCategories = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef(
    new Map<string, { marker: import("leaflet").Marker; element: HTMLElement | null }>(),
  );
  const offsetLinesRef = useRef(new Map<string, import("leaflet").Polyline>());
  const poiMarkersRef = useRef(new Map<string, import("leaflet").Marker>());
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
    const offsetLines = offsetLinesRef.current;
    const poiMarkers = poiMarkersRef.current;

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
      offsetLines.clear();
      poiMarkers.clear();
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

      const placed: Array<{
        projects: Array<{ project: MapProject; point: [number, number] }>;
        x: number;
        y: number;
      }> = [];
      const nextMarkerIds = new Set<string>();
      const nextOffsetLineIds = new Set<string>();
      const overlapDistance = compact ? 42 : 66;
      const ordered = [...projects].sort((a, b) => a.id.localeCompare(b.id, "zh-Hant"));

      ordered.forEach((project) => {
        const point = projectPoint(project);
        const screen = map.latLngToContainerPoint(point);
        const nearby = placed.find((group) => Math.hypot(group.x - screen.x, group.y - screen.y) < overlapDistance);

        if (nearby) {
          const size = nearby.projects.length;
          nearby.x = (nearby.x * size + screen.x) / (size + 1);
          nearby.y = (nearby.y * size + screen.y) / (size + 1);
          nearby.projects.push({ project, point });
        } else {
          placed.push({ projects: [{ project, point }], x: screen.x, y: screen.y });
        }
      });

      const markerPositions = placed.flatMap((group) => {
        if (group.projects.length === 1) {
          const item = group.projects[0];
          return [{ ...item, displayPoint: item.point, offset: false }];
        }

        return group.projects.map((item, index) => {
          const ring = Math.floor(index / 8);
          const ringStart = ring * 8;
          const ringCount = Math.min(8, group.projects.length - ringStart);
          const angle = -Math.PI / 2 + ((index - ringStart) * Math.PI * 2) / ringCount;
          const radius = (compact ? 34 : 52) + ring * (compact ? 30 : 44);
          const displayScreen = leaflet.point(
            group.x + Math.cos(angle) * radius,
            group.y + Math.sin(angle) * radius,
          );
          const display = map.containerPointToLatLng(displayScreen);
          return {
            ...item,
            displayPoint: [display.lat, display.lng] as [number, number],
            offset: true,
          };
        });
      });

      markerPositions.forEach(({ project, point, displayPoint, offset }) => {
        const active = project.id === activeId;
        const stage = projectStage(project);
        const stageText = stage === "presale" ? "預售屋" : "成屋";
        nextMarkerIds.add(project.id);
        if (offset) {
          nextOffsetLineIds.add(project.id);
          const existingLine = offsetLinesRef.current.get(project.id);
          if (existingLine) {
            existingLine.setLatLngs([point, displayPoint]);
          } else {
            const line = leaflet.polyline([point, displayPoint], {
              color: stage === "presale" ? "#c8511f" : "#176b8e",
              weight: 1.5,
              opacity: 0.6,
              dashArray: "3 4",
              interactive: false,
            }).addTo(map);
            offsetLinesRef.current.set(project.id, line);
          }
        }
        const existing = markersRef.current.get(project.id);
        if (existing) {
          existing.marker.setLatLng(displayPoint);
          existing.marker.setZIndexOffset(active ? 1000 : 0);
          existing.element?.classList.toggle("active", active);
          existing.element?.classList.toggle("stage-presale", stage === "presale");
          existing.element?.classList.toggle("stage-completed", stage === "completed");
          return;
        }

        const noOfficialPrice = project.priceEvidence?.status === "official-no-match";
        const priceText = project.price ? `${project.price.median} 萬` : noOfficialPrice ? "尚無成交" : "價格待補";
        const description = `${project.name}｜${stageText}｜${project.price ? `${project.price.median} 萬／坪` : noOfficialPrice ? "官方尚無已發布成交" : "成交價待補"}`;
        const icon = leaflet.divIcon({
          className: "project-map-marker-host",
          html: `<span class="project-map-marker stage-${stage} ${active ? "active" : ""} ${project.price ? "has-price" : "price-pending"}"><span class="marker-building" aria-hidden="true"><span class="marker-building-roof"></span><span class="marker-building-side"><span class="marker-side-windows"></span></span><span class="marker-building-front"><span class="marker-windows"></span></span></span><span class="marker-price">${priceText}</span></span>`,
          iconSize: [74, 64],
          iconAnchor: [37, 62],
        });
        const marker = leaflet.marker(displayPoint, {
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

      offsetLinesRef.current.forEach((line, projectId) => {
        if (nextOffsetLineIds.has(projectId)) return;
        line.remove();
        offsetLinesRef.current.delete(projectId);
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

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map) return;
    const visible = new Set(visibleAmenityCategories);
    const nextIds = new Set<string>();

    for (const poi of pois) {
      if (!visible.has(poi.category)) continue;
      nextIds.add(poi.id);
      const existing = poiMarkersRef.current.get(poi.id);
      if (existing) {
        existing.setLatLng([poi.latitude, poi.longitude]);
        continue;
      }
      const label = `${poi.name}（${amenitySymbols[poi.category]}）`;
      const icon = leaflet.divIcon({
        className: "amenity-poi-host",
        html: `<span class="amenity-poi-marker poi-${poi.category}">${amenitySymbols[poi.category]}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = leaflet.marker([poi.latitude, poi.longitude], { icon, keyboard: false, zIndexOffset: -200 }).addTo(map);
      marker.getElement()?.setAttribute("title", label);
      poiMarkersRef.current.set(poi.id, marker);
    }

    poiMarkersRef.current.forEach((marker, id) => {
      if (nextIds.has(id)) return;
      marker.remove();
      poiMarkersRef.current.delete(id);
    });
  }, [pois, ready, visibleAmenityCategories]);

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
