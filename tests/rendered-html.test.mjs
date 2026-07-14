import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the verified Linkou and A7 catalogue", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>居鑑｜北台灣建案履歷<\/title>/);
  assert.match(html, /官方資料 (?:<!-- -->)?42(?:<!-- -->)? 案/);
  assert.match(html, /建案地圖/);
  assert.match(html, /搜尋建案、建商、路段/);
  assert.match(html, /品質查核/);
  assert.match(html, /(?:3[7-9]|40)(?:<!-- -->)? 案有成交資料/);
  assert.match(html, /尚無成交/);
  assert.match(html, /隱藏清單/);
  assert.match(html, /生活機能/);
  assert.match(html, /data-map-engine="leaflet"/);
  assert.doesNotMatch(html, /class="map-project-card"/);
  assert.match(html, /lang="zh-Hant-TW"/);
  assert.match(html, /滾輪縮放 · 拖曳移動/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /maps\/search\/|target="_blank"[^>]*>[^<]*(?:地圖|放大)/);
  assert.doesNotMatch(html, /匿名示範資料|綜合表現/);
});

test("processed amenity data is scored and source-labelled", async () => {
  const raw = await readFile(new URL("../data/processed/amenities.json", import.meta.url), "utf8");
  const dataset = JSON.parse(raw);

  assert.equal(Object.keys(dataset.projects).length, 42);
  assert.ok(dataset.pois.length >= 350);
  assert.equal(dataset.source.name, "OpenStreetMap contributors");
  assert.equal(Object.keys(dataset.categories).length, 10);
  assert.ok(["market", "park", "pharmacy", "parking"].every((category) => dataset.categories[category]));
  assert.equal(dataset.routeCoverage.routedProjects, 31);
  assert.equal(dataset.routeCoverage.unavailableLocationProjects, 11);
  assert.deepEqual(Object.keys(dataset.methodology.profiles).sort(), ["balanced", "driver", "family", "student"]);
  assert.ok(Object.values(dataset.projects).every((project) => project.score === null || (project.score >= 0 && project.score <= 100)));
  assert.ok(Object.values(dataset.projects).every((project) => project.location.confidence));
  assert.equal(Object.values(dataset.projects).filter((project) => project.scoreReliability === "verified").length, 17);
  assert.equal(Object.values(dataset.projects).filter((project) => project.scoreReliability === "unavailable").length, 11);
  assert.ok(Object.values(dataset.projects).filter((project) => project.location.confidence === "estimated").every((project) => project.score === null));
  assert.equal(Object.values(dataset.projects).filter((project) => project.location.method === "nlsc-official-intersection").length, 16);
  assert.ok(Object.values(dataset.projects).filter((project) => project.score !== null).every((project) => Object.keys(project.categoryScores).length === 10));
  assert.ok(Object.values(dataset.projects).filter((project) => project.score !== null).every((project) => Object.values(project.nearest).every((nearest) => !nearest || nearest.routes.walking)));
  assert.match(dataset.methodology.peakDisclaimer, /不是即時路況/);
});

test("quality evidence records all current official-source reviews without overclaiming", async () => {
  const raw = await readFile(new URL("../data/processed/quality-evidence.json", import.meta.url), "utf8");
  const dataset = JSON.parse(raw);
  const projects = Object.values(dataset.projects);
  const events = projects.flatMap((project) => project.events);

  assert.equal(projects.length, 42);
  assert.equal(dataset.summary.queuedCount, 0);
  assert.equal(dataset.summary.reviewedCount, 42);
  assert.equal(dataset.summary.publishedEventCount, 7);
  assert.equal(dataset.summary.defectEventCount, 0);
  assert.equal(dataset.summary.contractEventCount, 7);
  assert.equal(dataset.summary.verifiedLocationCount, 17);
  assert.equal(dataset.summary.approximateLocationCount, 14);
  assert.equal(dataset.summary.awaitingParcelCount, 11);
  assert.ok(projects.every((project) => project.status === "reviewed"));
  assert.equal(events.length, 7);
  assert.ok(events.every((event) => event.level === "A"));
  assert.ok(events.every((event) => event.category === "契約查核"));
  assert.ok(events.every((event) => event.eventType === "contract"));
  assert.ok(projects.every((project) => project.defectEventCount === 0));
  assert.ok(projects.every((project) => project.defectReview.categories.length === 7));
  assert.equal(events.filter((event) => event.outcome === "符合").length, 6);
  assert.equal(events.filter((event) => event.outcome === "部分不符合").length, 1);
  assert.ok(events.every((event) => /施工|漏水/.test(event.limitation)));
  assert.match(dataset.projects["a7-06-08ce9d"].events[0].summary, /房地面積誤差及其價款找補/);
  assert.equal(dataset.projects["a7-12-ae84ab"].events.length, 0);
  assert.match(dataset.projects["a7-12-ae84ab"].sourceChecks.find((check) => check.sourceId === "judicial").note, /不是漏水或施工瑕疵/);
  assert.equal(dataset.projects["a7-10-e86850"].sourceChecks.find((check) => check.sourceId === "judicial").status, "ambiguous-query");
  assert.ok(projects.every((project) => project.locationReview.parcel?.officialMapUrl.startsWith("https://maps.nlsc.gov.tw/goland/")));
  assert.ok(dataset.methodology.noEventDisclaimer.includes("不代表建案沒有漏水或施工問題"));
  assert.match(dataset.methodology.defectPublishRule, /建案、問題類型與發生事實/);
});

test("processed data has the intended scope and explicit unknown states", async () => {
  const raw = await readFile(new URL("../data/processed/projects.json", import.meta.url), "utf8");
  const dataset = JSON.parse(raw);
  const regions = new Set(dataset.projects.map((project) => project.region));

  assert.equal(dataset.projects.length, 42);
  assert.deepEqual([...regions].sort(), ["A7", "林口"]);
  assert.ok(dataset.projects.filter((project) => project.price).length >= 37);
  assert.ok(dataset.projects.filter((project) => project.region === "A7" && project.price).length >= 17);
  assert.ok(dataset.projects.filter((project) => project.region === "A7" && project.priceEvidence?.status === "official-no-match").length <= 3);
  assert.ok(dataset.priceCoverage.a7OfficialRecordsReviewed >= 8000);
  assert.equal(dataset.priceCoverage.historyFrom, "112S1");
  assert.ok(dataset.projects.filter((project) => project.price).every((project) => project.price.count > 0));
  assert.ok(dataset.projects.filter((project) => project.region === "A7" && project.price).every((project) => project.price.source.includes("歷史季度＋本期")));
  assert.ok(dataset.projects.every((project) => project.registryNumber));
  assert.equal(new Set(dataset.projects.map((project) => project.sourceKey)).size, dataset.projects.length);
});

test("safe update report records safeguards and keeps historical backlog separate", async () => {
  const raw = await readFile(new URL("../data/processed/update-report.json", import.meta.url), "utf8");
  const report = JSON.parse(raw);

  assert.equal(report.summary.catalogueAfter, 42);
  assert.equal(report.summary.ambiguousCount, 0);
  assert.equal(report.summary.missingFromCurrentSourceCount, 0);
  assert.ok(report.summary.historicalBacklogCount >= 70);
  assert.equal(report.pipeline.status, "complete");
  assert.equal(report.pipeline.totalProjects, 42);
  assert.ok(report.safeguards.some((item) => item.includes("不會") && item.includes("刪除")));
});

test("filter controls stay above Leaflet map layers", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const filterLayer = Number(css.match(/\.filter-bar \{[^}]*z-index:(\d+)/)?.[1]);
  const headerLayer = Number(css.match(/\.site-header \{[^}]*z-index:(\d+)/)?.[1]);

  assert.ok(filterLayer > 1000);
  assert.ok(headerLayer > filterLayer);
  assert.match(css, /\.advanced-filter-panel \{[^}]*max-height:calc\(100dvh - 150px\)/);
});

test("map project markers keep fixed coordinates while zooming", async () => {
  const source = await readFile(new URL("../app/InteractiveMap.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /map\.on\("zoomend", renderMarkers\)/);
  assert.doesNotMatch(source, /containerPointToLatLng/);
  assert.match(source, /leaflet\.marker\(point,/);
});

test("detail interface separates defect evidence and supports route-based custom amenity weights", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /實際瑕疵與契約查核/);
  assert.match(source, /契約違規不會被當成漏水證據/);
  assert.match(source, /調整各項權重/);
  assert.match(source, /routeTimeText\(nearest\)/);
  assert.match(source, /平日 8 時/);
});
