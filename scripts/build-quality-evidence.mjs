import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsPath = path.join(root, "data", "processed", "projects.json");
const amenitiesPath = path.join(root, "data", "processed", "amenities.json");
const outputPath = path.join(root, "data", "processed", "quality-evidence.json");
const generatedAt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

const landSections = {
  林口段: { county: "F", code: "2211" },
  行政段: { county: "F", code: "2212" },
  佳林段: { county: "F", code: "2216" },
  麗林段: { county: "F", code: "0465" },
  力行段: { county: "F", code: "0466" },
  建林段: { county: "F", code: "0467" },
  新林段: { county: "F", code: "0468" },
  樂捷段: { county: "H", code: "1441" },
  善捷段: { county: "H", code: "1442" },
};

function parcelReference(buildingLand) {
  const match = buildingLand.match(/^(.+段)(\d+)(?:-(\d+))?地號$/u);
  if (!match || !landSections[match[1]]) return null;
  const section = landSections[match[1]];
  const main = match[2].padStart(4, "0");
  const sub = (match[3] || "0").padStart(4, "0");
  const parcelCode = `${section.code}${main}${sub}`;
  return {
    sectionName: match[1],
    sectionCode: section.code,
    parcelNumber: `${Number(match[2])}${match[3] ? `-${Number(match[3])}` : ""}`,
    parcelCode,
    officialMapUrl: `https://maps.nlsc.gov.tw/goland/${section.county}/${parcelCode}`,
  };
}

function locationReview(amenity, buildingLand) {
  const status = amenity.location.confidence === "high" || amenity.location.confidence === "medium"
    ? "verified"
    : amenity.location.confidence === "low"
      ? "approximate"
      : "awaiting-parcel-check";
  return {
    status,
    label: status === "verified" ? "已有可信定位" : status === "approximate" ? "道路位置估算" : "等待地號核對",
    method: amenity.location.method,
    parcel: parcelReference(buildingLand),
  };
}

async function main() {
  const projectDataset = JSON.parse(await readFile(projectsPath, "utf8"));
  const amenityDataset = JSON.parse(await readFile(amenitiesPath, "utf8"));
  const projects = {};

  for (const project of projectDataset.projects) {
    projects[project.id] = {
      status: "queued",
      statusLabel: "已排入官方來源查核",
      lastReviewedAt: null,
      publishedEventCount: 0,
      evidenceCount: 0,
      searchTerms: [project.name, project.builder, project.permitNo, project.buildingLand],
      sourceChecks: [
        { sourceId: "judicial", status: "not-reviewed", checkedAt: null, matchCount: null },
        { sourceId: "consumer-disputes", status: "not-reviewed", checkedAt: null, matchCount: null },
        { sourceId: "contract-inspection", status: "not-reviewed", checkedAt: null, matchCount: null },
      ],
      locationReview: locationReview(amenityDataset.projects[project.id], project.buildingLand),
      events: [],
    };
  }

  const values = Object.values(projects);
  const payload = {
    generatedAt,
    methodology: {
      publishRule: "僅刊登 A 級可直接核對資料，或至少兩個互相獨立來源構成的 B 級資料；C 級線索不形成品質結論。",
      noEventDisclaimer: "0 件已刊登事件只代表目前沒有資料通過刊登門檻，不代表建案沒有漏水或施工問題。",
      reviewStates: {
        queued: "已排入查核，尚未逐筆完成官方來源搜尋",
        reviewing: "正在核對事件、建案名稱、地址與當事人",
        reviewed: "本輪來源查核完成，但仍可能因資料更新而改變",
      },
      evidenceLevels: {
        A: "裁判書、政府處分、建商正式公告、具體修繕或鑑定文件",
        B: "至少兩個互相獨立且能確認同一建案的公開來源",
        C: "單一匿名貼文、無法核對棟別時間或僅有轉述的待查線索",
      },
    },
    sources: [
      { id: "judicial", name: "司法院裁判書查詢", url: "https://judgment.judicial.gov.tw/FJUD/default.aspx", level: "A", access: "公開查詢" },
      { id: "judicial-api", name: "司法院裁判書開放 API", url: "https://opendata.judicial.gov.tw/", level: "A", access: "需申請帳號與限時權杖" },
      { id: "consumer-disputes", name: "內政部房地產消費糾紛案例", url: "https://data.gov.tw/dataset/7506", level: "A", access: "開放資料" },
      { id: "contract-inspection", name: "行政院消保處預售屋契約查核", url: "https://cpc.ey.gov.tw/Page/6C059838CA9744A8/b876668f-58c1-4e6f-80c3-846d4a317786", level: "A", access: "公開資料" },
      { id: "nlsc", name: "國土測繪圖資服務雲", url: "https://maps.nlsc.gov.tw/", level: "A", access: "地號人工核對" },
    ],
    summary: {
      projectCount: values.length,
      publishedEventCount: 0,
      queuedCount: values.filter((project) => project.status === "queued").length,
      verifiedLocationCount: values.filter((project) => project.locationReview.status === "verified").length,
      approximateLocationCount: values.filter((project) => project.locationReview.status === "approximate").length,
      awaitingParcelCount: values.filter((project) => project.locationReview.status === "awaiting-parcel-check").length,
    },
    projects,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`完成 ${payload.summary.projectCount} 個建案的品質查核佇列`);
  console.log(`定位：可信 ${payload.summary.verifiedLocationCount}、道路估算 ${payload.summary.approximateLocationCount}、待地號核對 ${payload.summary.awaitingParcelCount}`);
}

await main();
