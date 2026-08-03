/* ============================================================
   listyourcar.ca — runtime configuration
   ------------------------------------------------------------
   Set FORM_ENDPOINT to a real endpoint to make forms submit for
   real. Formspree is the quickest path:
     1. Create a free form at https://formspree.io
     2. Paste its endpoint below, e.g.
        FORM_ENDPOINT: "https://formspree.io/f/abcdwxyz"
   Any endpoint that accepts a JSON POST and returns 2xx works
   (Formspree, Basin, Netlify Forms function, your own API).

   While FORM_ENDPOINT is empty, forms fall back to demo mode
   (data still saves to localStorage so the prototype works).
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
  if (!url) return { ok: false, demo: true };
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
