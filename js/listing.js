/* ============================================================
   listyourcar.ca — private listings ("Skip the dealer")

   A listing lives entirely in its link: the fragment after # holds
   the ad, encoded. Nothing is stored on a server, so the listing
   works today with no backend, and the fragment is never sent to
   the server in the first place. Whoever has the link sees the
   listing and contacts the seller directly — by email, and by
   phone or text if the seller chose to show them.

   Everything decoded here was typed by someone else. It is escaped
   before it is shown, links must be plain web addresses, and the
   page says plainly that we have not checked the car or the ad.
   ============================================================ */

const ListingCodec = (() => {
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(str) {
    try {
      const b64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { return null; }
  }
  return { encode, decode };
})();
window.ListingCodec = ListingCodec;

function pageListing() {
  const host = document.getElementById("listing");
  if (!host) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-CA");
  const COND = { excellent: "Excellent", good: "Good", fair: "Fair", "needs-work": "Needs work" };

  /* ---------- Read and check the listing ---------- */
  const raw = ListingCodec.decode(location.hash.slice(1));
  const str = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");
  const L = raw && raw.v === 1 ? {
    year: str(raw.y, 4), make: str(raw.mk, 40), model: str(raw.md, 60),
    km: /^\d{1,7}$/.test(str(raw.km, 7)) ? Number(raw.km) : null,
    cond: COND[raw.c] ? raw.c : "good",
    price: /^\d{2,8}$/.test(str(raw.p, 8)) ? Number(raw.p) : null,
    desc: str(raw.d, 800), photos: /^https?:\/\/[^\s"'<>]+$/i.test(str(raw.ph, 500)) ? str(raw.ph, 500) : "",
    town: str(raw.t, 60), prov: /^[A-Z]{2}$/.test(str(raw.pr, 2)) ? raw.pr : "", fsa: /^[A-Z]\d[A-Z]$/.test(str(raw.f, 3)) ? raw.f : "",
    name: str(raw.n, 40), email: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(str(raw.e, 120)) ? raw.e : "",
    tel: str(raw.tel, 25).replace(/[^0-9+]/g, ""), sms: raw.sms === 1, call: raw.call === 1,
    at: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.at, 10)) ? raw.at : "",
  } : null;

  if (!L || !L.year || !L.make || !L.model || !L.price || !L.email) {
    host.innerHTML = `<div class="listing-empty"><h1>This listing link is incomplete</h1>
      <p class="lead">The link may have been cut off when it was copied. Ask the seller to send it again.</p>
      <p><a class="btn btn-primary" href="/start.html?path=private">List your own car →</a></p></div>`;
    return;
  }

  const car = `${L.year} ${L.make} ${L.model}`;
  const place = [L.town, L.prov].filter(Boolean).join(", ");
  document.title = `${car} — ${money(L.price)} | Private sale | listyourcar.ca`;

  /* ---------- Price check, from the same estimate the site uses ---------- */
  let priceCheck = "";
  const e = window.LYC_VAL ? LYC_VAL.estimateValue({ year: L.year, make: L.make, model: L.model, mileage: L.km == null ? "" : L.km, condition: L.cond }) : null;
  if (e) {
    const verdict = L.price > e.privateHigh * 1.05
      ? "above our estimate — worth asking the seller what justifies it"
      : L.price < e.bidLow
        ? "below what dealers would likely bid — a good price, but inspect the car carefully"
        : "within the range our estimate expects";
    priceCheck = `<section class="listing-panel">
      <span class="eyebrow">Price check</span>
      <p>The asking price is <strong>${verdict}</strong>.</p>
      <dl class="flow-compare">
        <div><dt>Dealers bidding</dt><dd>${money(e.bidLow)} – ${money(e.bidHigh)}</dd></div>
        <div><dt>Private-sale ceiling</dt><dd>${money(e.privateHigh)}</dd></div>
        <div><dt>Asking</dt><dd>${money(L.price)}</dd></div>
      </dl>
      <p class="muted small">Our Smart Estimate for a ${esc(car)}${L.km != null ? " with " + L.km.toLocaleString("en-CA") + " km" : ""} in ${esc(COND[L.cond].toLowerCase())} condition, ${e.confidence}% confidence. It hasn't seen this particular car.</p>
    </section>`;
  }

  /* ---------- Paperwork for the province the car is in ---------- */
  const city = ((window.LYC_DATA && LYC_DATA.CITIES) || []).find((c) => c.province === L.prov);
  const paperwork = city
    ? `<p><strong>Buying in ${esc(city.provinceName)}:</strong> ${esc(city.paperwork)}</p>`
    : `<p><strong>Paperwork:</strong> get a signed bill of sale and the registration, and check what your province needs to transfer ownership — some require an inspection first.</p>`;

  const mailSubject = encodeURIComponent(`Your ${car} (listyourcar.ca)`);
  host.innerHTML = `
    <p class="listing-banner">Private sale, listed by the owner. listyourcar.ca hasn't inspected this car or checked this listing.</p>
    <div class="listing-grid">
      <div>
        <span class="eyebrow">Skip the dealer · ${place ? esc(place) + (L.fsa ? " · " + esc(L.fsa) : "") : "Private sale"}</span>
        <h1>${esc(car)}</h1>
        <p class="listing-price">${money(L.price)}</p>
        <dl class="listing-facts">
          ${L.km != null ? `<div><dt>Kilometres</dt><dd>${L.km.toLocaleString("en-CA")} km</dd></div>` : ""}
          <div><dt>Condition</dt><dd>${esc(COND[L.cond])} <span class="muted">(seller's view)</span></dd></div>
          ${place ? `<div><dt>Location</dt><dd>${esc(place)}${L.fsa ? " · " + esc(L.fsa) : ""}</dd></div>` : ""}
          ${L.at ? `<div><dt>Listed</dt><dd>${esc(L.at)}</dd></div>` : ""}
        </dl>
        ${L.desc ? `<div class="listing-desc">${esc(L.desc)}</div>` : ""}
        ${L.photos ? `<p><a class="btn btn-ghost" href="${esc(L.photos)}" target="_blank" rel="noopener nofollow ugc">See the photos ↗</a></p>` : ""}
        ${priceCheck}
      </div>
      <aside class="listing-contact">
        <span class="eyebrow">Contact ${esc(L.name || "the seller")}</span>
        <div class="listing-acts">
          <a class="btn btn-primary" href="mailto:${esc(L.email)}?subject=${mailSubject}">Email ${esc(L.name || "the seller")}</a>
          ${L.tel && L.call ? `<a class="btn btn-ghost" href="tel:${esc(L.tel)}">Call</a>` : ""}
          ${L.tel && L.sms ? `<a class="btn btn-ghost" href="sms:${esc(L.tel)}?body=${encodeURIComponent("Hi, I saw your " + car + " listed for " + money(L.price) + ". Is it still available?")}">Text</a>` : ""}
        </div>
        <form class="flow-form listing-offer" id="listing-offer" novalidate>
          <span class="flow-refine-k">Make an offer</span>
          <label class="flow-f"><span>Your offer</span><input name="amount" type="number" inputmode="numeric" min="1" step="100" placeholder="${Math.round(L.price * 0.95 / 100) * 100}" required /></label>
          <label class="flow-f"><span>Your name</span><input name="name" autocomplete="name" required /></label>
          <label class="flow-f"><span>Message <em>optional</em></span><textarea name="note" rows="3" placeholder="I can see it this weekend."></textarea></label>
          <p class="flow-error" id="listing-err" role="alert"></p>
          <button type="submit" class="btn btn-primary">Send my offer</button>
          <p class="muted small">Opens your email app with the offer written. It goes straight to the seller.</p>
        </form>
      </aside>
    </div>
    <section class="listing-panel listing-safe">
      <span class="eyebrow">Buying privately, safely</span>
      ${paperwork}
      <ul>
        <li>Check for a lien before you pay. A car sold with money owing on it can be repossessed from the new owner. A vehicle history report includes a lien search.</li>
        <li>Have it inspected by a mechanic you choose. A seller who refuses an inspection is telling you something.</li>
        <li>See the car, and the seller's ID and ownership papers, before any money moves. Never send a deposit for a car you haven't seen.</li>
        <li>Pay by bank draft or a transfer you can confirm with your own bank, and get a signed bill of sale.</li>
      </ul>
    </section>
    <section class="cta section-line">
      <h2>Selling a car too?</h2>
      <div class="hero-actions" style="justify-content:center">
        <a class="btn btn-primary" href="/start.html?path=private">Skip the dealer</a>
        <a class="btn btn-ghost" href="/start.html?path=value">What's mine worth?</a>
      </div>
    </section>`;

  const form = document.getElementById("listing-offer");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const amount = Math.round(Number(f.amount));
    const err = document.getElementById("listing-err");
    if (!amount || amount < 100) { err.textContent = "Add the amount you'd like to offer."; return; }
    if (!String(f.name || "").trim()) { err.textContent = "Add your name so the seller knows who's offering."; return; }
    err.textContent = "";
    const body = [
      `Hi ${L.name || "there"},`, "",
      `I'd like to offer ${money(amount)} for your ${car}, listed at ${money(L.price)}.`,
      f.note ? "" : null, f.note ? String(f.note).trim() : null, "",
      "Thanks,", String(f.name).trim(), "",
      `(Your listing: ${location.href})`,
    ].filter((l) => l !== null).join("\r\n");
    const q = new URLSearchParams({ subject: `Offer of ${money(amount)} on your ${car}`, body }).toString().replace(/\+/g, "%20");
    try { window.Analytics && Analytics.track("private_offer_opened", { offer_band: Analytics.band(amount) }); } catch { /* never block */ }
    location.href = `mailto:${L.email}?${q}`;
  });
}
window.pageListing = pageListing;
