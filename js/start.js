/* ============================================================
   listyourcar.ca — the start flow

   One entry point, two doors:

     value    "What's it worth?"   car -> answer
     dealers  "Get dealers bidding" car -> where -> pick dealers
                                    -> details -> send

   A car typed on the home page carries in through the URL, so a
   seller who arrives with one skips straight past the car screen.
   Location and car are shared with the header chip (Locator), so
   whatever is set here follows the seller round the site.

   Sending: the export behind the dealer network has phone numbers
   and websites but no email addresses, and this site has no mail
   server. So the seller sends from their own email app, with the
   message written for them. A dealer with an address on file (see
   build-dealers.js, data/dealer-emails.json) is emailed in one click;
   every other dealer gets copy-paste, their contact page, and their
   phone number. A dealer only counts as contacted when the seller
   says so — nothing is marked sent that we cannot see was sent.
   ============================================================ */

const StartFlow = (() => {
  const KEY = "lyc_flow";
  const PATHS = {
    value: ["car", "result"],
    dealers: ["car", "where", "dealers", "details", "send"],
  };
  const CONDITIONS = [["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["needs-work", "Needs work"]];

  const $f = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-CA");
  const kmFmt = (n) => Number(n).toLocaleString("en-CA") + " km";
  const shortPlace = (p) => String(p || "").replace(/\s*\([^)]*\)/g, "").trim();
  const track = (e, p) => { try { window.Analytics && Analytics.track(e, p || {}); } catch { /* never block the flow */ } };

  /* ---------- State ---------- */

  const blank = () => ({
    path: null,
    car: { year: "", make: "", model: "", mileage: "", condition: "good" },
    origin: null,
    selected: [],
    seller: { name: "", email: "", phone: "" },
    floor: "", notes: "",
    requestId: null,
  });
  let S = blank();
  let step = null;

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }
  function restore() {
    try { const v = JSON.parse(sessionStorage.getItem(KEY)); if (v && v.car) S = { ...blank(), ...v, car: { ...blank().car, ...v.car } }; }
    catch { /* start clean */ }
  }

  const carKnown = () => !!(S.car.year && S.car.make && S.car.model);
  const carLabel = () => [S.car.year, S.car.make, S.car.model].filter(Boolean).join(" ");
  const steps = () => PATHS[S.path] || [];

  function estimate() {
    if (!carKnown() || !window.LYC_VAL) return null;
    return LYC_VAL.estimateValue({
      year: S.car.year, make: S.car.make, model: S.car.model,
      mileage: S.car.mileage || "", condition: S.car.condition || "good",
    });
  }

  /* ---------- Navigation ---------- */

  function firstStep() {
    if (!S.path) return "choose";
    const list = steps();
    // A car typed on the home page skips the car screen.
    return carKnown() ? list[1] : list[0];
  }

  function go(next, { push = true } = {}) {
    step = next;
    save();
    if (push) history.pushState({ step: next, path: S.path }, "", location.pathname + location.search + "#" + next);
    render();
    const h = $f("#flow h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function nextStep() {
    const list = steps(), i = list.indexOf(step);
    return list[i + 1] || null;
  }
  function prevStep() {
    const list = steps(), i = list.indexOf(step);
    return i > 0 ? list[i - 1] : "choose";
  }

  /* ---------- Frame ---------- */

  function frame(inner, { wide = false } = {}) {
    const list = steps();
    const i = list.indexOf(step);
    const progress = i >= 0
      ? `<div class="flow-progress" aria-hidden="true"><i style="width:${((i + 1) / list.length * 100).toFixed(1)}%"></i></div>
         <p class="flow-k">${S.path === "value" ? "What's it worth" : "Get dealers bidding"} · Step ${i + 1} of ${list.length}</p>`
      : "";
    const back = step !== "choose"
      ? `<button type="button" class="link-btn flow-back" id="flow-back">← Back</button>` : "";
    return `<div class="flow-inner${wide ? " is-wide" : ""}">${progress}${inner}<div class="flow-foot">${back}</div></div>`;
  }

  /* ---------- Steps ---------- */

  const RENDER = {
    choose() {
      return frame(`
        <h1>What would you like to do?</h1>
        <p class="lead">Either way it starts with your car, and takes about a minute.</p>
        <div class="sf-paths flow-paths">
          <button type="button" class="sf-path" data-path="value">
            <span class="sf-k">01</span><strong>What's it worth?</strong>
            <span>A free estimate in seconds: what a dealer would offer on trade, and what bidding should get you.</span>
          </button>
          <button type="button" class="sf-path is-primary" data-path="dealers">
            <span class="sf-k">02</span><strong>Get dealers bidding</strong>
            <span>Pick the dealers near you who buy your kind of car, and send them your car in one go.</span>
          </button>
        </div>`);
    },

    car() {
      const c = S.car;
      return frame(`
        <h1>What are you selling?</h1>
        <form class="flow-form" id="flow-car" novalidate>
          <div class="flow-row flow-row-3">
            <label class="flow-f"><span>Year</span><input name="year" type="number" inputmode="numeric" min="1950" max="2027" placeholder="2018" value="${esc(c.year)}" required /></label>
            <label class="flow-f"><span>Make</span><input name="make" list="flow-makes" placeholder="Toyota" autocomplete="off" value="${esc(c.make)}" required /></label>
            <label class="flow-f"><span>Model</span><input name="model" placeholder="RAV4" autocomplete="off" value="${esc(c.model)}" required /></label>
          </div>
          <datalist id="flow-makes"></datalist>
          <div class="flow-row flow-row-2">
            <label class="flow-f"><span>Kilometres <em>optional</em></span><input name="mileage" type="number" inputmode="numeric" min="0" step="1000" placeholder="85000" value="${esc(c.mileage)}" /></label>
            <div class="flow-f"><span>Condition</span><div class="chipbar" role="radiogroup" aria-label="Condition">${CONDITIONS.map(([k, l]) =>
              `<button type="button" class="fchip${c.condition === k ? " active" : ""}" role="radio" aria-checked="${c.condition === k}" data-cond="${k}">${l}</button>`).join("")}</div></div>
          </div>
          <p class="flow-error" id="flow-err" role="alert"></p>
          <div class="flow-actions"><button type="submit" class="btn btn-primary">${S.path === "value" ? "See what it's worth" : "Continue"}</button></div>
        </form>`);
    },

    result() {
      const e = estimate();
      if (!e) return frame(`<h1>We need the car first.</h1><div class="flow-actions"><button type="button" class="btn btn-primary" data-go="car">Add the car</button></div>`);
      return frame(`
        <p class="eyebrow">Smart Estimate · ${e.confidence}% confidence</p>
        <h1>${esc(carLabel())}</h1>
        <div class="flow-answer">
          <span class="flow-answer-k">When dealers bid against each other</span>
          <strong class="flow-answer-n">${money(e.bidLow)} – ${money(e.bidHigh)}</strong>
        </div>
        <dl class="flow-compare">
          <div><dt>One dealer, one offer (trade-in)</dt><dd>${money(e.tradeIn)}</dd></div>
          <div><dt>What bidding adds</dt><dd class="up">+${money(e.upside)}</dd></div>
          <div><dt>Private-sale ceiling</dt><dd>${money(e.privateHigh)}</dd></div>
        </dl>
        <form class="flow-form flow-refine" id="flow-refine">
          <span class="flow-refine-k">Sharpen it</span>
          <div class="flow-row flow-row-2">
            <label class="flow-f"><span>Kilometres</span><input name="mileage" type="number" inputmode="numeric" min="0" step="1000" placeholder="85000" value="${esc(S.car.mileage)}" /></label>
            <div class="flow-f"><span>Condition</span><div class="chipbar">${CONDITIONS.map(([k, l]) =>
              `<button type="button" class="fchip${S.car.condition === k ? " active" : ""}" data-cond="${k}">${l}</button>`).join("")}</div></div>
          </div>
        </form>
        <div class="flow-actions">
          <button type="button" class="btn btn-primary" id="flow-to-dealers">Get dealers bidding on it →</button>
          <a class="btn btn-ghost" href="/value.html?${new URLSearchParams({ year: S.car.year, make: S.car.make, model: S.car.model, ...(S.car.mileage ? { mileage: S.car.mileage } : {}), condition: S.car.condition })}">See the full breakdown</a>
        </div>
        <p class="muted small">The gap between the first two numbers is what one offer leaves on the table. <button type="button" class="link-btn" data-go="car">Change the car</button></p>`);
    },

    where() {
      const o = S.origin;
      return frame(`
        <h1>Where's the car?</h1>
        <p class="lead">We use this to find the dealers closest to it. It stays in your browser.</p>
        <form class="flow-form" id="flow-where" novalidate>
          <div class="flow-row flow-row-where">
            <label class="flow-f"><span>Postal code</span><input name="postal" autocomplete="postal-code" maxlength="7" placeholder="K1A 0A6" value="${esc(o && o.postal ? o.postal : "")}" /></label>
            <button type="button" class="btn btn-ghost" id="flow-here">Use my location</button>
          </div>
          <p class="flow-note" id="flow-where-note" aria-live="polite">${o ? "Using <strong>" + esc(shortPlace(o.place) || o.postal) + "</strong>" + (o.province ? ", " + esc(o.province) : "") : ""}</p>
          <p class="flow-error" id="flow-err" role="alert"></p>
          <div class="flow-actions"><button type="submit" class="btn btn-primary">Find my dealers</button></div>
        </form>`);
    },

    dealers() {
      return frame(`
        <h1>Pick the dealers to ask</h1>
        <p class="lead">These are the closest dealers that buy your ${esc(carLabel() || "car")}. We've ticked them all — untick any you'd rather skip, or widen the set.</p>
        <div id="flow-picker"></div>
        <p class="flow-error" id="flow-err" role="alert"></p>
        <div class="flow-actions flow-sticky"><button type="button" class="btn btn-primary" id="flow-dealers-go">Continue</button></div>`, { wide: true });
    },

    details() {
      const e = estimate();
      return frame(`
        <h1>What should they know?</h1>
        <p class="lead">This is the message your ${S.selected.length} dealers will get. Change anything; the preview updates as you type.</p>
        <div class="flow-split">
          <form class="flow-form" id="flow-details" novalidate>
            <div class="flow-row flow-row-2">
              <label class="flow-f"><span>Kilometres</span><input name="mileage" type="number" inputmode="numeric" min="0" step="1000" placeholder="85000" value="${esc(S.car.mileage)}" /></label>
              <label class="flow-f"><span>Lowest you'd take <em>optional</em></span><input name="floor" type="number" inputmode="numeric" min="0" step="100" placeholder="${e ? e.suggestedReserve : ""}" value="${esc(S.floor)}" /></label>
            </div>
            <div class="flow-f"><span>Condition</span><div class="chipbar">${CONDITIONS.map(([k, l]) =>
              `<button type="button" class="fchip${S.car.condition === k ? " active" : ""}" data-cond="${k}">${l}</button>`).join("")}</div></div>
            <label class="flow-f"><span>Anything else <em>optional</em></span><textarea name="notes" rows="3" placeholder="One owner, winter tires included, no accidents.">${esc(S.notes)}</textarea></label>
            <div class="flow-row flow-row-2">
              <label class="flow-f"><span>Your name</span><input name="name" autocomplete="name" value="${esc(S.seller.name)}" required /></label>
              <label class="flow-f"><span>Your email</span><input name="email" type="email" autocomplete="email" value="${esc(S.seller.email)}" required /></label>
            </div>
            <label class="flow-f"><span>Phone <em>optional</em></span><input name="phone" type="tel" autocomplete="tel" value="${esc(S.seller.phone)}" /></label>
            <p class="flow-error" id="flow-err" role="alert"></p>
            <div class="flow-actions"><button type="submit" class="btn btn-primary">Get it ready to send →</button></div>
          </form>
          <aside class="flow-preview" aria-label="Message preview">
            <span class="flow-preview-k">Preview</span>
            <p class="flow-preview-subj" id="flow-subj"></p>
            <pre class="flow-preview-body" id="flow-body"></pre>
          </aside>
        </div>`, { wide: true });
    },

    send() {
      const withEmail = S.selected.filter((d) => d.email);
      const done = contactedSet();
      const rows = S.selected.map((d, i) => {
        const tel = d.phone ? d.phone.replace(/[^0-9+]/g, "") : "";
        const site = d.website ? "https://" + d.website.replace(/^https?:\/\//, "") : "";
        const on = done.has(d.id);
        return `<li class="flow-dealer${on ? " is-done" : ""}">
          <label class="flow-tick"><input type="checkbox" data-done="${esc(d.id)}"${on ? " checked" : ""} /><span class="sr-only">Mark ${esc(d.name)} as contacted</span></label>
          <span class="flow-dealer-main">
            <a class="dealer-link" href="/dealer.html?id=${esc(d.id)}" target="_blank" rel="noopener">${esc(d.name)}</a>
            <em>${esc(d.city)}, ${esc(d.province)} · ${d.km < 1 ? "under 1" : Math.round(d.km)} km</em>
          </span>
          <span class="flow-dealer-acts">
            ${d.email ? `<a class="btn btn-sm btn-primary" href="${mailto([d.email], d.name)}" data-act="email" data-id="${esc(d.id)}">Email</a>` : ""}
            <button type="button" class="btn btn-sm btn-ghost" data-copy="${esc(d.id)}">Copy</button>
            ${site ? `<a class="btn btn-sm btn-ghost" href="${esc(site)}" target="_blank" rel="noopener nofollow" data-act="site" data-id="${esc(d.id)}">Contact page ↗</a>` : ""}
            ${tel ? `<a class="btn btn-sm btn-ghost" href="tel:${tel}" data-act="call" data-id="${esc(d.id)}">Call</a>` : ""}
          </span>
        </li>`;
      }).join("");

      return frame(`
        <h1>Send your ${esc(carLabel())} to ${S.selected.length} dealers</h1>
        <p class="lead">Replies come straight to <strong>${esc(S.seller.email)}</strong>. Attach three to five photos when you send — dealers price faster with them.</p>

        <div class="flow-send-top">
          ${withEmail.length
            ? `<a class="btn btn-primary" id="flow-email-all" href="${mailto(withEmail.map((d) => d.email))}">Email all ${withEmail.length} at once</a>`
            : ""}
          <button type="button" class="btn ${withEmail.length ? "btn-ghost" : "btn-primary"}" id="flow-copy-all">Copy the message</button>
          <a class="btn btn-ghost" id="flow-open-mail" href="${mailto([])}">Open it in my email app</a>
        </div>
        <p class="flow-note" id="flow-copied" aria-live="polite"></p>

        <div class="flow-howto">
          ${withEmail.length === S.selected.length
            ? `<p>Every dealer you picked takes email, so the button above reaches all of them.</p>`
            : `<p><strong>How it works:</strong> copy the message once, then work down the list — paste it into each dealer's contact page, or call. Tick each one off as you go.</p>`}
        </div>

        <div class="flow-count" id="flow-count" aria-live="polite"></div>
        <ol class="flow-dealers">${rows}</ol>

        <div class="flow-after">
          <p class="muted">Would rather they compete in the open, against private buyers too? <a class="link-inline" href="/sell.html">List it as an auction with a reserve →</a></p>
        </div>`, { wide: true });
    },
  };

  /* ---------- The message ---------- */

  function replyBy() {
    const d = new Date(Date.now() + 3 * 864e5);
    return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  }

  function message(dealerName) {
    const e = estimate();
    const o = S.origin || {};
    const place = [shortPlace(o.place), o.province].filter(Boolean).join(", ");
    const subject = `${carLabel()}${S.car.mileage ? " · " + kmFmt(S.car.mileage) : ""} for sale${place ? " in " + place : ""} — your offer?`;
    const cond = (CONDITIONS.find(([k]) => k === S.car.condition) || [, "Good"])[1];
    const lines = [
      `Hello${dealerName ? " " + dealerName + " team" : ""},`,
      "",
      `I'm selling my ${carLabel()} and would like your best offer.`,
      "",
      `Vehicle: ${carLabel()}`,
      S.car.mileage ? `Kilometres: ${kmFmt(S.car.mileage)}` : null,
      `Condition: ${cond}`,
      place || o.postal ? `Located: ${[place, o.postal].filter(Boolean).join(" · ")}` : null,
      S.floor ? `Lowest I'll accept: ${money(S.floor)}` : null,
      S.notes ? "" : null,
      S.notes ? S.notes.trim() : null,
      "",
      e ? `For reference, an independent estimate puts competitive offers at ${money(e.bidLow)}–${money(e.bidHigh)}.` : null,
      `I'm asking a few dealers nearby, and I'd like offers by ${replyBy()}. Photos attached; happy to arrange a look.`,
      "",
      "Thanks,",
      S.seller.name || "",
      S.seller.phone || null,
      S.seller.email || null,
    ].filter((l) => l !== null);
    return { subject, body: lines.join("\n") };
  }

  function mailto(to, dealerName) {
    const m = message(dealerName);
    // With several addresses, dealers go in Bcc so no dealer sees the others.
    const params = new URLSearchParams();
    if (to.length > 1) params.set("bcc", to.join(","));
    params.set("subject", m.subject);
    params.set("body", m.body.replace(/\n/g, "\r\n"));
    const q = params.toString().replace(/\+/g, "%20");
    return "mailto:" + (to.length === 1 ? encodeURIComponent(to[0]) : "") + "?" + q;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
      t.remove(); return ok;
    }
  }

  /* ---------- The request record ---------- */

  function contactedSet() {
    const rec = S.requestId && Store.invites().find((x) => x.id === S.requestId);
    return new Set(rec ? rec.dealers.filter((d) => d.contactedAt).map((d) => d.id) : []);
  }

  function saveRequest() {
    const o = S.origin || {};
    const rec = Store.saveRequest({
      id: S.requestId,
      vehicle: carLabel(),
      city: o.market ? o.market.slug : "",
      place: [shortPlace(o.place), o.province].filter(Boolean).join(", "),
      dealers: S.selected,
      // Enough to reopen the send step from the dashboard later.
      flow: { path: "dealers", car: S.car, origin: S.origin, selected: S.selected,
              seller: S.seller, floor: S.floor, notes: S.notes },
    });
    S.requestId = rec.id;
    save();
  }

  /* ---------- Wiring ---------- */

  function readForm(form) { return Object.fromEntries(new FormData(form)); }
  function fail(msg) { const e = $f("#flow-err"); if (e) e.textContent = msg || ""; }

  function syncHeaderCar() {
    if (!window.Locator || !Locator.setCar || !S.car.make) return;
    const make = window.DealerNet ? DealerNet.canonMake(S.car.make) : S.car.make;
    const prev = Locator.car() || {};
    if ((prev.make || "").toLowerCase() !== make.toLowerCase() || String(prev.year) !== String(S.car.year)) {
      Locator.setCar({ make, year: S.car.year, kind: "", audience: null });
    }
  }

  function wireCond(root, after) {
    root.querySelectorAll("[data-cond]").forEach((b) => b.addEventListener("click", () => {
      S.car.condition = b.dataset.cond;
      root.querySelectorAll("[data-cond]").forEach((x) => {
        x.classList.toggle("active", x === b);
        if (x.hasAttribute("aria-checked")) x.setAttribute("aria-checked", String(x === b));
      });
      save();
      if (after) after();
    }));
  }

  const WIRE = {
    choose() {
      document.querySelectorAll("[data-path]").forEach((b) => b.addEventListener("click", () => {
        S.path = b.dataset.path;
        track("flow_started", { path: S.path, from: "chooser" });
        go(firstStep());
      }));
    },

    car() {
      const form = $f("#flow-car");
      if (window.DealerNet) {
        DealerNet.load().then(() => {
          const list = $f("#flow-makes");
          if (list) list.innerHTML = DealerNet.brands().concat(["Tesla", "Polestar", "Rivian"]).sort()
            .map((b) => `<option value="${esc(b)}">`).join("");
        }).catch(() => {});
      }
      wireCond(form);
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = readForm(form);
        const year = Number(f.year);
        if (!f.make.trim() || !f.model.trim() || !year) return fail("Add the year, make and model.");
        if (year < 1950 || year > new Date().getFullYear() + 1) return fail("That year doesn't look right.");
        const changed = String(year) !== String(S.car.year) || f.make.trim() !== S.car.make || f.model.trim() !== S.car.model;
        S.car = { ...S.car, year: String(year), make: f.make.trim(), model: f.model.trim(), mileage: f.mileage || "" };
        if (changed) S.selected = [];          // a different car has different buyers
        syncHeaderCar();
        go(nextStep());
      });
    },

    result() {
      const e = estimate();
      if (e) track("estimate_completed", {
        from: "flow", confidence: e.confidence,
        value_band: Analytics && Analytics.band ? Analytics.band(e.mid) : undefined,
      });
      const form = $f("#flow-refine");
      if (form) {
        const redo = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
        wireCond(form, redo);
        let t = null;
        form.mileage.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => { S.car.mileage = form.mileage.value; save(); redo(); $f("#flow-refine input[name=mileage]").focus(); }, 450);
        });
      }
      $f("#flow-to-dealers")?.addEventListener("click", () => {
        S.path = "dealers";
        track("flow_started", { path: "dealers", from: "estimate" });
        history.replaceState({ step: "where", path: "dealers" }, "", location.pathname + "?path=dealers#where");
        go("where", { push: false });
      });
    },

    where() {
      const form = $f("#flow-where");
      const note = $f("#flow-where-note");
      const show = (o) => {
        note.innerHTML = "Using <strong>" + esc(shortPlace(o.place) || o.postal || "your location") + "</strong>" +
          (o.province ? ", " + esc(o.province) : "") +
          (o.rural && o.precision === "district" ? " — district only; the full postal code is more exact." : "");
      };
      $f("#flow-here").addEventListener("click", async () => {
        fail(""); note.textContent = "Finding you…";
        try {
          const o = window.Locator ? await Locator.detect() : await DealerNet.fromDevice();
          S.origin = o; S.selected = []; save(); show(o);
          if (o.postal) form.postal.value = o.postal;
        } catch (err) { note.textContent = ""; fail(err.message || "Couldn't read your location. Enter a postal code instead."); }
      });
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        fail("");
        const code = form.postal.value.trim();
        const current = S.origin && S.origin.postal && code.replace(/\s/g, "").toUpperCase() === String(S.origin.postal).replace(/\s/g, "").toUpperCase();
        if (!code && S.origin) return go(nextStep());
        if (!code) return fail("Enter a postal code, or use your location.");
        if (current) return go(nextStep());
        note.textContent = "Looking that up…";
        try {
          const o = window.Locator ? await Locator.fromPostal(code) : await DealerNet.fromPostal(code);
          S.origin = o; S.selected = []; save(); show(o);   // somewhere else, different dealers
          go(nextStep());
        } catch (err) { note.textContent = ""; fail(err.message || "We couldn't find that postal code."); }
      });
    },

    dealers() {
      if (!S.origin) return go("where");
      const btn = $f("#flow-dealers-go");
      const label = () => {
        const n = S.selected.length;
        btn.textContent = n ? `Continue with ${n} dealer${n === 1 ? "" : "s"} →` : "Pick at least one dealer";
        btn.disabled = !n;
      };
      const body = window.LYC_VAL && LYC_VAL.guessBody ? LYC_VAL.guessBody(S.car.model) : "";
      const make = window.DealerNet ? DealerNet.canonMake(S.car.make) : S.car.make;
      const headerCar = window.Locator && Locator.car ? Locator.car() : null;
      const car = { make, year: S.car.year, body,
        kind: headerCar && (headerCar.make || "").toLowerCase() === make.toLowerCase() ? headerCar.kind || "" : "" };
      const picker = createDealerPicker($f("#flow-picker"), {
        count: 10, embedded: true, car,
        selected: S.selected.map((d) => d.id),     // coming back keeps the seller's own picks
        onChange: (sel) => {
          S.selected = sel.map((d) => ({ id: d.id, name: d.name, city: d.city, province: d.province,
            km: d.km, phone: d.phone, website: d.website, email: d.email || "" }));
          save(); label();
        },
      });
      label();
      // S.selected is cleared whenever the car or place changes, so a
      // non-empty one here is the seller's own choice for this place.
      picker.setOrigin(S.origin, S.selected.length > 0);
      btn.addEventListener("click", () => {
        if (!S.selected.length) return fail("Pick at least one dealer.");
        go(nextStep());
      });
    },

    details() {
      const form = $f("#flow-details");
      const preview = () => {
        const m = message();
        $f("#flow-subj").textContent = m.subject;
        $f("#flow-body").textContent = m.body;
      };
      const pull = () => {
        const f = readForm(form);
        S.car.mileage = f.mileage || "";
        S.floor = f.floor || "";
        S.notes = f.notes || "";
        S.seller = { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() };
        save(); preview();
      };
      form.addEventListener("input", pull);
      wireCond(form, preview);
      preview();
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        pull();
        if (!S.seller.name) return fail("Add your name so dealers know who they're replying to.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.seller.email)) return fail("Add an email address dealers can reply to.");
        saveRequest();
        track("dealer_request_ready", { dealers: S.selected.length, with_email: S.selected.filter((d) => d.email).length });
        go(nextStep());
      });
    },

    send() {
      const count = () => {
        const done = contactedSet().size, n = S.selected.length;
        $f("#flow-count").innerHTML = done === n
          ? `<strong>All ${n} contacted.</strong> Replies will come to ${esc(S.seller.email)}. You can find this list again in <a class="link-inline" href="/dashboard.html">your dashboard</a>.`
          : `<strong>${done} of ${n}</strong> contacted`;
      };
      count();
      const note = $f("#flow-copied");
      const flash = (t) => { note.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(() => { note.textContent = ""; }, 4000); };

      $f("#flow-copy-all").addEventListener("click", async () => {
        const m = message();
        const ok = await copy("Subject: " + m.subject + "\n\n" + m.body);
        flash(ok ? "Copied. Paste it into each dealer's contact page or email." : "Couldn't copy — select the preview on the last step instead.");
        track("dealer_message_copied", { scope: "all" });
      });
      document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
        const d = S.selected.find((x) => x.id === b.dataset.copy);
        const m = message(d && d.name);
        const ok = await copy("Subject: " + m.subject + "\n\n" + m.body);
        flash(ok ? `Copied the message for ${d.name}.` : "Couldn't copy on this browser.");
      }));
      document.querySelectorAll("[data-act]").forEach((a) => a.addEventListener("click", () => {
        track("dealer_contact_opened", { channel: a.dataset.act });
      }));
      document.querySelectorAll("[data-done]").forEach((cb) => cb.addEventListener("change", () => {
        Store.markContacted(S.requestId, cb.dataset.done, cb.checked);
        cb.closest(".flow-dealer").classList.toggle("is-done", cb.checked);
        if (cb.checked) track("dealer_contacted", {});
        count();
      }));
    },
  };

  function render() {
    const host = $f("#flow");
    if (!RENDER[step]) step = firstStep();
    host.innerHTML = RENDER[step]();
    host.dataset.step = step;
    $f("#flow-back")?.addEventListener("click", () => {
      if (history.state && history.state.step) history.back();
      else go(prevStep());
    });
    host.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
    WIRE[step] && WIRE[step]();
  }

  /* ---------- Boot ---------- */

  function init() {
    if (!$f("#flow")) return;
    const q = new URLSearchParams(location.search);
    restore();

    // Reopening a saved request from the dashboard.
    const reqId = q.get("request");
    if (reqId) {
      const rec = Store.invites().find((x) => x.id === reqId && x.kind === "request");
      if (rec && rec.flow) { S = { ...blank(), ...rec.flow, requestId: rec.id }; S.path = "dealers"; step = "send"; save(); render(); return; }
    }

    const path = q.get("path");
    if (path && PATHS[path]) {
      // A fresh entry from the home page replaces whatever was in progress.
      if (q.get("make") || q.get("model") || q.get("year")) {
        S = { ...blank(), origin: S.origin, seller: S.seller };
        ["year", "make", "model", "mileage"].forEach((k) => { if (q.get(k)) S.car[k] = q.get(k); });
      }
      S.path = path;
    }

    // Fill gaps from what the header already knows.
    if (!S.origin && window.Locator) { const o = Locator.get(); if (o && o.lat) S.origin = o; }
    if (!S.car.make && window.Locator && Locator.car) {
      const c = Locator.car();
      if (c) { S.car.make = c.make || ""; S.car.year = c.year ? String(c.year) : ""; }
    }

    const hash = location.hash.replace("#", "");
    step = hash && RENDER[hash] && (hash === "choose" || steps().includes(hash)) ? hash : firstStep();
    // A step that needs earlier answers falls back to the first gap.
    if (["result", "where", "dealers", "details", "send"].includes(step) && !carKnown()) step = S.path ? "car" : "choose";
    if (["dealers", "details", "send"].includes(step) && !S.origin) step = "where";
    if (["details", "send"].includes(step) && !S.selected.length) step = "dealers";
    if (step === "send" && !S.requestId) step = "details";

    if (S.path) track("flow_started", { path: S.path, from: q.get("from") || "direct" });
    history.replaceState({ step, path: S.path }, "", location.pathname + location.search + "#" + step);
    save();
    render();
    const h = $f("#flow h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }

    window.addEventListener("popstate", (e) => {
      if (e.state && e.state.step) { if (e.state.path) S.path = e.state.path; step = e.state.step; render(); }
    });
  }

  // For the send step's saved snapshot.
  function snapshot() { return { ...S }; }

  return { init, snapshot };
})();

window.pageStart = () => StartFlow.init();
