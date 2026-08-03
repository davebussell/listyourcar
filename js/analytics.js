/* ============================================================
   listyourcar.ca — funnel instrumentation

   Provider-agnostic on purpose. The events below describe what
   actually matters for this business — did the estimator get used,
   did that turn into a listing, did the listing draw bids — and the
   provider is a config switch behind them.

   Nothing loads and no request is made until a provider is set in
   config.js, so this is safe to ship before that decision is made.

   Privacy: only coarse, non-identifying properties are ever sent.
   Never pass a name, email, phone, exact price or free text through
   here — see scrub() at the bottom, which enforces it.
   ============================================================ */

const Analytics = (() => {
  const cfg = () => (window.LYC_CONFIG && window.LYC_CONFIG.ANALYTICS) || {};
  let ready = false;

  /* ---------- Provider bootstrap ---------- */
  function init() {
    const c = cfg();
    if (ready) return;
    ready = true;

    if (c.provider === "plausible" && c.domain) {
      const s = document.createElement("script");
      s.defer = true;
      s.dataset.domain = c.domain;
      s.src = "https://plausible.io/js/script.tagged-events.js";
      document.head.appendChild(s);
      window.plausible = window.plausible || function () {
        (window.plausible.q = window.plausible.q || []).push(arguments);
      };
    } else if (c.provider === "ga4" && c.measurementId) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(c.measurementId);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", c.measurementId, { anonymize_ip: true });
    }
    // No provider → deliberately nothing. Not an error state.
  }

  /* ---------- Emit ---------- */
  function track(event, props) {
    const c = cfg();
    const clean = scrub(props);
    if (c.debug) {
      console.info("[analytics]", event, clean);
      return;
    }
    try {
      if (c.provider === "plausible" && window.plausible) {
        window.plausible(event, Object.keys(clean).length ? { props: clean } : undefined);
      } else if (c.provider === "ga4" && window.gtag) {
        window.gtag("event", event, clean);
      }
    } catch {
      /* Analytics must never break the page. */
    }
  }

  /* Bucket a dollar figure so we learn the shape of the funnel
     without transmitting anyone's actual car value. */
  function band(n) {
    const v = Number(n);
    if (!isFinite(v) || v <= 0) return "unknown";
    if (v < 5000) return "under-5k";
    if (v < 10000) return "5-10k";
    if (v < 20000) return "10-20k";
    if (v < 30000) return "20-30k";
    if (v < 50000) return "30-50k";
    if (v < 80000) return "50-80k";
    return "80k-plus";
  }

  /* Strip anything identifying, and flatten to primitives. Providers
     reject nested values anyway, and this stops a careless call site
     from leaking a seller's contact details into a third party. */
  const BLOCKED = /^(name|email|phone|address|seller|bidder|description|message|vin)$/i;
  function scrub(props) {
    const out = {};
    if (!props) return out;
    for (const [k, v] of Object.entries(props)) {
      if (BLOCKED.test(k)) continue;
      if (v == null) continue;
      if (typeof v === "object") continue;
      out[k] = typeof v === "string" ? v.slice(0, 60) : v;
    }
    return out;
  }

  /* ---------- Page-level context ----------
     Lets us answer "do the SEO pages actually feed the estimator?",
     which is the question that decides where effort goes next. */
  function pageKind() {
    const p = location.pathname;
    if (p.startsWith("/sell-my-car/")) return p.split("/").filter(Boolean).length > 1 ? "seo-city-sell" : "seo-hub";
    if (p.startsWith("/car-auctions/")) return p.split("/").filter(Boolean).length > 1 ? "seo-city-auctions" : "seo-hub";
    if (p.startsWith("/what-is-my-car-worth/")) return p.split("/").filter(Boolean).length > 1 ? "seo-model" : "seo-hub";
    return document.body.dataset.page || "other";
  }

  /* Delegated CTA tracking — one listener covers all 60 pages,
     including the generated ones, with nothing to wire per page. */
  function initCtaTracking() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      let dest = null;
      if (/(^|\/)value\.html/.test(href)) dest = "estimator";
      else if (/(^|\/)sell\.html/.test(href)) dest = "sell";
      else if (/(^|\/)auctions?\.html/.test(href)) dest = "auctions";
      else if (/(^|\/)dealers\.html/.test(href)) dest = "dealers";
      if (!dest) return;
      track("cta_click", { to: dest, from: pageKind() });
    }, { capture: true });
  }

  return { init, track, band, pageKind, initCtaTracking };
})();

window.Analytics = Analytics;

document.addEventListener("DOMContentLoaded", () => {
  Analytics.init();
  Analytics.initCtaTracking();
  Analytics.track("pageview_context", { kind: Analytics.pageKind() });
});
