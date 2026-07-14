import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanBuilder,
  fetchBytes,
  householdCount,
  normalizeIdentity,
  normalizeName,
  parseCsv,
  rocToIso,
  seededPosition,
  sourceKeyFor,
  stableHash,
  todayTaipei,
} from "./data-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsPath = path.join(root, "data", "processed", "projects.json");
const reportPath = path.join(root, "data", "processed", "update-report.json");
const sourceDirectory = path.join(root, "data", "source", "current-buildcases");
const officialBase = "https://plvr.land.moi.gov.tw";
const sourceSpecs = [
  { region: "林口", city: "新北市", file: "f_lvr_buildcase.csv" },
  { region: "A7", city: "桃園市", file: "h_lvr_buildcase.csv" },
];
const officialFields = [
  "name", "city", "district", "builder", "households", "zoning", "mainUse", "material", "address",
  "buildingLand", "declaredDate", "permitDate", "permitNo", "firstRegistrationDate", "registryNumber",
];

function validValue(value) {
  return value && value !== "未提供";
}

function isA7(row) {
  const text = `${row.坐落基地 || ""} ${row.坐落街道 || ""}`;
  return /善捷段|樂捷段|樂善段|文桃路|樂學路|樂善一路|文青路|長慶/u.test(text);
}

function eligible(row, region) {
  const name = row.建案名稱 || "";
  if (!name || /\?|�/u.test(name) || !String(row.主要用途 || "").includes("住宅") || householdCount(row.層棟戶數) < 20) return false;
  if (region === "林口") return row.鄉鎮市區 === "林口區";
  return row.鄉鎮市區 === "龜山區" && isA7(row);
}

function officialProject(row, spec) {
  const project = {
    name: row.建案名稱.trim(),
    region: spec.region,
    city: spec.city,
    district: row.鄉鎮市區.trim(),
    builder: cleanBuilder(row.起造人),
    households: householdCount(row.層棟戶數),
    zoning: (row.使用分區 || "未提供").trim(),
    mainUse: (row.主要用途 || "未提供").trim(),
    material: (row.主要建材 || "未提供").trim(),
    address: (row.坐落街道 || "未提供").trim(),
    buildingLand: (row.坐落基地 || "未提供").trim(),
    declaredDate: rocToIso(row.申報備查日期),
    permitDate: rocToIso(row.建照核發日期),
    permitNo: (row.建造執照 || "未提供").trim(),
    firstRegistrationDate: rocToIso(row["第1次登記日期"]),
    registryNumber: (row.編號 || "未提供").trim(),
  };
  return { ...project, sourceKey: sourceKeyFor(project) };
}

function matchKeys(project) {
  const keys = [];
  if (validValue(project.registryNumber)) keys.push(`registry:${project.region}:${normalizeIdentity(project.registryNumber)}`);
  if (validValue(project.permitNo)) keys.push(`permit:${project.region}:${normalizeIdentity(project.permitNo)}`);
  keys.push(`fallback:${project.region}:${normalizeName(project.name)}:${normalizeIdentity(project.buildingLand)}`);
  return keys;
}

function candidateView(project) {
  return {
    sourceKey: project.sourceKey,
    name: project.name,
    region: project.region,
    builder: project.builder,
    households: project.households,
    declaredDate: project.declaredDate,
    address: project.address,
    buildingLand: project.buildingLand,
    permitNo: project.permitNo,
  };
}

function buildNewProject(candidate, checkedAt) {
  const { mapX, mapY } = seededPosition(candidate.name, candidate.region);
  const prefix = candidate.region === "林口" ? "linkou" : "a7";
  return {
    id: `${prefix}-${stableHash(candidate.sourceKey, 10)}`,
    ...candidate,
    price: null,
    priceEvidence: {
      status: "source-no-match",
      statusLabel: "官方來源尚未配對",
      matchMethod: "新建案已加入，等待成交資料配對",
      addressCorroborated: null,
      addressTokens: [],
      lastCheckedAt: checkedAt,
      sourceUrl: "https://plvr.land.moi.gov.tw/DownloadOpenData",
    },
    qualityStatus: "尚未查核",
    amenityStatus: "待定位",
    dataCompleteness: candidate.firstRegistrationDate ? 80 : 70,
    mapX,
    mapY,
  };
}

async function downloadSources() {
  await mkdir(sourceDirectory, { recursive: true });
  for (const spec of sourceSpecs) {
    const url = `${officialBase}/Download?PayType=saleremark&fileName=${spec.file}`;
    await writeFile(path.join(sourceDirectory, spec.file), await fetchBytes(url));
  }
}

async function readCandidates() {
  const candidates = [];
  for (const spec of sourceSpecs) {
    const text = await readFile(path.join(sourceDirectory, spec.file), "utf8");
    candidates.push(...parseCsv(text).filter((row) => eligible(row, spec.region)).map((row) => officialProject(row, spec)));
  }
  return candidates;
}

async function main() {
  const shouldDownload = process.argv.includes("--download");
  if (shouldDownload) await downloadSources();

  const checkedAt = todayTaipei();
  const dataset = JSON.parse(await readFile(projectsPath, "utf8"));
  const catalogueBefore = dataset.projects.length;
  const highWater = Object.fromEntries(["林口", "A7"].map((region) => [
    region,
    dataset.projects.filter((project) => project.region === region).map((project) => project.declaredDate || "").sort().at(-1) || "",
  ]));

  const existingIndex = new Map();
  for (const project of dataset.projects) {
    project.sourceKey ||= sourceKeyFor(project);
    for (const key of matchKeys(project)) {
      if (!existingIndex.has(key)) existingIndex.set(key, []);
      existingIndex.get(key).push(project);
    }
  }

  const matchedIds = new Set();
  const added = [];
  const updated = [];
  const ambiguous = [];
  const backlog = [];
  const candidates = await readCandidates();

  for (const candidate of candidates) {
    const matches = [...new Set(matchKeys(candidate).flatMap((key) => existingIndex.get(key) || []))];
    if (matches.length > 1) {
      ambiguous.push({ ...candidateView(candidate), matchedIds: matches.map((project) => project.id) });
      continue;
    }
    if (matches.length === 1) {
      const existing = matches[0];
      matchedIds.add(existing.id);
      const changes = {};
      for (const field of officialFields) {
        if (JSON.stringify(existing[field] ?? null) !== JSON.stringify(candidate[field] ?? null)) {
          changes[field] = { before: existing[field] ?? null, after: candidate[field] ?? null };
          existing[field] = candidate[field];
        }
      }
      existing.sourceKey = candidate.sourceKey;
      if (Object.keys(changes).length) updated.push({ id: existing.id, name: candidate.name, region: candidate.region, changes });
      continue;
    }

    if (candidate.declaredDate && candidate.declaredDate > highWater[candidate.region]) {
      const project = buildNewProject(candidate, checkedAt);
      dataset.projects.push(project);
      added.push(candidateView(project));
      matchedIds.add(project.id);
    } else {
      backlog.push(candidateView(candidate));
    }
  }

  const missing = dataset.projects
    .filter((project) => !added.some((item) => item.sourceKey === project.sourceKey) && !matchedIds.has(project.id))
    .map((project) => ({ id: project.id, name: project.name, region: project.region, sourceKey: project.sourceKey }));

  dataset.generatedAt = checkedAt;
  dataset.projectCount = dataset.projects.length;
  dataset.maintenance = {
    lastProjectScanAt: checkedAt,
    officialEligibleCount: candidates.length,
    catalogueCount: dataset.projects.length,
    autoAddedCount: added.length,
    updatedExistingCount: updated.length,
    historicalBacklogCount: backlog.length,
    attentionCount: ambiguous.length + missing.length,
    policy: "只自動加入晚於各區目前最新申報日的新案；既有案不自動刪除，歧義資料不覆蓋。",
  };
  await writeFile(projectsPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  const report = {
    generatedAt: checkedAt,
    status: ambiguous.length || missing.length ? "attention" : "ok",
    summary: {
      officialEligibleCount: candidates.length,
      catalogueBefore,
      catalogueAfter: dataset.projects.length,
      autoAddedCount: added.length,
      updatedExistingCount: updated.length,
      ambiguousCount: ambiguous.length,
      missingFromCurrentSourceCount: missing.length,
      historicalBacklogCount: backlog.length,
    },
    safeguards: [
      "新案必須晚於該區目前最新申報日才會自動加入",
      "既有建案不會因本期來源暫時缺少而刪除",
      "多重匹配或身分歧義不會自動覆蓋",
      "人工確認的定位與品質事件由後續流程保留",
    ],
    changes: { added, updated, ambiguous, missing },
    historicalBacklog: backlog.sort((a, b) => (b.declaredDate || "").localeCompare(a.declaredDate || "")),
    sources: sourceSpecs.map((spec) => ({
      region: spec.region,
      name: "內政部預售屋建案備查資料",
      url: `${officialBase}/DownloadOpenData`,
      file: spec.file,
    })),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`官方候選 ${candidates.length} 案；目錄 ${catalogueBefore} → ${dataset.projects.length} 案`);
  console.log(`自動新增 ${added.length}、既有更新 ${updated.length}、歧義 ${ambiguous.length}、來源暫缺 ${missing.length}`);
  console.log(`歷史候選庫 ${backlog.length} 案（不自動加入目前首批目錄）`);
}

await main();
