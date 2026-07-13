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
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef(
    new Map<string, { marker: import("maplibre-gl").Marker; element: HTMLButtonElement }>(),
  );
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;
      const initial = projectPoint(projects.find((project) => project.id === activeId) || projects[0]);
      const map = new maplibre.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: [initial[1], initial[0]],
        zoom: compact ? 15 : 14,
        minZoom: 11,
        maxZoom: 19,
        attributionControl: false,
        cooperativeGestures: false,
        reduceMotion: true,
        dragPan: { linearity: 0 },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        locale: {
          "NavigationControl.ZoomIn": "放大",
          "NavigationControl.ZoomOut": "縮小",
          "NavigationControl.ResetBearing": "重設方向",
        },
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new maplibre.AttributionControl({ compact: true, customAttribution: "OpenFreeMap" }),
        "bottom-right",
      );

      maplibreRef.current = maplibre;
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
      map.scrollZoom.enable();
      map.on("dragstart", () => containerRef.current?.classList.add("is-dragging"));
      map.on("dragend", () => {
        containerRef.current?.classList.remove("is-dragging");
        setMapMoved(true);
      });
      map.once("load", () => {
        if (cancelled) return;
        const chineseName: import("maplibre-gl").ExpressionSpecification = [
          "coalesce",
          ["get", "name:zh-Hant"],
          ["get", "name:zh"],
          ["get", "name_zh"],
          ["get", "name:nonlatin"],
          ["get", "name"],
          ["get", "name_en"],
        ];

        map.getStyle().layers?.forEach((layer) => {
          if (layer.type !== "symbol") return;
          const current = map.getLayoutProperty(layer.id, "text-field");
          if (!current || !JSON.stringify(current).includes("name")) return;
          map.setLayoutProperty(layer.id, "text-field", chineseName);
        });
        map.resize();
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const maplibre = maplibreRef.current;
    const map = mapRef.current;
    if (!ready || !maplibre || !map) return;

    let disposed = false;

    function clearMarkers() {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
    }

    function renderMarkers() {
      if (disposed) return;
      clearMarkers();

      const placed: Array<{ projects: MapProject[]; x: number; y: number }> = [];
      const clusterDistance = compact ? 34 : 62;
      const ordered = [...projects].sort((project) => project.id === activeId ? -1 : 1);

      ordered.forEach((project) => {
        const point = projectPoint(project);
        const screen = map.project([point[1], point[0]]);
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

      placed.forEach((group, groupIndex) => {
        const latitude = group.projects.reduce((sum, project) => sum + projectPoint(project)[0], 0) / group.projects.length;
        const longitude = group.projects.reduce((sum, project) => sum + projectPoint(project)[1], 0) / group.projects.length;

        if (group.projects.length > 1) {
          const element = document.createElement("button");
          element.type = "button";
          element.className = "project-cluster-marker";
          element.textContent = String(group.projects.length);
          element.title = `${group.projects.length} 個建案，點擊放大`;
          element.setAttribute("aria-label", `${group.projects.length} 個建案，點擊放大地圖`);
          element.addEventListener("click", () => {
            const bounds = new maplibre.LngLatBounds();
            group.projects.forEach((project) => {
              const point = projectPoint(project);
              bounds.extend([point[1], point[0]]);
            });
            map.fitBounds(bounds, { padding: compact ? 34 : 90, maxZoom: 17, duration: 0 });
          });
          const marker = new maplibre.Marker({ element, anchor: "center" })
            .setLngLat([longitude, latitude])
            .addTo(map);
          markersRef.current.set(`cluster-${groupIndex}`, { marker, element });
          return;
        }

        const project = group.projects[0];
        const active = project.id === activeId;
        const element = document.createElement("button");
        const building = document.createElement("span");
        const windows = document.createElement("span");
        const price = document.createElement("span");
        element.type = "button";
        element.className = `project-map-marker ${active ? "active" : ""} ${project.price ? "has-price" : "price-pending"}`;
        building.className = "marker-building";
        windows.className = "marker-windows";
        price.className = "marker-price";
        price.textContent = project.price ? `${project.price.median} 萬` : "價格待補";
        building.appendChild(windows);
        element.append(building, price);
        element.title = `${project.name}｜${project.price ? `${project.price.median} 萬／坪` : "成交價待補"}`;
        element.setAttribute("aria-label", `查看 ${project.name}，${project.price ? `每坪 ${project.price.median} 萬` : "成交價待補"}`);
        element.addEventListener("click", () => onSelectRef.current?.(project.id));
        const marker = new maplibre.Marker({ element, anchor: "bottom" })
          .setLngLat([longitude, latitude])
          .addTo(map);
        markersRef.current.set(project.id, { marker, element });
      });
    }

    renderMarkers();
    map.on("zoomend", renderMarkers);

    return () => {
      disposed = true;
      map.off("zoomend", renderMarkers);
      clearMarkers();
    };
  }, [activeId, compact, projects, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const active = projects.find((project) => project.id === activeId);
    if (!active) return;

    markersRef.current.forEach(({ element }, id) => {
      const selected = id === activeId;
      element.classList.toggle("active", selected);
    });
    const point = projectPoint(active);
    map.stop();
    map.jumpTo({ center: [point[1], point[0]], zoom: Math.max(map.getZoom(), compact ? 15 : 14) });
    setMapMoved(false);
  }, [activeId, compact, projects, ready]);

  function recenterActive() {
    const map = mapRef.current;
    const active = projects.find((project) => project.id === activeId);
    if (!map || !active) return;
    const point = projectPoint(active);
    map.stop();
    map.jumpTo({ center: [point[1], point[0]], zoom: Math.max(map.getZoom(), compact ? 15 : 14) });
    setMapMoved(false);
  }

  return (
    <div className={`interactive-map ${compact ? "compact" : ""}`} data-map-engine="maplibre" lang="zh-Hant-TW">
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
