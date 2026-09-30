/* ============================================================
   listyourcar.ca — dealer opt-in ("For dealers")

   A dealer finds its own listing, checks what sellers see, and gives
   the address it wants seller requests sent to. That address is what
   turns on one-click email in the start flow.

   Nothing goes live from here. The request is submitted through
   window.submitForm (js/config.js) to whoever runs the site; the
   address only reaches sellers once it is added by hand to
   data/dealer-emails.json and the build is rerun. That hand step is
   the review. The submission carries the exact line to add.

   Consent is explicit, because Canadian anti-spam law requires it for
   commercial email: the dealer agrees to be emailed by sellers, and
   is told the address will be published in our dealer data.
   ============================================================ */

function initDealerClaim() {
  const host = document.getElementById("dealer-claim");
  if (!host || !window.DealerNet) return;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const siteKey = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const CONSENT = "Sellers using listyourcar.ca may email this address about cars they want to sell. " +
    "This address will be published in listyourcar.ca's dealer data. I can withdraw this at any time.";

  let all = [], picked = null;

  function search(q) {
    const t = fold(q).trim();
    if (t.length < 2) return [];
    const postal = t.replace(/\s/g, "").toUpperCase();
    const isPostal = /^[A-Z]\d[A-Z]/.test(postal);
    return all.filter((d) => d.role === "dealer" && (isPostal
      ? String(d.postal).replace(/\s/g, "").toUpperCase().startsWith(postal.slice(0, 6))
      : fold(d.name).includes(t))).slice(0, 8);
  }

  function renderSearch(q, results) {
    host.innerHTML = `
      <label class="flow-f claim-search"><span>Dealership name or postal code</span>
        <input id="claim-q" autocomplete="organization" placeholder="Pacific Honda, or V7P 3R8" value="${esc(q)}" /></label>
      <ul class="claim-results">${results.map((d) => {
        const t = DealerNet.buyerTake(d);
        return `<li><button type="button" class="claim-pick" data-id="${esc(d.id)}">
          <strong>${esc(d.name)}</strong>
          <span>${esc(d.city)}, ${esc(d.province)}${d.postal ? " · " + esc(d.postal) : ""} · ${d.brands.length ? esc(d.brands.slice(0, 3).join(", ")) : "Independent"}</span>
          <span class="take-chip take-${t.tier}">${t.label}</span>
        </button></li>`;
      }).join("")}</ul>
      ${q.trim().length >= 2 && !results.length ? `<p class="muted">No match in our network. <a class="link-inline" href="contact.html?subject=dealer">Tell us about your dealership</a> and we'll add it.</p>` : ""}`;
    const input = document.getElementById("claim-q");
    input.addEventListener("input", () => {
      const v = input.value, pos = input.selectionStart;
      renderSearch(v, search(v));
      const again = document.getElementById("claim-q"); again.focus(); again.setSelectionRange(pos, pos);
    });
    host.querySelectorAll(".claim-pick").forEach((b) => b.addEventListener("click", () => {
      picked = all.find((d) => d.id === b.dataset.id);
      renderPicked();
    }));
  }

  async function renderPicked() {
    const d = picked;
    const t = DealerNet.buyerTake(d);
    const ev = await DealerNet.evidenceFor(d);
    host.innerHTML = `
      <div class="claim-card">
        <p class="claim-back"><button type="button" class="link-btn" id="claim-back">← Search again</button></p>
        <h3>${esc(d.name)}</h3>
        <dl class="dealer-facts">
          <div><dt>Location</dt><dd>${esc(d.city)}, ${esc(d.province)}${d.postal ? " · " + esc(d.postal) : ""}</dd></div>
          <div><dt>Phone</dt><dd>${esc(d.phone) || '<span class="muted">Not on file</span>'}</dd></div>
          <div><dt>Website</dt><dd>${d.website ? esc(d.website) : d.siteLost ? '<span class="muted">The address we had now belongs to someone else</span>' : '<span class="muted">Not on file</span>'}</dd></div>
          <div><dt>Makes</dt><dd>${d.brands.length ? esc(d.brands.join(", ")) : "Independent — all makes"}</dd></div>
          <div><dt>What sellers see</dt><dd><span class="take-chip take-${t.tier}">${t.label}</span> ${esc(t.summary)}${ev && ev.c ? `<br><span class="muted small">From your website, checked ${esc(ev.c)}.</span>` : ""}</dd></div>
        </dl>
        <p class="muted small">Something wrong or out of date? Say so below and we'll correct it.</p>
      </div>
      <form class="flow-form claim-form" id="claim-form" novalidate>
        <div class="flow-row flow-row-2">
          <label class="flow-f"><span>Your name</span><input name="contact_name" autocomplete="name" required /></label>
          <label class="flow-f"><span>Your role <em>optional</em></span><input name="role" autocomplete="organization-title" placeholder="Used car manager" /></label>
        </div>
        <label class="flow-f"><span>Email for seller requests</span><input name="email" type="email" autocomplete="email" placeholder="usedcars@yourdealership.ca" required /></label>
        <label class="flow-f"><span>Corrections <em>optional</em></span><textarea name="corrections" rows="3" placeholder="We also sell Acura. New phone: …"></textarea></label>
        <div class="flow-checks">
          <label><input type="checkbox" name="authorised" /> I work at this dealership and can act for it.</label>
          <label><input type="checkbox" name="consent" /> ${esc(CONSENT)}</label>
        </div>
        <p class="flow-error" id="claim-err" role="alert"></p>
        <div class="flow-actions">
          <button type="submit" class="btn btn-primary">Send seller requests here</button>
          <button type="button" class="link-btn" id="claim-optout">Stop sending us requests instead</button>
        </div>
      </form>
      <div id="claim-done" aria-live="polite"></div>`;
    document.getElementById("claim-back").addEventListener("click", () => { picked = null; renderSearch("", []); });
    const form = document.getElementById("claim-form");
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(form, "opt-in"); });
    document.getElementById("claim-optout").addEventListener("click", () => submit(form, "opt-out"));
  }

  async function submit(form, action) {
    const err = document.getElementById("claim-err");
    const f = Object.fromEntries(new FormData(form));
    const email = String(f.email || "").trim();
    if (!String(f.contact_name || "").trim()) { err.textContent = "Add your name."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Add the email address requests should go to."; return; }
    if (!form.authorised.checked) { err.textContent = "Confirm you can act for this dealership."; return; }
    if (action === "opt-in" && !form.consent.checked) { err.textContent = "Tick the consent box so sellers can email this address."; return; }
    err.textContent = "";
    const d = picked;
    const key = siteKey(d.website) || (d.name + "|" + d.postal);
    const payload = {
      _subject: `Dealer ${action}: ${d.name} (${d.city}, ${d.province})`,
      type: "dealer-" + action,
      dealer_id: d.id, dealer_name: d.name, city: d.city, province: d.province,
      website_domain: siteKey(d.website) || null,
      contact_name: String(f.contact_name).trim(), role: String(f.role || "").trim(),
      email, corrections: String(f.corrections || "").trim(),
      authorised: true,
      consent: action === "opt-in", consent_text: action === "opt-in" ? CONSENT : null,
      submitted_at: new Date().toISOString(),
      // What to do with it: add (or remove) this line in data/dealer-emails.json, then rerun the build.
      dealer_emails_line: action === "opt-in" ? JSON.stringify({ [key]: email }).slice(1, -1) : `remove "${key}"`,
    };
    const btns = form.querySelectorAll("button"); btns.forEach((b) => { b.disabled = true; });
    const r = await window.submitForm(payload);
    btns.forEach((b) => { b.disabled = false; });
    try { window.Analytics && Analytics.track("dealer_" + action.replace("-", "_"), { sent: !!r.ok }); } catch { /* never block */ }
    const done = document.getElementById("claim-done");
    if (r.ok) {
      form.hidden = true;
      done.innerHTML = action === "opt-in"
        ? `<div class="claim-ok"><strong>Thanks — we have it.</strong> We'll check it and turn it on. Once it's live, sellers who pick ${esc(d.name)} can email ${esc(email)} in one click.</div>`
        : `<div class="claim-ok"><strong>Done.</strong> We'll stop sending seller requests to ${esc(d.name)}.</div>`;
    } else if (r.demo) {
      // No form service is connected yet: say so plainly rather than pretend.
      done.innerHTML = `<div class="claim-note"><strong>We couldn't send this yet.</strong> Dealer sign-ups aren't switched on at our end, so nothing was received. Please try again soon, or reach us through the <a class="link-inline" href="contact.html?subject=dealer">contact page</a>.</div>`;
    } else {
      done.innerHTML = `<div class="claim-note"><strong>That didn't go through.</strong> Please try again in a moment.</div>`;
    }
  }

  DealerNet.all().then((list) => { all = list; renderSearch("", []); })
    .catch(() => { host.innerHTML = '<p class="muted">The dealer network could not be loaded. Please try again.</p>'; });
}
window.initDealerClaim = initDealerClaim;
