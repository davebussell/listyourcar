/* ============================================================
   listyourcar.ca — localStorage persistence
   Stands in for a real backend in this prototype. Holds the
   auctions a visitor creates, the bids they place, and their
   watchlist. Seeded auctions are read-only reference stock.
   ============================================================ */

const Store = (() => {
  const KEYS = {
    auctions: "lyc_auctions",
    bids: "lyc_bids",
    watch: "lyc_watch",
    invites: "lyc_invites",
  };

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Auctions ---------- */
  function userAuctions() { return read(KEYS.auctions); }

  function allAuctions() {
    const seed = (window.LYC_DATA?.AUCTIONS || []);
    return [...read(KEYS.auctions), ...seed].map(withLiveBids).map(withStatus);
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

  /* ---------- Bids ----------
     Stored separately from auctions so a seeded lot can still take
     live bids without mutating the reference data. */
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
    const bids = [...(a.bids || []), ...extra].sort((x, y) => x.amount - y.amount);
    const top = bids[bids.length - 1];
    return { ...a, bids, currentBid: top ? top.amount : a.currentBid };
  }

  // Derive live/closed state from the clock on every read, so a lot
  // never sits in a stale status just because nobody reloaded.
  function withStatus(a) {
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

  /* ---------- Dealer invitations ----------
     One record per listing: which rooftops were matched, when, and
     whether the invitation has actually been delivered. Matching is
     instant; delivery depends on having a contact channel and lawful
     consent, so the two are tracked separately and never conflated. */
  function invites() { return read(KEYS.invites); }
  function invitesFor(auctionId) {
    return read(KEYS.invites).filter((i) => i.auctionId === auctionId);
  }
  function addInvite({ auctionId, vehicle, city, dealers }) {
    const list = read(KEYS.invites);
    const rec = {
      id: uid("inv"),
      auctionId, vehicle, city,
      created: new Date().toISOString(),
      // "matched" = we know who should bid. "sent" only once a real
      // channel delivers it. Never claim delivery we cannot evidence.
      status: "matched",
      dealers: (dealers || []).map((d) => ({
        name: d.name, city: d.city, province: d.province,
        phone: d.phone, website: d.website, km: Math.round(d.km),
      })),
    };
    list.unshift(rec);
    write(KEYS.invites, list);
    return rec;
  }
  function markInviteSent(id, channel) {
    const list = read(KEYS.invites);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], status: "sent", sentAt: new Date().toISOString(), channel };
    write(KEYS.invites, list);
    return list[i];
  }

  function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  return {
    allAuctions, userAuctions, getAuction, addAuction,
    addBid, bidsFor, myBids,
    watchlist, isWatching, toggleWatch,
    invites, invitesFor, addInvite, markInviteSent,
    resetAll,
  };
})();

window.Store = Store;
