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
  assert.match(html, /官方資料 40 案/);
  assert.match(html, /建案地圖/);
  assert.match(html, /搜尋建案、建商、路段/);
  assert.match(html, /品質查核/);
  assert.match(html, /有成交資料/);
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

  assert.equal(Object.keys(dataset.projects).length, 40);
  assert.ok(dataset.pois.length >= 200);
  assert.equal(dataset.source.name, "OpenStreetMap contributors");
  assert.ok(Object.values(dataset.projects).every((project) => project.score >= 0 && project.score <= 100));
  assert.ok(Object.values(dataset.projects).every((project) => project.location.confidence));
});

test("processed data has the intended scope and explicit unknown states", async () => {
  const raw = await readFile(new URL("../data/processed/projects.json", import.meta.url), "utf8");
  const dataset = JSON.parse(raw);
  const regions = new Set(dataset.projects.map((project) => project.region));

  assert.equal(dataset.projects.length, 40);
  assert.deepEqual([...regions].sort(), ["A7", "林口"]);
  assert.equal(dataset.projects.filter((project) => project.price).length, 21);
  assert.ok(dataset.projects.every((project) => project.qualityStatus === "尚未查核"));
  assert.ok(dataset.projects.every((project) => project.registryNumber));
});
