/* ============================================================
   listyourcar.ca — shared chrome and helpers
   Formatting, the header behaviour every page needs, the scroll
   motion system, and the per-page dispatch. Auction behaviour
   lives in auction.js; valuation lives in valuation.js.
   ============================================================ */

const D = window.LYC_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Formatting ---------- */
const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtPrice = (n) => "$" + Number(n).toLocaleString("en-CA");
const fmtKm = (n) => Number(n).toLocaleString("en-CA") + " km";
const cityName = (slug) => (D.CITIES.find((c) => c.slug === slug) || {}).name || slug || "Canada";
const cityBySlug = (slug) => D.CITIES.find((c) => c.slug === slug) || null;
const qs = () => new URLSearchParams(location.search);

/* Set/refresh SEO + Open Graph tags on JS-rendered pages. */
function setSeo({ title, desc, canonical, image }) {
  if (title) document.title = title;
  const meta = (sel, attr, key, val) => {
    if (!val) return;
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", val);
  };
  if (desc) meta('meta[name="description"]', "name", "description", desc);
  meta('meta[property="og:title"]', "property", "og:title", title);
  meta('meta[property="og:description"]', "property", "og:description", desc);
  meta('meta[property="og:type"]', "property", "og:type", "website");
  meta('meta[property="og:image"]', "property", "og:image", image);
  meta('meta[name="twitter:card"]', "name", "twitter:card", image ? "summary_large_image" : "summary");
  if (canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
  }
}

function statCard(n, label) {
  return `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${label}</div></div>`;
}

/* ============================================================
   Header: mobile toggle, "More" disclosure, footer year
   ============================================================ */
function initChrome() {
  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();

  const toggle = $(".nav-toggle");
  const links = $(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // "More" disclosure — click to open, outside-click or Esc to close.
  const more = $(".nav-more");
  if (more) {
    const btn = $(".nav-more-btn", more);
    const close = () => { more.removeAttribute("aria-expanded"); btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (more.getAttribute("aria-expanded") === "true") close();
      else { more.setAttribute("aria-expanded", "true"); btn.setAttribute("aria-expanded", "true"); }
    });
    document.addEventListener("click", (e) => { if (!more.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  initImageFallback();
  initMotion();
}

/* A photo that fails to load should degrade to a labelled placeholder,
   not an empty box. Networks, ad blockers and corporate proxies all
   drop images unpredictably, and an empty frame reads as "the site is
   broken". Capture phase, because error events don't bubble. */
function initImageFallback() {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || img.dataset.failed) return;
    img.dataset.failed = "1";
    if (img.parentElement) img.parentElement.classList.add("img-failed");
    img.remove();
  }, true);
}

/* ============================================================
   Motion: nav scroll state, scroll reveal, stagger, count-ups.
   Everything degrades to "just show it" under reduced motion.
   ============================================================ */
function initMotion() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Tag direct children of [data-stagger] so they reveal in sequence.
  $$("[data-stagger]").forEach((grid) => {
    [...grid.children].forEach((child, i) => {
      child.classList.add("reveal", `reveal-delay-${Math.min(i + 1, 5)}`);
    });
  });

  const revealEls = $$(".reveal, .reveal-left");
  if (reduce) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => obs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  if (!reduce && "IntersectionObserver" in window) {
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animateCount(e.target); countObs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    $$(".count").forEach((el) => countObs.observe(el));
  }
}

function animateCount(el) {
  const raw = el.dataset.value || el.textContent.trim();
  el.dataset.value = raw;
  const prefix = (raw.match(/^[^\d]*/) || [""])[0];
  const suffix = (raw.match(/[^\d.]*$/) || [""])[0];
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return;
  const dur = 1100, start = performance.now(), dec = String(num).includes(".");
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const cur = num * (1 - Math.pow(1 - p, 3));
    el.textContent = prefix + (dec ? cur.toFixed(1) : Math.floor(cur)) + suffix;
    if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

/* ============================================================
   Contact form (posts via config.js, falls back to demo mode)
   ============================================================ */
function initDemoForms() {
  const f = document.getElementById("contact-page-form");
  if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    const payload = { _subject: "listyourcar.ca contact form", ...Object.fromEntries(new FormData(f)) };
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    const r = await window.submitForm(payload);
    if (btn) { btn.disabled = false; btn.textContent = "Send message"; }
    if (r.demo) {
      alert("Thanks! Demo mode — set FORM_ENDPOINT in js/config.js to receive submissions for real.");
    } else if (r.ok) {
      alert("Thanks! Your message has been sent.");
    } else {
      alert("Sorry, something went wrong sending your message. Please email hello@listyourcar.ca.");
      return;
    }
    f.reset();
  });
}

/* ============================================================
   Dispatch — page behaviour keyed off <body data-page="...">
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initDemoForms();
  const page = document.body.dataset.page;
  ({
    home:      () => window.homeAuctions && window.homeAuctions(),
    value:     () => window.pageValue && window.pageValue(),
    auctions:  () => window.pageAuctions && window.pageAuctions(),
    auction:   () => window.pageAuction && window.pageAuction(),
    sell:      () => window.pageSell && window.pageSell(),
    dashboard: () => window.pageAuctionDashboard && window.pageAuctionDashboard(),
    dealers:   () => window.pageDealers && window.pageDealers(),
    city:      () => window.pageCity && window.pageCity(),
    model:     () => window.pageModel && window.pageModel(),
  }[page] || (() => {}))();
});
