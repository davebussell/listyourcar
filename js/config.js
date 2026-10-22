/* ============================================================
   listyourcar.ca — runtime configuration
   ------------------------------------------------------------
   Forms submit to the Netlify Form "lead" (registered by the hidden
   form at the bottom of index.html; Netlify emails each submission
   per the project's form notifications). Every submission keeps the
   full payload as JSON in the "details" field.

   Set FORM_ENDPOINT only to send submissions somewhere else instead:
   any endpoint that accepts a JSON POST and returns 2xx works
   (Formspree, Basin, your own API).
   ============================================================ */
window.LYC_CONFIG = {
  FORM_ENDPOINT: "", // e.g. "https://formspree.io/f/xxxxxxxx"

  /* ---------- Analytics ----------
     OFF by default: with no provider set, nothing is loaded and no
     request leaves the browser. The funnel events are instrumented
     either way, so turning this on starts collecting immediately.

     Plausible (recommended — cookieless, no consent banner needed):
       1. Add the site at https://plausible.io (uses your own account)
       2. provider: "plausible", domain: "listyourcar.ca"

     GA4:
       provider: "ga4", measurementId: "G-XXXXXXXXXX"
       Note: GA4 sets cookies — you'll need a consent banner in the
       EU/UK, and PIPEDA transparency obligations still apply here.

     debug: true logs events to the console instead of sending them,
     which is how to verify the funnel without any provider at all. */
  ANALYTICS: {
    provider: "",       // "" | "plausible" | "ga4"
    domain: "",         // plausible
    measurementId: "",  // ga4
    debug: false,
  },
};

/* Generic submit helper. Returns { ok, demo }.
   - demo:true  → no endpoint configured, caller should fall back
   - ok:true    → posted successfully
   - ok:false   → endpoint configured but the request failed       */
window.submitForm = async function submitForm(payload) {
  const url = window.LYC_CONFIG.FORM_ENDPOINT;
  if (!url) return submitToNetlify(payload || {});
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, demo: false };
  } catch {
    return { ok: false, demo: false };
  }
};

/* Default destination: Netlify Forms. Field names must match the hidden
   <form name="lead"> in index.html, or Netlify drops them. */
async function submitToNetlify(p) {
  const kind = p.kind || p.type || (p._subject ? String(p._subject).split(":")[0] : "") || "contact";
  const body = new URLSearchParams({
    "form-name": "lead",
    "bot-field": "",
    kind: String(kind),
    subject: String(p.subject || p._subject || ""),
    name: String(p.name || p.contact_name || ""),
    email: String(p.email || ""),
    phone: String(p.phone || ""),
    message: String(p.message || p.corrections || ""),
    page: location.pathname,
    details: JSON.stringify(p),
  });
  try {
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { ok: res.ok, demo: false };
  } catch {
    return { ok: false, demo: false };
  }
}
