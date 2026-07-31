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
    auctions: "lyc_auctions",
    bids: "lyc_bids",
    watch: "lyc_watch",
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

  /* ---------- Auctions ----------
     Seed auctions are read-only reference stock; user-created ones
     live in localStorage. Bids placed against either are stored
     separately and merged on read, so a seeded auction can still
     take live bids in the prototype. */
  function userAuctions() { return read(KEYS.auctions); }
  function allAuctions() {
    const seed = (window.LYC_DATA?.AUCTIONS || []);
    const merged = [...read(KEYS.auctions), ...seed].map(withLiveBids);
    return merged.map(withStatus);
  }
  function getAuction(id) { return allAuctions().find((a) => a.id === id) || null; }

  function addAuction(data) {
    const list = read(KEYS.auctions);
    const a = {
      id: uid("auc"),
      created: new Date().toISOString(),
      openedAt: new Date().toISOString(),
      status: "live",
      bids: [],
      currentBid: null,
      watchers: 0,
      seller: data.name || "Private seller",
      ...data,
    };
    list.unshift(a);
    write(KEYS.auctions, list);
    return a;
  }

  /* Bids the visitor has placed, keyed by auction. */
  function bidsFor(auctionId) {
    return read(KEYS.bids).filter((b) => b.auctionId === auctionId);
  }
  function addBid({ auctionId, amount, bidder, type }) {
    const list = read(KEYS.bids);
    const b = {
      id: uid("bid"), auctionId, amount: Number(amount),
      bidder: bidder || "You", type: type || "public",
      created: new Date().toISOString(), mine: true,
    };
    list.unshift(b);
    write(KEYS.bids, list);
    return b;
  }
  function myBids() { return read(KEYS.bids); }

  // Fold locally-placed bids into an auction and recompute the top.
  function withLiveBids(a) {
    const extra = read(KEYS.bids).filter((b) => b.auctionId === a.id);
    if (!extra.length) return { ...a };
    const bids = [...(a.bids || []), ...extra]
      .sort((x, y) => x.amount - y.amount);
    const top = bids[bids.length - 1];
    return { ...a, bids, currentBid: top ? top.amount : a.currentBid };
  }
  // Derive live/closed state from the clock every time we read.
  function withStatus(a) {
    if (a.status === "sold") return a;
    const ended = new Date(a.closesAt).getTime() <= Date.now();
    const met = a.currentBid != null && a.currentBid >= a.reserve;
    return {
      ...a,
      reserveMet: met,
      status: ended ? (met ? "sold" : "reserve-not-met") : "live",
    };
  }

  /* ---------- Watchlist ---------- */
  function watchlist() { return read(KEYS.watch); }
  function isWatching(id) { return read(KEYS.watch).includes(id); }
  function toggleWatch(id) {
    const list = read(KEYS.watch);
    const i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    write(KEYS.watch, list);
    return i === -1;
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
    allAuctions, userAuctions, getAuction, addAuction,
    addBid, bidsFor, myBids,
    watchlist, isWatching, toggleWatch,
    resetAll,
  };
})();

window.Store = Store;
