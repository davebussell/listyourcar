/* ============================================================
   listyourcar.ca — seed data + content
   Static front-end prototype (Phase 1).
   In production, listings/content come from an API + CMS.
   ============================================================ */

/* ---------- Cities (local landing-page targets) ----------
   lat/lon power the OpenStreetMap location embed on listings. */
const CITIES = [
  { slug: "toronto",   name: "Toronto",   region: "GTA", province: "ON", lat: 43.6532, lon: -79.3832,
    note: "Highest private-sale volume in Canada. Ontario buyers must run a PPSA lien check before purchase." },
  { slug: "ottawa",    name: "Ottawa",    region: "Ottawa", province: "ON", lat: 45.4215, lon: -75.6972,
    note: "Strong bilingual market — list in English and French to widen reach. Ontario PPSA lien check applies." },
  { slug: "calgary",   name: "Calgary",   region: "Calgary", province: "AB", lat: 51.0447, lon: -114.0719,
    note: "No provincial sales tax on private sales in Alberta — a selling point worth noting in your listing." },
  { slug: "vancouver", name: "Vancouver", region: "Metro Vancouver", province: "BC", lat: 49.2827, lon: -123.1207,
    note: "BC's Motor Dealer Act sets rules for private vs dealer sales. ICBC transfer required at sale." },
  { slug: "edmonton",  name: "Edmonton",  region: "Edmonton", province: "AB", lat: 53.5461, lon: -113.4938,
    note: "Alberta has no PST on private vehicle sales. Registry agent handles the transfer." },
  { slug: "montreal",  name: "Montreal",  region: "Greater Montreal", province: "QC", lat: 45.5019, lon: -73.5674,
    note: "Quebec's biggest production hub — bilingual listings and Quebec's permit rules apply to street shoots." },
  { slug: "winnipeg",  name: "Winnipeg",  region: "Winnipeg", province: "MB", lat: 49.8951, lon: -97.1384,
    note: "A booming period-film location — its historic Exchange District doubles for many North American cities." },
  { slug: "halifax",   name: "Halifax",   region: "Halifax", province: "NS", lat: 44.6488, lon: -63.5752,
    note: "Atlantic Canada's production centre — coastal and heritage backdrops draw film and photo crews." },
];

/* Metros where most Canadian film/photo production happens — used to
   guarantee catalogue depth (5+ cars per category per city). */
const FILM_CITIES = ["toronto", "vancouver", "montreal", "calgary", "ottawa", "winnipeg", "halifax"];

/* ---------- Car photos (Wikimedia Commons, hotlinked) ----------
   Keyed by "make|model" (lowercased). Served via Special:FilePath,
   which resizes server-side. Real, freely-licensed photos. User
   listings match here when make+model line up; otherwise the UI
   falls back to an illustrative gradient + emoji. */
const WM = (file) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=800";
const CAR_IMAGES = {
  "toyota|corolla":  WM("Toyota_Corolla_Hybrid_(E210)_IMG_4338.jpg"),
  "honda|civic":     WM("Honda_Civic_e-HEV_Sport_(XI)_–_f_30062024.jpg"),
  "ford|f-150":      WM("2018_Ford_F-150_XLT_Crew_Cab,_front_11.10.19.jpg"),
  "tesla|model 3":   WM("Tesla_Model_3_(2023)_Autofrühling_Ulm_IMG_9282.jpg"),
  "mazda|cx-5":      WM("2024_Mazda_CX-5_2.5_S_Select_in_Platinum_Quartz_Metallic,_front_right.jpg"),
  "subaru|outback":  WM("2026_Subaru_Outback_Wilderness,_front_left,_05-24-2026.jpg"),
  "jeep|wrangler":   WM("2018_Jeep_Wrangler_Sahara_Unlimited_Multijet_2.1_Front.jpg"),
  "hyundai|tucson":  WM("2022_Hyundai_Tucson_Preferred,_Front_Right,_05-24-2021.jpg"),
};

/* ---------- Seed listings (sale + rental + both) ---------- */
const SEED_LISTINGS = [];

/* ---------- Content pillars (SEO architecture) ---------- */
const PILLARS = [
  {
    id: "rental", phase: "Earn with your car",
    title: "Rent your car out for shoots",
    blurb: "Turn a characterful car into income — insurance, earnings and how shoot rentals work.",
    keywords: ["how to list your car for rent", "list your car for rent", "rent my car out canada"],
  },
  {
    id: "craft", phase: "Make it shine",
    title: "Make your listing book",
    blurb: "Photos and descriptions that get your car booked for shoots.",
    keywords: ["how to list your car for sale", "list your car for sale for free", "how to write a car listing"],
  },
];

/* ---------- Articles (full-length) ----------
   Each article belongs to a pillar and renders via article.html.
   Disclaimer: educational content for Canadian owners, not legal,
   tax, or insurance advice. */
const ARTICLES = [


  /* ====================== Pillar 3 — Rental ====================== */
  { slug: "how-to-rent-out-your-car-canada", pillar: "rental", readMins: 11,
    title: "How to rent out your car in Canada: a complete guide",
    meta: "Everything Canadian owners need to start renting out their car: insurance, platforms, pricing, screening, taxes, and safety, step by step.",
    keywords: ["how to list your car for rent", "rent my car out canada", "how to rent out my car", "list your car for rent"],
    sections: [
      { h: null, p: "Renting out your car can turn an idle vehicle into hundreds of dollars a month — but in Canada it comes with insurance, tax, and liability considerations that most owners don't anticipate. Done carelessly, it can void your insurance or leave you personally on the hook for a claim. Done properly, it's a legitimate, manageable side income. This is the complete starting guide, in the order you should actually tackle it." },
      { h: "Step 1 — Confirm you're allowed to rent the vehicle", p: "First, check who controls the car. If it's financed, review your loan terms; if it's leased, read the lease carefully, because many leases prohibit commercial use and renting it out could breach the agreement. If you own the vehicle outright, you're clear to proceed. This five-minute check prevents an expensive mistake later." },
      { h: "Step 2 — Sort out insurance before anything else", p: "This is the step that protects everything else, so do it first. Your standard personal auto policy almost certainly does not cover renting your car to strangers for profit — and driving during an uninsured paid rental can void coverage entirely. In Ontario, talk to your broker about endorsements such as the OPCF 27 (which addresses liability for non-owned automobiles and permission-to-drive situations) or a commercial/vehicle-sharing policy; other provinces have equivalents. Managed platforms like Turo provide their own coverage during trips, but read the terms, deductibles, and exclusions closely. Never accept a booking until you can confirm, in writing, that you're covered." },
      { h: "Step 3 — Decide how you'll list", p: "You have two broad paths. Managed platforms (such as Turo) handle insurance, payments, and a built-in audience, but take a significant commission — often 15–40% — and set many of the rules. Listing directly on channels like Facebook Marketplace, Kijiji, and listyourcar.ca/rent keeps far more of the income in your pocket and gives you control, but means you arrange insurance, screening, and payment yourself. Many owners start on a managed platform to learn the ropes, then move to direct listing once they're confident." },
      { h: "Step 4 — Set rates that fill the calendar", p: "Research daily rates for comparable cars in your city and price competitively, especially when you're new and have no reviews. Offer weekly and monthly rates at a discount to attract longer, lower-hassle bookings that keep your calendar full with fewer handoffs. Always require a refundable security deposit sized to your vehicle's value — it covers minor damage and signals that you run a serious operation." },
      { h: "Step 5 — Screen every renter", p: "Set a minimum age (23–25 is common for insurance reasons), require a valid driver's licence, and verify it in person at pickup. Look the renter up where you can, trust your instincts, and don't be afraid to decline a booking that feels off. On a managed platform, lean on its verification tools; listing directly, build your own simple screening checklist and stick to it every time." },
      { h: "Step 6 — Document condition at pickup and return", p: "Before every rental, photograph the car from all angles, note the fuel level and odometer reading, and walk through any existing damage with the renter. Repeat the process at return. This record is your best protection in a dispute and makes deposit decisions objective rather than emotional. A short written rental agreement — covering dates, rates, mileage limits, fuel policy, and responsibilities — protects both sides; listyourcar.ca can generate one auto-filled from your listing and booking." },
      { h: "Step 7 — Keep records for taxes", p: "Rental income is taxable in Canada and must be reported. The upside is that legitimate expenses are typically deductible — the incremental insurance cost, cleaning, maintenance and tires attributable to rentals, platform fees, and a reasonable share of other costs. Keep clean records of income and expenses from day one. If renting becomes a meaningful income stream, talk to an accountant about how to report it and whether GST/HST registration could apply." },
      { h: "Step 8 — Deliver a great experience and earn reviews", p: "On any platform, reviews and response time drive bookings. Reply quickly, keep the car clean and well-maintained, be flexible on pickup when you can, and communicate clearly. A handful of strong early reviews can be the difference between an empty calendar and a booked-out one. Treat your first few renters as the foundation of your reputation." },
      { h: "The realistic bottom line", p: "Renting out your car in Canada is genuinely worthwhile if the vehicle is reliable and often idle, and if you handle insurance and screening properly. The income is real, but so is the responsibility. Start by confirming your insurance, list on a channel you trust, document everything, and scale up as you get comfortable. When you're ready, you can list your car for rent on listyourcar.ca and manage every booking inquiry from one dashboard." },
    ],
  },
  { slug: "how-much-can-you-make-renting-your-car-canada", pillar: "rental", readMins: 7,
    title: "How much can you make renting out your car in Canada?",
    meta: "Realistic earnings for renting out your car in Canada by vehicle type and city, what eats into the gross, and how to maximize your take-home.",
    keywords: ["how much can you make renting your car", "car rental income canada", "rent my car income"],
    sections: [
      { h: null, p: "The honest answer is \"it depends\" — on your vehicle, your city, how often it books, and whether you list directly or through a managed platform. But you can build a realistic estimate before committing. Here are the ranges Canadian owners actually see, and the costs that quietly shrink the headline number." },
      { h: "Typical gross earnings by vehicle type", p: "As a rough guide for Canadian markets: economy and compact cars rent for roughly $40–65 per day; mid-size sedans and small SUVs around $55–90; larger SUVs, trucks, and premium EVs often $90–130 or more. Most casual owners book somewhere between 8 and 15 days a month, which puts typical gross income in the $500–$1,500 range. Specialty and luxury vehicles can earn more but also carry higher insurance, deposit, and risk." },
      { h: "What eats into the gross", p: "Gross is not take-home. Subtract the incremental insurance cost or platform protection-plan fee, cleaning between rentals, the added maintenance and tire wear from extra kilometres, and — on managed platforms — commission that can run 15–40%. After all of that, owners commonly keep somewhere around 55–75% of gross. Listing directly keeps more of the commission in your pocket but shifts insurance and admin onto you." },
      { h: "City matters", p: "Demand and rates are higher in and around major centres — the GTA, Metro Vancouver, Calgary, Ottawa, Edmonton — where travellers, locals between cars, and people needing a specific vehicle type all create steady demand. A truck in Calgary or an EV in Toronto can stay busy; the same car in a small town may sit. Match your expectations to your local market." },
      { h: "Utilization is the lever that matters most", p: "Your earnings are driven less by your daily rate than by how many days the car is actually booked. Fast responses, competitive pricing while you build reviews, flexible pickup, spotless presentation, and strong photos all push utilization up. Weekly and monthly rates reduce turnover and idle gaps, often making a fuller calendar more profitable than a higher headline day rate with more empty days." },
      { h: "A quick worked estimate", p: "Imagine a mid-size SUV at $80/day, booked 12 days a month: that's $960 gross. Knock off insurance, cleaning, wear, and fees totalling roughly 35%, and you're around $620 net per month — about $7,400 a year from a car that would otherwise sit idle. Adjust the inputs for your own vehicle and city to get your number." },
      { h: "Is it worth it?", p: "For a reliable, frequently idle car owned outright, the income is real and meaningful — especially if you list directly and keep utilization high. For an older car, a financed/leased vehicle, or one you drive most days, the math and the hassle rarely justify it. Run your own estimate, confirm your insurance, and start small." },
    ],
  },
  { slug: "insurance-to-rent-out-your-car-ontario", pillar: "rental", readMins: 7,
    title: "What insurance do you need to rent out your car in Ontario?",
    meta: "A plain-language guide to insurance for renting out your car in Ontario, including the OPCF 27 endorsement and platform coverage.",
    keywords: ["insurance to rent out your car ontario", "opcf 27 endorsement", "rent out car insurance ontario"],
    sections: [
      { h: null, p: "This is the single most important part of renting out your car in Ontario, and the part owners most often get wrong. Get it right and everything else is manageable; get it wrong and a single incident can void your policy and leave you personally liable. Here's what you need to understand before you accept a booking." },
      { h: "Your personal policy almost certainly isn't enough", p: "Standard Ontario personal auto policies are written for personal use and generally exclude renting your vehicle out for profit. If you let a paying renter drive your car and there's a claim, the insurer can deny it on the grounds that the vehicle was being used commercially without the right coverage — leaving you exposed for damage, injury, and liability. Assume your everyday policy does not cover paid rentals unless your insurer confirms otherwise in writing." },
      { h: "Understand the OPCF 27 endorsement", p: "In Ontario, the OPCF 27 is an endorsement dealing with liability for damage to non-owned automobiles and related permission-to-drive scenarios. It's commonly discussed in the context of letting others drive your vehicle. It is not a one-size-fits-all \"rent your car out\" solution, so the right move is to talk to your broker about your specific situation — they can advise whether an endorsement, a commercial policy, or a dedicated vehicle-sharing product fits how you plan to rent." },
      { h: "Platform-provided coverage", p: "Managed platforms such as Turo include their own insurance or protection plans that apply during the trip, with various tiers, deductibles, and exclusions. This is convenient and is a major reason owners start on managed platforms. But coverage gaps exist — read exactly what's covered, what the deductible is, and what happens outside an active trip (for example, during pickup, return, or personal use). Never assume the platform covers everything." },
      { h: "If you list directly, the responsibility is yours", p: "List your car for rent directly on channels like Facebook, Kijiji, or listyourcar.ca/rent and you are responsible for arranging appropriate coverage yourself. That means a conversation with your broker before your first booking, and getting confirmation in writing. listyourcar.ca surfaces insurance guidance and partner referrals at the listing step specifically so owners don't skip this." },
      { h: "Don't forget tax and liability basics", p: "Insurance isn't the only obligation. Rental income is taxable, and you carry liability for what happens with your vehicle. Documenting condition at pickup and return, requiring a deposit, screening renters, and using a written agreement all reduce your risk and support any claim or dispute. Insurance is the backstop, not a substitute for good practices." },
      { h: "Bottom line", p: "Call your broker before you rent out your car in Ontario, describe exactly what you intend to do, and get written confirmation that you're covered for paid rentals. It's a short conversation that protects your finances, your vehicle, and your peace of mind — and it's non-negotiable. This article is educational, not insurance advice; your broker's guidance for your specific policy is what counts." },
    ],
  },



  /* ====================== Pillar 6 — Craft ====================== */
  { slug: "how-to-write-a-car-listing-that-sells", pillar: "craft", readMins: 7,
    title: "How to write a car listing that sells (with examples)",
    meta: "A template and examples for writing a used car listing description that earns more inquiries and sells faster in Canada.",
    keywords: ["how to write a car listing", "car listing description examples", "car ad template"],
    sections: [
      { h: null, p: "A great listing answers a buyer's questions before they have to ask, builds trust, and makes your car easy to say yes to. Most private listings fail at this — they're vague, defensive, or missing the basics. Here's a structure that consistently earns more inquiries, with examples you can copy." },
      { h: "Lead with the essentials", p: "Buyers scan, so put the headline facts first: year, make, model, trim, mileage, and price. Don't bury them three paragraphs down. A strong opening line reads like: \"2019 Toyota Corolla LE — 62,000 km — $18,500 — one owner, no accidents, clean CARFAX.\" In one line the buyer knows exactly what you have and whether it fits their budget." },
      { h: "Tell the car's story honestly", p: "After the facts, give context that builds trust. Is it a one-owner car? Non-smoker? Garage-kept? Recently serviced? Say so. Then — and this is what separates credible sellers from the rest — disclose the flaws plainly. A small dent, a worn tire, a check-engine light you understand: naming them up front earns trust and filters out buyers who'd walk at the test drive anyway. Honesty sells faster than spin." },
      { h: "List features and recent work", p: "Spell out the options and any recent maintenance: heated seats, Apple CarPlay, backup camera, new brakes last spring, fresh all-seasons plus a set of winters on rims, remaining factory warranty. Recent work is a powerful value signal — it tells the buyer they won't face those costs soon, which supports your price." },
      { h: "A copy-and-paste template", p: "\"[Year] [Make] [Model] [Trim] — [mileage] km — $[price]. [One-owner / accident-free / clean CARFAX] and always serviced [where]. Recent: [maintenance items]. Features: [key options]. Extras: [winter tires / second key / etc.]. Selling because [honest reason]. Minor flaws: [disclose plainly]. Test drives welcome — meet in [city/area]. Text [or preferred contact] to arrange a viewing.\"" },
      { h: "Worked example", p: "\"2019 Toyota Corolla LE — 62,000 km — $18,500. One owner, no accidents, clean CARFAX, always dealer-serviced. Recent brakes and all-season tires, plus a set of winters on rims included. Bluetooth, backup camera, remote start. Selling because I'm upsizing for a growing family. Small stone chip on the hood, otherwise excellent. Test drives welcome — meet in north Toronto. Text to arrange a viewing.\" Notice how it leads with facts, builds trust, lists value, discloses a flaw, and ends with a clear next step." },
      { h: "Close with a clear call to action", p: "End by inviting contact and stating your preferred method and meeting area: \"Text to arrange a viewing in [area].\" A specific call to action converts far better than trailing off after the description. Make it effortless for a serious buyer to take the next step." },
    ],
  },
  { slug: "how-to-take-car-photos-that-sell", pillar: "craft", readMins: 6,
    title: "How to take car photos that get more inquiries",
    meta: "Simple photo techniques that make your used car listing stand out and generate more buyer inquiries — no fancy camera needed.",
    keywords: ["car listing photos", "how to photograph car for sale", "car photos that sell"],
    sections: [
      { h: null, p: "Photos are the single biggest driver of inquiries on a used car listing — buyers decide whether to click based on the first image alone. The good news: you don't need a real camera or any skill. You need a clean car, good light, and a complete set of angles. Here's how to do it with just your phone." },
      { h: "Clean it first — this is non-negotiable", p: "Wash and dry the exterior, vacuum the interior, wipe down the dash and glass, and remove all personal items. A clean car photographs as a cared-for car, and buyers extend that impression to how you maintained it mechanically. Ten minutes of cleaning does more for your photos than any camera trick." },
      { h: "Shoot in the right light", p: "Natural light is everything. Shoot during the \"golden hour\" — the first hour after sunrise or the last before sunset — when soft light flatters paint and avoids harsh glare. Avoid direct midday sun (hard shadows, blown-out highlights) and dark garages (muddy, unflattering). An overcast day is actually ideal: even, shadow-free light." },
      { h: "Pick a clean background", p: "Where you shoot matters as much as the car. Find a plain, uncluttered setting — an empty parking lot, a quiet tree-lined street, a scenic open space — not your cluttered driveway with garbage bins and the neighbour's car in frame. A clean background keeps all the attention on the vehicle and looks instantly more professional." },
      { h: "Cover every angle", p: "Buyers want to see everything, and a complete set signals you have nothing to hide. Capture: the front three-quarter (your hero shot), all four corners, straight-on front and rear, both sides, the wheels and tires, the dashboard and odometer, the front and rear seats, the cargo area, the engine bay, and clear close-ups of any flaws. Aim for 10–15 honest photos." },
      { h: "Get the details right", p: "Shoot at a slight downward angle for exteriors and hold the phone level for interiors. Turn the car on for a clean dash shot, and photograph the odometer clearly so buyers trust the mileage. Showing minor flaws openly in photos builds credibility and pre-empts disappointment at the viewing — the buyers who show up are the ones genuinely interested." },
      { h: "Lead with your best shot", p: "Set the most striking image — usually a clean front three-quarter view — as the first photo, since it's what buyers see in search results. A strong lead photo against a clean background, with the rest of the set thorough and honest, is what turns scrollers into inquiries." },
    ],
  },
  { slug: "how-to-list-your-car-for-sale-free-step-by-step", pillar: "craft", readMins: 6,
    title: "How to list your car for sale for free: a step-by-step guide",
    meta: "A beginner-friendly, step-by-step guide to listing your car for sale online for free in Canada, from prep to publishing.",
    keywords: ["how to list your car for sale", "list your car for sale for free", "list your car for sale free", "how to list your car online"],
    sections: [
      { h: null, p: "Listing your car for sale online is free and takes about 15 minutes once you've prepped. If you've never done it, this walkthrough covers the whole process from gathering your details to publishing and managing replies — without spending a dollar." },
      { h: "Step 1 — Gather your information", p: "Before you start typing, collect the basics: your VIN (on the dash by the windshield, the driver's door jamb, and your ownership), the current odometer reading, your registration/ownership, and notes on recent maintenance. List any extras you'll include, like a second set of tires or an additional key. Having this ready makes the listing fast and accurate." },
      { h: "Step 2 — Photograph the car", p: "Clean the car inside and out, then shoot 10–15 photos in good daylight against a plain background: front three-quarter hero shot, all sides and corners, interior, odometer, and any flaws. Good photos are the biggest driver of inquiries, so this step is worth the extra few minutes. (See our dedicated photo guide for the full angle checklist.)" },
      { h: "Step 3 — Set a fair price", p: "Search comparable listings for your exact trim and mileage, take the median, and shade it down slightly for realism, then add a small cushion for negotiation. Price just under common search thresholds — $19,900 rather than $20,100 — so budget-filtering buyers actually see your ad. Our pricing guide walks through this in detail." },
      { h: "Step 4 — Write the description", p: "Lead with the essentials (year, make, model, trim, mileage, price), tell the car's story honestly, list features and recent work, disclose any flaws plainly, and end with a clear call to action and your preferred contact method. Honesty and specificity earn trust and cut down on wasted back-and-forth." },
      { h: "Step 5 — Publish for free and manage replies", p: "Post to free channels like Kijiji Autos and Facebook Marketplace — or create one listing on listyourcar.ca and crosspost it to multiple channels at once, with every reply landing in a single inbox. Respond quickly and politely (the fastest responder usually wins the sale), keep your paperwork ready, and meet buyers safely in a public place. That's it — your car is listed, for free, and working for you." },
    ],
  },
];


/* ---------- Editorial imagery (public domain, Wikimedia) ----------
   Vintage NARA / DOCUMERICA photographs of people and cars — the
   cinematic, fashion-editorial backbone of the brand. All PD. */
const WMw = (file, w) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=" + w;
const EDITORIAL = {
  heroDrive:  WMw("YOUNG_WOMAN_HAS_STOPPED_AT_A_SERVICE_STATION_FOR_ENGINE_ADJUSTMENT_AFTER_HER_CAR_HAD_FAILED_THE_EMISSIONS_TEST_AT_AN..._-_NARA_-_557924.jpg", 1600),
  studebaker: WMw("Stanley_McCaughey,_Pansy_McCaughey,_Ruth_Sites_Bailey,_and_Ed_Bailey_in_a_1925_Studebaker._(13e7526e-dd60-4cef-a391-3b2e4a205a3e).jpg", 1600),
  ford1929:   WMw("WARREN_BROWN,_OWNER_OF_THE_SERVICE_STATION_AND_GROCERY_ON_MAIN_STREET_IN_HELEN,_GEORGIA,_SITS_IN_A_1929_FORD_WHILE..._-_NARA_-_557685.jpg", 1200),
  driveIn:    WMw("DRIVE-IN_RESTAURANT_-_NARA_-_547855.jpg", 1400),
};

/* ============================================================
   Categories — the searchable "looks" creators hunt for.
   Each has a pool of representative vehicles + real Wikimedia
   photos, used to stock every film metro with 5+ options.
   ============================================================ */
const CATEGORIES = [
  {
    id: "vintage", name: "Vintage & Classic", emoji: "🚗",
    tagline: "Pre-1975 character cars with patina and period charm.",
    use: "period pieces, weddings, editorial fashion, album covers",
    rate: 220,
    images: [
      WM("Red 1959 Cadillac Series 62 Convertible.jpg"),
      WM("2009 05 31 Cadillac Coupe deVille.jpg"),
      WM("57 Chevy BelAir.jpg"),
      WM("Buick Roadmaster -- 04-22-2010.jpg"),
      WM("1963 Cadillac Series 62 Convertible (35566724566).jpg"),
    ],
    models: [
      ["Cadillac", "Series 62", 1959], ["Cadillac", "Coupe DeVille", 1965],
      ["Chevrolet", "Bel Air", 1957], ["Buick", "Roadmaster", 1953],
      ["Cadillac", "Series 62 Convertible", 1963],
    ],
  },
  {
    id: "luxury", name: "Luxury", emoji: "🚘",
    tagline: "Premium marques for high-gloss, aspirational frames.",
    use: "luxury brands, music videos, real-estate & lifestyle shoots",
    rate: 340,
    images: [
      WM("2019 Rolls-Royce Phantom V12 Automatic 6.75.jpg"),
      WM("Bentley Continental GT First Edition (49919050697) (cropped) (cropped).jpg"),
      WM("Mercedes-Benz W223 IMG 6663.jpg"),
      WM("2018 Aston Martin DB11 V8 Automatic 4.0 Front.jpg"),
      WM("Moscow, Bentley Continental, Aug 2025 01.jpg"),
    ],
    models: [
      ["Rolls-Royce", "Phantom", 2019], ["Bentley", "Continental GT", 2022],
      ["Mercedes-Benz", "S-Class", 2021], ["Aston Martin", "DB11", 2019],
      ["Bentley", "Flying Spur", 2021],
    ],
  },
  {
    id: "muscle", name: "Muscle & American", emoji: "🏎️",
    tagline: "V8 muscle and chrome — loud, low and cinematic.",
    use: "action films, car culture, streetwear, hip-hop videos",
    rate: 240,
    images: [
      WM("1969 Chevrolet Camaro SS 3.jpg"),
      WM("Ford Mustang 5312665.jpg"),
      WM("Dodge Challenger SRT8 (2015) Hirschaid-20220709-RM-120221 (cropped).jpg"),
      WM("2005 Pontiac GTO, front left, 10-28-2022.jpg"),
      WM("Chevrolet Camaro RS 327 1968 (cropped).jpg"),
    ],
    models: [
      ["Chevrolet", "Camaro SS", 1969], ["Ford", "Mustang GT", 1968],
      ["Dodge", "Challenger", 2015], ["Pontiac", "GTO", 2005],
      ["Chevrolet", "Camaro RS", 1968],
    ],
  },
  {
    id: "exotic", name: "Exotic & Supercar", emoji: "🏎️",
    tagline: "Wedge-era icons and today's supercars for showstopper hero shots.",
    use: "luxury campaigns, music videos, supercar content, launches",
    rate: 520,
    images: [
      WM("Ferrari 308 GTS 5312189.jpg"),
      WM("Lamborghini Countach LP500S IMG 4464.jpg"),
      WM("Porsche 911 No 1000000, 70 Years Porsche Sports Car, Berlin (1X7A3888).jpg"),
      WM("Ferrari 308 5312150.jpg"),
    ],
    models: [
      ["Ferrari", "308 GTS", 1980], ["Lamborghini", "Countach", 1983],
      ["Porsche", "911 Turbo", 1985], ["Ferrari", "308 GTB", 1982],
    ],
  },
  {
    id: "military", name: "Military & Utility", emoji: "🛻",
    tagline: "Jeeps, trucks and hardware for grit and scale.",
    use: "war films, period drama, rugged brand shoots, documentaries",
    rate: 280,
    images: [
      WM("Jeep Willys MB.jpg"),
      WM("M35.jpg"),
      WM("Willys M606 in Switzerland (2019).jpg"),
      WM("2015 Land Rover Defender (L316 MY15) 90 3-door wagon (2015-10-24) 01.jpg"),
    ],
    models: [
      ["Willys", "MB Jeep", 1944], ["AM General", "M35 Cargo Truck", 1968],
      ["Jeep", "M606", 1965], ["Land Rover", "Defender 90", 2015],
    ],
  },
];

/* Deterministic catalogue generator: for every film metro × category,
   produce 5 shoot-ready listings (cycling the pool + photos). No RNG —
   stable across reloads. */
/* ---------- Occasion collections — when & why you'd shoot with a car.
   Each car is tagged with the occasions it suits; people-featuring
   public-domain photography. ---------- */
const OCC_BY_CAT = {
  vintage:  ["weddings", "engagement", "prom", "events"],
  luxury:   ["weddings", "events", "musicvideo", "prom"],
  muscle:   ["musicvideo", "events", "prom"],
  exotic:   ["musicvideo", "events"],
  military: ["events", "musicvideo"],
};
const OCCASIONS = [
  { id: "weddings",   name: "Weddings",        emoji: "💍", group: "occasion",
    tagline: "The getaway car that steals the album.",
    use: "wedding portraits, getaway cars, bridal-party photos",
    image: WMw("Wedding with red car (Unsplash).jpg", 1000) },
  { id: "engagement", name: "Engagement & Couples", emoji: "💕", group: "occasion",
    tagline: "Two people, one unforgettable frame.",
    use: "engagement, couples & anniversary shoots",
    image: WMw("Young bride and groom in car (Unsplash).jpg", 1000) },
  { id: "prom",       name: "Prom & Grad",     emoji: "🎓", group: "occasion",
    tagline: "The grand entrance, on film.",
    use: "prom, graduation and milestone portraits",
    image: EDITORIAL.heroDrive },
  { id: "events",     name: "Events & Parties", emoji: "🎉", group: "occasion",
    tagline: "Arrivals and parties worth a photo.",
    use: "galas, parties, brand activations, arrivals",
    image: EDITORIAL.studebaker },
  { id: "musicvideo", name: "Music Videos",    emoji: "🎬", group: "occasion",
    tagline: "The hero car for your next video.",
    use: "music videos, fashion films, brand spots",
    image: EDITORIAL.ford1929 },
];

const CATALOGUE = (() => {
  const out = [];
  const sellers = ["Verified owner", "Studio collective", "Private collector", "Classic garage", "Local creator"];
  let cursor = 0;
  CATEGORIES.forEach((cat) => {
    cat.models.forEach(([make, model, baseYear], i) => {
      const city = FILM_CITIES[cursor % FILM_CITIES.length]; cursor++;
      const cityNm = (CITIES.find((c) => c.slug === city) || {}).name || city;
      const dailyRate = cat.rate + i * 25;
      out.push({
        id: `car-${cat.id}-${i + 1}`,
        category: cat.id,
        intent: "rental",
        occasions: OCC_BY_CAT[cat.id] || [],
        make, model, year: baseYear,
        dailyRate,
        weeklyRate: dailyRate * 5,
        deposit: Math.round((dailyRate * 6) / 50) * 50,
        mileage: null,
        city,
        condition: "excellent",
        emoji: cat.emoji,
        image: cat.images[i],
        minAge: 25,
        shootReady: true,
        description: `${baseYear} ${make} ${model} available as a ${cat.name.split(" ")[0].toLowerCase()} backdrop for photo & film shoots in ${cityNm}. Ideal for ${cat.use}. Stationary or driving shots by arrangement; owner present on set.`,
        seller: sellers[i % sellers.length],
        created: "2026-06-20",
      });
    });
  });
  return out;
})();

// Merge the generated catalogue into the seed set.
SEED_LISTINGS.push(...CATALOGUE);

/* Expose globally for the prototype (no module bundler). */
/* ---------- Featured photographers (per metro) ----------
   Shoot pros you can bundle with any car as a package. Avatars are
   rendered as initials (no external images). rate = per shoot day. */
const PHOTOGRAPHERS = [
  { id: "ph-to-1", name: "Maya Okonkwo",   city: "toronto",   specialty: "Automotive & editorial", rate: 1200, styles: ["musicvideo", "events"],
    bio: "Shoots cars like characters — moody, cinematic, magazine-ready. 10+ years on car campaigns across the GTA." },
  { id: "ph-to-2", name: "Daniel Reyes",   city: "toronto",   specialty: "Weddings & couples",      rate: 900,  styles: ["weddings", "engagement"],
    bio: "Documentary-style wedding photographer who loves a great getaway car. Featured in Toronto Life weddings." },
  { id: "ph-va-1", name: "Priya Sharma",   city: "vancouver", specialty: "Fashion & editorial",     rate: 1350, styles: ["musicvideo", "events"],
    bio: "Editorial and lookbook specialist. West-coast light, clean lines, bold colour. Works with brands and labels." },
  { id: "ph-va-2", name: "Liam Chen",      city: "vancouver", specialty: "Music video & motion",    rate: 1500, styles: ["musicvideo", "events"],
    bio: "Director-DP hybrid for music videos and brand films. Hero-car visuals are his signature." },
  { id: "ph-mo-1", name: "Camille Tremblay", city: "montreal", specialty: "Fashion & portraits",    rate: 1100, styles: ["engagement", "events", "musicvideo"],
    bio: "Montréal fashion and portrait photographer. Bilingue. A warm, filmic eye for people and machines." },
  { id: "ph-mo-2", name: "Étienne Lefebvre", city: "montreal", specialty: "Weddings & events",      rate: 850,  styles: ["weddings", "engagement", "events"],
    bio: "Candid wedding and event coverage across Greater Montréal. Calm on set, beautiful in the album." },
  { id: "ph-ca-1", name: "Sarah MacLeod",  city: "calgary",   specialty: "Automotive & lifestyle",  rate: 950,  styles: ["events", "musicvideo"],
    bio: "Big-sky backdrops and clean automotive work. Calgary-based, mountains an hour away." },
  { id: "ph-ot-1", name: "Noah Bélanger",  city: "ottawa",    specialty: "Portraits & prom",        rate: 700,  styles: ["prom", "engagement", "weddings"],
    bio: "Portrait and milestone photographer — prom, grad and engagements with a polished, friendly style." },
  { id: "ph-wi-1", name: "Grace Beaulieu", city: "winnipeg",  specialty: "Period & film looks",     rate: 800,  styles: ["weddings", "events", "musicvideo"],
    bio: "Period-accurate styling in Winnipeg's heritage districts — perfect for a vintage car story." },
  { id: "ph-ha-1", name: "Owen Murphy",    city: "halifax",   specialty: "Coastal & lifestyle",     rate: 750,  styles: ["weddings", "engagement", "events"],
    bio: "Atlantic-coast light, relaxed sessions. Weddings, couples and brand shoots around Halifax." },
];

window.LYC_DATA = { CITIES, FILM_CITIES, SEED_LISTINGS, PILLARS, ARTICLES, CAR_IMAGES, EDITORIAL, CATEGORIES, OCCASIONS, PHOTOGRAPHERS };
