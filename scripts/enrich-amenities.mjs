import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsPath = path.join(root, "data", "processed", "projects.json");
const outputPath = path.join(root, "data", "processed", "amenities.json");
const cacheDirectory = path.join(root, "data", "cache");
const geocodeCachePath = path.join(cacheDirectory, "nominatim-projects.json");
const overpassCachePath = path.join(cacheDirectory, "overpass-pois.json");
const userAgent = "JujianNorthTaiwan/1.0 (+https://jujian-north-taiwan.baka0406.chatgpt.site)";
const generatedAt = new Date().toISOString().slice(0, 10);

const categories = {
  convenience: { label: "便利商店", symbol: "商" },
  pxmart: { label: "全聯", symbol: "全" },
  costco: { label: "好市多", symbol: "好" },
  station: { label: "捷運／車站", symbol: "站" },
  school: { label: "學校", symbol: "學" },
  medical: { label: "醫療", symbol: "醫" },
};

const scoreRules = [
  { category: "convenience", label: "便利商店", maxScore: 20, bands: [[300, 20], [500, 15], [800, 8]] },
  { category: "pxmart", label: "全聯", maxScore: 20, bands: [[800, 20], [1500, 12], [2500, 6]] },
  { category: "costco", label: "好市多", maxScore: 15, bands: [[5000, 15], [10000, 10], [15000, 5]] },
  { category: "station", label: "捷運／車站", maxScore: 25, bands: [[800, 25], [1200, 18], [2000, 10]] },
  { category: "school", label: "學校", maxScore: 10, bands: [[800, 10], [1500, 6]] },
  { category: "medical", label: "醫療", maxScore: 10, bands: [[1200, 10], [2500, 6]] },
];

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function fallbackPoint(project) {
  const seed = [...project.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  const latitudeJitter = ((seed % 9) - 4) * 0.00007;
  const longitudeJitter = (((seed * 7) % 9) - 4) * 0.00007;
  if (project.region === "林口") {
    const x = (project.mapX - 25) / 19;
    const y = (project.mapY - 33) / 34;
    return { latitude: 25.0885 - y * 0.0205 + latitudeJitter, longitude: 121.364 + x * 0.023 + longitudeJitter };
  }
  const x = (project.mapX - 57) / 15;
  const y = (project.mapY - 42) / 30;
  return { latitude: 25.057 - y * 0.018 + latitudeJitter, longitude: 121.381 + x * 0.017 + longitudeJitter };
}

function cleanAddress(address) {
  return address
    .replace(/(\d+)號旁/gu, "$1號")
    .replace(/對面工地|對面|附近|旁|等$/gu, "")
    .replace(/、/gu, "與")
    .replace(/跟/gu, "與")
    .replace(/交岔路口|交叉路口|交叉口|路口/gu, "與")
    .replace(/與+/gu, "與")
    .replace(/與$/u, "")
    .trim();
}

function geocodeQueries(project) {
  const cleaned = cleanAddress(project.address);
  const roadParts = cleaned.split("與").map((part) => part.trim()).filter(Boolean);
  return [...new Set([
    `${project.city}${project.district}${cleaned}`,
    roadParts.length > 1 ? `${project.city}${project.district}${roadParts[0]}` : null,
  ].filter(Boolean))];
}

function geocodeMatches(project, result) {
  if (!result) return false;
  const roadTokens = project.address.match(/[\p{Script=Han}\d]+(?:路(?:[一二三四五六七八九十]+段)?|街(?:\d+巷)?)/gu) || [];
  if (!roadTokens.length) return true;
  const displayName = result.display_name || "";
  return roadTokens.some((token) => displayName.includes(token));
}

function locationConfidence(project, result) {
  if (!result) {
    return { confidence: "estimated", method: "catalogue-fallback", label: "區域估算位置" };
  }
  const address = project.address;
  const resultType = `${result.category || ""} ${result.type || ""}`;
  if (/\d+號/u.test(address) && /house|building|residential/u.test(resultType)) {
    return { confidence: "high", method: "nominatim-address", label: "門牌定位" };
  }
  if (/交叉|路口|與/u.test(address)) {
    return { confidence: "medium", method: "nominatim-intersection", label: "路口附近" };
  }
  return { confidence: "low", method: "nominatim-road", label: "道路中心附近" };
}

async function geocodeProjects(projects) {
  const cache = await readJson(geocodeCachePath, {});
  let changed = false;

  for (const [index, project] of projects.entries()) {
    if (!Object.hasOwn(cache, project.id)) {
      let matchedResult = null;
      for (const query of geocodeQueries(project)) {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        countrycodes: "tw",
        addressdetails: "1",
        "accept-language": "zh-TW,zh-Hant",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": userAgent, Referer: "https://jujian-north-taiwan.baka0406.chatgpt.site" },
      });
      if (!response.ok) throw new Error(`Nominatim ${response.status} for ${project.id}`);
      const results = await response.json();
        if (geocodeMatches(project, results[0])) {
          matchedResult = results[0];
          break;
        }
        await sleep(1100);
      }
      cache[project.id] = matchedResult;
      changed = true;
      console.log(`[${index + 1}/${projects.length}] 定位 ${project.name}: ${matchedResult?.display_name || "無結果"}`);
      await writeFile(geocodeCachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
      await sleep(1100);
    }
  }

  if (changed) await writeFile(geocodeCachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

  return Object.fromEntries(projects.map((project) => {
    const result = cache[project.id];
    const fallback = fallbackPoint(project);
    const latitude = result ? Number(result.lat) : fallback.latitude;
    const longitude = result ? Number(result.lon) : fallback.longitude;
    return [project.id, { latitude, longitude, ...locationConfidence(project, result), queryAddress: `${project.city}${project.district}${project.address}` }];
  }));
}

const coreBounds = "25.025,121.335,25.110,121.420";
const overpassQueries = {
  convenience: `[out:json][timeout:60];nwr["shop"="convenience"](${coreBounds});out center tags;`,
  supermarket: `[out:json][timeout:60];nwr["shop"="supermarket"](${coreBounds});out center tags;`,
  station: `[out:json][timeout:30];(node["railway"="station"](${coreBounds});node["railway"="halt"](${coreBounds}););out body;`,
  school: `[out:json][timeout:60];nwr["amenity"="school"](${coreBounds});out center tags;`,
  medical: `[out:json][timeout:60];nwr["amenity"~"hospital|clinic"](${coreBounds});out center tags;`,
  costco: `[out:json][timeout:60];nwr["name"~"好市多|Costco",i](24.85,121.15,25.30,121.65);out center tags;`,
};

async function loadOverpass() {
  const cached = await readJson(overpassCachePath, { elementsByQuery: {} });
  const endpoints = ["https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"];
  for (const [name, query] of Object.entries(overpassQueries)) {
    if (cached.elementsByQuery[name]) continue;
    if (name === "station") {
      cached.elementsByQuery[name] = [];
      await writeFile(overpassCachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
      continue;
    }
    let lastError;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": userAgent },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        cached.elementsByQuery[name] = data.elements || [];
        console.log(`設施 ${name}: ${cached.elementsByQuery[name].length}`);
        await writeFile(overpassCachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Overpass ${name} 暫時失敗（${endpoint}）：${error.message}`);
      }
    }
    if (lastError) {
      cached.elementsByQuery[name] = [];
      console.warn(`Overpass ${name} 本次無法取得，先保留空集合並使用可驗證的補充資料。`);
      await writeFile(overpassCachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
    }
    await sleep(1000);
  }
  return { elements: Object.values(cached.elementsByQuery).flat() };
}

function classifyPoi(tags = {}) {
  const identity = [tags.name, tags["name:zh"], tags.brand, tags.operator].filter(Boolean).join(" ");
  if (/好市多|costco/iu.test(identity)) return "costco";
  if (/全聯|px\s*mart|pxmart/iu.test(identity)) return "pxmart";
  if (tags.shop === "convenience") return "convenience";
  if (tags.railway === "station" || tags.railway === "halt") return "station";
  if (tags.amenity === "school") return "school";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "medical";
  return null;
}

function poiAddress(tags = {}) {
  return [tags["addr:city"], tags["addr:district"], tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join("");
}

function normalizePois(overpass) {
  const pois = [];
  const seen = new Set();
  for (const element of overpass.elements || []) {
    const category = classifyPoi(element.tags);
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!category || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const id = `${element.type}-${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    pois.push({
      id,
      name: element.tags?.name || element.tags?.["name:zh"] || categories[category].label,
      category,
      latitude,
      longitude,
      address: poiAddress(element.tags) || null,
    });
  }
  const supplementalPois = [
    { id: "node-4456093778", name: "A9 林口站", category: "station", latitude: 25.0657846, longitude: 121.3614372, address: "新北市林口區八德路" },
    { id: "node-4653352241", name: "A8 長庚醫院站", category: "station", latitude: 25.0604744, longitude: 121.3707965, address: "桃園市龜山區" },
    { id: "node-4653352242", name: "A7 體育大學站", category: "station", latitude: 25.0413317, longitude: 121.3854083, address: "桃園市龜山區" },
    { id: "way-183547237", name: "好市多 桃園南崁店", category: "costco", latitude: 25.0542781, longitude: 121.2819513, address: "桃園市蘆竹區南崁" },
    { id: "way-183001662", name: "林口國中", category: "school", latitude: 25.0770334, longitude: 121.3771228, address: "新北市林口區民治路25號" },
    { id: "way-182688791", name: "麗林國小", category: "school", latitude: 25.0683973, longitude: 121.3685137, address: "新北市林口區公園路46號" },
    { id: "node-9741206307", name: "樂善國小", category: "school", latitude: 25.0519917, longitude: 121.3843066, address: "桃園市龜山區樂學三路" },
    { id: "way-1310794583", name: "文青國中小", category: "school", latitude: 25.0449991, longitude: 121.3910210, address: "桃園市龜山區樂善二路778號" },
  ];
  for (const poi of supplementalPois) {
    if (seen.has(poi.id)) continue;
    seen.add(poi.id);
    pois.push(poi);
  }
  return pois.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "zh-Hant"));
}

function haversineMeters(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function nearestPoi(projectLocation, pois, category) {
  const candidates = pois
    .filter((poi) => poi.category === category)
    .map((poi) => ({ poi, distanceMeters: Math.round(haversineMeters(projectLocation, poi)) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (!candidates.length) return null;
  const { poi, distanceMeters } = candidates[0];
  return { ...poi, distanceMeters, walkMinutes: Math.max(1, Math.ceil(distanceMeters / 80)) };
}

function categoryScore(distanceMeters, rule) {
  if (!Number.isFinite(distanceMeters)) return 0;
  return rule.bands.find(([limit]) => distanceMeters <= limit)?.[1] || 0;
}

function gradeFor(score) {
  if (score >= 80) return "非常便利";
  if (score >= 65) return "便利";
  if (score >= 45) return "基本足夠";
  return "機能較少";
}

async function main() {
  await mkdir(cacheDirectory, { recursive: true });
  const projectDataset = await readJson(projectsPath, null);
  const locations = await geocodeProjects(projectDataset.projects);
  const pois = normalizePois(await loadOverpass());
  const projects = {};

  for (const project of projectDataset.projects) {
    const location = locations[project.id];
    const nearest = Object.fromEntries(Object.keys(categories).map((category) => [category, nearestPoi(location, pois, category)]));
    const score = scoreRules.reduce((total, rule) => total + categoryScore(nearest[rule.category]?.distanceMeters, rule), 0);
    projects[project.id] = { location, score, grade: gradeFor(score), nearest };
  }

  const payload = {
    generatedAt,
    source: {
      name: "OpenStreetMap contributors",
      url: "https://www.openstreetmap.org/copyright",
      license: "ODbL",
      service: "Nominatim 與 Overpass API",
    },
    methodology: {
      distance: "兩點間直線距離",
      walkingMetersPerMinute: 80,
      disclaimer: "距離與步行時間為直線距離換算，未考慮實際道路、坡度、圍牆、紅綠燈與出入口，不可當作導航時間。",
      locationDisclaimer: "建案位置依官方申報地址查找；地址僅到道路或路口時，位置會標示為估算，不代表精確基地界址。",
      scoreRules,
    },
    categories,
    poiCount: pois.length,
    pois,
    projects,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const counts = Object.keys(categories).map((category) => `${categories[category].label} ${pois.filter((poi) => poi.category === category).length}`).join("、");
  console.log(`完成：${projectDataset.projects.length} 個建案，${pois.length} 個設施（${counts}）`);
  console.log(`輸出：${outputPath}`);
}

await main();
