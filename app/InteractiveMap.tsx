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

type AmenityCategory = "convenience" | "pxmart" | "costco" | "station" | "school" | "medical" | "market" | "park" | "pharmacy" | "parking";

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
  onSearchArea?: (ids: string[]) => void;
  onClearArea?: () => void;
  onRegionSelect?: (region: "林口" | "A7") => void;
  scopeActive?: boolean;
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

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) * 5) / 10;
}

const amenitySymbols: Record<AmenityCategory, string> = {
  convenience: "商",
  pxmart: "全",
  costco: "好",
  station: "站",
  school: "學",
  medical: "醫",
  market: "市",
  park: "園",
  pharmacy: "藥",
  parking: "停",
};

const projectMarkerMinZoom = 14;
const overviewCenter: [number, number] = [25.073, 121.377];

export default function InteractiveMap({
  projects,
  activeId,
  onSelect,
  onSearchArea,
  onClearArea,
  onRegionSelect,
  scopeActive = false,
  compact = false,
  pois = [],
  visibleAmenityCategories = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef(new Map<string, { marker: import("leaflet").Marker; element: HTMLElement | null }>());
  const areaMarkersRef = useRef(new Map<string, import("leaflet").Marker>());
  const poiMarkersRef = useRef(new Map<string, import("leaflet").Marker>());
  const onSelectRef = useRef(onSelect);
  const onRegionSelectRef = useRef(onRegionSelect);
  const initialProjectsRef = useRef(projects);
  const initialActiveIdRef = useRef(activeId);
  const [ready, setReady] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [projectMarkersVisible, setProjectMarkersVisible] = useState(compact);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onRegionSelectRef.current = onRegionSelect;
  }, [onRegionSelect, onSelect]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const markers = markersRef.current;
    const areaMarkers = areaMarkersRef.current;
    const poiMarkers = poiMarkersRef.current;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const initialProjects = initialProjectsRef.current;
      const initialActiveId = initialActiveIdRef.current;
      const compactPoint = projectPoint(initialProjects.find((project) => project.id === initialActiveId) || initialProjects[0]);
      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
        inertia: false,
        zoomAnimation: true,
        fadeAnimation: false,
        markerZoomAnimation: true,
        zoomAnimationThreshold: 4,
        wheelDebounceTime: 70,
        wheelPxPerZoomLevel: 130,
        minZoom: 11,
        maxZoom: 19,
      });
      map.setView(compact ? compactPoint : overviewCenter, compact ? 15 : 12, { animate: false });
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 11,
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 6,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      leaflet.control.zoom({ position: "topright", zoomInTitle: "放大", zoomOutTitle: "縮小" }).addTo(map);
      leaflet.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

      const syncMapTier = () => {
        const showProjects = compact || map.getZoom() >= projectMarkerMinZoom;
        containerRef.current?.classList.toggle("map-tier-project", showProjects);
        containerRef.current?.classList.toggle("map-tier-area", !showProjects);
        setProjectMarkersVisible((current) => current === showProjects ? current : showProjects);
      };
      const markViewportChanged = () => {
        if (!compact) setMapMoved(true);
      };

      leafletRef.current = leaflet;
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false, pan: false }));
      resizeObserver.observe(containerRef.current);
      map.on("dragend", markViewportChanged);
      map.on("zoomend", () => {
        syncMapTier();
        markViewportChanged();
      });
      map.whenReady(() => {
        if (cancelled) return;
        map.invalidateSize({ animate: false, pan: false });
        syncMapTier();
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.clear();
      areaMarkers.clear();
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

    const nextMarkerIds = new Set(projects.map((project) => project.id));
    projects.forEach((project) => {
      const point = projectPoint(project);
      const active = project.id === activeId;
      const stage = projectStage(project);
      const stageText = stage === "presale" ? "預售屋" : "成屋";
      const noOfficialPrice = project.priceEvidence?.status === "official-no-match";
      const markerPrice = project.price ? `${project.price.median} 萬` : noOfficialPrice ? "尚無成交" : "價格待補";
      const description = `${project.name}｜${stageText}｜${project.price ? `${project.price.median} 萬／坪` : markerPrice}`;
      const icon = leaflet.divIcon({
        className: "project-map-marker-host",
        html: `<span class="project-map-marker stage-${stage} ${active ? "active" : ""} ${project.price ? "has-price" : "price-pending"}"><span class="marker-building" aria-hidden="true"><span class="marker-building-roof"></span><span class="marker-building-side"><span class="marker-side-windows"></span></span><span class="marker-building-front"><span class="marker-windows"></span></span></span><span class="marker-price">${markerPrice}</span></span>`,
        iconSize: [74, 64],
        iconAnchor: [37, 62],
      });
      const existing = markersRef.current.get(project.id);
      if (existing) {
        existing.marker.setLatLng(point);
        existing.marker.setIcon(icon);
        existing.marker.setZIndexOffset(active ? 1000 : 0);
        const host = existing.marker.getElement();
        host?.setAttribute("aria-label", `查看 ${description}`);
        host?.setAttribute("title", description);
        existing.element = host?.querySelector<HTMLElement>(".project-map-marker") ?? null;
        return;
      }

      const marker = leaflet.marker(point, { icon, keyboard: true, zIndexOffset: active ? 1000 : 0 }).addTo(map);
      marker.on("click", () => onSelectRef.current?.(project.id));
      const host = marker.getElement();
      host?.setAttribute("aria-label", `查看 ${description}`);
      host?.setAttribute("title", description);
      markersRef.current.set(project.id, { marker, element: host?.querySelector<HTMLElement>(".project-map-marker") ?? null });
    });

    markersRef.current.forEach(({ marker }, markerId) => {
      if (nextMarkerIds.has(markerId)) return;
      marker.remove();
      markersRef.current.delete(markerId);
    });

    const groups = new Map<"林口" | "A7", MapProject[]>();
    projects.forEach((project) => groups.set(project.region, [...(groups.get(project.region) || []), project]));
    const nextAreaIds = new Set<string>();
    groups.forEach((items, region) => {
      nextAreaIds.add(region);
      const points = items.map(projectPoint);
      const point: [number, number] = [
        points.reduce((total, item) => total + item[0], 0) / points.length,
        points.reduce((total, item) => total + item[1], 0) / points.length,
      ];
      const regionMedian = median(items.flatMap((project) => project.price ? [project.price.median] : []));
      const icon = leaflet.divIcon({
        className: "area-summary-host",
        html: `<span class="area-summary-marker"><b>${region}</b><strong>${items.length} 案</strong><small>${regionMedian === null ? "成交資料待補" : `中位 ${regionMedian} 萬／坪`}</small><em>放大查看建案</em></span>`,
        iconSize: [142, 80],
        iconAnchor: [71, 40],
      });
      const existing = areaMarkersRef.current.get(region);
      if (existing) {
        existing.setLatLng(point);
        existing.setIcon(icon);
        existing.off("click");
        existing.on("click", () => onRegionSelectRef.current?.(region));
        return;
      }
      const marker = leaflet.marker(point, { icon, keyboard: true, zIndexOffset: -50 }).addTo(map);
      marker.on("click", () => onRegionSelectRef.current?.(region));
      marker.getElement()?.setAttribute("aria-label", `篩選 ${region} 的 ${items.length} 個建案`);
      areaMarkersRef.current.set(region, marker);
    });
    areaMarkersRef.current.forEach((marker, region) => {
      if (nextAreaIds.has(region)) return;
      marker.remove();
      areaMarkersRef.current.delete(region);
    });
  }, [activeId, projects, ready]);

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

  function searchCurrentArea() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const ids = projects.filter((project) => bounds.contains(projectPoint(project))).map((project) => project.id);
    onSearchArea?.(ids);
    setMapMoved(false);
  }

  return (
    <div className={`interactive-map ${compact ? "compact" : ""}`} data-map-engine="leaflet" lang="zh-Hant-TW">
      <div className="interactive-map-canvas" ref={containerRef} role="application" aria-label="可用滑鼠滾輪縮放、拖曳移動的建案地圖" />
      {!projectMarkersVisible && !compact && <div className="map-marker-zoom-hint">目前顯示區域摘要 · 放大後顯示個別建案</div>}
      {mapMoved && !compact && <button className="map-search-area" type="button" onClick={searchCurrentArea}>搜尋此地圖範圍</button>}
      {scopeActive && !mapMoved && !compact && <button className="map-clear-area" type="button" onClick={onClearArea}>顯示全部範圍</button>}
    </div>
  );
}
