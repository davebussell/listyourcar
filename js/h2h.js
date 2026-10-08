/* ============================================================
   listyourcar.ca — head-to-head dealer comparisons

   Two dealerships, side by side, from both ends of the deal. Someone
   selling a car is usually buying the next one, so every comparison
   asks two questions:

     Who is the better buyer for my car?
     Who is the better place to buy my next one?

   and then the one that ties them together: trading in where you buy
   usually saves sales tax, so a cash offer elsewhere has to beat the
   trade-in by that much to be worth taking.

   Every row is a stated fact — from the dealer's own website (with
   the words and the page), or from our network data — and a row only
   names a winner when one side has something the other doesn't say.
   Nothing here judges price, honesty or service: those aren't in the
   data, and the page says so and points to where to look.

   Runs in the browser (head-to-head.html, dealer pages) and in Node
   (build-seo.js writes the static head-to-head pages), so the two
   never disagree. Needs DealerNet (js/dealers.js) loaded first.
   ============================================================ */

const H2H = (() => {
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const Net = () => (typeof window !== "undefined" && window.DealerNet) || (typeof global !== "undefined" && global.window && global.window.DealerNet);
  const THIS_YEAR = new Date().getFullYear();

  /* ---------- Hours ---------- */
  const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const clock = (m) => {
    const h = Math.floor(m / 60) % 24, mm = m % 60;
    const h12 = h % 12 || 12;
    return h12 + (mm ? ":" + String(mm).padStart(2, "0") : "") + (h < 12 ? " am" : " pm");
  };
  function hoursStats(h) {
    if (!h) return null;
    let total = 0, evenings = 0;
    h.forEach((d, i) => {
      if (!d) return;
      total += d[1] - d[0];
      if (i < 5 && d[1] >= 20 * 60) evenings++;
    });
    return { total: Math.round(total / 60), evenings, sat: h[5], sun: h[6] };
  }
  const span = (d) => (d ? clock(d[0]) + "–" + clock(d[1]) : "Closed");

  /* ---------- Sales tax on a dealer purchase ----------
     The combined rate charged on a car bought from a dealer, which in
     every province applies to the price minus the trade-in. BC's PST
     rises on cars over $55,000; the common rate is shown. */
  const TAX = {
    ON: [13, "HST"], QC: [14.975, "GST and QST"], BC: [12, "GST and PST"], AB: [5, "GST"],
    SK: [11, "GST and PST"], MB: [12, "GST and RST"], NS: [14, "HST"], NB: [15, "HST"],
    NL: [15, "HST"], PE: [15, "HST"],
  };
  const PROV_NAME = { ON: "Ontario", QC: "Quebec", BC: "British Columbia", AB: "Alberta", SK: "Saskatchewan",
    MB: "Manitoba", NS: "Nova Scotia", NB: "New Brunswick", NL: "Newfoundland and Labrador", PE: "Prince Edward Island" };

  /* Where to check a dealer's licence, by province (links checked when written). */
  const REGULATOR = {
    ON: ["OMVIC dealer search", "https://www.omvic.ca/dealer-search/"],
    BC: ["Vehicle Sales Authority search", "https://vsabc.ca/dealer-wholesaler/search-a-dealership-or-salesperson/"],
    AB: ["AMVIC licence search", "https://www.amvic.org/"],
    QC: ["Office de la protection du consommateur", "https://www.opc.gouv.qc.ca/se-renseigner"],
  };
  const reviewsUrl = (d, f) => "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent([d.name, f && f.a ? f.a.s : "", f && f.a ? f.a.l : d.city, d.province].filter(Boolean).join(" "));

  /* ---------- What each side has ---------- */
  const OFFER_LABEL = {
    collision: "Collision centre", shuttle: "Shuttle", loaner: "Loaner cars", wash: "Car wash",
    tires: "Tire storage", express: "Express service", commercial: "Commercial / fleet department",
  };
  const has = (f, k) => !!(f && f.o && f.o[k]);
  const q = (f, k) => (f && f.o && f.o[k] ? f.o[k].q : "");

  /* A cell: what to show, a value to compare, and whether the side was checked. */
  const YES = (text, quote) => ({ html: `<span class="cmp-yes">${esc(text || "Yes")}</span>${quote ? `<span class="h2h-q">“${esc(quote)}”</span>` : ""}`, v: 1 });
  const NOT = (checked, word) => ({ html: `<span class="cmp-unk">${checked ? (word || "Not stated on its site") : "Site not read"}</span>`, v: checked ? 0 : null });

  function facts(d, ev) {
    const f = ev && ev.f ? ev.f : null;
    return { d, ev: ev || null, f, read: !!(d.web && d.web.read), deep: !!f };
  }

  /* Who wins a row: the higher value, if both sides are known and they differ by at least `by`. */
  function winner(a, b, by = 1, lowerWins = false) {
    if (a.v == null || b.v == null) return null;
    const diff = lowerWins ? b.v - a.v : a.v - b.v;
    if (Math.abs(diff) < by) return null;
    return diff > 0 ? "a" : "b";
  }

  function rowsFor(A, B, car) {
    const N = Net();
    const ta = N.buyerTake(A.d, car), tb = N.buyerTake(B.d, car);
    const sections = [];
    const row = (label, ca, cb, win, help) => ({ label, a: ca, b: cb, win, help });

    /* 1. Selling or trading in */
    {
      const take = (t) => ({ html: `<span class="take-chip take-${t.tier}">${t.label}</span><span class="h2h-q">${esc(t.summary)}</span>`, v: t.score });
      const buys = (X) => (X.d.web && X.d.web.buys ? YES("Yes", X.ev && X.ev.e && X.ev.e.buys) : NOT(X.read));
      const page = (X) => {
        const p = X.ev && X.ev.p && X.ev.p[0];
        return X.d.web && X.d.web.page
          ? { html: p ? `<a class="link-inline" href="${esc(p.u)}" rel="nofollow noopener" target="_blank">${esc(p.l || "Their page")} ↗</a>` : `<span class="cmp-yes">Yes</span>`, v: 1 }
          : NOT(X.read);
      };
      const appraise = (X) => {
        const w = X.d.web || {};
        if (w.tool) return YES((X.ev && X.ev.e && X.ev.e.tool) || "Online valuation tool");
        if (w.trade) return YES("Yes", X.ev && X.ev.e && X.ev.e.trade);
        return NOT(X.read);
      };
      const reach = (X) => (X.d.group ? { html: `${esc(X.d.group)} group`, v: 1 }
        : X.d.sites >= 2 ? { html: "Several locations", v: 1 } : { html: "Single store", v: 0 });
      const cA = take(ta), cB = take(tb);
      sections.push({
        key: "sell", title: "Selling or trading in your car",
        intro: "Which store is likelier to want your car, and to make buying it easy.",
        rows: [
          row("Buyer's take", cA, cB, winner(cA, cB, 8), "Our score for how likely a dealer is to want a car, from what it says and sells."),
          row("Says it buys cars from the public", buys(A), buys(B), winner(buys(A), buys(B))),
          row("A page for selling or trading in", page(A), page(B), winner(page(A), page(B))),
          row("Online appraisal", appraise(A), appraise(B), winner(appraise(A), appraise(B))),
          row("Lots it can place your car on", reach(A), reach(B), winner(reach(A), reach(B)), "A group can move a trade to whichever of its stores sells it best, which helps the offer."),
        ],
      });
    }

    /* 2. Buying your next car */
    {
      const makes = (X) => ({ html: X.d.brands.length ? esc(X.d.brands.join(", ")) : "Independent", v: null });
      const cpo = (X) => (X.d.web && X.d.web.cpo ? YES("Yes", X.ev && X.ev.e && X.ev.e.cpo) : has(X.f, "cpo") ? YES("Yes", q(X.f, "cpo")) : NOT(X.read || X.deep));
      const used = (X) => (X.d.web && X.d.web.used ? YES("Yes", X.ev && X.ev.e && X.ev.e.used) : NOT(X.read));
      const offer = (k, X) => (has(X.f, k) ? YES("Yes", q(X.f, k)) : NOT(X.deep));
      const onlineOrHome = (X) => {
        if (has(X.f, "online") && has(X.f, "delivery")) return YES("Online and home delivery", q(X.f, "online"));
        if (has(X.f, "online")) return YES("Buy online", q(X.f, "online"));
        if (has(X.f, "delivery")) return YES("Home delivery", q(X.f, "delivery"));
        return NOT(X.deep);
      };
      const r = [
        row("New makes it sells", makes(A), makes(B), null),
        row("Certified pre-owned program", cpo(A), cpo(B), winner(cpo(A), cpo(B)), "Inspected used cars with a manufacturer warranty."),
        row("Used inventory on its site", used(A), used(B), winner(used(A), used(B))),
        row("Pricing policy", offer("price", A), offer("price", B), winner(offer("price", A), offer("price", B)), "No-haggle, upfront or transparent pricing, in its own words."),
        row("Free vehicle history report", offer("history", A), offer("history", B), winner(offer("history", A), offer("history", B))),
        row("Help with credit", offer("credit", A), offer("credit", B), winner(offer("credit", A), offer("credit", B)), "Says it finances buyers with bruised or no credit."),
        row("Buy online or at home", onlineOrHome(A), onlineOrHome(B), winner(onlineOrHome(A), onlineOrHome(B))),
        row("Extended or lifetime warranty", offer("warranty", A), offer("warranty", B), winner(offer("warranty", A), offer("warranty", B))),
      ];
      sections.push({ key: "buy", title: "Buying your next car", intro: "What each store offers someone buying from it, as its own website puts it.", rows: r });
    }

    /* 3. Visiting and owning */
    {
      const ha = hoursStats(A.f && A.f.h), hb = hoursStats(B.f && B.f.h);
      // Hours we couldn't find are unknown, not zero: no winner against them.
      const noHours = (X) => ({ html: `<span class="cmp-unk">${X.deep ? "Hours not found" : "Site not read"}</span>`, v: null });
      const hrs = (s, X) => (s ? { html: `${s.total} hours`, v: s.total } : noHours(X));
      const eve = (s, X) => (s ? { html: s.evenings ? `${s.evenings} weeknight${s.evenings > 1 ? "s" : ""} to 8 pm or later` : "None", v: s.evenings } : noHours(X));
      const day = (d, s, X) => (s ? { html: d ? span(d) : `<span class="cmp-no">Closed</span>`, v: d ? 1 : 0 } : noHours(X));
      const extras = (X) => {
        const list = Object.keys(OFFER_LABEL).filter((k) => has(X.f, k));
        return list.length ? { html: list.map((k) => OFFER_LABEL[k]).join(", "), v: list.length } : NOT(X.deep, "None mentioned");
      };
      const langs = (X) => {
        const l = X.f && X.f.ln ? X.f.ln.v : null;
        if (l && l.length) return { html: esc(l.join(", ")), v: l.length };
        if (X.d.french) return { html: "French and English", v: 2 };
        return { html: `<span class="cmp-unk">Not stated</span>`, v: null };
      };
      sections.push({
        key: "own", title: "Visiting, and living with the car",
        intro: "When you can get there, and what the service side offers once you own the car.",
        rows: [
          row("Showroom hours a week", hrs(ha, A), hrs(hb, B), winner(hrs(ha, A), hrs(hb, B), 3)),
          row("Weeknight hours", eve(ha, A), eve(hb, B), winner(eve(ha, A), eve(hb, B))),
          row("Saturday", day(ha && ha.sat, ha, A), day(hb && hb.sat, hb, B), winner(day(ha && ha.sat, ha, A), day(hb && hb.sat, hb, B))),
          row("Sunday", day(ha && ha.sun, ha, A), day(hb && hb.sun, hb, B), winner(day(ha && ha.sun, ha, A), day(hb && hb.sun, hb, B))),
          row("Service extras mentioned", extras(A), extras(B), winner(extras(A), extras(B), 2)),
          row("Languages", langs(A), langs(B), null),
        ],
      });
    }

    /* 4. The business */
    {
      const since = (X) => {
        const y = X.f && X.f.y;
        // No year stated is unknown — never "year 0", which would win "longest-running".
        return y ? { html: `${y.v} <span class="h2h-q">${THIS_YEAR - y.v} years${y.q ? ` · “${esc(y.q)}”` : ""}</span>`, v: y.v }
          : { html: `<span class="cmp-unk">${X.deep ? "Not stated" : "Site not read"}</span>`, v: null };
      };
      const fam = (X) => (X.f && X.f.fam ? YES("Yes", X.f.fam.q) : NOT(X.deep, "Not stated"));
      const awards = (X) => {
        const a = X.f && X.f.aw;
        return a && a.length ? { html: a.map((x) => `<span class="cmp-yes">${esc(x.n)}</span>`).join(" ") + (a[0].q ? `<span class="h2h-q">“${esc(a[0].q)}”</span>` : ""), v: a.length }
          : NOT(X.deep, "None mentioned");
      };
      const size = (X) => ({ html: N.SIZE_LABEL[X.d.size] || "—", v: null });
      const sA = since(A), sB = since(B);
      sections.push({
        key: "biz", title: "The business behind it",
        intro: "Track record and recognition. Older isn't automatically better, but a long-running store has a reputation it's protecting.",
        rows: [
          row("In business since", sA, sB, winner(sA, sB, 5, true)),
          row("Family-owned", fam(A), fam(B), null),
          row("Awards it mentions", awards(A), awards(B), winner(awards(A), awards(B))),
          row("Size", size(A), size(B), null),
        ],
      });
    }

    sections.forEach((s) => {
      s.score = { a: s.rows.filter((r) => r.win === "a").length, b: s.rows.filter((r) => r.win === "b").length };
      s.winner = s.score.a > s.score.b ? "a" : s.score.b > s.score.a ? "b" : null;
    });
    return { sections, ta, tb };
  }

  /* The verdict: who to sell to, who to buy from, and how the two connect. */
  function verdict(A, B, sections, ta, tb) {
    const by = Object.fromEntries(sections.map((s) => [s.key, s]));
    const sell = by.sell.winner || (ta.score - tb.score >= 8 ? "a" : tb.score - ta.score >= 8 ? "b" : null);
    const buyScore = { a: by.buy.score.a + by.own.score.a + by.biz.score.a, b: by.buy.score.b + by.own.score.b + by.biz.score.b };
    const buy = buyScore.a > buyScore.b ? "a" : buyScore.b > buyScore.a ? "b" : null;
    const name = (k) => (k === "a" ? A.d.name : B.d.name);
    let text;
    if (sell && buy && sell === buy) {
      text = `${name(sell)} comes out ahead on both sides: the likelier buyer for your car, and more on offer for buying your next one. If its offer on your car is fair, one visit can do both, and trading in where you buy usually saves sales tax.`;
    } else if (sell && buy) {
      text = `Split decision. ${name(sell)} looks the stronger buyer for your car; ${name(buy)} offers more to someone buying. Get ${name(sell)}'s written offer for your car, then ask ${name(buy)} to match it as a trade-in on the car you buy there. Because trading in saves sales tax, a matched trade-in beats the same cash offer.`;
    } else if (sell) {
      text = `${name(sell)} looks the stronger buyer for your car. On the buying side the two are level on what their sites say, so let the price of the car you want decide, and get ${name(sell)}'s offer on yours first.`;
    } else if (buy) {
      text = `They're level as buyers of your car on what their sites say, so get a written offer from both. ${name(buy)} offers more to someone buying their next car.`;
    } else {
      text = "Too close to call on what their websites say. Get a written offer for your car from each, and a price on the car you want, and let the numbers decide.";
    }
    return { sell, buy, text };
  }

  /* ---------- Rendering ---------- */
  function headCard(X, side, t) {
    const d = X.d, f = X.f;
    const tel = d.phone ? d.phone.replace(/[^0-9+]/g, "") : "";
    const site = d.website ? "https://" + d.website.replace(/^https?:\/\//, "") : "";
    const addr = f && f.a ? `${esc(f.a.s)}, ${esc(f.a.l)}${f.a.pc ? " " + esc(f.a.pc) : ""}` : `${esc(d.city)}, ${esc(d.province)}${d.postal ? " " + esc(d.postal) : ""}`;
    // Today's hours only where "today" is real: in the browser, not on a page built in advance.
    const today = f && f.h && typeof document !== "undefined" ? (() => { const i = (new Date().getDay() + 6) % 7; return `${DAY[i]}: ${span(f.h[i])}`; })() : "";
    return `<div class="h2h-card h2h-${side}">
      <span class="h2h-side">${side === "a" ? "A" : "B"}</span>
      <h2 class="h2h-name"><a href="/dealer.html?id=${esc(d.id)}">${esc(d.name)}</a></h2>
      <p class="h2h-addr">${addr}</p>
      <p class="h2h-chip"><span class="take-chip take-${t.tier}">${t.label} as a buyer</span></p>
      <ul class="h2h-contact">
        ${tel ? `<li><a href="tel:${esc(tel)}">${esc(d.phone)}</a></li>` : ""}
        ${site ? `<li><a href="${esc(site)}" target="_blank" rel="noopener nofollow">${esc(d.website.replace(/^www\./, ""))} ↗</a></li>` : ""}
        ${today ? `<li class="muted">${esc(today)}</li>` : ""}
        <li><a href="${esc(reviewsUrl(d, f))}" target="_blank" rel="noopener nofollow">Read its Google reviews ↗</a></li>
      </ul>
    </div>`;
  }

  function weekTable(A, B) {
    if (!(A.f && A.f.h) && !(B.f && B.f.h)) return "";
    const cell = (X, i) => (X.f && X.f.h ? (X.f.h[i] ? span(X.f.h[i]) : `<span class="cmp-no">Closed</span>`) : `<span class="cmp-unk">—</span>`);
    return `<div class="table-scroll"><table class="cmp-table h2h-week">
      <thead><tr><th>Showroom</th>${DAY.map((d) => `<th scope="col">${d}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><th scope="row">${esc(A.d.name)}</th>${DAY.map((_, i) => `<td>${cell(A, i)}</td>`).join("")}</tr>
        <tr><th scope="row">${esc(B.d.name)}</th>${DAY.map((_, i) => `<td>${cell(B, i)}</td>`).join("")}</tr>
      </tbody></table></div>`;
  }

  function sectionHTML(s, A, B, n) {
    const tally = s.winner ? `<span class="h2h-tally">${esc(s.winner === "a" ? A.d.name : B.d.name)} ${Math.max(s.score.a, s.score.b)}–${Math.min(s.score.a, s.score.b)}</span>`
      : `<span class="h2h-tally h2h-even">Even${s.score.a ? ` ${s.score.a}–${s.score.b}` : ""}</span>`;
    const rows = s.rows.map((r) => `<tr>
        <th scope="row">${esc(r.label)}${r.help ? `<span class="h2h-help">${esc(r.help)}</span>` : ""}</th>
        <td class="${r.win === "a" ? "h2h-win" : ""}">${r.a.html}</td>
        <td class="${r.win === "b" ? "h2h-win" : ""}">${r.b.html}</td>
      </tr>`).join("");
    return `<section class="h2h-section" id="h2h-${s.key}">
      <div class="h2h-sec-head"><span class="index">${String(n).padStart(2, "0")}</span><div><h2>${esc(s.title)}</h2><p class="muted">${esc(s.intro)}</p></div>${tally}</div>
      <div class="table-scroll"><table class="cmp-table h2h-table">
        <thead><tr><th></th><th scope="col">${esc(A.d.name)}</th><th scope="col">${esc(B.d.name)}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </section>`;
  }

  function tradeBox(A, B) {
    const p = A.d.province === B.d.province ? A.d.province : "";
    const t = TAX[p];
    if (!t) return "";
    const eg = 15000, save = Math.round(eg * t[0] / 100);
    return `<section class="h2h-trade" data-rate="${t[0]}">
      <span class="eyebrow">Selling and buying</span>
      <h2>What trading in here is worth</h2>
      <p class="muted">In ${esc(PROV_NAME[p])}, ${esc(t[1])} on a dealer sale is charged on the price minus your trade-in. So trading in at the store you buy from saves ${t[0]}% of the trade-in's value in tax: on a $${eg.toLocaleString("en-CA")} trade-in, about $${save.toLocaleString("en-CA")}. A cash offer for your car from anyone else has to beat the trade-in by that much to leave you better off.</p>
      <label class="h2h-calc">Your car's trade-in offer <span class="h2h-calc-in">$<input type="number" min="0" step="500" inputmode="numeric" value="${eg}" data-h2h-trade /></span></label>
      <p class="h2h-calc-out" data-h2h-out>Tax saved by trading in: <strong>$${save.toLocaleString("en-CA")}</strong>. To beat it, a cash offer must be over <strong>$${(eg + save).toLocaleString("en-CA")}</strong>.</p>
      <p class="muted small">${p === "BC" ? "BC's PST is higher on cars priced over $55,000. " : ""}Rates as of 2026. Confirm with the dealer, and see what your car is worth with a <a class="link-inline" href="/start.html?path=value">free Smart Estimate</a> before you take any offer.</p>
    </section>`;
  }

  /* "/our-dealership/about-us/" -> "about us" */
  const pageName = (u) => {
    try {
      const last = decodeURIComponent(new URL(u).pathname).replace(/\/+$/, "").split("/").pop();
      return last.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ") || "page";
    } catch { return "page"; }
  };
  function sourcesHTML(A, B) {
    const one = (X) => {
      const pages = X.f && X.f.pg ? X.f.pg : [];
      const reg = REGULATOR[X.d.province];
      return `<div><h3>${esc(X.d.name)}</h3>
        <p class="muted small">${X.deep ? `We read ${pages.length} page${pages.length === 1 ? "" : "s"} of its website on ${esc(X.f.c)}: ${pages.map((u, i) => `<a class="link-inline" href="${esc(u)}" target="_blank" rel="nofollow noopener">${i === 0 ? "home" : esc(pageName(u))}</a>`).join(", ")}.`
          : X.read ? "We read its homepage. A deeper profile is coming." : "We couldn't read its website, so its rows use our network data only."}
        ${reg ? ` Check its licence: <a class="link-inline" href="${esc(reg[1])}" target="_blank" rel="noopener">${esc(reg[0])} ↗</a>.` : ""}</p>
      </div>`;
    };
    return `<section class="h2h-sources"><h2>Where this comes from</h2><div class="h2h-src-grid">${one(A)}${one(B)}</div>
      <p class="muted small">A winner is only named for a row when one dealer says something the other doesn't. A store's website not mentioning something doesn't mean it doesn't offer it — ask. This comparison says nothing about prices, how a store treats its customers, or how its service department does the work. For that, read each one's reviews and ask people who've bought there.</p></section>`;
  }

  /* The whole comparison. `ctx` = { car, intro } */
  function render(dA, evA, dB, evB, ctx = {}) {
    const A = facts(dA, evA), B = facts(dB, evB);
    const { sections, ta, tb } = rowsFor(A, B, ctx.car || null);
    const v = verdict(A, B, sections, ta, tb);
    const pick = (k) => (k ? esc(k === "a" ? A.d.name : B.d.name) : "Even");
    return {
      verdict: v, sections,
      html: `<div class="h2h">
        <div class="h2h-heads">${headCard(A, "a", ta)}<span class="h2h-vs" aria-hidden="true">vs</span>${headCard(B, "b", tb)}</div>
        <section class="h2h-verdict">
          <div class="h2h-picks">
            <div><span class="eyebrow">To sell your car</span><strong>${pick(v.sell)}</strong></div>
            <div><span class="eyebrow">To buy your next car</span><strong>${pick(v.buy)}</strong></div>
          </div>
          <p>${esc(v.text)}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/start.html?path=dealers">Send my car to both</a>
            <a class="btn btn-ghost" href="/start.html?path=value">What's my car worth?</a>
          </div>
        </section>
        ${sections.map((s, i) => sectionHTML(s, A, B, i + 1)).join("")}
        ${weekTable(A, B)}
        ${tradeBox(A, B)}
        ${sourcesHTML(A, B)}
      </div>`,
    };
  }

  /* The calculator on a rendered comparison. Safe to call more than once. */
  function bind(root) {
    const scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope) return;
    scope.querySelectorAll(".h2h-trade").forEach((box) => {
      const input = box.querySelector("[data-h2h-trade]"), out = box.querySelector("[data-h2h-out]");
      if (!input || !out || input.dataset.bound) return;
      input.dataset.bound = "1";
      const rate = +box.dataset.rate;
      const upd = () => {
        const v = Math.max(0, +input.value || 0), save = Math.round(v * rate / 100);
        out.innerHTML = `Tax saved by trading in: <strong>$${save.toLocaleString("en-CA")}</strong>. To beat it, a cash offer must be over <strong>$${(v + save).toLocaleString("en-CA")}</strong>.`;
      };
      input.addEventListener("input", upd);
    });
  }

  return { render, bind, hoursStats, span, TAX, REGULATOR, reviewsUrl, DAY };
})();

if (typeof window !== "undefined") window.H2H = H2H;
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => H2H.bind());
  else H2H.bind();
}
