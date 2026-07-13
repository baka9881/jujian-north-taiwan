"use client";

import { useEffect, useMemo, useState } from "react";
import dataset from "@/data/processed/projects.json";
import InteractiveMap from "./InteractiveMap";

type PriceSummary = {
  median: number;
  low: number;
  high: number;
  count: number;
  latestDate: string | null;
  source: string;
};

type Project = {
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
  qualityStatus: string;
  amenityStatus: string;
  dataCompleteness: number;
  mapX: number;
  mapY: number;
};

type ViewMode = "map" | "list";
type DetailTab = "summary" | "builder" | "price" | "quality" | "amenity";
type SortKey = "newest" | "priceLow" | "priceHigh" | "households";
type StageFilter = "all" | "presale" | "completed";

const projects = dataset.projects as Project[];

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "尚未登錄";
}

function priceText(project: Project) {
  return project.price ? `${project.price.median} 萬／坪` : "價格待補";
}

function locationLabel(project: Project) {
  if (/交叉|路口|與/u.test(project.address)) return "官方路口附近";
  if (/號/u.test(project.address)) return "官方門牌附近";
  return "官方道路附近";
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
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
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
        project.households >= minHouseholds
      );
    });

    return [...result].sort((a, b) => {
      if (sortBy === "households") return b.households - a.households;
      if (sortBy === "priceLow") return (a.price?.median ?? Infinity) - (b.price?.median ?? Infinity);
      if (sortBy === "priceHigh") return (b.price?.median ?? -1) - (a.price?.median ?? -1);
      return (b.declaredDate || "").localeCompare(a.declaredDate || "");
    });
  }, [minHouseholds, priceOnly, query, region, sortBy, stageFilter]);

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
  const hasFilters = query || region !== "全部" || stageFilter !== "all" || priceOnly || minHouseholds > 0 || sortBy !== "newest";

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
    setSortBy("newest");
  }

  function selectBuilderProject(project: Project) {
    setQuery("");
    setRegion("全部");
    setStageFilter("all");
    setPriceOnly(false);
    setMinHouseholds(0);
    setSelectedId(project.id);
    setDetailTab("builder");
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
          <span><i />官方資料 40 案</span>
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
        <label className="filter-select"><span>戶數</span><select value={minHouseholds} onChange={(event) => setMinHouseholds(Number(event.target.value))}><option value="0">不限</option><option value="100">100 戶以上</option><option value="300">300 戶以上</option><option value="500">500 戶以上</option></select></label>
        <button type="button" className={`filter-chip ${priceOnly ? "active" : ""}`} onClick={() => setPriceOnly((value) => !value)}>有成交資料</button>
        <label className="filter-select sort"><span>排序</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}><option value="newest">最新備查</option><option value="priceLow">單價低到高</option><option value="priceHigh">單價高到低</option><option value="households">戶數多到少</option></select></label>
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
                    <div className="result-data"><strong>{priceText(project)}</strong><span>{project.households} 戶</span><span>資料 {project.dataCompleteness}%</span></div>
                    <small>{project.city}{project.district}{project.address}</small>
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
            />
            <div className="map-caption"><span>依官方地址顯示附近位置</span><strong>{locationLabel(active)}</strong><small>非精確基地界址，可拖曳探索周邊</small></div>
            <aside className="map-legend" aria-label="地圖標記說明">
              <strong>地圖標記</strong>
              <span title="尚未有首次登記日期"><i className="presale" /> 預售屋 <b>{presaleCount}</b></span>
              <span title="已有首次登記日期"><i className="completed" /> 成屋 <b>{completedCount}</b></span>
              <span><i className="cluster" /> 橘藍群組為兩者重疊</span>
            </aside>
            <div className="map-gesture-hint">滾輪縮放 · 拖曳移動</div>
            <article className="map-project-card">
              <div className="map-card-heading"><span>{active.region}</span><div><h2>{active.name}</h2><p>{active.builder}</p></div></div>
              <div className="map-card-data"><div><span>中位單價</span><strong>{active.price ? active.price.median : "—"}</strong><small>{active.price ? "萬／坪" : "待補"}</small></div><div><span>申報戶數</span><strong>{active.households}</strong><small>戶</small></div><div><span>資料完整</span><strong>{active.dataCompleteness}</strong><small>%</small></div></div>
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
                    <div className="project-placeholder"><span>{project.region}</span><strong>{project.price ? `${project.price.median}` : "待補"}</strong><small>{project.price ? "萬／坪" : "成交價"}</small></div>
                    <div className="grid-card-copy"><div><span>{project.city} · {project.district}</span><i>品質待查</i></div><h2>{project.name}</h2><p>{project.builder}</p><dl><div><dt>戶數</dt><dd>{project.households} 戶</dd></div><div><dt>備查</dt><dd>{formatDate(project.declaredDate)}</dd></div><div><dt>資料</dt><dd>{project.dataCompleteness}%</dd></div></dl></div>
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
          <div className="drawer-metrics"><div><span>中位單價</span><strong>{active.price ? active.price.median : "—"}</strong><small>{active.price ? "萬／坪" : "待補"}</small></div><div><span>戶數</span><strong>{active.households}</strong><small>戶</small></div><div><span>資料</span><strong>{active.dataCompleteness}</strong><small>%</small></div></div>
          <nav>{(["summary", "builder", "price", "quality", "amenity"] as DetailTab[]).map((tab) => <button key={tab} type="button" className={detailTab === tab ? "active" : ""} onClick={() => setDetailTab(tab)}>{{ summary: "基本", builder: "建商", price: "價格", quality: "品質", amenity: "機能" }[tab]}</button>)}</nav>
          <div className="drawer-content">
            {detailTab === "summary" && <section><h3>官方基本資料</h3><div className={`stage-evidence ${projectStage(active)}`}><span>{projectStageText(active)}</span><strong>{active.firstRegistrationDate ? `已於 ${formatDate(active.firstRegistrationDate)} 首次登記` : "目前尚未有首次登記日期"}</strong><p>建案狀態依本資料庫收錄的首次登記日期判斷；官方資料更新後，狀態也會隨之調整。</p></div><div className="drawer-facts"><div><span>申報備查</span><strong>{formatDate(active.declaredDate)}</strong></div><div><span>建照日期</span><strong>{formatDate(active.permitDate)}</strong></div><div><span>首次登記</span><strong>{formatDate(active.firstRegistrationDate)}</strong></div><div><span>主要建材</span><strong>{active.material}</strong></div><div><span>主要用途</span><strong>{active.mainUse}</strong></div><div><span>使用分區</span><strong>{active.zoning}</strong></div></div><div className="drawer-address"><span>坐落街道</span><strong>{active.city}{active.district}{active.address}</strong><span>坐落基地</span><strong>{active.buildingLand}</strong><small>{locationLabel(active)}，非精確基地界址。</small></div><details><summary>建照與官方資料編號</summary><p>{active.permitNo}</p><p>{active.registryNumber}</p></details></section>}
            {detailTab === "builder" && <section><h3>建商履歷</h3><div className="builder-profile"><span>本資料庫辨識名稱</span><strong>{active.builder}</strong><p>目前以官方資料中的起造人名稱進行完全相同比對。</p></div><div className="builder-stats"><div><span>已收錄</span><strong>{builderProjects.length}</strong><small>個建案</small></div><div><span>成屋</span><strong>{builderCompletedCount}</strong><small>個建案</small></div><div><span>有成交</span><strong>{builderPricedCount}</strong><small>個建案</small></div></div><div className="builder-projects">{builderProjects.map((project) => <button type="button" className={project.id === active.id ? "active" : ""} onClick={() => selectBuilderProject(project)} key={project.id}><span className={projectStage(project)}>{projectStageText(project)}</span><div><strong>{project.name}</strong><small>{project.region} · 備查 {formatDate(project.declaredDate)}</small></div><b>{priceText(project)}</b></button>)}</div><p className="builder-disclaimer">目前僅統計本資料庫已收錄的林口與 A7 建案，不代表該建商的完整作品或品質排名。</p></section>}
            {detailTab === "price" && <section><h3>成交行情</h3>{active.price ? <><div className="drawer-price"><span>中位單價</span><strong>{active.price.median}</strong><small>萬／坪</small><p>{active.price.low}–{active.price.high} 萬／坪</p></div><div className="drawer-facts two"><div><span>有效樣本</span><strong>{active.price.count} 筆</strong></div><div><span>最新交易</span><strong>{formatDate(active.price.latestDate)}</strong></div></div><p className="drawer-note">來源：{active.price.source}。成交價不是目前開價，也不是估價結果。</p></> : <div className="drawer-empty"><strong>成交資料尚待補齊</strong><p>目前批次未成功配對，不代表沒有交易。</p></div>}</section>}
            {detailTab === "quality" && <section><h3>漏水與施工品質</h3><div className="quality-pending"><span>待查</span><strong>目前沒有足夠證據可下結論</strong><p>裁判書、公開住戶證據、新聞與建商回應完成交叉核對後，才會建立品質事件。</p></div><ol><li>確認事件與建案配對</li><li>區分單一個案與重複問題</li><li>保留建商修繕與回應</li></ol></section>}
            {detailTab === "amenity" && <section><h3>生活機能</h3><div className="drawer-amenities"><div><span>便利商店</span><strong>距離待算</strong></div><div><span>全聯</span><strong>距離待算</strong></div><div><span>好市多</span><strong>距離待算</strong></div><div><span>捷運／車站</span><strong>距離待算</strong></div></div><div className="drawer-map"><InteractiveMap projects={[active]} activeId={active.id} compact /></div><small className="drawer-map-note">地圖為官方地址附近示意，非精確基地界址。</small></section>}
          </div>
        </aside>
      )}

      {compareIds.length > 0 && <div className="compare-bar"><div>{compareProjects.map((project) => <button type="button" key={project.id} onClick={() => toggleCompare(project.id)}>{project.name}<span>×</span></button>)}</div><small>{compareIds.length}／3</small><button type="button" onClick={() => setCompareOpen(true)}>比較建案</button>{notice && <em>{notice}</em>}</div>}

      {compareOpen && <div className="modal-layer" role="presentation" onMouseDown={() => setCompareOpen(false)}><section className="compare-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setCompareOpen(false)}>×</button><h2>建案比較</h2>{compareProjects.length < 2 && <p>再選一個建案，就能看出差異。</p>}<div className="table-scroll"><table><thead><tr><th>項目</th>{compareProjects.map((p) => <th key={p.id}>{p.name}<small>{p.region}</small></th>)}</tr></thead><tbody><tr><th>建案狀態</th>{compareProjects.map((p) => <td key={p.id}>{projectStageText(p)}</td>)}</tr><tr><th>中位單價</th>{compareProjects.map((p) => <td key={p.id}>{priceText(p)}</td>)}</tr><tr><th>成交樣本</th>{compareProjects.map((p) => <td key={p.id}>{p.price ? `${p.price.count} 筆` : "待補"}</td>)}</tr><tr><th>申報戶數</th>{compareProjects.map((p) => <td key={p.id}>{p.households} 戶</td>)}</tr><tr><th>備查日期</th>{compareProjects.map((p) => <td key={p.id}>{formatDate(p.declaredDate)}</td>)}</tr><tr><th>品質</th>{compareProjects.map((p) => <td key={p.id}>{p.qualityStatus}</td>)}</tr><tr><th>生活機能</th>{compareProjects.map((p) => <td key={p.id}>{p.amenityStatus}</td>)}</tr></tbody></table></div></section></div>}

      {methodOpen && <div className="modal-layer" role="presentation" onMouseDown={() => setMethodOpen(false)}><section className="method-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setMethodOpen(false)}>×</button><h2>資料怎麼看？</h2><div><article><span>官方</span><strong>建案基本身分</strong><p>起造人、戶數、基地、建照與申報日期。</p></article><article><span className="coral">成交</span><strong>已配對的實價樣本</strong><p>顯示筆數、區間與中位數，不代表開價。</p></article><article><span className="gray">待查</span><strong>尚不能下結論</strong><p>漏水、品質與生活機能不足時直接標示。</p></article></div><footer>{dataset.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name} ↗</a>)}</footer></section></div>}
    </main>
  );
}
