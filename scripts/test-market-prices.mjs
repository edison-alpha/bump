import assert from "node:assert/strict";
import { test } from "node:test";
import { priceStatus, pricesInWindow } from "../modules/market/price-data.ts";
import { usdPrice, signedPct } from "../lib/format.ts";

test("a healthy market cannot make a missing, paused, expired, or future-dated market live", () => {
  const now = 1_800_000_000_000;
  assert.equal(priceStatus(undefined, now, false), "unavailable");
  assert.equal(priceStatus(undefined, now, true), "loading");
  assert.equal(priceStatus({ price: 10, at: now, ok: true }, now, false), "live");
  assert.equal(priceStatus({ price: 10, at: now, ok: false }, now, false), "stale");
  assert.equal(priceStatus({ price: 10, at: now - 20_001, ok: true }, now, false), "stale");
  assert.equal(priceStatus({ price: 10, at: now + 60_000, ok: true }, now, false), "stale");
  for (const price of [NaN, Infinity, 0, -1]) assert.equal(priceStatus({ price, at: now, ok: true }, now, false), "unavailable");
});

test("chart windows contain only recorded samples, with no fake history or invalid points", () => {
  assert.deepEqual(pricesInWindow([], 100_000, 1000, 60), []);
  assert.deepEqual(pricesInWindow([
    { at: 10_000, price: 1 }, { at: 50_000, price: 2 }, { at: 90_000, price: 3 },
    { at: 95_000, price: NaN }, { at: 101_000, price: 4 },
  ], 100_000, 1000, 60), [2, 3]);
});

test("missing prices and changes never render NaN, Infinity, or a made-up zero", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(usdPrice(value), "…");
    assert.equal(signedPct(value), "…");
  }
});
