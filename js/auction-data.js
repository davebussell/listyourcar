/* ============================================================
   listyourcar.ca — auction seed data
   Dealers who bid, and a book of live auctions so the platform
   reads as a working marketplace rather than an empty shell.
   Closing times are generated relative to load, so the countdown
   is always live no matter when the page is opened.
   ============================================================ */

const WMA = (file) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=900";

/* ---------- The bidder pool ----------
   Verified dealers bid under their business name; the public bids
   under a masked handle. Both compete in the same auction. */
const DEALERS = [
  { id: "d-01", name: "Maple Ridge Auto Group",   city: "toronto",   type: "dealer", since: 2016, deals: 1840, rating: 4.8 },
  { id: "d-02", name: "Lakeshore Motors",          city: "toronto",   type: "dealer", since: 2011, deals: 3210, rating: 4.7 },
  { id: "d-03", name: "Pacific Coast Automotive",  city: "vancouver", type: "dealer", since: 2014, deals: 2260, rating: 4.9 },
  { id: "d-04", name: "Fraser Valley Motors",      city: "vancouver", type: "dealer", since: 2019, deals: 980,  rating: 4.6 },
  { id: "d-05", name: "Bow River Auto Sales",      city: "calgary",   type: "dealer", since: 2013, deals: 1975, rating: 4.7 },
  { id: "d-06", name: "Chinook Motor Co.",         city: "calgary",   type: "dealer", since: 2017, deals: 1120, rating: 4.5 },
  { id: "d-07", name: "Groupe Auto Saint-Laurent", city: "montreal",  type: "dealer", since: 2009, deals: 4050, rating: 4.8 },
  { id: "d-08", name: "Rive-Sud Automobiles",      city: "montreal",  type: "dealer", since: 2015, deals: 1630, rating: 4.6 },
  { id: "d-09", name: "Rideau Valley Motors",      city: "ottawa",    type: "dealer", since: 2012, deals: 1490, rating: 4.7 },
  { id: "d-10", name: "Prairie Auto Exchange",     city: "winnipeg",  type: "dealer", since: 2018, deals: 870,  rating: 4.6 },
  { id: "d-11", name: "Atlantic Motor Traders",    city: "halifax",   type: "dealer", since: 2016, deals: 1050, rating: 4.8 },
  { id: "d-12", name: "Northgate Auto Centre",     city: "edmonton",  type: "dealer", since: 2010, deals: 2740, rating: 4.5 },
];

/* Masked public bidders — buyers see a handle, never contact info,
   until the auction closes and the seller accepts. */
const PUBLIC_BIDDERS = [
  "J. Whitfield", "A. Nakamura", "R. Boucher", "S. Kaur", "M. Delaney",
  "T. Okafor", "L. Fontaine", "D. MacIntyre", "P. Sandhu", "C. Vega",
];

/* ---------- Vehicle photos (Wikimedia Commons, freely licensed) ---------- */
const AUCTION_PHOTOS = {
  corolla:  WMA("Toyota_Corolla_Hybrid_(E210)_IMG_4338.jpg"),
  civic:    WMA("Honda_Civic_e-HEV_Sport_(XI)_–_f_30062024.jpg"),
  f150:     WMA("2018_Ford_F-150_XLT_Crew_Cab,_front_11.10.19.jpg"),
  model3:   WMA("Tesla_Model_3_(2023)_Autofrühling_Ulm_IMG_9282.jpg"),
  cx5:      WMA("2024_Mazda_CX-5_2.5_S_Select_in_Platinum_Quartz_Metallic,_front_right.jpg"),
  outback:  WMA("2026_Subaru_Outback_Wilderness,_front_left,_05-24-2026.jpg"),
  wrangler: WMA("2018_Jeep_Wrangler_Sahara_Unlimited_Multijet_2.1_Front.jpg"),
  tucson:   WMA("2022_Hyundai_Tucson_Preferred,_Front_Right,_05-24-2021.jpg"),
  rav4:     WMA("2019_Toyota_RAV4_XLE_AWD_in_Magnetic_Grey_Metallic,_front_left.jpg"),
  silverado:WMA("2019_Chevrolet_Silverado_1500_LT_Z71_Crew_Cab,_front_6.1.19.jpg"),
  golf:     WMA("VW_Golf_VIII_1X7A0269.jpg"),
  x3:       WMA("BMW_X3_xDrive20d_(G01)_–_f_10012019.jpg"),
};

/* ---------- Live auction book ----------
   `closesInMin` becomes a real timestamp at load. Bid histories are
   built from the dealer pool so competitive bidding is visible. */
const AUCTION_SEEDS = [
  { make: "Ford", model: "F-150", trim: "XLT SuperCrew 4x4", year: 2019, mileage: 88400,
    condition: "good", city: "calgary", photo: "f150", closesInMin: 47,
    reserve: 27500, startingBid: 19000,
    bids: [[19000, "d-05"], [21500, "pub:0"], [23000, "d-06"], [25500, "d-05"], [27000, "d-12"], [28200, "d-06"]] },

  { make: "Toyota", model: "RAV4", trim: "XLE AWD", year: 2021, mileage: 54200,
    condition: "excellent", city: "toronto", photo: "rav4", closesInMin: 173,
    reserve: 29000, startingBid: 22000,
    bids: [[22000, "d-01"], [24500, "d-02"], [26000, "pub:1"], [28000, "d-01"], [29400, "d-02"]] },

  { make: "Honda", model: "Civic", trim: "EX Sedan", year: 2020, mileage: 71800,
    condition: "good", city: "vancouver", photo: "civic", closesInMin: 12,
    reserve: 19500, startingBid: 13500,
    bids: [[13500, "d-03"], [15200, "pub:2"], [16800, "d-04"], [18400, "d-03"], [19100, "pub:2"], [19800, "d-04"]] },

  { make: "Tesla", model: "Model 3", trim: "Long Range AWD", year: 2021, mileage: 62500,
    condition: "good", city: "toronto", photo: "model3", closesInMin: 1490,
    reserve: 31000, startingBid: 24000,
    bids: [[24000, "d-02"], [26500, "pub:3"], [28000, "d-01"]] },

  { make: "Subaru", model: "Outback", trim: "Touring AWD", year: 2018, mileage: 118600,
    condition: "good", city: "halifax", photo: "outback", closesInMin: 2870,
    reserve: 17500, startingBid: 11000,
    bids: [[11000, "d-11"], [12800, "pub:4"], [14200, "d-11"]] },

  { make: "Jeep", model: "Wrangler", trim: "Sahara Unlimited", year: 2019, mileage: 79300,
    condition: "excellent", city: "ottawa", photo: "wrangler", closesInMin: 640,
    reserve: 33000, startingBid: 25000,
    bids: [[25000, "d-09"], [27500, "pub:5"], [29800, "d-09"], [31500, "pub:5"], [33400, "d-01"]] },

  { make: "Mazda", model: "CX-5", trim: "GS AWD", year: 2020, mileage: 66900,
    condition: "good", city: "montreal", photo: "cx5", closesInMin: 305,
    reserve: 23000, startingBid: 16500,
    bids: [[16500, "d-07"], [18200, "d-08"], [20000, "pub:6"], [21800, "d-07"]] },

  { make: "Hyundai", model: "Tucson", trim: "Preferred AWD", year: 2022, mileage: 41200,
    condition: "excellent", city: "winnipeg", photo: "tucson", closesInMin: 4120,
    reserve: 26500, startingBid: 20000,
    bids: [[20000, "d-10"], [22400, "pub:7"]] },

  { make: "Chevrolet", model: "Silverado", trim: "1500 LT Z71 Crew", year: 2019, mileage: 102400,
    condition: "fair", city: "edmonton", photo: "silverado", closesInMin: 88,
    reserve: 25000, startingBid: 17000,
    bids: [[17000, "d-12"], [19500, "d-05"], [21200, "pub:8"], [23000, "d-12"], [24100, "d-05"]] },

  { make: "Toyota", model: "Corolla", trim: "LE Hybrid", year: 2022, mileage: 38700,
    condition: "excellent", city: "toronto", photo: "corolla", closesInMin: 2210,
    reserve: 24000, startingBid: 18000,
    bids: [[18000, "d-01"], [19800, "pub:9"], [21500, "d-02"]] },

  { make: "Volkswagen", model: "Golf", trim: "Comfortline", year: 2019, mileage: 94100,
    condition: "good", city: "vancouver", photo: "golf", closesInMin: 520,
    reserve: 16000, startingBid: 10500,
    bids: [[10500, "d-03"], [12200, "pub:0"], [13600, "d-04"]] },

  { make: "BMW", model: "X3", trim: "xDrive30i", year: 2020, mileage: 73500,
    condition: "good", city: "calgary", photo: "x3", closesInMin: 1105,
    reserve: 34000, startingBid: 26000,
    bids: [[26000, "d-05"], [28500, "pub:1"], [30200, "d-06"], [32000, "d-05"]] },
];

/* Build the live auction objects. */
const AUCTIONS = (() => {
  const now = Date.now();
  const dealerById = Object.fromEntries(DEALERS.map((d) => [d.id, d]));
  return AUCTION_SEEDS.map((s, i) => {
    const closesAt = now + s.closesInMin * 60000;
    const openedAt = closesAt - (5 + (i % 4)) * 86400000; // opened 5–8 days before close
    const span = closesAt - openedAt;

    const bids = s.bids.map(([amount, who], bi) => {
      const isPublic = String(who).startsWith("pub:");
      const bidder = isPublic
        ? { name: PUBLIC_BIDDERS[Number(String(who).split(":")[1]) % PUBLIC_BIDDERS.length], type: "public" }
        : { name: (dealerById[who] || {}).name || "Dealer", type: "dealer",
            rating: (dealerById[who] || {}).rating, deals: (dealerById[who] || {}).deals };
      return {
        id: `bid-${i}-${bi}`,
        amount,
        bidder: bidder.name,
        type: bidder.type,
        rating: bidder.rating || null,
        deals: bidder.deals || null,
        // spread historical bids across the run, accelerating near the close
        created: new Date(openedAt + span * Math.pow((bi + 1) / (s.bids.length + 1), 1.7)).toISOString(),
      };
    });

    const top = bids.length ? bids[bids.length - 1].amount : null;
    return {
      id: `auc-${String(i + 1).padStart(3, "0")}`,
      make: s.make, model: s.model, trim: s.trim, year: s.year,
      mileage: s.mileage, condition: s.condition, city: s.city,
      photo: AUCTION_PHOTOS[s.photo] || null,
      reserve: s.reserve,
      startingBid: s.startingBid,
      openedAt: new Date(openedAt).toISOString(),
      closesAt: new Date(closesAt).toISOString(),
      bids,
      currentBid: top,
      reserveMet: top != null && top >= s.reserve,
      watchers: 6 + ((i * 7) % 34),
      seller: "Private seller",
      status: "live",
      description: `${s.year} ${s.make} ${s.model} ${s.trim}. ${titleCaseA(s.condition)} condition, ${Number(s.mileage).toLocaleString("en-CA")} km. Clean history, service records available. Selling to the highest bid at close — reserve set by the owner.`,
    };
  });
})();

function titleCaseA(s) { return String(s).replace(/\b\w/g, (c) => c.toUpperCase()).replace("-", " "); }

/* Cities where the bidder pool is deep enough to run an auction. */
const AUCTION_CITIES = ["toronto", "vancouver", "montreal", "calgary", "ottawa", "edmonton", "winnipeg", "halifax"];

/* Merge into the shared data namespace. */
window.LYC_DATA = Object.assign(window.LYC_DATA || {}, {
  DEALERS, AUCTIONS, AUCTION_CITIES, AUCTION_PHOTOS, PUBLIC_BIDDERS,
});
