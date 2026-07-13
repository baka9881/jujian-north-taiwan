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
  assert.match(html, /40<!-- --> 筆官方建案/);
  assert.match(html, /林口＋A7 官方建案第一版/);
  assert.match(html, /品質尚未查核/);
  assert.match(html, /內政部預售屋建案備查資料/);
  assert.match(html, /Google 地圖/);
  assert.match(html, /依官方道路文字定位，非基地界址/);
  assert.doesNotMatch(html, /class="map-marker/);
  assert.doesNotMatch(html, /匿名示範資料|綜合表現/);
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
