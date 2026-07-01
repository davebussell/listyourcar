/* ============================================================
   listyourcar.ca — THE SHOOT PLANNER
   The single-player hook: occasion → style → city & date → budget
   in four taps, out comes a production-grade call sheet — light
   windows, shot list, matched picture cars, crew, and a budget.
   Free to use; saving plans is the signup moment (freemium).
   Depends on data.js (D), store.js (Store), app.js helpers ($, $$,
   fmtPrice, cityName, titleOf, carImage, qs).
   ============================================================ */

/* ---------- Golden-hour engine (NOAA sunrise equation) ----------
   Pure math, no API. Returns UTC hours for the sun crossing a given
   zenith angle on a date at lat/lon; null in polar edge cases. */
function sunCrossingUT(date, lat, lon, zenith, rising) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const N = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const lngHour = lon / 15;
  const t = N + (((rising ? 6 : 18) - lngHour) / 24);
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA += (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null; // sun never crosses this zenith today
  let H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
  H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  let UT = T - lngHour;
  UT = ((UT % 24) + 24) % 24;
  return UT;
}

/* Full light table for a date + city. All values are epoch ms (UTC). */
function lightTable(dateStr, city) {
  const date = new Date(dateStr + "T12:00:00Z");
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const at = (zenith, rising) => {
    const ut = sunCrossingUT(date, city.lat, city.lon, zenith, rising);
    return ut == null ? null : base + ut * 3600000;
  };
  return {
    dawn: at(96, true),          // civil dawn — blue hour begins
    sunrise: at(90.833, true),
    goldenAmEnd: at(84, true),   // sun reaches ~6° — morning gold ends
    goldenPmStart: at(84, false),
    sunset: at(90.833, false),
    dusk: at(96, false),         // civil dusk — blue hour ends
  };
}
function fmtClock(ms, tz) {
  if (ms == null) return "—";
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(ms));
}

/* ---------- Plan state + share links ---------- */
const PLAN_KEYS = ["o", "s", "c", "d", "b"]; // occasion, style, city, date, budget
function planFromQuery() {
  const p = qs();
  const st = {};
  PLAN_KEYS.forEach((k) => { const v = p.get(k); if (v) st[k] = v; });
  return st;
}
function planUrl(st) {
  const u = new URL("plan.html", location.href);
  PLAN_KEYS.forEach((k) => { if (st[k]) u.searchParams.set(k, st[k]); });
  return u.toString();
}
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/* ---------- Matching ---------- */
function matchCars(st) {
  const style = D.STYLES.find((x) => x.id === st.s);
  const rank = (l) => {
    const ci = style ? style.cats.indexOf(l.category) : 0;
    return (ci === -1 ? 9 : ci) * 10 + (l.city === st.c ? 0 : 5);
  };
  const pool = Store.allListings().filter((l) =>
    l.shootReady && (l.occasions || []).includes(st.o) &&
    (!style || style.cats.includes(l.category)));
  pool.sort((a, b) => rank(a) - rank(b) || a.dailyRate - b.dailyRate);
  // Ensure variety: at most 2 per category in the top picks
  const picks = [], perCat = {};
  for (const l of pool) {
    if ((perCat[l.category] || 0) >= 2) continue;
    picks.push(l); perCat[l.category] = (perCat[l.category] || 0) + 1;
    if (picks.length === 3) break;
  }
  return picks;
}
function matchPhotographers(st) {
  const pool = (D.PHOTOGRAPHERS || []).filter((p) => (p.styles || []).includes(st.o));
  pool.sort((a, b) => (a.city === st.c ? 0 : 1) - (b.city === st.c ? 0 : 1) || a.rate - b.rate);
  const picks = pool.slice(0, 2);
  return picks.length ? picks : (D.PHOTOGRAPHERS || []).slice(0, 2);
}

/* ---------- Budget ---------- */
function planBudget(st, car, ph) {
  const tier = D.PLAN_TIERS.find((t) => t.id === st.b) || D.PLAN_TIERS[1];
  const round5 = (n) => Math.round(n / 5) * 5;
  const lines = [];
  if (!car) return { tier, lines, total: 0 };
  if (tier.parts.includes("car-half")) lines.push({ label: `${titleOf(car)} — half-day`, amt: round5(car.dailyRate * 0.6) });
  if (tier.parts.includes("car-full")) lines.push({ label: `${titleOf(car)} — full day`, amt: car.dailyRate });
  if (tier.parts.includes("ph") && ph) lines.push({ label: `${ph.name} — shoot day (10% bundle saving)`, amt: round5(ph.rate * 0.9) });
  if (tier.parts.includes("extras")) lines.push({ label: "Styling & location allowance", amt: 300 });
  const total = lines.reduce((s, l) => s + l.amt, 0);
  return { tier, lines, total, deposit: car.deposit || 0 };
}

/* ---------- Wizard ---------- */
function pagePlan() {
  const wrap = $("#plan-wrap");
  if (!wrap) return;
  const st = planFromQuery();
  if (!st.d) st.d = nextSaturday();
  if (!st.b) st.b = "signature";

  // Deep link with occasion+style+city → straight to the call sheet
  if (st.o && st.s && st.c) { renderSheet(wrap, st); return; }
  renderWizard(wrap, st);
}

function renderWizard(wrap, st) {
  const OCCS = D.OCCASIONS || [];
  const steps = [
    { key: "o", label: "Occasion" },
    { key: "s", label: "Style" },
    { key: "cd", label: "City & Date" },
    { key: "b", label: "Budget" },
  ];
  let step = st.o ? (st.s ? 2 : 1) : 0;

  function stepsBar() {
    return `<div class="pw-steps">${steps.map((s, i) =>
      `<button type="button" class="pw-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}" data-step="${i}" ${i > step ? "disabled" : ""}>
        <span class="pw-num">0${i + 1}</span>${s.label}</button>`).join('<span class="pw-sep"></span>')}</div>`;
  }

  function body() {
    if (step === 0) return `
      <h2 class="pw-q">What are we shooting?</h2>
      <div class="pw-grid" data-pick="o">
        ${OCCS.map((o) => `
          <button type="button" class="pw-opt ${st.o === o.id ? "sel" : ""}" data-v="${o.id}">
            <span class="pw-opt-img"><img src="${o.image}" alt="" loading="lazy" /></span>
            <span class="pw-opt-name">${o.emoji} ${o.name}</span>
            <span class="pw-opt-desc">${o.tagline}</span>
          </button>`).join("")}
      </div>`;
    if (step === 1) {
      const styles = [...D.STYLES].sort((a, b) =>
        (a.for.includes(st.o) ? 0 : 1) - (b.for.includes(st.o) ? 0 : 1));
      return `
      <h2 class="pw-q">Pick the look.</h2>
      <div class="pw-grid" data-pick="s">
        ${styles.map((s, i) => `
          <button type="button" class="pw-opt ${st.s === s.id ? "sel" : ""}" data-v="${s.id}">
            <span class="pw-opt-img"><img src="${s.image}" alt="" loading="lazy" />${i === 0 && s.for.includes(st.o) ? '<span class="pw-rec">Recommended</span>' : ""}</span>
            <span class="pw-opt-name">${s.emoji} ${s.name}</span>
            <span class="pw-opt-desc">${s.desc}</span>
          </button>`).join("")}
      </div>`;
    }
    if (step === 2) return `
      <h2 class="pw-q">Where, and when?</h2>
      <div class="pw-cities" data-pick="c">
        ${D.FILM_CITIES.map((cs) => `<button type="button" class="pw-city ${st.c === cs ? "sel" : ""}" data-v="${cs}">${cityName(cs)}</button>`).join("")}
      </div>
      <label class="pw-date">Shoot date
        <input type="date" id="pw-date" value="${st.d}" min="${new Date().toISOString().slice(0, 10)}" />
      </label>
      <p class="muted small">We'll compute your exact golden-hour windows for this date and city.</p>`;
    return `
      <h2 class="pw-q">How big are we going?</h2>
      <div class="pw-grid tiers" data-pick="b">
        ${D.PLAN_TIERS.map((t) => `
          <button type="button" class="pw-opt tier ${st.b === t.id ? "sel" : ""}" data-v="${t.id}">
            <span class="pw-tier-mark">${t.emoji}</span>
            <span class="pw-opt-name">${t.name}</span>
            <span class="pw-opt-desc">${t.desc}</span>
          </button>`).join("")}
      </div>`;
  }

  function paint() {
    wrap.innerHTML = `
      <div class="pw reveal is-visible">
        ${stepsBar()}
        ${body()}
        <div class="pw-foot">
          ${step > 0 ? '<button type="button" class="btn btn-ghost" id="pw-back">← Back</button>' : "<span></span>"}
          <button type="button" class="btn btn-primary" id="pw-next" ${canNext() ? "" : "disabled"}>
            ${step === steps.length - 1 ? "Build my call sheet →" : "Next →"}</button>
        </div>
      </div>`;
    wire();
  }
  function canNext() {
    if (step === 0) return !!st.o;
    if (step === 1) return !!st.s;
    if (step === 2) return !!st.c && !!st.d;
    return !!st.b;
  }
  function wire() {
    $$(".pw-grid .pw-opt, .pw-cities .pw-city", wrap).forEach((b) =>
      b.addEventListener("click", () => {
        const key = b.closest("[data-pick]").dataset.pick;
        st[key] = b.dataset.v;
        // picking an option auto-advances (except city, which pairs with date)
        if (key !== "c") { step = Math.min(step + 1, steps.length - 1); paint(); }
        else {
          $$(".pw-city", wrap).forEach((x) => x.classList.toggle("sel", x === b));
          $("#pw-next").disabled = !canNext();
        }
      }));
    $("#pw-date")?.addEventListener("change", (e) => { st.d = e.target.value; $("#pw-next").disabled = !canNext(); });
    $("#pw-back")?.addEventListener("click", () => { step = Math.max(0, step - 1); paint(); });
    $("#pw-next")?.addEventListener("click", () => {
      if (!canNext()) return;
      if (step < steps.length - 1) { step++; paint(); }
      else {
        history.replaceState(null, "", planUrl(st));
        renderSheet(wrap, st);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    $$(".pw-step", wrap).forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.step);
      if (i <= step) { step = i; paint(); }
    }));
  }
  paint();
}

/* ---------- The Call Sheet ---------- */
function sunArc(light, tz) {
  if (!light.sunrise || !light.sunset) return "";
  const day0 = light.dawn ?? light.sunrise, day1 = light.dusk ?? light.sunset;
  const span = day1 - day0;
  const pos = (ms) => Math.max(0, Math.min(100, ((ms - day0) / span) * 100));
  const seg = (a, b, cls) => a != null && b != null
    ? `<span class="sun-seg ${cls}" style="left:${pos(a)}%;width:${Math.max(0.5, pos(b) - pos(a))}%"></span>` : "";
  const tick = (ms, label) => ms != null
    ? `<span class="sun-tick" style="left:${pos(ms)}%"><i></i><em>${label}<br>${fmtClock(ms, tz)}</em></span>` : "";
  return `
    <div class="sun-arc" aria-hidden="true">
      <div class="sun-track">
        ${seg(light.dawn, light.sunrise, "blue")}
        ${seg(light.sunrise, light.goldenAmEnd, "gold")}
        ${seg(light.goldenPmStart, light.sunset, "gold")}
        ${seg(light.sunset, light.dusk, "blue")}
      </div>
      ${tick(light.sunrise, "Sunrise")}
      ${tick(light.goldenPmStart, "Golden")}
      ${tick(light.sunset, "Sunset")}
    </div>`;
}

function renderSheet(wrap, st) {
  const occ = (D.OCCASIONS || []).find((o) => o.id === st.o) || {};
  const style = (D.STYLES || []).find((s) => s.id === st.s) || {};
  const city = D.CITIES.find((c) => c.slug === st.c) || D.CITIES[0];
  const cars = matchCars(st);
  const phs = matchPhotographers(st);
  const budget = planBudget(st, cars[0], phs[0]);
  const light = lightTable(st.d, city);
  const tz = city.tz || "America/Toronto";
  const isPlus = Store.isPlus();
  const shots = (D.SHOT_LISTS[st.o] || []);
  const prodNo = "LYC-" + st.d.replace(/-/g, "").slice(2) + "-" + (st.c || "xx").slice(0, 2).toUpperCase();
  const dateLong = new Date(st.d + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  document.title = `${occ.name || "Shoot"} call sheet — ${city.name} | listyourcar.ca`;

  const carCard = (l, i) => `
    <a class="sheet-car ${i === 0 ? "lead" : ""}" href="listing.html?id=${encodeURIComponent(l.id)}">
      <span class="sheet-car-img"><img src="${carImage(l)}" alt="${titleOf(l)}" loading="lazy" /></span>
      <span class="sheet-car-body">
        ${i === 0 ? '<span class="sheet-tag">Picture car · first choice</span>' : `<span class="sheet-tag alt">Backup ${i}</span>`}
        <strong>${titleOf(l)}</strong>
        <span class="muted small">${cityName(l.city)}${l.city !== st.c ? " · travels" : ""} · ${fmtPrice(l.dailyRate)}/day</span>
      </span>
    </a>`;
  const phCard = (p, i) => `
    <div class="sheet-ph">
      ${phAvatar(p)}
      <div class="grow">
        <strong>${p.name}</strong> <span class="ph-verified">✓ Verified</span>
        <div class="muted small">${p.specialty} · ${cityName(p.city)}${p.city !== st.c ? " · travels" : ""} · ${fmtPrice(p.rate)}/day</div>
      </div>
      <a class="btn btn-sm ${i === 0 ? "btn-primary" : "btn-outline"}" href="listing.html?id=${encodeURIComponent((cars[0] || {}).id || "")}&ph=${p.id}">Package</a>
    </div>`;

  const visibleShots = shots.filter((s) => !s.plus || isPlus);
  const lockedCount = shots.length - visibleShots.length;

  wrap.innerHTML = `
    <div class="sheet" id="callsheet">
      <header class="sheet-head">
        <div>
          <span class="sheet-stamp">Call sheet</span>
          <h1 class="sheet-title">${(occ.name || "Shoot").toUpperCase()} — ${(style.name || "").toUpperCase()}</h1>
          <p class="sheet-sub">${dateLong} · ${city.name}, ${city.province}</p>
        </div>
        <dl class="sheet-meta">
          <div><dt>Prod №</dt><dd>${prodNo}</dd></div>
          <div><dt>Occasion</dt><dd>${occ.emoji || ""} ${occ.name || "—"}</dd></div>
          <div><dt>Look</dt><dd>${style.emoji || ""} ${style.name || "—"}</dd></div>
          <div><dt>Tier</dt><dd>${budget.tier.name}</dd></div>
        </dl>
      </header>

      <div class="sheet-actions no-print">
        <button type="button" class="btn btn-primary" id="sheet-save">💾 Save this plan</button>
        <button type="button" class="btn btn-outline" id="sheet-share">🔗 Copy share link</button>
        <button type="button" class="btn btn-outline" onclick="window.print()">🖨 Print call sheet</button>
        <a class="btn btn-ghost" href="plan.html">↺ Start over</a>
      </div>

      <section class="sheet-section">
        <h2 class="sheet-h"><span>01</span> The light — ${city.name}, ${dateLong.split(",")[0]}</h2>
        ${sunArc(light, tz)}
        <div class="light-grid">
          <div class="light-cell"><dt>Blue hour (am)</dt><dd>${fmtClock(light.dawn, tz)} – ${fmtClock(light.sunrise, tz)}</dd></div>
          <div class="light-cell gold"><dt>Golden hour (am)</dt><dd>${fmtClock(light.sunrise, tz)} – ${fmtClock(light.goldenAmEnd, tz)}</dd></div>
          <div class="light-cell gold"><dt>Golden hour (pm)</dt><dd>${fmtClock(light.goldenPmStart, tz)} – ${fmtClock(light.sunset, tz)}</dd></div>
          <div class="light-cell"><dt>Blue hour (pm)</dt><dd>${fmtClock(light.sunset, tz)} – ${fmtClock(light.dusk, tz)}</dd></div>
        </div>
        <p class="muted small">Call time tip: crew on location <strong>45 minutes before golden hour</strong> — walk the angles while the light is still flat.</p>
      </section>

      <section class="sheet-section">
        <h2 class="sheet-h"><span>02</span> Picture cars</h2>
        ${cars.length ? `<div class="sheet-cars">${cars.map(carCard).join("")}</div>`
          : '<p class="muted">No matched cars yet — <a href="index.html">browse the lot</a>.</p>'}
      </section>

      <section class="sheet-section">
        <h2 class="sheet-h"><span>03</span> Crew</h2>
        <div class="sheet-crew">${phs.map(phCard).join("")}</div>
        <p class="muted small">Booking the car and the pro together saves 10% on the photographer.</p>
      </section>

      <section class="sheet-section">
        <h2 class="sheet-h"><span>04</span> Shot list — ${occ.name || ""}</h2>
        <ol class="shotlist">
          ${visibleShots.map((s) => `
            <li class="shot"><label><input type="checkbox" />
              <span class="shot-body"><strong>${s.t}</strong> <span class="shot-tag t-${s.tag}">${s.tag}</span><br><span class="muted small">${s.d}</span></span>
            </label></li>`).join("")}
        </ol>
        ${lockedCount ? `
          <button type="button" class="shot-locked no-print" id="unlock-shots">
            🔒 ${lockedCount} more advanced shots — night looks, motion passes — in <strong>Plus</strong>. Unlock →
          </button>` : ""}
      </section>

      <section class="sheet-section">
        <h2 class="sheet-h"><span>05</span> Budget — ${budget.tier.name}</h2>
        <div class="budget">
          ${budget.lines.map((l) => `<div class="pkg-line"><span>${l.label}</span><span>${fmtPrice(l.amt)}</span></div>`).join("")}
          <div class="pkg-total"><span>Estimated total</span><span>${fmtPrice(budget.total)}</span></div>
          ${budget.deposit ? `<p class="muted small">+ ${fmtPrice(budget.deposit)} refundable deposit on the car.</p>` : ""}
        </div>
        <div class="sheet-book no-print">
          ${cars[0] ? `<a class="btn btn-primary" href="listing.html?id=${encodeURIComponent(cars[0].id)}${budget.tier.parts.includes("ph") && phs[0] ? "&ph=" + phs[0].id : ""}">Book this shoot →</a>` : ""}
          <span class="muted small">Inquiry-based — we confirm the car${budget.tier.parts.includes("ph") ? " and the photographer" : ""} for your date.</span>
        </div>
      </section>

      <footer class="sheet-foot">
        <span>listyourcar.ca — the shoot planner</span><span>${prodNo}</span>
      </footer>
    </div>`;

  // ---- Actions ----
  $("#sheet-share")?.addEventListener("click", async (e) => {
    const url = planUrl(st);
    try { await navigator.clipboard.writeText(url); e.target.textContent = "✓ Link copied"; }
    catch { prompt("Copy your plan link:", url); }
    setTimeout(() => { e.target.textContent = "🔗 Copy share link"; }, 2200);
  });
  $("#sheet-save")?.addEventListener("click", () => savePlanFlow(st, occ, style, city, budget));
  $("#unlock-shots")?.addEventListener("click", () => plusModal(() => renderSheet(wrap, st)));
}

/* ---------- Freemium: signup + upgrade modals ---------- */
function accountModal(onDone) {
  const acc = Store.account();
  if (acc) { onDone(acc); return; }
  const dlg = document.createElement("dialog");
  dlg.className = "lyc-modal";
  dlg.innerHTML = `
    <form method="dialog">
      <span class="eyebrow">Free account</span>
      <h3>Save your call sheet</h3>
      <p class="muted">One free account keeps your plan — and lets you share it with your photographer, partner or crew.</p>
      <label>Name<input name="name" required placeholder="Your name" /></label>
      <label>Email<input type="email" name="email" required placeholder="you@example.com" /></label>
      <div class="hero-actions">
        <button class="btn btn-primary" value="go">Create free account</button>
        <button class="btn btn-ghost" value="cancel" formnovalidate>Not now</button>
      </div>
      <p class="muted small">Free: 1 saved plan · Plus: unlimited plans + the extended shot library.</p>
    </form>`;
  document.body.appendChild(dlg);
  // Act on the form's submit (not the dialog close event — not fired
  // reliably in every embedder for method="dialog" submissions).
  dlg.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "go") {
      const f = new FormData(e.target);
      onDone(Store.saveAccount({ name: f.get("name"), email: f.get("email") }));
    }
    setTimeout(() => dlg.remove(), 0);
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
function plusModal(onUpgraded) {
  const dlg = document.createElement("dialog");
  dlg.className = "lyc-modal";
  dlg.innerHTML = `
    <form method="dialog">
      <span class="eyebrow">Plus</span>
      <h3>Go Plus — free during beta</h3>
      <ul class="checklist">
        <li>Unlimited saved plans</li>
        <li>The extended shot library — night looks, motion passes</li>
        <li>Outreach templates for owners &amp; photographers</li>
        <li>Priority on car + photographer packages</li>
      </ul>
      <p class="plan-price" style="margin:.25rem 0 1rem">$9 <span>/month · $0 during beta</span></p>
      <div class="hero-actions">
        <button class="btn btn-primary" value="go">Unlock Plus</button>
        <button class="btn btn-ghost" value="cancel" formnovalidate>Maybe later</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  dlg.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "go") {
      if (!Store.account()) Store.saveAccount({ name: "Creator", email: "" });
      Store.saveAccount({ tier: "plus" });
      onUpgraded && onUpgraded();
    }
    setTimeout(() => dlg.remove(), 0);
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
function savePlanFlow(st, occ, style, city, budget) {
  accountModal(() => {
    const existing = Store.plans();
    if (existing.length >= 1 && !Store.isPlus()) { plusModal(() => savePlanFlow(st, occ, style, city, budget)); return; }
    Store.addPlan({
      ...st,
      title: `${occ.name || "Shoot"} — ${style.name || ""}`.trim(),
      cityName: city.name, total: budget.total, url: planUrl(st),
    });
    const btn = $("#sheet-save");
    if (btn) { btn.textContent = "✓ Saved to dashboard"; btn.disabled = true; }
  });
}

window.pagePlan = pagePlan;
