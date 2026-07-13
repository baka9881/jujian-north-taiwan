"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
  mapX: number;
  mapY: number;
};

type EvidenceKind = "official" | "market" | "pending";

const projects = dataset.projects as Project[];
const regions = ["全部", "林口", "A7"];

function formatDate(date: string | null) {
  if (!date) return "尚未登錄";
  return date.replaceAll("-", ".");
}

function priceLabel(project: Project) {
  return project.price ? `${project.price.median} 萬／坪` : "尚待補齊";
}

function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
  const labels = { official: "官方", market: "成交", pending: "待查" };
  return <span className={`evidence-badge ${kind}`}>{labels[kind]}</span>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("全部");
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [methodOpen, setMethodOpen] = useState(false);
  const [compareNotice, setCompareNotice] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const regionMatch = region === "全部" || project.region === region;
      const queryMatch =
        !needle ||
        [project.name, project.region, project.city, project.district, project.builder, project.address]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return regionMatch && queryMatch;
    });
  }, [query, region]);

  const active = projects.find((project) => project.id === selectedId) || projects[0];
  const compareProjects = compareIds
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean) as Project[];
  const builders = new Set(projects.map((project) => project.builder)).size;
  const pricedProjects = projects.filter((project) => project.price).length;

  function selectProject(id: string) {
    setSelectedId(id);
  }

  function toggleCompare(id: string) {
    setCompareNotice("");
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        setCompareNotice("一次最多比較 3 個建案");
        return current;
      }
      return [...current, id];
    });
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="居鑑首頁">
          <span className="brand-mark">居</span>
          <span>
            <strong>居鑑</strong>
            <small>北台灣建案履歷</small>
          </span>
        </a>
        <nav aria-label="主要導覽">
          <a href="#explore">探索建案</a>
          <a href="#compare">比較</a>
          <button type="button" onClick={() => setMethodOpen(true)}>資料方法</button>
        </nav>
        <div className="data-status">
          <span className="status-dot" />
          {projects.length} 筆官方建案
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">LINKOU · AIRPORT MRT A7</p>
          <h1>第一批真實建案，<br />先把來源攤開來。</h1>
          <p className="hero-intro">
            已匯入林口與 A7 的官方預售屋備查資料，並核對可取得的實價登錄。
            品質與漏水證據還沒完成查核的案子，一律不先下結論。
          </p>
          <label className="hero-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋建案、建商或地址…"
              aria-label="搜尋建案、建商或地址"
            />
            <kbd>{filtered.length} 案</kbd>
          </label>
          <div className="hero-notes">
            <span>✓ 官方建案 {projects.length} 筆</span>
            <span>✓ 建商 {builders} 家</span>
            <span>✓ 成交資料 {pricedProjects} 案</span>
          </div>
        </div>
        <div className="hero-proof">
          <div className="proof-heading">
            <span>目前選取建案</span>
            <span className="live-label">OFFICIAL DATA</span>
          </div>
          <div className="proof-score">
            <div className="score-ring" style={{ "--score": active.dataCompleteness } as CSSProperties}>
              <span>{active.dataCompleteness}%</span>
              <small>資料完整度</small>
            </div>
            <div>
              <p>{active.region} · {active.city}</p>
              <h2>{active.name}</h2>
              <span>{active.builder}</span>
            </div>
          </div>
          <div className="proof-grid">
            <div><span>戶數</span><strong>{active.households}</strong></div>
            <div><span>中位單價</span><strong>{active.price ? active.price.median : "—"}</strong></div>
            <div><span>品質狀態</span><strong>待查</strong></div>
            <div><span>生活機能</span><strong>待串</strong></div>
          </div>
          <p className="demo-caption">資料完整度只表示欄位覆蓋，不代表建案品質高低。</p>
        </div>
      </section>

      <section className="workspace" id="explore">
        <div className="section-heading">
          <div>
            <p className="eyebrow">VERIFIED PROJECT EXPLORER</p>
            <h2>林口＋A7 官方建案第一版</h2>
          </div>
          <p>先查基本身分與成交，再逐步補齊漏水、售後與生活圈證據。</p>
        </div>

        <div className="filter-row" aria-label="地區篩選">
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
          <span className="result-count">顯示 {filtered.length} 個真實建案</span>
        </div>

        <div className="explorer-grid">
          <div className="project-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <strong>找不到符合的建案</strong>
                <span>換一個關鍵字，或切回「全部」。</span>
              </div>
            ) : (
              filtered.map((project) => (
                <article
                  className={`project-card ${selectedId === project.id ? "selected" : ""}`}
                  key={project.id}
                >
                  <button className="project-select" type="button" onClick={() => selectProject(project.id)}>
                    <div className="project-card-top">
                      <span>{project.region} · {project.city}</span>
                      <span className="issue-pill unknown">品質尚未查核</span>
                    </div>
                    <h3>{project.name}</h3>
                    <p>{project.builder}</p>
                    <div className="project-metrics">
                      <span><strong>{project.dataCompleteness}%</strong> 資料</span>
                      <span><strong>{project.price ? project.price.median : "—"}</strong> 萬／坪</span>
                      <span><strong>{project.households}</strong> 戶</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`compare-toggle ${compareIds.includes(project.id) ? "checked" : ""}`}
                    onClick={() => toggleCompare(project.id)}
                    aria-pressed={compareIds.includes(project.id)}
                  >
                    {compareIds.includes(project.id) ? "✓ 已加入比較" : "＋ 加入比較"}
                  </button>
                </article>
              ))
            )}
          </div>

          <div className="map-panel" aria-label="林口與 A7 建案分布示意">
            <div className="map-label map-label-taipei">林口</div>
            <div className="map-label map-label-taoyuan">A7</div>
            <div className="river river-one" />
            <div className="river river-two" />
            <div className="road road-one" />
            <div className="road road-two" />
            <div className="road road-three" />
            {filtered.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`map-marker ${project.price ? "" : "unpriced"} ${selectedId === project.id ? "active" : ""}`}
                style={{ left: `${project.mapX}%`, top: `${project.mapY}%` }}
                onClick={() => selectProject(project.id)}
                aria-label={`查看 ${project.name}`}
                title={project.name}
              >
                <span>{project.price ? Math.round(project.price.median) : "·"}</span>
              </button>
            ))}
            <div className="map-legend">
              <span><i className="legend-dot good" />有成交資料</span>
              <span><i className="legend-dot mid" />尚待補齊</span>
              <span>數字為中位單價（萬／坪）</span>
            </div>
          </div>

          <aside className="detail-panel" aria-live="polite">
            <div className="detail-kicker">
              <span>{active.region} · 官方備查</span>
              <span>資料完整度 {active.dataCompleteness}%</span>
            </div>
            <h2>{active.name}</h2>
            <p className="builder-line">起造人：{active.builder}</p>

            <div className="detail-summary">
              <div className="mini-score">
                <strong>{active.dataCompleteness}%</strong>
                <span>欄位覆蓋</span>
              </div>
              <p>已核對官方建案基本資料。漏水、施工與售後仍在查核；「沒有已收錄紀錄」不能解讀為「沒有問題」。</p>
            </div>

            <h3 className="subheading">官方基本資料</h3>
            <div className="amenity-grid">
              <div><span>申報戶數</span><strong>{active.households} 戶</strong></div>
              <div><span>中位成交單價</span><strong>{priceLabel(active)}</strong></div>
              <div><span>申報備查</span><strong>{formatDate(active.declaredDate)}</strong></div>
              <div><span>首次登記</span><strong>{formatDate(active.firstRegistrationDate)}</strong></div>
            </div>

            <h3 className="subheading">證據與查核狀態</h3>
            <div className="evidence-list">
              <div className="evidence-item">
                <EvidenceBadge kind="official" />
                <div>
                  <strong>建照與基地已核對</strong>
                  <p>{active.permitNo}<br />{active.address} · {active.buildingLand}</p>
                  <small>建照日期 {formatDate(active.permitDate)}</small>
                </div>
              </div>
              <div className="evidence-item">
                <EvidenceBadge kind={active.price ? "market" : "pending"} />
                <div>
                  <strong>{active.price ? `${active.price.count} 筆成交資料` : "成交資料尚待補齊"}</strong>
                  <p>{active.price ? `區間 ${active.price.low}–${active.price.high} 萬／坪，中位數 ${active.price.median} 萬／坪。` : "目前批次未配對到有效成交，不代表沒有交易。"}</p>
                  <small>{active.price ? `${active.price.source} · 最新 ${formatDate(active.price.latestDate)}` : "下一階段補歷史批次"}</small>
                </div>
              </div>
              <div className="evidence-item">
                <EvidenceBadge kind="pending" />
                <div>
                  <strong>漏水與施工品質：尚未查核</strong>
                  <p>需交叉核對裁判書、公開住戶證據、新聞與建商回應，達到門檻後才會顯示結論。</p>
                  <small>目前不做品質排名</small>
                </div>
              </div>
            </div>

            <h3 className="subheading">生活機能距離</h3>
            <div className="amenity-grid">
              <div><span>便利商店</span><strong>待串接</strong></div>
              <div><span>全聯</span><strong>待串接</strong></div>
              <div><span>好市多</span><strong>待串接</strong></div>
              <div><span>捷運／車站</span><strong>待串接</strong></div>
            </div>

            <button
              type="button"
              className={`detail-compare ${compareIds.includes(active.id) ? "added" : ""}`}
              onClick={() => toggleCompare(active.id)}
            >
              {compareIds.includes(active.id) ? "已加入比較，點擊移除" : "加入建案比較"}
            </button>
            {compareNotice && <p className="compare-notice">{compareNotice}</p>}
          </aside>
        </div>
      </section>

      <section className="compare-section" id="compare">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIDE BY SIDE</p>
            <h2>先比較已確認的事實</h2>
          </div>
          <p>{compareProjects.length ? `已選擇 ${compareProjects.length} 個建案` : "從上方加入 2–3 個建案開始比較"}</p>
        </div>

        {compareProjects.length === 0 ? (
          <div className="compare-empty">
            <div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div>
            <strong>還沒有加入比較</strong>
            <p>可以先挑兩個同區域建案，比較戶數、建照、成交與資料完整度。</p>
            <a href="#explore">回到建案清單</a>
          </div>
        ) : (
          <div className="compare-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>比較項目</th>
                  {compareProjects.map((project) => (
                    <th key={project.id}>
                      <span>{project.region}</span>
                      {project.name}
                      <button type="button" onClick={() => toggleCompare(project.id)} aria-label={`移除 ${project.name}`}>×</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><th>起造人</th>{compareProjects.map((p) => <td key={p.id}>{p.builder}</td>)}</tr>
                <tr><th>申報戶數</th>{compareProjects.map((p) => <td key={p.id}><strong>{p.households}</strong> 戶</td>)}</tr>
                <tr><th>中位成交單價</th>{compareProjects.map((p) => <td key={p.id}>{priceLabel(p)}</td>)}</tr>
                <tr><th>成交樣本</th>{compareProjects.map((p) => <td key={p.id}>{p.price ? `${p.price.count} 筆` : "待補"}</td>)}</tr>
                <tr><th>申報備查日</th>{compareProjects.map((p) => <td key={p.id}>{formatDate(p.declaredDate)}</td>)}</tr>
                <tr><th>建材</th>{compareProjects.map((p) => <td key={p.id}>{p.material}</td>)}</tr>
                <tr><th>品質／漏水</th>{compareProjects.map((p) => <td key={p.id}>{p.qualityStatus}</td>)}</tr>
                <tr><th>生活機能</th>{compareProjects.map((p) => <td key={p.id}>{p.amenityStatus}</td>)}</tr>
                <tr><th>資料完整度</th>{compareProjects.map((p) => <td key={p.id}><span className="confidence-cell">{p.dataCompleteness}%</span></td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="principles">
        <div>
          <p className="eyebrow">HOW WE READ THE DATA</p>
          <h2>沒有證據，就不先評分。</h2>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>官方身分先對齊</h3>
            <p>建案名稱、起造人、戶數、基地與建照先以政府備查資料為準。</p>
          </article>
          <article>
            <span>02</span>
            <h3>價格看樣本，不看話術</h3>
            <p>顯示實價登錄筆數、區間與中位數；樣本不足時直接標記。</p>
          </article>
          <article>
            <span>03</span>
            <h3>未知就是未知</h3>
            <p>漏水與品質尚未完成查核，就維持「尚未查核」，不包裝成低風險。</p>
          </article>
        </div>
        <button type="button" className="method-link" onClick={() => setMethodOpen(true)}>查看資料方法與下一步 →</button>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark">居</span>
          <div><strong>居鑑</strong><p>讓每一次購屋判斷，都有資料可以回頭查。</p></div>
        </div>
        <div className="source-links">
          <span>本版資料來源</span>
          {dataset.sources.map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name}</a>
          ))}
        </div>
        <p className="footer-note">林口＋A7 真實資料第一版 · 更新 {dataset.generatedAt} · 品質與生活機能仍在查核</p>
      </footer>

      {methodOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setMethodOpen(false)}>
          <section className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setMethodOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">DATA METHODOLOGY</p>
            <h2 id="method-title">這一版先建立可追溯的真實底冊。</h2>
            <p>目前的「資料完整度」只計算官方備查、成交與首次登記欄位，不是品質分數，也不是購屋推薦。</p>
            <div className="method-list">
              <div><strong>已完成：建案底冊</strong><span>林口與 A7 共 40 案，含起造人、戶數、基地、建照與用途</span></div>
              <div><strong>已完成：部分成交</strong><span>林口歷史資料與 A7 最新批次，共 21 案有可核對的成交樣本</span></div>
              <div><strong>下一步：生活機能</strong><span>以實際步行／駕車路線計算便利商店、全聯、好市多、捷運與醫療</span></div>
              <div><strong>下一步：品質證據</strong><span>裁判書、公開住戶證據、新聞與建商回應交叉驗證後才建立事件</span></div>
            </div>
            <div className="method-warning">
              <strong>必要護欄</strong>
              <p>任何負面紀錄都必須保留來源、日期、建案配對方式與更正管道；單一匿名留言不直接構成漏水結論。</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
