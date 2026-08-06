import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(path.join(root, "data", "processed", name), "utf8"));
const readManualJson = async (name) => JSON.parse(await readFile(path.join(root, "data", "manual", name), "utf8"));
const projects = await readJson("projects.json");
const amenities = await readJson("amenities.json");
const quality = await readJson("quality-evidence.json");
const report = await readJson("update-report.json");
const qualityAudits = await readManualJson("quality-audits.json");
const errors = [];
const fail = (condition, message) => { if (!condition) errors.push(message); };

const ids = projects.projects.map((project) => project.id);
const sourceKeys = projects.projects.map((project) => project.sourceKey);
const expectedIds = [...ids].sort();
fail(new Set(ids).size === ids.length, "建案 ID 有重複");
fail(sourceKeys.every(Boolean) && new Set(sourceKeys).size === sourceKeys.length, "官方來源識別碼缺少或重複");
fail(JSON.stringify(Object.keys(amenities.projects).sort()) === JSON.stringify(expectedIds), "生活機能資料與建案目錄不同步");
fail(JSON.stringify(Object.keys(quality.projects).sort()) === JSON.stringify(expectedIds), "品質資料與建案目錄不同步");
fail(report.summary.catalogueAfter === projects.projects.length, "更新報告的建案數不同步");
fail(projects.priceCoverage.totalProjects === projects.projects.length, "價格涵蓋率的建案數不同步");
fail(Object.keys(qualityAudits.projects).every((id) => ids.includes(id)), "人工品質查核包含不存在的建案 ID");
fail((qualityAudits.reviewedProjectIds || []).every((id) => ids.includes(id)), "品質查核範圍包含不存在的建案 ID");
const expectedReviewedCount = qualityAudits.reviewedProjectIds?.length ?? Object.keys(qualityAudits.projects).length;
fail(quality.summary.reviewedCount === expectedReviewedCount, "品質查核完成數與人工查核資料不同步");
const amenityCategories = Object.keys(amenities.categories);
fail(amenityCategories.length === 10, "生活機能應包含 10 類設施");
fail(["market", "park", "pharmacy", "parking"].every((category) => amenityCategories.includes(category)), "生活機能缺少市場、公園、藥局或停車場");
fail(amenities.routeCoverage?.routedProjects === 31, "道路路線時間涵蓋數異常");
fail(Object.keys(amenities.methodology?.profiles || {}).length === 4, "生活機能評分情境不完整");
fail(amenities.methodology?.scoreFormula?.version === 2, "生活機能評分公式尚未升級");
fail(Object.keys(amenities.methodology?.densityRules || {}).length === 10, "生活機能選擇數量規則不完整");
fail(quality.summary.publishedEventCount === quality.summary.defectEventCount + quality.summary.contractEventCount, "品質事件分類計數不同步");

for (const project of projects.projects) {
  fail(Boolean(project.priceEvidence?.status), `${project.name} 缺少價格查核狀態`);
  fail(!project.price || project.price.count > 0, `${project.name} 的價格樣本數無效`);
  const amenity = amenities.projects[project.id];
  fail(Number.isFinite(amenity?.location?.latitude) && Number.isFinite(amenity?.location?.longitude), `${project.name} 缺少有效座標`);
  fail(amenity?.location?.confidence !== "estimated" || amenity.score === null, `${project.name} 的估算位置不應顯示機能分數`);
  fail(Object.keys(amenity?.categoryScores || {}).length === 10, `${project.name} 的生活機能分類分數不完整`);
  fail(Object.keys(amenity?.routeScores || {}).length === 10, `${project.name} 的生活機能路線分數不完整`);
  fail(Object.keys(amenity?.densityScores || {}).length === 10, `${project.name} 的生活機能數量分數不完整`);
  fail(Object.keys(amenity?.nearbyCounts || {}).length === 10, `${project.name} 的附近設施數量不完整`);
  fail(amenity?.scoreFormulaVersion === 2, `${project.name} 尚未使用新版生活機能公式`);
  if (amenity?.score !== null) {
    fail(amenityCategories.every((category) => !amenity.nearest[category] || amenity.nearest[category].routes?.walking), `${project.name} 缺少道路步行時間`);
    fail(amenityCategories.every((category) => !amenity.nearest[category] || amenity.nearest[category].routes?.driving), `${project.name} 缺少道路開車時間`);
    fail(amenityCategories.every((category) => !amenity.nearest[category] || amenity.nearest[category].routes?.peakDriving), `${project.name} 缺少平日尖峰路線時間`);
  }
  fail(Array.isArray(quality.projects[project.id]?.events), `${project.name} 的品質事件格式無效`);
  fail(quality.projects[project.id]?.publishedEventCount === quality.projects[project.id]?.events.length, `${project.name} 的品質事件計數不同步`);
  fail(quality.projects[project.id]?.defectEventCount === quality.projects[project.id]?.events.filter((event) => event.eventType === "defect").length, `${project.name} 的實際瑕疵計數不同步`);
  fail(quality.projects[project.id]?.contractEventCount === quality.projects[project.id]?.events.filter((event) => event.eventType === "contract").length, `${project.name} 的契約查核計數不同步`);
  fail(quality.projects[project.id]?.events.every((event) => event.sources?.every((source) => /^https:\/\//.test(source.url))), `${project.name} 的品質事件缺少官方來源連結`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`資料檢查通過：${projects.projects.length} 案、${projects.priceCoverage.pricedProjects} 案有成交、${amenities.poiCount} 個生活設施`);
}
