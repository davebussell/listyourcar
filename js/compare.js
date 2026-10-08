/* ============================================================
   listyourcar.ca — compare any two dealers, and the dealer page's
   website profile and rivals

   compare.html?a=d12&b=d34 renders the same head-to-head as the
   static /compare/ pages (js/h2h.js), for any pair. With one or no
   dealer chosen it offers a picker, and suggests the obvious rivals.

   Wrapped in a function scope: classic scripts share one global
   scope, and a second top-level `esc` would break the page.
   ============================================================ */
(() => {
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const NOISE = new Set("of the de du des la le les et and on in at sales ventes motors motor auto autos automobiles automotive group groupe ltd ltee inc limited centre center dealership cars car new used city north south east west".split(" "));
  const tokens = (n) => fold(n).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !NOISE.has(t));

  /* Same business under another name: same group, same phone, or a
     shared distinctive word that isn't a make ("Gabriel", "Pattison"). */
  function sisters(a, b) {
    if (a.group && a.group === b.group) return true;
    const dg = (p) => String(p || "").replace(/\D/g, "").slice(-10);
    if (dg(a.phone) && dg(a.phone) === dg(b.phone)) return true;
    const makes = new Set([...a.brands, ...b.brands].map((m) => fold(m)));
    const ta = new Set(tokens(a.name).filter((t) => !makes.has(t)));
    return tokens(b.name).some((t) => ta.has(t) && !makes.has(t));
  }

  /* The closest rivals that sell what this dealer sells. */
  async function rivalsOf(d, n = 3) {
    const near = await DealerNet.ranked({ lat: d.lat, lon: d.lon }, {});
    return near.filter((x) => x.id !== d.id && x.role === "dealer" && !x.siteLost &&
      (d.brands.length ? x.brands.some((b) => d.brands.includes(b)) : !x.brands.length) && !sisters(d, x)).slice(0, n);
  }
  const compareHref = async (a, b) => {
    const idx = await DealerNet.h2hIndex();
    const hit = (idx[a.id] || []).find((p) => p[1] === b.name);
    return hit ? `/compare/${hit[0]}/` : `/compare.html?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`;
  };

  /* ---------- compare.html ---------- */
  async function pageCompare() {
    const host = document.getElementById("compare-root");
    if (!host) return;
    const p = new URLSearchParams(location.search);
    let a = null, b = null;
    try {
      [a, b] = await Promise.all([p.get("a") ? DealerNet.byId(p.get("a")) : null, p.get("b") ? DealerNet.byId(p.get("b")) : null]);
    } catch { host.innerHTML = `<p class="muted">We couldn't load the dealer network. Try again in a moment.</p>`; return; }

    if (a && b && a.id !== b.id) {
      // A published page for this pair is the one to share and index.
      const idx = await DealerNet.h2hIndex();
      const pub = (idx[a.id] || []).find((x) => x[1] === b.name);
      const [evA, evB] = await Promise.all([DealerNet.evidenceFor(a), DealerNet.evidenceFor(b)]);
      const car = window.Locator && Locator.car ? Locator.car() : null;
      const out = H2H.render(a, evA, b, evB, { car });
      document.title = `${a.name} vs ${b.name} — compared | listyourcar.ca`;
      const canon = document.querySelector('link[rel="canonical"]');
      if (canon && pub) canon.href = `https://listyourcar.ca/compare/${pub[0]}/`;
      host.innerHTML = `
        <nav class="crumbs"><a href="/compare/">Compare dealers</a> / ${esc(a.name)} vs ${esc(b.name)}</nav>
        <div class="page-head">
          <span class="eyebrow">Head to head${car && car.make ? " · for your " + esc([car.year, car.make].filter(Boolean).join(" ")) : ""}</span>
          <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
          <p class="lead narrow">Who's the better buyer for your car, and the better place to buy your next one, from what each store's own website says and what our network knows.${pub ? ` <a class="link-inline" href="/compare/${esc(pub[0])}/">Shareable page for this pair →</a>` : ""}</p>
          <p><a class="link" href="/compare.html?a=${esc(a.id)}">Compare ${esc(a.name)} with someone else</a> · <a class="link" href="/compare.html?a=${esc(b.id)}">Compare ${esc(b.name)} with someone else</a></p>
        </div>
        ${out.html}`;
      H2H.bind(host);
      return;
    }
    renderPicker(host, a);
  }

  /* Two search boxes. Picking both opens the comparison. */
  async function renderPicker(host, preset) {
    const all = (await DealerNet.all()).filter((x) => x.role === "dealer");
    const chosen = { a: preset || null, b: null };
    host.innerHTML = `
      <nav class="crumbs"><a href="/compare/">Compare dealers</a> / Any two</nav>
      <div class="page-head">
        <span class="eyebrow">Head to head</span>
        <h1>Compare any two dealers</h1>
        <p class="lead narrow">Pick two stores. We'll put them side by side as a buyer for your car and as a place to buy your next one, from their own websites and our dealer network.</p>
      </div>
      <div class="h2h-pickers">
        <div class="h2h-picker" data-side="a"></div>
        <div class="h2h-picker" data-side="b"></div>
      </div>
      <div id="h2h-suggest"></div>
      <p class="muted small" style="margin-top:2rem">Or browse <a class="link-inline" href="/compare/">every published head-to-head</a>.</p>`;

    const draw = (side) => {
      const box = host.querySelector(`.h2h-picker[data-side="${side}"]`);
      const d = chosen[side];
      if (d) {
        box.innerHTML = `<label>Dealer ${side.toUpperCase()}</label>
          <div class="h2h-picked"><span><strong>${esc(d.name)}</strong> <span class="muted">· ${esc(d.city)}, ${esc(d.province)}</span></span>
          <button type="button" class="link-btn" data-clear>Change</button></div>`;
        box.querySelector("[data-clear]").onclick = () => { chosen[side] = null; draw(side); suggest(); };
        return;
      }
      box.innerHTML = `<label for="pick-${side}">Dealer ${side.toUpperCase()}</label>
        <input id="pick-${side}" type="search" placeholder="Name or city, e.g. Toyota Calgary" autocomplete="off" />
        <ul></ul>`;
      const input = box.querySelector("input"), list = box.querySelector("ul");
      input.addEventListener("input", () => {
        const words = fold(input.value).split(/\s+/).filter(Boolean);
        if (!words.length) { list.innerHTML = ""; return; }
        const hits = all.filter((x) => { const hay = fold(x.name + " " + x.city + " " + x.brands.join(" ")); return words.every((w) => hay.includes(w)); })
          .filter((x) => !chosen.a || x.id !== chosen.a.id).slice(0, 8);
        list.innerHTML = hits.length ? hits.map((x) => `<li><button type="button" data-id="${esc(x.id)}">${esc(x.name)} <span>· ${esc(x.city)}, ${esc(x.province)}</span></button></li>`).join("")
          : `<li class="muted small">No dealer matches that.</li>`;
        list.querySelectorAll("button").forEach((btn) => btn.onclick = () => pick(side, all.find((x) => x.id === btn.dataset.id)));
      });
    };
    const pick = (side, d) => {
      chosen[side] = d;
      if (chosen.a && chosen.b) { location.href = `/compare.html?a=${encodeURIComponent(chosen.a.id)}&b=${encodeURIComponent(chosen.b.id)}`; return; }
      draw(side); suggest();
    };
    /* With one dealer chosen, its obvious rivals are one click away. */
    const suggest = async () => {
      const box = host.querySelector("#h2h-suggest");
      const one = chosen.a || chosen.b;
      if (!one) { box.innerHTML = ""; return; }
      const rivals = await rivalsOf(one, 5);
      const links = await Promise.all(rivals.map(async (r) => `<li><a href="${esc(await compareHref(one, r))}">${esc(one.name)} vs ${esc(r.name)}</a><span class="h2h-mk">${esc(r.brands.join(", ") || "Independent")}</span><span>${esc(r.city)}, ${esc(r.province)}</span></li>`));
      box.innerHTML = rivals.length ? `<h2 style="margin-top:2rem;font-size:1.25rem">Its closest rivals</h2><ul class="h2h-list">${links.join("")}</ul>` : "";
    };
    draw("a"); draw("b"); suggest();
  }

  /* ---------- Dealer page: what its own website says ---------- */
  const OFFER_LABEL = {
    cpo: "Certified pre-owned program", history: "Free vehicle history report", price: "Pricing policy",
    credit: "Help with credit", online: "Buy online", delivery: "Home delivery or test drives", warranty: "Extended or lifetime warranty",
    collision: "Collision centre", shuttle: "Shuttle", loaner: "Loaner cars", wash: "Car wash", tires: "Tire storage",
    express: "Express service", commercial: "Commercial / fleet department",
  };
  async function dealerSite(d) {
    const box = document.getElementById("dealer-site");
    if (!box) return;
    const ev = await DealerNet.evidenceFor(d);
    const f = ev && ev.f;
    const reg = H2H.REGULATOR[d.province];
    const links = `<p class="muted small">
      <a class="link-inline" href="${esc(H2H.reviewsUrl(d, f))}" target="_blank" rel="noopener nofollow">Read its Google reviews ↗</a>
      ${reg ? ` · Check its licence: <a class="link-inline" href="${esc(reg[1])}" target="_blank" rel="noopener">${esc(reg[0])} ↗</a>` : ""}</p>`;
    if (!f) {
      box.innerHTML = `<span class="eyebrow">From its website</span>
        <p class="muted">We haven't read this dealer's website in depth yet${d.web && d.web.read ? " — only its homepage, for the buyer's take below" : ""}. Profiles are added as we compare dealers head to head.</p>${links}`;
      return;
    }
    const facts = [];
    if (f.a) facts.push(["Address", `${esc(f.a.s)}<br>${esc(f.a.l)}${f.a.pc ? " " + esc(f.a.pc) : ""}`]);
    if (f.y) facts.push(["In business", `Since ${f.y.v} (${new Date().getFullYear() - f.y.v} years)${f.y.q ? `<span class="h2h-q">“${esc(f.y.q)}”</span>` : ""}`]);
    if (f.fam) facts.push(["Ownership", `Family-owned<span class="h2h-q">“${esc(f.fam.q)}”</span>`]);
    if (f.aw) facts.push(["Awards", f.aw.map((a) => esc(a.n)).join(", ") + (f.aw[0].q ? `<span class="h2h-q">“${esc(f.aw[0].q)}”</span>` : "")]);
    if (f.ln) facts.push(["Languages", esc(f.ln.v.join(", "))]);
    const s = H2H.hoursStats(f.h);
    if (s) facts.push(["Showroom", `${s.total} hours a week · ${s.evenings ? s.evenings + " weeknight" + (s.evenings > 1 ? "s" : "") + " to 8 pm or later" : "no late weeknights"} · ${s.sun ? "open Sundays" : "closed Sundays"}`]);
    const offers = Object.keys(OFFER_LABEL).filter((k) => f.o && f.o[k]);
    const week = f.h ? `<div class="table-scroll"><table class="cmp-table h2h-week"><thead><tr>${H2H.DAY.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead>
      <tbody><tr>${f.h.map((h) => `<td>${h ? H2H.span(h) : '<span class="cmp-no">Closed</span>'}</td>`).join("")}</tr></tbody></table></div>` : "";
    box.innerHTML = `<span class="eyebrow">From its website · read ${esc(f.c)}</span>
      <dl class="dealer-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${week}
      ${offers.length ? `<h3 style="margin:1.5rem 0 .25rem;font-size:1.0625rem">What it mentions offering</h3>
        <ul class="dealer-site-list">${offers.map((k) => `<li><strong>${OFFER_LABEL[k]}</strong>${f.o[k].q ? `<span class="h2h-q">“${esc(f.o[k].q)}”</span>` : ""}</li>`).join("")}</ul>` : ""}
      <p class="muted small" style="margin-top:1rem">In the dealer's own words, from ${f.pg.length} page${f.pg.length === 1 ? "" : "s"} of its site. Not mentioned doesn't mean not offered — ask.</p>
      ${links}`;
  }

  async function dealerRivals(d) {
    const box = document.getElementById("dealer-rivals");
    if (!box || d.role !== "dealer") { if (box) box.remove(); return; }
    const idx = await DealerNet.h2hIndex();
    const pub = idx[d.id] || [];
    const rivals = (await rivalsOf(d, 4)).filter((r) => !pub.some((p) => p[1] === r.name)).slice(0, 3);
    const items = pub.map((p) => `<li><a href="/compare/${esc(p[0])}/">${esc(d.name)} vs ${esc(p[1])}</a><span class="h2h-mk">${esc(p[2])}</span><span>Full head-to-head</span></li>`)
      .concat(rivals.map((r) => `<li><a href="/compare.html?a=${esc(d.id)}&amp;b=${esc(r.id)}">${esc(d.name)} vs ${esc(r.name)}</a><span class="h2h-mk">${esc(r.brands.join(", ") || "Independent")}</span><span>${esc(r.city)}</span></li>`));
    box.innerHTML = `<span class="eyebrow">Head to head</span>
      <h3 style="margin:.4rem 0 .25rem;font-size:1.25rem">Compare it with its rivals</h3>
      <p class="muted">As a buyer for your car and as a place to buy your next one.</p>
      ${items.length ? `<ul class="h2h-list">${items.join("")}</ul>` : ""}
      <p style="margin-top:.75rem"><a class="link" href="/compare.html?a=${esc(d.id)}">Compare with any dealer →</a></p>`;
  }

  window.pageCompare = pageCompare;
  window.dealerExtras = (d) => { dealerSite(d).catch(() => {}); dealerRivals(d).catch(() => {}); };
})();
