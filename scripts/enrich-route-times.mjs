import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const amenitiesPath = path.join(root, "data", "processed", "amenities.json");
const cacheDirectory = path.join(root, "data", "cache");
const routeCachePath = path.join(cacheDirectory, "valhalla-routes.json");
const generatedAt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const routeEndpoint = "https://valhalla1.openstreetmap.de/sources_to_targets";
const clientId = "jujian-north-taiwan.baka0406.chatgpt.site";

const routeScoreRules = {
  convenience: { mode: "walking", bands: [[5, 100], [10, 75], [15, 45], [25, 20]] },
  pxmart: { mode: "walking", bands: [[10, 100], [20, 70], [30, 40], [45, 20]] },
  costco: { mode: "peakDriving", bands: [[15, 100], [25, 75], [40, 45], [60, 20]] },
  station: { mode: "walking", bands: [[10, 100], [15, 80], [25, 45], [40, 20]] },
  school: { mode: "walking", bands: [[10, 100], [20, 65], [30, 35], [45, 15]] },
  medical: { mode: "walking", bands: [[10, 100], [20, 65], [30, 35], [45, 15]] },
  market: { mode: "walking", bands: [[10, 100], [20, 70], [30, 40], [45, 20]] },
  park: { mode: "walking", bands: [[5, 100], [10, 75], [20, 40], [30, 20]] },
  pharmacy: { mode: "walking", bands: [[5, 100], [10, 75], [20, 40], [30, 20]] },
  parking: { mode: "walking", bands: [[5, 100], [10, 70], [15, 40], [25, 20]] },
};

const profiles = {
  balanced: {
    label: "均衡生活",
    description: "兼顧交通、採買、醫療、休憩與停車。",
    weights: { convenience: 12, pxmart: 12, costco: 6, station: 18, school: 10, medical: 10, market: 8, park: 10, pharmacy: 7, parking: 7 },
  },
  student: {
    label: "學生通勤",
    description: "提高車站、超商、市場與日常採買權重。",
    weights: { convenience: 18, pxmart: 10, costco: 2, station: 25, school: 5, medical: 8, market: 10, park: 8, pharmacy: 8, parking: 6 },
  },
  family: {
    label: "家庭生活",
    description: "提高學校、醫療、公園與採買權重。",
    weights: { convenience: 10, pxmart: 12, costco: 4, station: 12, school: 18, medical: 12, market: 10, park: 14, pharmacy: 5, parking: 3 },
  },
  driver: {
    label: "開車族",
    description: "提高停車、好市多與道路移動權重。",
    weights: { convenience: 8, pxmart: 10, costco: 12, station: 8, school: 5, medical: 10, market: 8, park: 5, pharmacy: 4, parking: 30 },
  },
};

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nextWeekday(dateText) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  do date.setDate(date.getDate() + 1); while (date.getDay() === 0 || date.getDay() === 6);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

function matrixSignature(project, categories, peakDate) {
  const targets = categories.map((category) => {
    const poi = project.nearest[category];
    return `${category}:${poi?.id || "none"}:${poi?.latitude || ""}:${poi?.longitude || ""}`;
  });
  return [
    project.location.latitude.toFixed(6),
    project.location.longitude.toFixed(6),
    peakDate,
    ...targets,
  ].join("|");
}

async function fetchMatrix(source, targets, costing, dateTime = null) {
  if (!targets.length) return [];
  const payload = {
    sources: [{ lat: source.latitude, lon: source.longitude, ...(dateTime ? { date_time: dateTime } : {}) }],
    targets: targets.map((target) => ({ lat: target.latitude, lon: target.longitude })),
    costing,
    units: "kilometers",
    verbose: true,
  };
  const url = `${routeEndpoint}?json=${encodeURIComponent(JSON.stringify(payload))}`;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "X-Client-Id": clientId,
          "User-Agent": "JujianNorthTaiwan/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const body = await response.json();
      return body.sources_to_targets?.[0] || [];
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1200);
    }
  }
  throw lastError;
}

function normalizeRoute(result, profile, departure = null) {
  if (!result || !Number.isFinite(result.time) || !Number.isFinite(result.distance)) return null;
  return {
    durationMinutes: Math.max(1, Math.ceil(result.time / 60)),
    distanceMeters: Math.round(result.distance * 1000),
    profile,
    departure,
  };
}

async function routeProject(project, categories, peakDate) {
  const targetEntries = categories
    .map((category) => [category, project.nearest[category]])
    .filter(([, poi]) => poi);
  const targets = targetEntries.map(([, poi]) => poi);
  const peakDateTime = `${peakDate}T08:00`;
  const walking = await fetchMatrix(project.location, targets, "pedestrian");
  await sleep(250);
  const driving = await fetchMatrix(project.location, targets, "auto");
  await sleep(250);
  const peakDriving = await fetchMatrix(project.location, targets, "auto", peakDateTime);
  await sleep(250);

  return Object.fromEntries(targetEntries.map(([category], index) => [category, {
    walking: normalizeRoute(walking[index], "pedestrian"),
    driving: normalizeRoute(driving[index], "auto"),
    peakDriving: normalizeRoute(peakDriving[index], "auto", peakDateTime),
  }]));
}

function scoreForRoute(routes, rule) {
  const minutes = routes?.[rule.mode]?.durationMinutes;
  if (!Number.isFinite(minutes)) return 0;
  return rule.bands.find(([limit]) => minutes <= limit)?.[1] || 0;
}

function weightedScore(categoryScores, weights) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((total, [, weight]) => total + weight, 0);
  if (!totalWeight) return 0;
  return Math.round(entries.reduce((total, [category, weight]) => total + (categoryScores[category] || 0) * weight, 0) / totalWeight);
}

function gradeFor(score) {
  if (score >= 80) return "非常便利";
  if (score >= 65) return "便利";
  if (score >= 45) return "基本足夠";
  return "機能較少";
}

async function main() {
  await mkdir(cacheDirectory, { recursive: true });
  const amenities = await readJson(amenitiesPath, null);
  const cache = await readJson(routeCachePath, { version: 1, projects: {} });
  const categories = Object.keys(amenities.categories);
  const peakDate = nextWeekday(generatedAt);
  let routedProjects = 0;

  for (const [index, [projectId, project]] of Object.entries(amenities.projects).entries()) {
    if (project.scoreReliability === "unavailable") {
      for (const category of categories) {
        if (project.nearest[category]) project.nearest[category].routes = { walking: null, driving: null, peakDriving: null };
      }
      project.categoryScores = Object.fromEntries(categories.map((category) => [category, 0]));
      project.distanceScore = project.score;
      project.score = null;
      project.rawScore = 0;
      project.grade = null;
      continue;
    }

    const signature = matrixSignature(project, categories, peakDate);
    let routes = cache.projects[projectId]?.signature === signature ? cache.projects[projectId].routes : null;
    if (!routes) {
      try {
        routes = await routeProject(project, categories, peakDate);
        cache.projects[projectId] = { signature, routes, updatedAt: generatedAt };
        await writeFile(routeCachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
        console.log(`[${index + 1}/${Object.keys(amenities.projects).length}] 路線 ${projectId}`);
      } catch (error) {
        console.warn(`路線暫時無法更新 ${projectId}：${error.message}`);
        routes = cache.projects[projectId]?.routes || {};
      }
    }

    for (const category of categories) {
      if (project.nearest[category]) {
        project.nearest[category].routes = routes[category] || { walking: null, driving: null, peakDriving: null };
      }
    }
    const categoryScores = Object.fromEntries(categories.map((category) => [
      category,
      scoreForRoute(routes[category], routeScoreRules[category]),
    ]));
    const score = weightedScore(categoryScores, profiles.balanced.weights);
    project.categoryScores = categoryScores;
    project.distanceScore = project.score;
    project.score = score;
    project.rawScore = score;
    project.grade = gradeFor(score);
    routedProjects += 1;
  }

  amenities.generatedAt = generatedAt;
  amenities.source.service = "Nominatim、Overpass API 與 Valhalla";
  amenities.methodology = {
    ...amenities.methodology,
    distance: "依 OpenStreetMap 道路網計算步行與開車路線距離",
    disclaimer: "步行與開車時間由 Valhalla 依 OpenStreetMap 道路網估算，會受到出入口、道路資料完整度與模型影響，不可當作導航保證。",
    peakDisclaimer: `尖峰時間採 ${peakDate} 平日 08:00 的道路網時間估算，不是即時路況；正式通勤仍應在實際時段以導航服務複核。`,
    routing: {
      provider: "Valhalla",
      providerUrl: "https://valhalla.github.io/valhalla/api/matrix/api-reference/",
      data: "OpenStreetMap",
      profileLabels: { walking: "步行", driving: "一般開車", peakDriving: "平日 08:00" },
      peakDate,
    },
    defaultProfile: "balanced",
    profiles,
    routeScoreRules,
  };
  amenities.routeCoverage = {
    routedProjects,
    totalProjects: Object.keys(amenities.projects).length,
    unavailableLocationProjects: Object.values(amenities.projects).filter((project) => project.scoreReliability === "unavailable").length,
  };

  await writeFile(amenitiesPath, `${JSON.stringify(amenities, null, 2)}\n`, "utf8");
  console.log(`路線完成：${routedProjects} 個可定位建案，${categories.length} 類生活設施`);
}

await main();
