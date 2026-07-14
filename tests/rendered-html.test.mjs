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
  assert.match(html, /點選建案切換地圖/);
  assert.match(html, /生活機能/);
  assert.match(html, /data-map-engine="leaflet"/);
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
  assert.ok(dataset.pois.length >= 200);
  assert.equal(dataset.source.name, "OpenStreetMap contributors");
  assert.ok(Object.values(dataset.projects).every((project) => project.score === null || (project.score >= 0 && project.score <= 100)));
  assert.ok(Object.values(dataset.projects).every((project) => project.location.confidence));
  assert.equal(Object.values(dataset.projects).filter((project) => project.scoreReliability === "verified").length, 17);
  assert.equal(Object.values(dataset.projects).filter((project) => project.scoreReliability === "unavailable").length, 11);
  assert.ok(Object.values(dataset.projects).filter((project) => project.location.confidence === "estimated").every((project) => project.score === null));
  assert.equal(Object.values(dataset.projects).filter((project) => project.location.method === "nlsc-official-intersection").length, 16);
});

test("quality evidence records preserve unknown states and official review links", async () => {
  const raw = await readFile(new URL("../data/processed/quality-evidence.json", import.meta.url), "utf8");
  const dataset = JSON.parse(raw);
  const projects = Object.values(dataset.projects);

  assert.equal(projects.length, 42);
  assert.equal(dataset.summary.queuedCount, 42);
  assert.equal(dataset.summary.publishedEventCount, 0);
  assert.equal(dataset.summary.verifiedLocationCount, 17);
  assert.equal(dataset.summary.approximateLocationCount, 14);
  assert.equal(dataset.summary.awaitingParcelCount, 11);
  assert.ok(projects.every((project) => project.status === "queued"));
  assert.ok(projects.every((project) => project.events.length === 0));
  assert.ok(projects.every((project) => project.locationReview.parcel?.officialMapUrl.startsWith("https://maps.nlsc.gov.tw/goland/")));
  assert.ok(dataset.methodology.noEventDisclaimer.includes("不代表建案沒有漏水或施工問題"));
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
  assert.ok(dataset.projects.every((project) => project.qualityStatus === "尚未查核"));
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
