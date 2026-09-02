#!/usr/bin/env node
/* ============================================================
   listyourcar.ca — full postal code geocoder for rural dealers

   Rural forward sortation areas (a "0" in the second position, like
   J0X or T0C) are not neighbourhoods; they are regions, often more
   than 100 km across. Placing a dealer at the FSA centroid put the
   median rural rooftop 60 km from its town, and the worst ones 250+.

   The full six-character code pins a rural address to the village.
   OpenStreetMap resolves most of them, so this script asks once per
   distinct rural code, at the polite rate the service requires, and
   caches the answer in data/postal-coords.json for build-dealers.js.
   Urban codes are left alone — at neighbourhood level the FSA
   centroid is already as precise as the map needs.

     node build-postal.js          # fills in anything not yet cached

   Every answer is validated before it is kept: the service must echo
   the same postal code back, and the point must land inside Canada.
   A near-miss fuzzy match is worse than no match, because the city
   fallback would have been right.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "data");
const RAW = path.join(DIR, "dealers-raw.json");
const OUT = path.join(DIR, "postal-coords.json");

const UA = { "User-Agent": "listyourcar.ca/1.0 (https://listyourcar.ca; hello@listyourcar.ca) build-postal" };
const PAUSE_MS = 1100;            // the service asks for at most one request a second

const norm = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
const isRural = (code) => /^[A-Z]0[A-Z]\d[A-Z]\d$/.test(code);
const inCanada = (la, lo) => la >= 41 && la <= 83.5 && lo >= -141.5 && lo <= -52;

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
const dealers = Array.isArray(raw) ? raw : (raw.dealers || Object.values(raw)[0]);
const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const codes = [...new Set(dealers.map((d) => norm(d.z)).filter(isRural))].sort();
const todo = codes.filter((c) => !(c in cache));
console.log("rural codes:", codes.length, "| cached:", codes.length - todo.length, "| to fetch:", todo.length);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(code) {
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
    postalcode: code.slice(0, 3) + " " + code.slice(3),
    country: "Canada", format: "json", limit: "1", addressdetails: "1",
  });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const hit = (await r.json())[0];
  if (!hit) return null;
  const a = hit.address || {};
  if (norm(a.postcode) !== code) return null;             // fuzzy match, not this code
  const lat = +hit.lat, lon = +hit.lon;
  if (!inCanada(lat, lon)) return null;
  return [+lat.toFixed(4), +lon.toFixed(4)];
}

(async () => {
  let hits = 0, misses = 0, errors = 0;
  for (let i = 0; i < todo.length; i++) {
    const code = todo[i];
    try {
      const c = await lookup(code);
      cache[code] = c;                                       // null is a remembered miss
      if (c) hits++; else misses++;
    } catch (e) {
      errors++;
      console.log("  " + code + " error: " + e.message);
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) {
      fs.writeFileSync(OUT, JSON.stringify(cache));         // checkpoint, so a crash keeps progress
      console.log("  " + (i + 1) + "/" + todo.length + "  hits " + hits + "  misses " + misses + "  errors " + errors);
    }
    await sleep(PAUSE_MS);
  }
  fs.writeFileSync(OUT, JSON.stringify(cache));
  const placed = codes.filter((c) => cache[c]).length;
  console.log("\nresolved " + placed + " of " + codes.length + " rural codes -> " + path.relative(__dirname, OUT));
})();
