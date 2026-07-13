"use client";

import { useMemo, useState, type CSSProperties } from "react";

type Evidence = {
  kind: "official" | "resident" | "model";
  title: string;
  detail: string;
  date: string;
};

type Project = {
  id: string;
  name: string;
  city: string;
  district: string;
  builder: string;
  contractor: string;
  year: number;
  households: number;
  price: number;
  change: number;
  overall: number;
  quality: number;
  response: number;
  amenity: number;
  environment: number;
  confidence: "高" | "中" | "待補";
  issue: "未見重大紀錄" | "需留意" | "資料不足";
  summary: string;
  mapX: number;
  mapY: number;
  amenities: {
    convenience: string;
    pxmart: string;
    costco: string;
    station: string;
  };
  evidence: Evidence[];
};

const projects: Project[] = [
  {
    id: "tao-a19",
    name: "青埔｜森序",
    city: "桃園市",
    district: "中壢區",
    builder: "森川建設（示範）",
    contractor: "宏築營造（示範）",
    year: 2021,
    households: 168,
    price: 52.8,
    change: 8.4,
    overall: 86,
    quality: 88,
    response: 84,
    amenity: 82,
    environment: 89,
    confidence: "高",
    issue: "未見重大紀錄",
    summary: "官方基本資料完整，示範回報以公共區域修繕為主，尚無已確認的重大滲漏水紀錄。",
    mapX: 24,
    mapY: 68,
    amenities: {
      convenience: "步行 3 分",
      pxmart: "步行 9 分",
      costco: "開車 12 分",
      station: "A19 步行 7 分",
    },
    evidence: [
      { kind: "official", title: "使用執照已核對", detail: "起造人、承造人、戶數與完工年份欄位完整。", date: "2026.07" },
      { kind: "resident", title: "住戶回報 4 筆", detail: "3 筆公共區域修繕、1 筆窗框滲水，皆附時間紀錄。", date: "2024–2026" },
      { kind: "model", title: "品質樣本充足", detail: "可比對同一建商 6 個完工案，資料覆蓋率 78%。", date: "分析結果" },
    ],
  },
  {
    id: "tao-zhonglu",
    name: "中路｜日和",
    city: "桃園市",
    district: "桃園區",
    builder: "和石開發（示範）",
    contractor: "大磐營造（示範）",
    year: 2019,
    households: 92,
    price: 45.2,
    change: 4.1,
    overall: 78,
    quality: 72,
    response: 76,
    amenity: 91,
    environment: 75,
    confidence: "中",
    issue: "需留意",
    summary: "示範資料中有多戶窗框滲水回報，建商後續完成修繕；是否復發仍需持續追蹤。",
    mapX: 32,
    mapY: 61,
    amenities: {
      convenience: "步行 2 分",
      pxmart: "步行 5 分",
      costco: "開車 18 分",
      station: "公車站步行 2 分",
    },
    evidence: [
      { kind: "official", title: "建照／使照已連結", detail: "使用執照與社區門牌已完成一對一配對。", date: "2026.07" },
      { kind: "resident", title: "窗框滲水 7 筆", detail: "分布於兩棟、不同樓層；5 筆有修繕照片。", date: "2022–2025" },
      { kind: "model", title: "復發資訊不足", detail: "最近一次修繕後僅有一個雨季樣本，不宜判定已完全排除。", date: "分析結果" },
    ],
  },
  {
    id: "hsinchu-hsr",
    name: "竹北高鐵｜光序",
    city: "新竹縣市",
    district: "竹北市",
    builder: "光合建築（示範）",
    contractor: "衡岳營造（示範）",
    year: 2023,
    households: 214,
    price: 69.6,
    change: 6.7,
    overall: 83,
    quality: 82,
    response: 79,
    amenity: 88,
    environment: 84,
    confidence: "中",
    issue: "未見重大紀錄",
    summary: "新成屋觀察期間較短，目前可驗證資料有限；生活機能與交通表現突出。",
    mapX: 18,
    mapY: 84,
    amenities: {
      convenience: "步行 4 分",
      pxmart: "步行 8 分",
      costco: "開車 11 分",
      station: "高鐵步行 9 分",
    },
    evidence: [
      { kind: "official", title: "使照資料已核對", detail: "承造人、監造人、構造與戶數資料完整。", date: "2026.07" },
      { kind: "resident", title: "具證據回報 2 筆", detail: "皆為交屋初期修繕，尚無跨戶重複問題。", date: "2024–2025" },
      { kind: "model", title: "觀察期偏短", detail: "完工未滿 5 年，品質評估信心度暫列中等。", date: "分析結果" },
    ],
  },
  {
    id: "newtaipei-linkou",
    name: "林口｜嶼森",
    city: "新北市",
    district: "林口區",
    builder: "嶼森建設（示範）",
    contractor: "元拓營造（示範）",
    year: 2017,
    households: 326,
    price: 49.1,
    change: 3.8,
    overall: 74,
    quality: 69,
    response: 68,
    amenity: 86,
    environment: 72,
    confidence: "高",
    issue: "需留意",
    summary: "示範紀錄顯示地下室潮濕與外牆修繕次數較多；問題集中在公共區域，已列入追蹤。",
    mapX: 47,
    mapY: 39,
    amenities: {
      convenience: "步行 1 分",
      pxmart: "步行 6 分",
      costco: "開車 7 分",
      station: "A9 開車 8 分",
    },
    evidence: [
      { kind: "official", title: "使用執照已核對", detail: "起造人與社區名稱已經過地址、使照雙重比對。", date: "2026.07" },
      { kind: "resident", title: "公共區域回報 12 筆", detail: "主要為地下室潮濕、外牆與車道上方滲水。", date: "2020–2026" },
      { kind: "model", title: "戶數與屋齡已校正", detail: "已按 326 戶及 9 年觀察期正規化，不直接以件數排名。", date: "分析結果" },
    ],
  },
  {
    id: "newtaipei-banqiao",
    name: "板橋｜川庭",
    city: "新北市",
    district: "板橋區",
    builder: "川庭開發（示範）",
    contractor: "川庭營造（示範）",
    year: 2015,
    households: 76,
    price: 78.4,
    change: 2.9,
    overall: 88,
    quality: 86,
    response: 90,
    amenity: 96,
    environment: 80,
    confidence: "高",
    issue: "未見重大紀錄",
    summary: "屋齡與回報樣本相對完整，修繕處理紀錄清楚；生活圈成熟但價格明顯高於其他示範區。",
    mapX: 58,
    mapY: 49,
    amenities: {
      convenience: "步行 1 分",
      pxmart: "步行 4 分",
      costco: "開車 15 分",
      station: "捷運步行 6 分",
    },
    evidence: [
      { kind: "official", title: "社區資料完整", detail: "使照、管理組織與歷年成交資料可相互驗證。", date: "2026.07" },
      { kind: "resident", title: "修繕回報 6 筆", detail: "皆有處理結果，未見同一位置重複發生。", date: "2019–2025" },
      { kind: "model", title: "售後回應佳", detail: "示範樣本中首次回應中位數為 4 個工作日。", date: "分析結果" },
    ],
  },
  {
    id: "taipei-nangang",
    name: "南港｜丘序",
    city: "臺北市",
    district: "南港區",
    builder: "丘序建設（示範）",
    contractor: "東衡營造（示範）",
    year: 2020,
    households: 118,
    price: 96.5,
    change: 5.2,
    overall: 76,
    quality: 80,
    response: 73,
    amenity: 84,
    environment: 66,
    confidence: "待補",
    issue: "資料不足",
    summary: "官方資料可核對，但住戶與售後紀錄樣本不足；環境分數受道路噪音示範指標影響。",
    mapX: 77,
    mapY: 46,
    amenities: {
      convenience: "步行 3 分",
      pxmart: "步行 7 分",
      costco: "開車 9 分",
      station: "捷運步行 10 分",
    },
    evidence: [
      { kind: "official", title: "基本資料已核對", detail: "交易、門牌與建物完成年份資料可相互連結。", date: "2026.07" },
      { kind: "resident", title: "有效回報僅 1 筆", detail: "樣本不足，不能推論整體施工品質。", date: "2025" },
      { kind: "model", title: "暫不產生品質結論", detail: "資料覆蓋率低於門檻，顯示資料不足而非低風險。", date: "分析結果" },
    ],
  },
];

const regions = ["全部", "桃園市", "新竹縣市", "新北市", "臺北市"];

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <div className="score-track" aria-hidden="true">
        <span style={{ width: value + "%" }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function EvidenceBadge({ kind }: { kind: Evidence["kind"] }) {
  const labels = { official: "官方", resident: "住戶", model: "推估" };
  return <span className={"evidence-badge " + kind}>{labels[kind]}</span>;
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
      const regionMatch = region === "全部" || project.city === region;
      const queryMatch =
        !needle ||
        [project.name, project.city, project.district, project.builder]
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
          <button type="button" onClick={() => setMethodOpen(true)}>評分方法</button>
        </nav>
        <div className="data-status">
          <span className="status-dot" />
          資料骨架已就緒
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">TAOYUAN · HSINCHU · GREATER TAIPEI</p>
          <h1>買房前，先看見<br />建案的完整履歷。</h1>
          <p className="hero-intro">
            把建照、成交、瑕疵證據、建商回應與生活圈放在同一張圖上。
            不用猜哪個建商比較好，每一項結論都能回到來源。
          </p>
          <label className="hero-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋建案、地區或建商…"
              aria-label="搜尋建案、地區或建商"
            />
            <kbd>Enter</kbd>
          </label>
          <div className="hero-notes">
            <span>✓ 來源分級</span>
            <span>✓ 沒資料不等於沒問題</span>
            <span>✓ 最多比較 3 案</span>
          </div>
        </div>
        <div className="hero-proof">
          <div className="proof-heading">
            <span>建案健檢預覽</span>
            <span className="live-label">DEMO</span>
          </div>
          <div className="proof-score">
            <div className="score-ring" style={{ "--score": active.overall } as CSSProperties}>
              <span>{active.overall}</span>
              <small>綜合表現</small>
            </div>
            <div>
              <p>{active.name}</p>
              <h2>{active.issue}</h2>
              <span>資料可信度 {active.confidence}</span>
            </div>
          </div>
          <div className="proof-grid">
            <div><span>品質紀錄</span><strong>{active.quality}</strong></div>
            <div><span>售後處理</span><strong>{active.response}</strong></div>
            <div><span>生活機能</span><strong>{active.amenity}</strong></div>
            <div><span>環境風險</span><strong>{active.environment}</strong></div>
          </div>
          <p className="demo-caption">目前為匿名示範資料，不代表任何真實建案評價。</p>
        </div>
      </section>

      <section className="workspace" id="explore">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PROJECT EXPLORER</p>
            <h2>從地圖開始縮小選擇</h2>
          </div>
          <p>先用區域和關鍵字篩選，再打開證據逐筆判讀。</p>
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
          <span className="result-count">{filtered.length} 個示範建案</span>
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
                  className={"project-card " + (selectedId === project.id ? "selected" : "")}
                  key={project.id}
                >
                  <button className="project-select" type="button" onClick={() => setSelectedId(project.id)}>
                    <div className="project-card-top">
                      <span>{project.city} · {project.district}</span>
                      <span className={"issue-pill " + (project.issue === "需留意" ? "warn" : project.issue === "資料不足" ? "unknown" : "")}>
                        {project.issue}
                      </span>
                    </div>
                    <h3>{project.name}</h3>
                    <p>{project.builder}</p>
                    <div className="project-metrics">
                      <span><strong>{project.overall}</strong> 綜合</span>
                      <span><strong>{project.price}</strong> 萬／坪</span>
                      <span><strong>{project.year}</strong> 完工</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={"compare-toggle " + (compareIds.includes(project.id) ? "checked" : "")}
                    onClick={() => toggleCompare(project.id)}
                    aria-pressed={compareIds.includes(project.id)}
                  >
                    {compareIds.includes(project.id) ? "✓ 已加入比較" : "＋ 加入比較"}
                  </button>
                </article>
              ))
            )}
          </div>

          <div className="map-panel" aria-label="北台灣建案示意地圖">
            <div className="map-label map-label-taipei">雙北</div>
            <div className="map-label map-label-taoyuan">桃園</div>
            <div className="map-label map-label-hsinchu">新竹</div>
            <div className="river river-one" />
            <div className="river river-two" />
            <div className="road road-one" />
            <div className="road road-two" />
            <div className="road road-three" />
            {filtered.map((project) => (
              <button
                key={project.id}
                type="button"
                className={"map-marker " + (selectedId === project.id ? "active" : "")}
                style={{ left: project.mapX + "%", top: project.mapY + "%" }}
                onClick={() => setSelectedId(project.id)}
                aria-label={"查看 " + project.name}
              >
                <span>{project.overall}</span>
              </button>
            ))}
            <div className="map-legend">
              <span><i className="legend-dot good" />80+</span>
              <span><i className="legend-dot mid" />70–79</span>
              <span>數字為綜合表現</span>
            </div>
          </div>

          <aside className="detail-panel" aria-live="polite">
            <div className="detail-kicker">
              <span>{active.city} · {active.district}</span>
              <span>資料可信度 {active.confidence}</span>
            </div>
            <h2>{active.name}</h2>
            <p className="builder-line">{active.builder} · {active.contractor}</p>

            <div className="detail-summary">
              <div className="mini-score">
                <strong>{active.overall}</strong>
                <span>綜合表現</span>
              </div>
              <p>{active.summary}</p>
            </div>

            <div className="score-stack">
              <ScoreBar label="品質紀錄" value={active.quality} />
              <ScoreBar label="售後處理" value={active.response} />
              <ScoreBar label="生活機能" value={active.amenity} />
              <ScoreBar label="環境表現" value={active.environment} />
            </div>

            <h3 className="subheading">生活圈距離</h3>
            <div className="amenity-grid">
              <div><span>便利商店</span><strong>{active.amenities.convenience}</strong></div>
              <div><span>全聯</span><strong>{active.amenities.pxmart}</strong></div>
              <div><span>好市多</span><strong>{active.amenities.costco}</strong></div>
              <div><span>車站／捷運</span><strong>{active.amenities.station}</strong></div>
            </div>

            <h3 className="subheading">證據時間線</h3>
            <div className="evidence-list">
              {active.evidence.map((item) => (
                <div className="evidence-item" key={item.kind + item.title}>
                  <EvidenceBadge kind={item.kind} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <small>{item.date}</small>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className={"detail-compare " + (compareIds.includes(active.id) ? "added" : "")}
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
            <h2>把取捨攤開來看</h2>
          </div>
          <p>{compareProjects.length ? "已選擇 " + compareProjects.length + " 個建案" : "從上方加入 2–3 個建案開始比較"}</p>
        </div>

        {compareProjects.length === 0 ? (
          <div className="compare-empty">
            <div className="empty-illustration" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>還沒有加入比較</strong>
            <p>建議挑一個「生活方便」和一個「品質紀錄完整」的建案，差異會最清楚。</p>
            <a href="#explore">回到建案地圖</a>
          </div>
        ) : (
          <div className="compare-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>比較項目</th>
                  {compareProjects.map((project) => (
                    <th key={project.id}>
                      <span>{project.district}</span>
                      {project.name}
                      <button type="button" onClick={() => toggleCompare(project.id)} aria-label={"移除 " + project.name}>×</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><th>綜合表現</th>{compareProjects.map((p) => <td key={p.id}><strong>{p.overall}</strong>／100</td>)}</tr>
                <tr><th>品質紀錄</th>{compareProjects.map((p) => <td key={p.id}>{p.quality}</td>)}</tr>
                <tr><th>售後處理</th>{compareProjects.map((p) => <td key={p.id}>{p.response}</td>)}</tr>
                <tr><th>生活機能</th>{compareProjects.map((p) => <td key={p.id}>{p.amenity}</td>)}</tr>
                <tr><th>環境表現</th>{compareProjects.map((p) => <td key={p.id}>{p.environment}</td>)}</tr>
                <tr><th>示範單價</th>{compareProjects.map((p) => <td key={p.id}>{p.price} 萬／坪</td>)}</tr>
                <tr><th>資料可信度</th>{compareProjects.map((p) => <td key={p.id}><span className="confidence-cell">{p.confidence}</span></td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="principles">
        <div>
          <p className="eyebrow">HOW WE READ THE DATA</p>
          <h2>評分之前，先尊重證據。</h2>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>事實與推估分開</h3>
            <p>官方紀錄、住戶回報與模型推估各自標示，不讓 AI 生成沒有來源的指控。</p>
          </article>
          <article>
            <span>02</span>
            <h3>按戶數與屋齡校正</h3>
            <p>大型、老社區本來就容易累積較多事件，不能單用問題件數排名。</p>
          </article>
          <article>
            <span>03</span>
            <h3>未知就是未知</h3>
            <p>找不到回報時顯示資料不足，不會直接把它包裝成低風險。</p>
          </article>
        </div>
        <button type="button" className="method-link" onClick={() => setMethodOpen(true)}>查看完整評分方法 →</button>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark">居</span>
          <div><strong>居鑑</strong><p>讓每一次購屋判斷，都有資料可以回頭查。</p></div>
        </div>
        <div className="source-links">
          <span>預計串接來源</span>
          <a href="https://lvr.land.moi.gov.tw/" target="_blank" rel="noreferrer">實價登錄</a>
          <a href="https://data.gov.tw/" target="_blank" rel="noreferrer">政府資料開放平臺</a>
          <a href="https://judgment.judicial.gov.tw/" target="_blank" rel="noreferrer">司法院裁判書</a>
          <a href="https://data.gov.tw/dataset/25766" target="_blank" rel="noreferrer">淹水潛勢圖</a>
        </div>
        <p className="footer-note">第一版互動原型 · 所有建案與評價皆為匿名示範資料</p>
      </footer>

      {methodOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setMethodOpen(false)}>
          <section className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setMethodOpen(false)} aria-label="關閉">×</button>
            <p className="eyebrow">METHODOLOGY</p>
            <h2 id="method-title">評分不是判決，是可追溯的比較工具。</h2>
            <p>第一版將建案拆成四個獨立分數，不用單一總分掩蓋重要取捨。</p>
            <div className="method-list">
              <div><strong>品質紀錄 35%</strong><span>已確認瑕疵、重複發生程度、戶數與屋齡校正</span></div>
              <div><strong>售後處理 25%</strong><span>首次回應時間、完成修繕比例、修繕後是否復發</span></div>
              <div><strong>生活機能 25%</strong><span>步行與駕車時間、交通、採買、醫療與公園</span></div>
              <div><strong>環境表現 15%</strong><span>淹水、液化、道路噪音與鄰近工業設施</span></div>
            </div>
            <div className="method-warning">
              <strong>公開前的必要護欄</strong>
              <p>真實負面紀錄必須附來源、時間與證據等級，並提供更正與建商回應機制。</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
