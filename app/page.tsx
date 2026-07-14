"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dataset from "@/data/processed/projects.json";
import amenityDataset from "@/data/processed/amenities.json";
import qualityDataset from "@/data/processed/quality-evidence.json";
import updateReportDataset from "@/data/processed/update-report.json";
import InteractiveMap from "./InteractiveMap";

type PriceSummary = {
  median: number;
  low: number;
  high: number;
  count: number;
  latestDate: string | null;
  source: string;
};

type PriceEvidence = {
  status: "matched" | "official-no-match" | "source-no-match";
  statusLabel: string;
  matchMethod: string;
  addressCorroborated: boolean | null;
  addressTokens: string[];
  lastCheckedAt: string;
  sourceUrl: string;
};

type AmenityCategory = "convenience" | "pxmart" | "costco" | "station" | "school" | "medical";

type AmenityPoi = {
  id: string;
  name: string;
  category: AmenityCategory;
  latitude: number;
  longitude: number;
  address: string | null;
};

type NearestAmenity = AmenityPoi & {
  distanceMeters: number;
  walkMinutes: number;
};

type ProjectAmenity = {
  location: {
    latitude: number;
    longitude: number;
    confidence: "high" | "medium" | "low" | "estimated";
    method: string;
    label: string;
    queryAddress: string;
  };
  score: number | null;
  rawScore: number;
  grade: string | null;
  scoreReliability: "verified" | "approximate" | "unavailable";
  nearest: Record<AmenityCategory, NearestAmenity | null>;
};

type AmenityDataset = {
  generatedAt: string;
  source: { name: string; url: string; license: string; service: string };
  methodology: { distance: string; walkingMetersPerMinute: number; disclaimer: string; locationDisclaimer: string; scoreDisclaimer: string };
  categories: Record<AmenityCategory, { label: string; symbol: string }>;
  pois: AmenityPoi[];
  projects: Record<string, ProjectAmenity>;
};

type ProjectQuality = {
  status: "queued" | "reviewing" | "reviewed";
  statusLabel: string;
  lastReviewedAt: string | null;
  publishedEventCount: number;
  evidenceCount: number;
  searchTerms: string[];
  sourceChecks: Array<{ sourceId: string; status: string; checkedAt: string | null; matchCount: number | null }>;
  locationReview: {
    status: "verified" | "approximate" | "awaiting-parcel-check";
    label: string;
    method: string;
    parcel: { sectionName: string; sectionCode: string; parcelNumber: string; parcelCode: string; officialMapUrl: string } | null;
  };
  events: Array<{ id: string; title: string; level: "A" | "B" | "C" }>;
};

type QualityDataset = {
  generatedAt: string;
  methodology: { publishRule: string; noEventDisclaimer: string; reviewStates: Record<string, string>; evidenceLevels: Record<"A" | "B" | "C", string> };
  sources: Array<{ id: string; name: string; url: string; level: string; access: string }>;
  summary: { projectCount: number; publishedEventCount: number; queuedCount: number; verifiedLocationCount: number; approximateLocationCount: number; awaitingParcelCount: number };
  projects: Record<string, ProjectQuality>;
};

type RawProject = {
  id: string;
  name: string;
  region: "林口" | "A7";
  city: string;
  district: string;
  builder: string;
  households: number;
  zoning: string;
  mainUse: string;
  material: string;
  address: string;
  buildingLand: string;
  declaredDate: string | null;
  permitDate: string | null;
  permitNo: string;
  firstRegistrationDate: string | null;
  registryNumber: string;
  price: PriceSummary | null;
  priceEvidence: PriceEvidence;
  qualityStatus: string;
  amenityStatus: string;
  dataCompleteness: number;
  mapX: number;
  mapY: number;
};

type Project = RawProject & {
  latitude: number;
  longitude: number;
  amenity: ProjectAmenity;
  quality: ProjectQuality;
};

type ViewMode = "map" | "list";
type DetailTab = "summary" | "builder" | "price" | "quality" | "amenity";
type SortKey = "newest" | "priceLow" | "priceHigh" | "households";
type StageFilter = "all" | "presale" | "completed";
type AmenityFilter = "all" | "score80" | "convenience500" | "pxmart1000" | "station1200";

type UpdateReport = {
  generatedAt: string;
  status: "ok" | "attention";
  summary: {
    autoAddedCount: number;
    updatedExistingCount: number;
    ambiguousCount: number;
    missingFromCurrentSourceCount: number;
    historicalBacklogCount: number;
  };
};

const amenityData = amenityDataset as unknown as AmenityDataset;
const qualityData = qualityDataset as unknown as QualityDataset;
const updateReport = updateReportDataset as unknown as UpdateReport;
const projects = (dataset.projects as RawProject[]).map((project) => {
  const amenity = amenityData.projects[project.id];
  const quality = qualityData.projects[project.id];
  return {
    ...project,
    amenity,
    quality,
    latitude: amenity.location.latitude,
    longitude: amenity.location.longitude,
    amenityStatus: amenity.score === null ? "待地號定位" : `${amenity.score} 分 · ${amenity.grade}`,
  };
});
const amenityEntries = Object.entries(amenityData.categories) as Array<[AmenityCategory, { label: string; symbol: string }]>;

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "尚未登錄";
}

function priceText(project: Project) {
  if (project.price) return `${project.price.median} 萬／坪`;
  return project.priceEvidence.status === "official-no-match" ? "官方尚無成交" : "價格待補";
}

function locationLabel(project: Project) {
  return project.amenity.location.label;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
}

function amenityScoreText(project: Project) {
  return project.amenity.score === null ? "待定位" : `${project.amenity.score} 分`;
}

function amenityFilterMatches(project: Project, filter: AmenityFilter) {
  if (filter === "all") return true;
  if (project.amenity.score === null) return false;
  if (filter === "score80") return project.amenity.score >= 80;
  if (filter === "convenience500") return (project.amenity.nearest.convenience?.distanceMeters ?? Infinity) <= 500;
  if (filter === "pxmart1000") return (project.amenity.nearest.pxmart?.distanceMeters ?? Infinity) <= 1000;
  if (filter === "station1200") return (project.amenity.nearest.station?.distanceMeters ?? Infinity) <= 1200;
  return true;
}

function projectStage(project: Project) {
  return project.firstRegistrationDate ? "completed" : "presale";
}

function projectStageText(project: Project) {
  return projectStage(project) === "completed" ? "成屋" : "預售屋";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("全部");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [priceOnly, setPriceOnly] = useState(false);
  const [minHouseholds, setMinHouseholds] = useState(0);
  const [amenityFilter, setAmenityFilter] = useState<AmenityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [amenityLayers, setAmenityLayers] = useState<AmenityCategory[]>([]);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = projects.filter((project) => {
      const matchesQuery =
        !needle ||
        [project.name, project.builder, project.address, project.city, project.region]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return (
        matchesQuery &&
        (region === "全部" || project.region === region) &&
        (stageFilter === "all" || projectStage(project) === stageFilter) &&
        (!priceOnly || Boolean(project.price)) &&
        amenityFilterMatches(project, amenityFilter) &&
        project.households >= minHouseholds
      );
    });

    return [...result].sort((a, b) => {
      if (sortBy === "households") return b.households - a.households;
      if (sortBy === "priceLow") return (a.price?.median ?? Infinity) - (b.price?.median ?? Infinity);
      if (sortBy === "priceHigh") return (b.price?.median ?? -1) - (a.price?.median ?? -1);
      return (b.declaredDate || "").localeCompare(a.declaredDate || "");
    });
  }, [amenityFilter, minHouseholds, priceOnly, query, region, sortBy, stageFilter]);

  const active = filtered.find((project) => project.id === selectedId) || filtered[0] || projects[0];
  const compareProjects = compareIds
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean) as Project[];
  const pricedCount = filtered.filter((project) => project.price).length;
  const completedCount = filtered.filter((project) => project.firstRegistrationDate).length;
  const presaleCount = filtered.length - completedCount;
  const builderProjects = useMemo(
    () => projects
      .filter((project) => project.builder === active.builder)
      .sort((a, b) => (b.declaredDate || "").localeCompare(a.declaredDate || "")),
    [active.builder],
  );
  const builderCompletedCount = builderProjects.filter((project) => project.firstRegistrationDate).length;
  const builderPricedCount = builderProjects.filter((project) => project.price).length;
  const hasFilters = query || region !== "全部" || stageFilter !== "all" || amenityFilter !== "all" || priceOnly || minHouseholds > 0 || sortBy !== "newest";
  const advancedFilterCount = Number(priceOnly) + Number(minHouseholds > 0) + Number(amenityFilter !== "all") + Number(sortBy !== "newest");
  const activeNearestPois = active.amenity.score === null
    ? []
    : amenityEntries
      .map(([category]) => active.amenity.nearest[category])
      .filter(Boolean) as NearestAmenity[];

  useEffect(() => {
    const card = document.querySelector<HTMLElement>(`[data-result-id="${active.id}"]`);
    const list = document.querySelector<HTMLElement>(".result-list");
    if (!card || !list) return;
    const cardRect = card.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    if (cardRect.top < listRect.top) list.scrollTop -= listRect.top - cardRect.top + 8;
    if (cardRect.bottom > listRect.bottom) list.scrollTop += cardRect.bottom - listRect.bottom + 8;
  }, [active.id, panelOpen]);

  function selectProject(project: Project, openDetail = false) {
    setSelectedId(project.id);
    setDetailTab("summary");
    if (openDetail) setDetailOpen(true);
  }

  function toggleCompare(id: string) {
    setNotice("");
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        setNotice("一次最多比較 3 個建案");
        return current;
      }
      return [...current, id];
    });
  }

  function clearFilters() {
    setQuery("");
    setRegion("全部");
    setStageFilter("all");
    setPriceOnly(false);
    setMinHouseholds(0);
    setAmenityFilter("all");
    setSortBy("newest");
  }

  function selectBuilderProject(project: Project) {
    setQuery("");
    setRegion("全部");
    setStageFilter("all");
    setPriceOnly(false);
    setMinHouseholds(0);
    setAmenityFilter("all");
    setSelectedId(project.id);
    setDetailTab("builder");
  }

  function toggleAmenityLayer(category: AmenityCategory) {
    setAmenityLayers((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="居鑑首頁">
          <span>居</span>
          <div><strong>居鑑</strong><small>建案履歷資料庫</small></div>
        </a>
        <nav aria-label="主要功能">
          <button className="active" type="button" onClick={() => setViewMode("map")}>建案地圖</button>
          <button type="button" onClick={() => { setViewMode("list"); setPriceOnly(true); }}>成交行情</button>
          <button type="button" onClick={() => { setViewMode("list"); setDetailTab("quality"); }}>品質查核</button>
        </nav>
        <div className="header-tools">
          <span><i />官方資料 {projects.length} 案</span>
          <button type="button" onClick={() => setMethodOpen(true)}>資料說明</button>
        </div>
      </header>

      <section className="filter-bar" id="top" aria-label="搜尋篩選">
        <label className="global-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋建案、建商、路段" aria-label="搜尋建案、建商或路段" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
        </label>

        <label className="filter-select"><span>區域</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>全部</option><option>林口</option><option>A7</option></select></label>
        <label className="filter-select"><span>狀態</span><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as StageFilter)} aria-label="建案狀態"><option value="all">全部</option><option value="presale">預售屋</option><option value="completed">成屋</option></select></label>
        <div className="advanced-filter-wrap">
          <button type="button" className={`advanced-filter-button ${advancedFilterCount ? "active" : ""}`} aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((value) => !value)}>篩選{advancedFilterCount ? ` ${advancedFilterCount}` : ""} <span>⌄</span></button>
          {advancedFiltersOpen && <section className="advanced-filter-panel" aria-label="進階篩選">
            <header><strong>進階篩選</strong><button type="button" onClick={() => setAdvancedFiltersOpen(false)}>完成</button></header>
            <label><span>生活機能</span><select value={amenityFilter} onChange={(event) => setAmenityFilter(event.target.value as AmenityFilter)}><option value="all">不限</option><option value="score80">機能 80 分以上</option><option value="convenience500">便利商店 500 公尺內</option><option value="pxmart1000">全聯 1 公里內</option><option value="station1200">車站 1.2 公里內</option></select></label>
            <label><span>社區戶數</span><select value={minHouseholds} onChange={(event) => setMinHouseholds(Number(event.target.value))}><option value="0">不限</option><option value="100">100 戶以上</option><option value="300">300 戶以上</option><option value="500">500 戶以上</option></select></label>
            <label><span>排序方式</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}><option value="newest">最新備查</option><option value="priceLow">單價低到高</option><option value="priceHigh">單價高到低</option><option value="households">戶數多到少</option></select></label>
            <button type="button" className={`price-toggle ${priceOnly ? "active" : ""}`} onClick={() => setPriceOnly((value) => !value)}><span>{priceOnly ? "✓" : ""}</span>只看有成交資料</button>
            {hasFilters && <button type="button" className="panel-clear" onClick={clearFilters}>清除全部條件</button>}
          </section>}
        </div>
        {hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>清除</button>}

        <div className="view-switch" aria-label="檢視模式">
          <button type="button" className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><span aria-hidden="true">⌖</span> 地圖</button>
          <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><span aria-hidden="true">☷</span> 列表</button>
        </div>
      </section>

      {viewMode === "map" ? (
        <section className={`map-workspace ${panelOpen ? "" : "panel-collapsed"}`}>
          <aside className="result-sidebar">
            <div className="result-summary">
              <div><strong>{filtered.length} 個建案</strong><span>{pricedCount} 案有成交資料</span></div>
              <small>點選建案切換地圖</small>
            </div>
            <div className="result-list">
              {filtered.length === 0 ? (
                <div className="empty-results"><strong>沒有符合的建案</strong><button type="button" onClick={clearFilters}>清除條件</button></div>
              ) : filtered.map((project) => (
                <article className={`map-result-card ${active.id === project.id ? "selected" : ""}`} data-result-id={project.id} key={project.id}>
                  <button className="result-main" type="button" onClick={() => selectProject(project)}>
                    <div className="result-title"><span>{project.region}</span><h2>{project.name}</h2><span className={`result-stage ${projectStage(project)}`}>{projectStageText(project)}</span></div>
                    <p>{project.builder}</p>
                    <div className="result-data"><strong>{priceText(project)}</strong><span>{project.households} 戶</span><span className={`amenity-inline ${project.amenity.score === null ? "unavailable" : ""}`}>機能 {amenityScoreText(project)}</span></div>
                  </button>
                  <div className="result-actions">
                    <button type="button" onClick={() => selectProject(project, true)}>完整資料</button>
                    <button type="button" className={compareIds.includes(project.id) ? "checked" : ""} onClick={() => toggleCompare(project.id)}>{compareIds.includes(project.id) ? "✓ 已比較" : "＋ 比較"}</button>
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <section className="map-stage" aria-label={`${active.name} 站內地圖`}>
            <button
              className="panel-toggle"
              type="button"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((value) => !value)}
            >
              {panelOpen ? "‹ 收合建案" : "☰ 展開建案"}
            </button>
            <InteractiveMap
              projects={filtered.length ? filtered : [active]}
              activeId={active.id}
              onSelect={(id) => {
                const project = projects.find((item) => item.id === id);
                if (project) selectProject(project);
              }}
              pois={amenityData.pois}
              visibleAmenityCategories={amenityLayers}
            />
            <details className="map-legend">
              <summary>圖例</summary>
              <div><span title="尚未有首次登記日期"><i className="presale" /> 預售屋 <b>{presaleCount}</b></span><span title="已有首次登記日期"><i className="completed" /> 成屋 <b>{completedCount}</b></span><span><i className="cluster" /> 橘藍代表重疊</span></div>
            </details>
            <details className="amenity-layer-control">
              <summary>生活機能{amenityLayers.length ? ` ${amenityLayers.length}` : ""}</summary>
              <div>{amenityEntries.map(([category, meta]) => <button type="button" key={category} className={amenityLayers.includes(category) ? "active" : ""} onClick={(event) => { event.preventDefault(); toggleAmenityLayer(category); }}><i className={`poi-${category}`}>{meta.symbol}</i>{meta.label}</button>)}</div>
            </details>
            <div className="map-gesture-hint">滾輪縮放 · 拖曳移動</div>
            <article className="map-project-card">
              <div className="map-card-heading"><span>{active.region}</span><div><h2>{active.name}</h2><p>{active.builder}</p></div><b className={projectStage(active)}>{projectStageText(active)}</b></div>
              <div className="map-card-data"><div><span>中位單價</span><strong>{active.price ? active.price.median : "—"}</strong><small>{active.price ? "萬／坪" : active.priceEvidence.status === "official-no-match" ? "官方未發布" : "待配對"}</small></div><div><span>戶數</span><strong>{active.households}</strong><small>戶</small></div><div><span>機能</span><strong className={active.amenity.score === null ? "amenity-pending" : ""}>{active.amenity.score ?? "待定位"}</strong>{active.amenity.score !== null && <small>分</small>}</div><div><span>定位</span><strong className="location-value">{locationLabel(active)}</strong></div></div>
              <div className="map-card-actions"><button type="button" onClick={() => setDetailOpen(true)}>查看建案完整資料</button><button type="button" className={compareIds.includes(active.id) ? "added" : ""} onClick={() => toggleCompare(active.id)}>{compareIds.includes(active.id) ? "✓ 已加入比較" : "＋ 加入比較"}</button></div>
            </article>
          </section>
        </section>
      ) : (
        <section className="list-workspace">
          <div className="list-heading"><div><p>PROJECT LIST</p><h1>建案列表</h1></div><span>共 {filtered.length} 案 · {pricedCount} 案有成交資料</span></div>
          {filtered.length === 0 ? (
            <div className="list-empty"><strong>沒有符合的建案</strong><button type="button" onClick={clearFilters}>清除全部條件</button></div>
          ) : (
            <div className="project-grid">
              {filtered.map((project) => (
                <article className="project-grid-card" key={project.id}>
                  <button type="button" className="grid-card-main" onClick={() => selectProject(project, true)}>
                    <div className="project-placeholder"><span>{project.region}</span><strong>{project.price ? `${project.price.median}` : project.priceEvidence.status === "official-no-match" ? "尚無" : "待補"}</strong><small>{project.price ? "萬／坪" : "官方成交"}</small></div>
                    <div className="grid-card-copy"><div><span>{project.city} · {project.district}</span><i>品質已排程</i></div><h2>{project.name}</h2><p>{project.builder}</p><dl><div><dt>戶數</dt><dd>{project.households} 戶</dd></div><div><dt>備查</dt><dd>{formatDate(project.declaredDate)}</dd></div><div><dt>機能</dt><dd>{amenityScoreText(project)}</dd></div></dl></div>
                  </button>
                  <button type="button" className={`grid-compare ${compareIds.includes(project.id) ? "checked" : ""}`} onClick={() => toggleCompare(project.id)}>{compareIds.includes(project.id) ? "✓ 已加入比較" : "＋ 加入比較"}</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {detailOpen && (
        <aside className="detail-drawer" aria-label={`${active.name} 詳細資料`}>
          <header><button type="button" onClick={() => setDetailOpen(false)} aria-label="關閉">×</button><div className="drawer-header-meta"><span>{active.region} · {active.city}{active.district}</span><b className={projectStage(active)}>{projectStageText(active)}</b></div><h2>{active.name}</h2><p>起造人：{active.builder}</p></header>
          <div className="drawer-metrics"><div><span>中位單價</span><strong>{active.price ? active.price.median : "—"}</strong><small>{active.price ? "萬／坪" : active.priceEvidence.status === "official-no-match" ? "官方未發布" : "待配對"}</small></div><div><span>戶數</span><strong>{active.households}</strong><small>戶</small></div><div><span>資料</span><strong>{active.dataCompleteness}</strong><small>%</small></div></div>
          <nav>{(["summary", "builder", "price", "quality", "amenity"] as DetailTab[]).map((tab) => <button key={tab} type="button" className={detailTab === tab ? "active" : ""} onClick={() => setDetailTab(tab)}>{{ summary: "基本", builder: "建商", price: "價格", quality: "品質", amenity: "機能" }[tab]}</button>)}</nav>
          <div className="drawer-content">
            {detailTab === "summary" && <section><h3>官方基本資料</h3><div className={`stage-evidence ${projectStage(active)}`}><span>{projectStageText(active)}</span><strong>{active.firstRegistrationDate ? `已於 ${formatDate(active.firstRegistrationDate)} 首次登記` : "目前尚未有首次登記日期"}</strong><p>建案狀態依本資料庫收錄的首次登記日期判斷；官方資料更新後，狀態也會隨之調整。</p></div><div className="drawer-facts"><div><span>申報備查</span><strong>{formatDate(active.declaredDate)}</strong></div><div><span>建照日期</span><strong>{formatDate(active.permitDate)}</strong></div><div><span>首次登記</span><strong>{formatDate(active.firstRegistrationDate)}</strong></div><div><span>主要建材</span><strong>{active.material}</strong></div><div><span>主要用途</span><strong>{active.mainUse}</strong></div><div><span>使用分區</span><strong>{active.zoning}</strong></div></div><div className="drawer-address"><span>坐落街道</span><strong>{active.city}{active.district}{active.address}</strong><span>坐落基地</span><strong>{active.buildingLand}</strong><small>{locationLabel(active)}，非精確基地界址。</small>{active.quality.locationReview.parcel && <a className="parcel-map-link" href={active.quality.locationReview.parcel.officialMapUrl} target="_blank" rel="noreferrer">用國土測繪圖資服務雲核對地號 ↗</a>}</div><details><summary>建照與官方資料編號</summary><p>{active.permitNo}</p><p>{active.registryNumber}</p></details></section>}
            {detailTab === "builder" && <section><h3>建商履歷</h3><div className="builder-profile"><span>本資料庫辨識名稱</span><strong>{active.builder}</strong><p>目前以官方資料中的起造人名稱進行完全相同比對。</p></div><div className="builder-stats"><div><span>已收錄</span><strong>{builderProjects.length}</strong><small>個建案</small></div><div><span>成屋</span><strong>{builderCompletedCount}</strong><small>個建案</small></div><div><span>有成交</span><strong>{builderPricedCount}</strong><small>個建案</small></div></div><div className="builder-projects">{builderProjects.map((project) => <button type="button" className={project.id === active.id ? "active" : ""} onClick={() => selectBuilderProject(project)} key={project.id}><span className={projectStage(project)}>{projectStageText(project)}</span><div><strong>{project.name}</strong><small>{project.region} · 備查 {formatDate(project.declaredDate)}</small></div><b>{priceText(project)}</b></button>)}</div><p className="builder-disclaimer">目前僅統計本資料庫已收錄的林口與 A7 建案，不代表該建商的完整作品或品質排名。</p></section>}
            {detailTab === "price" && <section><h3>成交行情</h3>{active.price ? <><div className="drawer-price"><span>中位單價</span><strong>{active.price.median}</strong><small>萬／坪</small><p>{active.price.low}–{active.price.high} 萬／坪</p></div><div className="drawer-facts two"><div><span>有效樣本</span><strong>{active.price.count} 筆</strong></div><div><span>最新交易</span><strong>{formatDate(active.price.latestDate)}</strong></div></div><p className="drawer-note">來源：{active.price.source}。已排除解約資料並以官方編號去除重複；成交價不是目前開價，也不是估價結果。</p></> : <div className="drawer-empty price-unavailable"><span>{active.priceEvidence.statusLabel}</span><strong>{active.priceEvidence.status === "official-no-match" ? "目前沒有可安全歸戶的官方成交" : "成交資料尚待配對"}</strong><p>{active.priceEvidence.status === "official-no-match" ? "已核對官方已發布資料；這不代表建案沒有銷售，近期交易可能尚未申報或公開。" : "目前來源未成功配對，不代表沒有交易。"}</p><small>查核更新 {formatDate(active.priceEvidence.lastCheckedAt)} · {active.priceEvidence.matchMethod}</small><a href={active.priceEvidence.sourceUrl} target="_blank" rel="noreferrer">查看官方資料入口 ↗</a></div>}</section>}
            {detailTab === "quality" && <section><h3>漏水與施工品質</h3><div className="quality-pending"><span>{active.quality.statusLabel}</span><strong>目前 {active.quality.publishedEventCount} 件事件通過刊登門檻</strong><p>{qualityData.methodology.noEventDisclaimer}</p></div><h4 className="quality-section-title">官方來源查核進度</h4><div className="quality-source-checks">{active.quality.sourceChecks.map((check) => { const source = qualityData.sources.find((item) => item.id === check.sourceId); if (!source) return null; return <a href={source.url} target="_blank" rel="noreferrer" key={check.sourceId}><div><strong>{source.name}</strong><small>{source.access} · 證據等級 {source.level}</small></div><span>{check.status === "not-reviewed" ? "待查核" : "已查核"}</span></a>; })}</div><details className="quality-review-details"><summary>查看這一案的查核關鍵字</summary><div>{active.quality.searchTerms.map((term) => <span key={term}>{term}</span>)}</div></details><h4 className="quality-section-title">證據刊登標準</h4><div className="evidence-levels">{(["A", "B", "C"] as const).map((level) => <article key={level}><b>{level}</b><div><strong>{{ A: "可直接核對", B: "多來源互證", C: "僅供追查" }[level]}</strong><p>{qualityData.methodology.evidenceLevels[level]}</p></div></article>)}</div><p className="quality-method-note">{qualityData.methodology.publishRule}</p></section>}
            {detailTab === "amenity" && <section><h3>生活機能</h3>{active.amenity.score === null ? <div className="amenity-unavailable"><span>等待地號核對</span><strong>暫不顯示精確機能分數</strong><p>{amenityData.methodology.scoreDisclaimer}</p><dl><div><dt>官方坐落街道</dt><dd>{active.city}{active.district}{active.address}</dd></div><div><dt>官方坐落基地</dt><dd>{active.buildingLand}</dd></div></dl>{active.quality.locationReview.parcel && <a href={active.quality.locationReview.parcel.officialMapUrl} target="_blank" rel="noreferrer">用國土測繪圖資服務雲核對地號 ↗</a>}</div> : <><div className="amenity-score-card"><div className="amenity-score-ring" style={{ "--amenity-score": `${active.amenity.score}%` } as CSSProperties}><strong>{active.amenity.score}</strong><span>分</span></div><div><span>{active.amenity.scoreReliability === "verified" ? "可信定位評估" : "道路位置估算"}</span><strong>{active.amenity.grade}</strong><p>{locationLabel(active)} · 資料更新 {formatDate(amenityData.generatedAt)}</p></div></div><div className="drawer-amenities">{amenityEntries.map(([category, meta]) => { const nearest = active.amenity.nearest[category]; return <div key={category}><i className={`poi-${category}`}>{meta.symbol}</i><span>{meta.label}</span>{nearest ? <><strong>{nearest.name}</strong><p>{formatDistance(nearest.distanceMeters)} · 約 {nearest.walkMinutes} 分鐘*</p></> : <><strong>附近資料不足</strong><p>不計入分數</p></>}</div>; })}</div><div className="drawer-map"><InteractiveMap projects={[active]} activeId={active.id} compact pois={activeNearestPois} visibleAmenityCategories={amenityEntries.map(([category]) => category)} /></div><small className="drawer-map-note">* 以每分鐘 80 公尺換算直線距離，不是實際步行路線。{amenityData.methodology.locationDisclaimer}</small></>}<a className="amenity-source-link" href={amenityData.source.url} target="_blank" rel="noreferrer">{amenityData.source.name} · {amenityData.source.license} ↗</a></section>}
          </div>
        </aside>
      )}

      {compareIds.length > 0 && <div className="compare-bar"><div>{compareProjects.map((project) => <button type="button" key={project.id} onClick={() => toggleCompare(project.id)}>{project.name}<span>×</span></button>)}</div><small>{compareIds.length}／3</small><button type="button" onClick={() => setCompareOpen(true)}>比較建案</button>{notice && <em>{notice}</em>}</div>}

      {compareOpen && <div className="modal-layer" role="presentation" onMouseDown={() => setCompareOpen(false)}><section className="compare-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setCompareOpen(false)}>×</button><h2>建案比較</h2>{compareProjects.length < 2 && <p>再選一個建案，就能看出差異。</p>}<div className="table-scroll"><table><thead><tr><th>項目</th>{compareProjects.map((p) => <th key={p.id}>{p.name}<small>{p.region}</small></th>)}</tr></thead><tbody><tr><th>建案狀態</th>{compareProjects.map((p) => <td key={p.id}>{projectStageText(p)}</td>)}</tr><tr><th>中位單價</th>{compareProjects.map((p) => <td key={p.id}>{priceText(p)}</td>)}</tr><tr><th>成交樣本</th>{compareProjects.map((p) => <td key={p.id}>{p.price ? `${p.price.count} 筆` : "待補"}</td>)}</tr><tr><th>申報戶數</th>{compareProjects.map((p) => <td key={p.id}>{p.households} 戶</td>)}</tr><tr><th>備查日期</th>{compareProjects.map((p) => <td key={p.id}>{formatDate(p.declaredDate)}</td>)}</tr><tr><th>品質</th>{compareProjects.map((p) => <td key={p.id}>{p.quality.statusLabel}<small>{p.quality.publishedEventCount} 件通過門檻</small></td>)}</tr><tr><th>生活機能</th>{compareProjects.map((p) => <td key={p.id}><strong>{amenityScoreText(p)}</strong><small>{p.amenity.grade ?? "需先完成定位"}</small></td>)}</tr></tbody></table></div></section></div>}

      {methodOpen && <div className="modal-layer" role="presentation" onMouseDown={() => setMethodOpen(false)}><section className="method-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setMethodOpen(false)}>×</button><h2>資料怎麼看？</h2><div><article><span>官方</span><strong>建案基本身分</strong><p>起造人、戶數、基地、建照與申報日期。</p></article><article><span className="coral">成交</span><strong>歷史季度＋本期實價樣本</strong><p>顯示筆數、區間與中位數；排除解約並去除重複，不代表目前開價。</p></article><article><span>機能</span><strong>六類設施距離評分</strong><p>使用 OpenStreetMap 直線距離；不是導航，也不代表實際步行品質。</p></article><article><span className="gray">品質</span><strong>證據達門檻才刊登</strong><p>A 級可核對文件或 B 級多來源互證；單一匿名說法不下結論。</p></article><article><span>維護</span><strong>安全更新已啟用</strong><p>更新於 {formatDate(updateReport.generatedAt)}。新案會自動加入；既有案不自動刪除，歧義資料不覆蓋。目前另保留 {updateReport.summary.historicalBacklogCount} 案歷史候選。</p></article></div><footer>{dataset.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name} ↗</a>)}<a href={amenityData.source.url} target="_blank" rel="noreferrer">OpenStreetMap ↗</a><a href="https://www.judicial.gov.tw/tw/cp-1729-81602-b94da-1.html" target="_blank" rel="noreferrer">司法院裁判查詢 ↗</a></footer></section></div>}
    </main>
  );
}
