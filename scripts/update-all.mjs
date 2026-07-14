import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = [
  ["scan-project-updates.mjs", "--download"],
  ["refresh-project-prices.mjs", "--download"],
  ["enrich-amenities.mjs"],
  ["enrich-route-times.mjs"],
  ["build-quality-evidence.mjs"],
  ["validate-data.mjs"],
];

for (const [script, ...arguments_] of scripts) {
  console.log(`\n▶ ${script}`);
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...arguments_], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const processed = path.join(root, "data", "processed");
const reportPath = path.join(processed, "update-report.json");
const [report, projects, amenities, quality] = await Promise.all([
  readFile(reportPath, "utf8").then(JSON.parse),
  readFile(path.join(processed, "projects.json"), "utf8").then(JSON.parse),
  readFile(path.join(processed, "amenities.json"), "utf8").then(JSON.parse),
  readFile(path.join(processed, "quality-evidence.json"), "utf8").then(JSON.parse),
]);
report.pipeline = {
  status: "complete",
  pricedProjects: projects.priceCoverage.pricedProjects,
  totalProjects: projects.projects.length,
  verifiedOrApproximateLocations: Object.values(amenities.projects).filter((project) => project.score !== null).length,
  qualityQueuedCount: quality.summary.queuedCount,
  qualityReviewedCount: quality.summary.reviewedCount,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("\n安全更新完成；請查看 data/processed/update-report.json 的變更報告。");
