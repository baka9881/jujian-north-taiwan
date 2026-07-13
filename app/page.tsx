"use client";

import { useMemo, useRef, useState } from "react";
import dataset from "@/data/processed/projects.json";

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
};

type DetailTab = "overview" | "price" | "quality" | "amenity";
type SortKey = "newest" | "priceLow" | "priceHigh" | "households";

const projects = dataset.projects as Project[];
const regions = ["全部", "林口", "A7"] as const;
const tabs: { id: DetailTab; label: string; short: string }[] = [
  { id: "overview", label: "基本資料", short: "基本" },
  { id: "price", label: "成交價格", short: "價格" },
  { id: "quality", label: "品質查核", short: "品質" },
  { id: "amenity", label: "生活機能", short: "機能" },
];

function formatDate(date: string | null) {
  return date ? date.replaceAll("-", ".") : "尚未登錄";
}

function priceText(project: Project) {
  return project.price ? `${project.price.median} 萬／坪` : "尚無配對資料";
}

function googleMapUrls(project: Project) {
  const address = project.address
    .replace("交岔路口", "交叉口")
    .replace(/(?:附近|對面工地|對面|號旁|旁|等)$/u, "");
  const query = `${project.city}${project.district}${address}`;
  return {
    embed: `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`,
  };
}

function locationPrecision(project: Project) {
  if (/交叉|路口|與/u.test(project.address)) return "依官方路口文字定位";
  if (/號/u.test(project.address)) return "依官方門牌附近定位";
  return "依官方道路文字定位";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("全部");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [priceOnly, setPriceOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const detailRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = projects.filter((project) => {
      const regionMatch = region === "全部" || project.region === region;
      const priceMatch = !priceOnly || Boolean(project.price);
      const queryMatch =
        !needle ||
        [project.name, project.region, project.city, project.builder, project.address]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return regionMatch && priceMatch && queryMatch;
    });

    return [...matches].sort((a, b) => {
      if (sortBy === "households") return b.households - a.households;
      if (sortBy === "priceLow") return (a.price?.median ?? Infinity) - (b.price?.median ?? Infinity);
      if (sortBy === "priceHigh") return (b.price?.median ?? -1) - (a.price?.median ?? -1);
      return (b.declaredDate || "").localeCompare(a.declaredDate || "");
    });
  }, [priceOnly, query, region, sortBy]);

  const active = filtered.find((project) => project.id === selectedId) || filtered[0] || projects[0];
  const compareProjects = compareIds
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean) as Project[];
  const pricedCount = filtered.filter((project) => project.price).length;
  const mapUrls = googleMapUrls(active);
  const hasFilters = query !== "" || region !== "全部" || priceOnly || sortBy !== "newest";

  function selectProject(id: string) {
    setSelectedId(id);
    setActiveTab("overview");
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
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
    setPriceOnly(false);
    setSortBy("newest");
  }

  function showMap() {
    setActiveTab("amenity");
  }

  return (
    <main id="top">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="居鑑首頁">
          <span className="brand-mark">居</span>
          <span><strong>居鑑</strong><small>建案資料查詢</small></span>
        </a>
        <div className="header-actions">
          <span className="data-live"><i />官方資料 40 案</span>
          <button type="button" className="text-button" onClick={() => setMethodOpen(true)}>資料怎麼看？</button>
        </div>
      </header>

      <section className="catalog-intro">
        <div>
          <p className="eyebrow">林口＋A7 第一批</p>
          <h1>先找到建案，再看證據。</h1>
          <p>用建案名稱、建商或地址快速篩選；官方資料、成交價格與待查項目分開呈現。</p>
        </div>
        <div className="intro-note">
          <strong>目前不做品質排名</strong>
          <span>漏水與施工品質尚未完成證據查核，不會用「沒看到資料」代表「沒有問題」。</span>
        </div>
      </section>

      <section className="search-panel" aria-label="建案搜尋與篩選">
        <label className="search-input">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋建案、建商或地址"
            aria-label="搜尋建案、建商或地址"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
        </label>

        <div className="region-switch" aria-label="區域篩選">
          {regions.map((item) => (
            <button
              type="button"
              key={item}
              className={region === item ? "active" : ""}
              onClick={() => setRegion(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className={`data-toggle ${priceOnly ? "checked" : ""}`}>
          <input type="checkbox" checked={priceOnly} onChange={(event) => setPriceOnly(event.target.checked)} />
          <span>只看有成交資料</span>
        </label>

        <label className="sort-select">
          <span>排序</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}>
            <option value="newest">最新備查</option>
            <option value="priceLow">單價低到高</option>
            <option value="priceHigh">單價高到低</option>
            <option value="households">戶數多到少</option>
          </select>
        </label>

        {hasFilters && <button type="button" className="clear-filter" onClick={clearFilters}>清除篩選</button>}
      </section>

      <section className="catalog-summary" aria-live="polite">
        <span>找到 <strong>{filtered.length}</strong> 個建案</span>
        <span><strong>{pricedCount}</strong> 案有成交資料</span>
        <span>最多可選 3 案比較</span>
      </section>

      <section className="catalog-layout">
        <aside className="results-pane" aria-label="建案搜尋結果">
          <div className="results-heading">
            <div><strong>建案清單</strong><span>點選一案查看完整資料</span></div>
            <span>{filtered.length} 案</span>
          </div>

          <div className="project-list">
            {filtered.length === 0 ? (
              <div className="no-results">
                <span>⌕</span>
                <strong>找不到符合的建案</strong>
                <p>試試看縮短關鍵字或清除篩選。</p>
                <button type="button" onClick={clearFilters}>查看全部建案</button>
              </div>
            ) : (
              filtered.map((project) => {
                const selected = active.id === project.id;
                const comparing = compareIds.includes(project.id);
                return (
                  <article className={`project-row ${selected ? "selected" : ""}`} key={project.id}>
                    <button type="button" className="project-row-main" onClick={() => selectProject(project.id)}>
                      <div className="row-topline">
                        <span className="region-tag">{project.region}</span>
                        <span className="pending-tag">品質待查</span>
                      </div>
                      <h2>{project.name}</h2>
                      <p>{project.builder}</p>
                      <div className="row-metrics">
                        <span><small>中位單價</small><strong>{project.price ? `${project.price.median} 萬` : "待補"}</strong></span>
                        <span><small>申報戶數</small><strong>{project.households} 戶</strong></span>
                        <span><small>資料</small><strong>{project.dataCompleteness}%</strong></span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`row-compare ${comparing ? "active" : ""}`}
                      onClick={() => toggleCompare(project.id)}
                      aria-label={`${comparing ? "移除" : "加入"}${project.name}比較`}
                    >
                      {comparing ? "✓ 已選" : "＋ 比較"}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </aside>

        <article className="detail-pane" ref={detailRef} aria-live="polite">
          <div className="detail-head">
            <div className="detail-title">
              <div><span className="region-tag">{active.region}</span><span>{active.city} · {active.district}</span></div>
              <h2>{active.name}</h2>
              <p>起造人：{active.builder}</p>
            </div>
            <div className="detail-actions">
              <button type="button" className="secondary-action" onClick={showMap}>站內看地圖</button>
              <button
                type="button"
                className={compareIds.includes(active.id) ? "primary-action added" : "primary-action"}
                onClick={() => toggleCompare(active.id)}
              >
                {compareIds.includes(active.id) ? "✓ 已加入比較" : "＋ 加入比較"}
              </button>
            </div>
          </div>

          <div className="headline-metrics">
            <div><span>中位成交單價</span><strong>{active.price ? active.price.median : "—"}</strong><small>{active.price ? "萬／坪" : "尚待補齊"}</small></div>
            <div><span>申報戶數</span><strong>{active.households}</strong><small>戶</small></div>
            <div><span>資料完整度</span><strong>{active.dataCompleteness}</strong><small>%（非品質分數）</small></div>
          </div>

          <nav className="detail-tabs" aria-label="建案資料分類">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                <span className="tab-full">{tab.label}</span><span className="tab-short">{tab.short}</span>
                {(tab.id === "quality" || tab.id === "amenity") && <i />}
              </button>
            ))}
          </nav>

          <div className="detail-content">
            {activeTab === "overview" && (
              <section className="tab-section">
                <div className="section-title"><div><span>OFFICIAL RECORD</span><h3>官方基本資料</h3></div><span className="verified-label">已核對</span></div>
                <div className="fact-grid">
                  <div><span>申報備查日</span><strong>{formatDate(active.declaredDate)}</strong></div>
                  <div><span>建照核發日</span><strong>{formatDate(active.permitDate)}</strong></div>
                  <div><span>首次登記日</span><strong>{formatDate(active.firstRegistrationDate)}</strong></div>
                  <div><span>主要建材</span><strong>{active.material}</strong></div>
                  <div><span>主要用途</span><strong>{active.mainUse}</strong></div>
                  <div><span>使用分區</span><strong>{active.zoning}</strong></div>
                </div>
                <div className="address-block">
                  <div><span>官方坐落街道</span><strong>{active.city}{active.district}{active.address}</strong></div>
                  <div><span>坐落基地</span><strong>{active.buildingLand}</strong></div>
                  <button type="button" onClick={showMap}>站內查看地圖 →</button>
                  <small>{locationPrecision(active)}，僅供位置參考，不代表精確基地界址。</small>
                </div>
                <details className="permit-details">
                  <summary>查看建照與資料編號</summary>
                  <dl><div><dt>建造執照</dt><dd>{active.permitNo}</dd></div><div><dt>官方資料編號</dt><dd>{active.registryNumber}</dd></div></dl>
                </details>
              </section>
            )}

            {activeTab === "price" && (
              <section className="tab-section">
                <div className="section-title"><div><span>PRICE RECORD</span><h3>成交價格</h3></div><span className={active.price ? "verified-label" : "pending-label"}>{active.price ? "已配對" : "待補資料"}</span></div>
                {active.price ? (
                  <>
                    <div className="price-hero">
                      <div><span>中位單價</span><strong>{active.price.median}</strong><small>萬／坪</small></div>
                      <p>中位數比平均數較不容易受到極端交易影響，但仍要搭配樓層、坪數與車位判讀。</p>
                    </div>
                    <div className="fact-grid three">
                      <div><span>成交區間</span><strong>{active.price.low}–{active.price.high} 萬／坪</strong></div>
                      <div><span>有效樣本</span><strong>{active.price.count} 筆</strong></div>
                      <div><span>最新交易</span><strong>{formatDate(active.price.latestDate)}</strong></div>
                    </div>
                    <div className="data-caveat"><strong>來源：{active.price.source}</strong><p>此處是已成功配對的官方交易樣本，不等於目前開價，也不是估價結果。</p></div>
                  </>
                ) : (
                  <div className="empty-evidence"><span>成交</span><strong>目前批次尚未配對到資料</strong><p>這不代表沒有交易；A7 歷史批次仍在補齊中。</p></div>
                )}
              </section>
            )}

            {activeTab === "quality" && (
              <section className="tab-section">
                <div className="section-title"><div><span>QUALITY REVIEW</span><h3>漏水與施工品質</h3></div><span className="pending-label">尚未查核</span></div>
                <div className="pending-hero">
                  <div className="pending-symbol">待</div>
                  <div><strong>目前沒有足夠證據可以下結論</strong><p>找不到已收錄紀錄，不代表沒有問題；在完成裁判書、公開住戶證據、新聞與建商回應的交叉核對前，不顯示好壞評分。</p></div>
                </div>
                <div className="review-steps">
                  <div><span>1</span><strong>確認事件</strong><p>來源、日期與建案名稱必須能核對。</p></div>
                  <div><span>2</span><strong>判斷重複性</strong><p>單一個案與多戶共同問題分開處理。</p></div>
                  <div><span>3</span><strong>收錄回應</strong><p>同步保留建商修繕與說明。</p></div>
                </div>
              </section>
            )}

            {activeTab === "amenity" && (
              <section className="tab-section">
                <div className="section-title"><div><span>NEARBY AMENITIES</span><h3>生活機能</h3></div><span className="pending-label">串接中</span></div>
                <div className="amenity-grid">
                  {[
                    ["便利商店", "待計算步行距離"],
                    ["全聯", "待計算步行距離"],
                    ["好市多", "待計算駕車距離"],
                    ["捷運／車站", "待計算步行距離"],
                  ].map(([name, state]) => <div key={name}><span>{name}</span><strong>{state}</strong></div>)}
                </div>
                <div className="map-box">
                  <iframe key={active.id} src={mapUrls.embed} title={`${active.name} Google 地圖`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  <div><strong>{active.name}</strong><span>{active.city}{active.district}{active.address}</span><em>站內地圖</em></div>
                </div>
                <p className="map-disclaimer">地圖依官方街道／路口文字定位，並非精確基地界址。</p>
              </section>
            )}
          </div>
        </article>
      </section>

      <footer>
        <div><span className="brand-mark small">居</span><p><strong>居鑑</strong><br />讓購屋判斷有資料可以回頭查。</p></div>
        <p>林口＋A7 真實資料第一版 · 更新 {dataset.generatedAt}</p>
      </footer>

      {compareIds.length > 0 && (
        <div className="compare-dock" role="status">
          <div className="compare-chips">
            {compareProjects.map((project) => <button key={project.id} type="button" onClick={() => toggleCompare(project.id)}>{project.name}<span>×</span></button>)}
          </div>
          <span className="compare-count">{compareIds.length}／3</span>
          <button type="button" className="open-compare" onClick={() => setCompareOpen(true)}>開始比較</button>
          {notice && <span className="dock-notice">{notice}</span>}
        </div>
      )}

      {compareOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCompareOpen(false)}>
          <section className="compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setCompareOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">PROJECT COMPARISON</p>
            <h2 id="compare-title">建案並排比較</h2>
            {compareProjects.length < 2 && <p className="modal-hint">再選一個建案，差異會更清楚。</p>}
            <div className="compare-table-wrap">
              <table>
                <thead><tr><th>比較項目</th>{compareProjects.map((project) => <th key={project.id}>{project.name}<small>{project.region}</small></th>)}</tr></thead>
                <tbody>
                  <tr><th>中位單價</th>{compareProjects.map((p) => <td key={p.id}>{priceText(p)}</td>)}</tr>
                  <tr><th>成交樣本</th>{compareProjects.map((p) => <td key={p.id}>{p.price ? `${p.price.count} 筆` : "待補"}</td>)}</tr>
                  <tr><th>申報戶數</th>{compareProjects.map((p) => <td key={p.id}>{p.households} 戶</td>)}</tr>
                  <tr><th>申報備查</th>{compareProjects.map((p) => <td key={p.id}>{formatDate(p.declaredDate)}</td>)}</tr>
                  <tr><th>品質查核</th>{compareProjects.map((p) => <td key={p.id}>{p.qualityStatus}</td>)}</tr>
                  <tr><th>生活機能</th>{compareProjects.map((p) => <td key={p.id}>{p.amenityStatus}</td>)}</tr>
                  <tr><th>資料完整度</th>{compareProjects.map((p) => <td key={p.id}>{p.dataCompleteness}%</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {methodOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setMethodOpen(false)}>
          <section className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setMethodOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">DATA GUIDE</p>
            <h2 id="method-title">先分清楚「已知」和「待查」。</h2>
            <div className="method-list">
              <div><span className="verified-label">官方</span><strong>可以核對的基本資料</strong><p>起造人、戶數、基地、建照與申報日期。</p></div>
              <div><span className="verified-label coral">成交</span><strong>已成功配對的實價樣本</strong><p>呈現筆數、區間與中位數，不代表目前開價。</p></div>
              <div><span className="pending-label">待查</span><strong>不能先做結論的資料</strong><p>漏水、施工、售後與生活機能尚未完成時直接標示。</p></div>
            </div>
            <div className="source-list"><strong>本版官方來源</strong>{dataset.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name} ↗</a>)}</div>
          </section>
        </div>
      )}
    </main>
  );
}
