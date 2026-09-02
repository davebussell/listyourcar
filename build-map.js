#!/usr/bin/env node
/* ============================================================
   listyourcar.ca — map builder

   Turns Natural Earth province outlines into a small set of SVG paths
   the browser can draw directly. No mapping library, no tile server:
   a tile layer would mean thousands of hotlinked requests per visit to
   a service we do not control, and hotlinking has already bitten this
   site once. This ships one ~50KB file we own.

   Source: Natural Earth 1:50m admin-1 states and provinces.
   Natural Earth is public domain — no attribution required, though it
   is credited on /credits.html anyway.

     node build-map.js

   Output: data/canada-map.json
     proj       projection constants, so the client can place a dealer
                at the same spot the coastline was drawn
     viewBox    the drawing surface the paths were fitted to
     provinces  [{code, name, d, labelX, labelY}]
   ============================================================ */

const fs = require("fs");
const path = require("path");

const SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lakes.geojson";
const DIR = path.join(__dirname, "data");
const CACHE = path.join(DIR, ".ne-cache.geojson");

/* ---------- Lambert Conformal Conic ----------
   The standard choice for a country far wider than it is tall. Two
   standard parallels keep scale honest across the populated south
   rather than smearing the east and west coasts apart the way Mercator
   would. Constants are the ones Canada's own agencies use. */
const PROJ = { phi1: 49, phi2: 77, lon0: -95, phi0: 49 };

const rad = Math.PI / 180;
const N = (() => {
  const { phi1, phi2 } = PROJ;
  return Math.log(Math.cos(phi1 * rad) / Math.cos(phi2 * rad)) /
    Math.log(Math.tan(Math.PI / 4 + phi2 * rad / 2) / Math.tan(Math.PI / 4 + phi1 * rad / 2));
})();
const F = Math.cos(PROJ.phi1 * rad) * Math.pow(Math.tan(Math.PI / 4 + PROJ.phi1 * rad / 2), N) / N;
const RHO0 = F / Math.pow(Math.tan(Math.PI / 4 + PROJ.phi0 * rad / 2), N);

function lcc(lat, lon) {
  const rho = F / Math.pow(Math.tan(Math.PI / 4 + lat * rad / 2), N);
  let dl = (lon - PROJ.lon0) * rad * N;
  return [rho * Math.sin(dl), RHO0 - rho * Math.cos(dl)];
}

/* ---------- Douglas-Peucker ---------- */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  /* A closed ring starts and ends on the same point, so the baseline is
     degenerate and every perpendicular distance would compute as zero —
     which silently flattens the whole ring to a line. Fall back to plain
     distance from that point so the farthest vertex still splits it. */
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len < 1e-9
      ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
      : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1),
          ...simplify(pts.slice(idx), tol)];
}

const ringArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    a += (r[j][0] * r[i][1]) - (r[i][0] * r[j][1]);
  return Math.abs(a / 2);
};

/* ---------- Load ---------- */
async function source() {
  if (fs.existsSync(CACHE)) {
    console.log("using cached Natural Earth data");
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  }
  console.log("downloading Natural Earth 1:50m admin-1 …");
  const r = await fetch(SRC);
  if (!r.ok) throw new Error("download failed: HTTP " + r.status);
  const j = await r.json();
  const ca = j.features.filter((f) => f.properties.adm0_a3 === "CAN");
  const out = { type: "FeatureCollection", features: ca };
  fs.writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

(async () => {
  const geo = await source();
  console.log("provinces and territories:", geo.features.length);

  /* Project every ring first so tolerances are in drawing units. */
  const feats = geo.features.map((f) => {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    const rings = [];
    for (const poly of polys) {
      // outer ring only; interior holes are lakes we do not draw
      const r = poly[0].map(([lon, lat]) => lcc(lat, lon));
      rings.push(r);
    }
    return {
      code: f.properties.postal || f.properties.iso_3166_2.replace("CA-", ""),
      name: f.properties.name.replace("Québec", "Quebec"),
      rings,
    };
  });

  /* Fit everything to a 1000-wide canvas. */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of feats) for (const r of f.rings) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const W = 1000;
  const scale = W / (maxX - minX);
  const H = Math.round((maxY - minY) * scale);
  const tx = (x) => (x - minX) * scale;
  /* Projected y grows northward, SVG y grows downward. Flip, or the
     country is drawn upside down — which reads as plausible geometry
     until you notice Toronto is above the treeline. */
  const ty = (y) => (maxY - y) * scale;

  /* Simplify in canvas units, and drop specks. An island smaller than
     this is under a pixel on screen; keeping it costs bytes and buys
     nothing. The threshold is low enough to keep PEI and Cape Breton. */
  const TOL = 0.45;
  const MIN_AREA = 1.2;
  /* The territories hold 11 of 4,441 dealers but almost half the
     vertices, nearly all of it Arctic island coastline. They are
     context here, not targets, so they are drawn coarser. */
  const COARSE = new Set(["NU", "NT", "YT"]);

  let kept = 0, dropped = 0, ptsIn = 0, ptsOut = 0;
  const provinces = feats.map((f) => {
    const coarse = COARSE.has(f.code);
    const tol = coarse ? TOL * 5 : TOL;
    const minArea = coarse ? MIN_AREA * 12 : MIN_AREA;
    const parts = [];
    let biggest = null, biggestArea = 0;
    for (const ring of f.rings) {
      const canvas = ring.map(([x, y]) => [tx(x), ty(y)]);
      ptsIn += canvas.length;
      const s = simplify(canvas, tol);
      const area = ringArea(s);
      if (area < minArea) { dropped++; continue; }
      kept++; ptsOut += s.length;
      parts.push(s);
      if (area > biggestArea) { biggestArea = area; biggest = s; }
    }
    const d = parts.map((r) =>
      "M" + r.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join("L") + "Z").join("");
    // Label at the centroid of the largest landmass, not of all parts —
    // otherwise Quebec's label drifts into Hudson Bay.
    const c = biggest
      ? biggest.reduce((a, p) => [a[0] + p[0] / biggest.length, a[1] + p[1] / biggest.length], [0, 0])
      : [0, 0];
    return { code: f.code, name: f.name, d, labelX: +c[0].toFixed(1), labelY: +c[1].toFixed(1) };
  });

  const payload = {
    /* Enough for the client to place a point exactly where the
       coastline was drawn:  x = (px - minX) * scale
                             y = (maxY - py) * scale   (note the flip) */
    proj: { ...PROJ, n: N, f: F, rho0: RHO0, scale, minX, maxY },
    viewBox: [0, 0, W, H],
    provinces,
    source: "Natural Earth 1:50m (public domain)",
    built: new Date().toISOString().slice(0, 10),
  };

  const out = path.join(DIR, "canada-map.json");
  fs.writeFileSync(out, JSON.stringify(payload));

  console.log("rings kept  :", kept, "| dropped as specks:", dropped);
  console.log("points      :", ptsIn, "->", ptsOut,
    "(" + Math.round(100 - ptsOut / ptsIn * 100) + "% smaller)");
  console.log("viewBox     : 0 0", W, H);
  console.log(out.replace(__dirname + path.sep, "") + " :",
    (fs.statSync(out).size / 1024).toFixed(0), "KB");
})();
