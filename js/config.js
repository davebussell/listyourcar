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
