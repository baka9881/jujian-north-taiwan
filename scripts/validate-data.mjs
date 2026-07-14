import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(path.join(root, "data", "processed", name), "utf8"));
const projects = await readJson("projects.json");
const amenities = await readJson("amenities.json");
const quality = await readJson("quality-evidence.json");
const report = await readJson("update-report.json");
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

for (const project of projects.projects) {
  fail(Boolean(project.priceEvidence?.status), `${project.name} 缺少價格查核狀態`);
  fail(!project.price || project.price.count > 0, `${project.name} 的價格樣本數無效`);
  const amenity = amenities.projects[project.id];
  fail(Number.isFinite(amenity?.location?.latitude) && Number.isFinite(amenity?.location?.longitude), `${project.name} 缺少有效座標`);
  fail(amenity?.location?.confidence !== "estimated" || amenity.score === null, `${project.name} 的估算位置不應顯示機能分數`);
  fail(Array.isArray(quality.projects[project.id]?.events), `${project.name} 的品質事件格式無效`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`資料檢查通過：${projects.projects.length} 案、${projects.priceCoverage.pricedProjects} 案有成交、${amenities.poiCount} 個生活設施`);
}
