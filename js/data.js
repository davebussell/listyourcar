/* ============================================================
   listyourcar.ca — reference data
   Cities we run auctions in, with the provincial paperwork that
   actually applies when a private sale closes. Used by the city
   landing pages and the location line on every auction.

   The rules below are a plain-language summary for sellers, not
   legal advice — provincial requirements and tax rates change,
   so each page tells the reader to confirm with the province.
   ============================================================ */

const CITIES = [
  {
    slug: "toronto", name: "Toronto", region: "Greater Toronto Area",
    province: "ON", provinceName: "Ontario", lat: 43.6532, lon: -79.3832, tz: "America/Toronto",
    market: "The deepest used-car market in the country, and the most competitive bidding on this platform. Trucks and AWD SUVs move fastest; commuter sedans draw the widest dealer interest.",
    paperwork: "Ontario requires the seller to buy a Used Vehicle Information Package (UVIP) from ServiceOntario and give it to the buyer — it is not optional. The buyer needs a Safety Standards Certificate to plate the car, and pays retail sales tax at registration on the greater of the purchase price or the province's wholesale value.",
    tip: "Order the UVIP before your auction closes. Having it in hand on closing day is the difference between handing over keys that week and chasing paperwork for ten days.",
  },
  {
    slug: "vancouver", name: "Vancouver", region: "Metro Vancouver",
    province: "BC", provinceName: "British Columbia", lat: 49.2827, lon: -123.1207, tz: "America/Vancouver",
    market: "Strong money for AWD wagons, hybrids and clean imports. Rust-free coastal cars attract bidders from the Prairies, so expect out-of-region dealer interest.",
    paperwork: "Transfers in British Columbia go through an Autoplan broker, where ICBC handles registration and insurance together. Both parties complete the transfer/tax form, and the buyer pays provincial sales tax at the counter on private sales — the rate steps up on higher-value vehicles.",
    tip: "Book the Autoplan appointment with the winning bidder rather than leaving them to it. Deals that stall in BC almost always stall at the broker's office.",
  },
  {
    slug: "montreal", name: "Montreal", region: "Greater Montreal",
    province: "QC", provinceName: "Quebec", lat: 45.5019, lon: -73.5674, tz: "America/Toronto",
    market: "A big, price-sensitive market with heavy winter wear on older stock — which means well-kept examples stand out sharply and bid up. Listing details in French widens your bidder pool.",
    paperwork: "Quebec transfers happen at the SAAQ, and both the seller and buyer generally need to be present. Quebec sales tax is calculated on the higher of the agreed price or the vehicle's estimated value, so an unusually low sale price does not reduce the buyer's tax bill.",
    tip: "Because the SAAQ needs you both there, agree the appointment slot when you accept the bid — not after.",
  },
  {
    slug: "calgary", name: "Calgary", region: "Calgary",
    province: "AB", provinceName: "Alberta", lat: 51.0447, lon: -114.0719, tz: "America/Edmonton",
    market: "Truck country. Half-tons and diesel three-quarter-tons draw the most aggressive bidding in the country here, especially heading into winter.",
    paperwork: "Alberta charges no provincial sales tax on private vehicle sales, which is a genuine advantage worth noting in your listing — buyers know it. A registry agent handles the transfer, and a signed bill of sale is the key document.",
    tip: "Say 'no PST in Alberta' in your description. It reads as a real saving to any buyer comparing your car against one in Ontario or BC.",
  },
  {
    slug: "edmonton", name: "Edmonton", region: "Edmonton",
    province: "AB", provinceName: "Alberta", lat: 53.5461, lon: -113.4938, tz: "America/Edmonton",
    market: "Work trucks, fleet-spec pickups and 4x4s dominate. Winter-ready vehicles with block heaters and good rubber consistently beat their estimate here.",
    paperwork: "Alberta charges no provincial sales tax on private vehicle sales. A registry agent completes the transfer; bring photo ID, the signed bill of sale and the registration.",
    tip: "Include photos of the undercarriage. Northern buyers look for rust first and bid harder when they can see there isn't any.",
  },
  {
    slug: "ottawa", name: "Ottawa", region: "Ottawa–Gatineau",
    province: "ON", provinceName: "Ontario", lat: 45.4215, lon: -75.6972, tz: "America/Toronto",
    market: "Steady, well-maintained government-town stock. Bidders here favour low-distance sedans and compact SUVs, and cross-river Quebec buyers add to the pool.",
    paperwork: "Ontario requires the seller to provide a Used Vehicle Information Package (UVIP) from ServiceOntario. The buyer needs a Safety Standards Certificate to plate the vehicle and pays retail sales tax at registration on the greater of the price paid or the province's wholesale value.",
    tip: "Ottawa auctions draw Quebec bidders. If yours wins, the car leaves the province — factor the extra transfer steps into your handover plan.",
  },
  {
    slug: "winnipeg", name: "Winnipeg", region: "Winnipeg",
    province: "MB", provinceName: "Manitoba", lat: 49.8951, lon: -97.1384, tz: "America/Winnipeg",
    market: "A smaller pool but keen bidders, particularly for AWD and anything that starts reliably at minus thirty. Salt-belt condition matters more here than distance.",
    paperwork: "Manitoba Public Insurance (MPI) handles registration and transfer through an Autopac agent, and provincial sales tax applies to private sales at the point of transfer.",
    tip: "Photograph the rockers, wheel wells and brake lines. In a salt province, visible proof of a clean underside is worth real money at close.",
  },
  {
    slug: "halifax", name: "Halifax", region: "Halifax Regional Municipality",
    province: "NS", provinceName: "Nova Scotia", lat: 44.6488, lon: -63.5752, tz: "America/Halifax",
    market: "Coastal salt exposure makes clean, rust-free examples genuinely scarce — and they bid accordingly. Small SUVs and fuel-efficient commuters hold up best.",
    paperwork: "Transfers go through Access Nova Scotia. Nova Scotia applies sales tax on private vehicle sales, and the province requires a valid Motor Vehicle Inspection for the car to be registered and driven.",
    tip: "A fresh MVI certificate before your auction closes removes the single biggest reason Nova Scotia buyers discount their bid.",
  },
];

window.LYC_DATA = Object.assign(window.LYC_DATA || {}, { CITIES });
