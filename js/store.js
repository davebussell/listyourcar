/* ============================================================
   listyourcar.ca — localStorage persistence layer
   Stands in for a real backend/API in this Phase 1 prototype.
   Stores: user-created listings, inquiries (unified inbox),
   and rental booking requests.
   ============================================================ */

const Store = (() => {
  const KEYS = {
    listings: "lyc_listings",
    inquiries: "lyc_inquiries",
    bookings: "lyc_bookings",
    account: "lyc_account",
    plans: "lyc_plans",
  };

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Listings ---------- */
  // Combined view = seed listings + user-created listings.
  function allListings() {
    const seed = (window.LYC_DATA?.SEED_LISTINGS || []);
    return [...read(KEYS.listings), ...seed];
  }
  function userListings() { return read(KEYS.listings); }
  function getListing(id) { return allListings().find((l) => l.id === id) || null; }
  function addListing(data) {
    const list = read(KEYS.listings);
    const listing = {
      id: uid("lyc"),
      status: "live",
      created: new Date().toISOString().slice(0, 10),
      seller: data.name || "You",
      emoji: pickEmoji(data),
      ...data,
    };
    list.unshift(listing);
    write(KEYS.listings, list);
    return listing;
  }
  function updateListing(id, patch) {
    const list = read(KEYS.listings);
    const i = list.findIndex((l) => l.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...patch };
    write(KEYS.listings, list);
    return list[i];
  }
  function pickEmoji(d) {
    const t = ((d.make || "") + " " + (d.model || "")).toLowerCase();
    if (/truck|f-150|silverado|ram|sierra|tacoma|tundra/.test(t)) return "🛻";
    if (/tesla|ev|electric|bolt|leaf|model/.test(t)) return "⚡";
    if (/suv|cx|rav|tucson|outback|wrangler|explorer|highlander/.test(t)) return "🚙";
    return "🚗";
  }

  /* ---------- Inquiries (unified inbox) ---------- */
  function inquiries() { return read(KEYS.inquiries); }
  function addInquiry(data) {
    const list = read(KEYS.inquiries);
    const inq = {
      id: uid("inq"),
      created: new Date().toISOString(),
      read: false,
      ...data, // { listingId, listingTitle, channel, kind, name, email, message }
    };
    list.unshift(inq);
    write(KEYS.inquiries, list);
    return inq;
  }
  function markInquiryRead(id) {
    const list = read(KEYS.inquiries);
    const i = list.findIndex((x) => x.id === id);
    if (i !== -1) { list[i].read = true; write(KEYS.inquiries, list); }
  }

  /* ---------- Rental bookings ---------- */
  function bookings() { return read(KEYS.bookings); }
  function addBooking(data) {
    const list = read(KEYS.bookings);
    const b = {
      id: uid("bk"),
      created: new Date().toISOString(),
      status: "requested", // requested → confirmed → completed
      ...data,
    };
    list.unshift(b);
    write(KEYS.bookings, list);
    return b;
  }

  /* ---------- Account (freemium prototype) ----------
     tier: "free" (1 saved plan) | "plus" (unlimited + extended shots). */
  function account() {
    try { return JSON.parse(localStorage.getItem(KEYS.account)) || null; }
    catch { return null; }
  }
  function saveAccount(data) {
    const acc = { tier: "free", created: new Date().toISOString(), ...(account() || {}), ...data };
    localStorage.setItem(KEYS.account, JSON.stringify(acc));
    return acc;
  }
  function isPlus() { return (account() || {}).tier === "plus"; }

  /* ---------- Saved shoot plans ---------- */
  function plans() { return read(KEYS.plans); }
  function getPlan(id) { return plans().find((p) => p.id === id) || null; }
  function addPlan(data) {
    const list = read(KEYS.plans);
    const p = { id: uid("plan"), created: new Date().toISOString(), ...data };
    list.unshift(p);
    write(KEYS.plans, list);
    return p;
  }
  function deletePlan(id) {
    write(KEYS.plans, read(KEYS.plans).filter((p) => p.id !== id));
  }

  function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  return {
    allListings, userListings, getListing, addListing, updateListing,
    inquiries, addInquiry, markInquiryRead,
    bookings, addBooking,
    account, saveAccount, isPlus,
    plans, getPlan, addPlan, deletePlan,
    resetAll,
  };
})();

window.Store = Store;
