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
    id: "decide", phase: "Decision phase",
    title: "Should I sell or rent my car?",
    blurb: "Weighing your options. We give you the framework — the platform handles either path.",
    keywords: ["should I sell or rent my car", "how much is my car worth canada", "sell vs trade in canada"],
  },
  {
    id: "rental", phase: "Rental phase",
    title: "How do I rent out my car?",
    blurb: "Wide open in Canada. Insurance, tax, platforms, and earnings — all in one place.",
    keywords: ["how to list your car for rent", "list your car for rent", "rent my car out canada"],
  },
  {
    id: "trust", phase: "Trust phase",
    title: "Is this safe? Will I get scammed?",
    blurb: "Real fears, real answers. Scam protection, bills of sale, and safe-sale checklists.",
    keywords: ["bill of sale ontario car", "car sale scams canada", "sell car privately safely ontario"],
  },
  {
    id: "price", phase: "Pricing phase",
    title: "What should I ask for it?",
    blurb: "Price with confidence so you don't underprice, overprice, or abandon the sale.",
    keywords: ["how to price my car for private sale", "used car value canada", "best time to sell car canada"],
  },
  {
    id: "craft", phase: "Listing craft phase",
    title: "How do I write a good listing?",
    blurb: "You're ready to list — let's make it convert. Descriptions, photos, and templates.",
    keywords: ["how to list your car for sale", "list your car for sale for free", "how to write a car listing"],
  },
];

/* ---------- Articles (full-length) ----------
   Each article belongs to a pillar and renders via article.html.
   Disclaimer: educational content for Canadian owners, not legal,
   tax, or insurance advice. */
const ARTICLES = [

  /* ====================== Pillar 1 — Decide ====================== */
  { slug: "should-i-sell-or-rent-my-car", pillar: "decide", readMins: 9,
    title: "Should I sell or rent my car? A Canadian owner's guide",
    meta: "A clear framework for deciding whether to sell your car outright or rent it out for ongoing income in Canada, with the math and the trade-offs.",
    keywords: ["should I sell or rent my car", "sell vs rent your car canada", "rent or sell my car"],
    sections: [
      { h: null, p: "Every owner with a vehicle they're not driving much hits the same fork in the road: sell it for a lump sum, or rent it out for recurring income? There's no universal right answer — it depends on your cash needs, what the car is worth, how reliable it is, and how much hands-on management you'll tolerate. This guide gives you a framework to decide the way a Canadian owner actually should, and shows why you may not have to choose at all." },
      { h: "Start with one question: do you need the money now or over time?", p: "Selling converts your car into a single payment, usually within a few weeks. Renting trickles income in month after month but ties up the asset and your time. If you're buying a replacement vehicle, paying down high-interest debt, or moving and can't manage handoffs, the lump sum almost always wins. If the car is paid off, reliable, and would otherwise sit in the driveway, renting can quietly outperform a sale over a couple of years." },
      { h: "When selling is the right call", p: "Sell if any of these are true: you need the cash quickly; the car is approaching a costly maintenance cliff (timing belt, major brakes, an aging transmission); you're carrying insurance and parking costs you'd rather drop; or you simply don't want the ongoing responsibility. A clean private sale is final — you hand over the keys, file the paperwork, and you're done. For higher-mileage or older vehicles, selling also caps your exposure: you're not on the hook if a renter discovers a problem mid-trip." },
      { h: "When renting is the right call", p: "Rent if the car is dependable, fairly new, and frequently idle. A vehicle parked five days a week is a depreciating asset doing nothing. Renting it can turn that dead time into $500–$1,500 a month gross in a major Canadian city, depending on the vehicle. Renting also keeps your options open — you still own the car, can sell it later, and can stop any time. The trade-offs are real: you'll arrange specialized insurance, handle pickups and returns, clean between rentals, and absorb extra wear." },
      { h: "The break-even math, simplified", p: "Here's a quick way to compare. Estimate your car's realistic private-sale value (see our guide on what your car is worth). Then estimate your monthly net rental income — gross rental minus the insurance increase, cleaning, added maintenance, and any platform fees. Divide the sale price by that monthly net. The result is roughly how many months of renting it takes to equal selling today. If that number is under about 24 months and you're confident you'll keep the calendar reasonably full, renting likely comes out ahead. If it's longer, or you doubt you'll rent it consistently, take the sale." },
      { h: "Worked example", p: "Say your car would sell privately for $18,000. You think you can net $700/month renting it after expenses. $18,000 ÷ $700 ≈ 26 months to break even against selling. That's borderline — it only makes sense if you'll rent it steadily for well over two years and you value keeping the asset. Now imagine the same car nets $1,000/month: break-even drops to 18 months, and renting looks much stronger." },
      { h: "Don't forget the hidden costs of each path", p: "Selling has costs too: your time creating the listing and meeting buyers, possible safety-certificate or inspection fees, and the opportunity cost of the car sitting unsold. Renting's hidden costs are mostly ongoing — the mental load of managing bookings, the risk of damage or a bad renter, and the tax reporting obligation on rental income. Be honest with yourself about whether you'll actually enjoy (or at least tolerate) being a micro-rental operator." },
      { h: "You don't actually have to choose", p: "This is the part most owners miss. On listyourcar.ca you can list a vehicle as \"for sale, for rent, or both\" from a single listing. Choosing \"both\" puts your car in front of buyers and renters at the same time and lets the market tell you which demand is stronger. If a sale closes, your rental listing auto-delists; if you book a rental first, you keep earning while you wait for the right buyer. For owners genuinely on the fence, listing both ways is the lowest-risk way to decide." },
      { h: "A simple decision checklist", p: "Choose SELL if: you need cash soon, the car is older or maintenance-heavy, or you don't want ongoing hassle. Choose RENT if: the car is newer and reliable, it's often idle, and you're comfortable managing bookings and insurance. Choose BOTH if: you're unsure, the car is in good shape, and you'd be happy with either outcome. Whatever you pick, you can start free on listyourcar.ca and change course later." },
    ],
  },
  { slug: "how-much-is-my-car-worth-canada", pillar: "decide", readMins: 7,
    title: "How much is my used car worth in Canada? (2025 guide)",
    meta: "How to estimate your used car's private-sale value in Canada using live comparables, condition, history, and regional demand.",
    keywords: ["how much is my car worth canada", "used car value canada", "what is my car worth"],
    sections: [
      { h: null, p: "Before you decide to sell or rent — and certainly before you set a price — you need a defensible number. Canadian used-car values move with region, season, trim, and condition, not just the year and mileage on the window sticker. Here's how to triangulate a realistic figure you can stand behind when a buyer pushes back." },
      { h: "Step 1 — Pin down exactly what you have", p: "Value starts with specifics. Note the year, make, model, and — critically — the trim level, because a base model and a top trim of the same car can differ by thousands. Record the mileage, drivetrain (FWD/AWD/4x4), transmission, and standout options (sunroof, leather, tow package, winter tires on rims). The more precisely you describe your car, the more accurate your comparison set." },
      { h: "Step 2 — Build a live comparables set", p: "The single best valuation tool is the market itself. Search the major Canadian marketplaces for your exact trim within roughly 20,000 km of your mileage, in your province. Pull together 8–10 active listings and note both the asking prices and how long each has been listed. Asking prices run optimistic, so expect real sale prices to land about 5–10% below the median ask. Listings that have sat for weeks tell you where the ceiling is; fresh, well-priced ones show you the moving market." },
      { h: "Step 3 — Adjust for condition and history", p: "Condition can swing value by 15% or more. A clean CARFAX, complete service records, two sets of tires, and a no-accident history push you toward the top of your range. Cosmetic damage, mechanical needs, high mileage, aftermarket modifications, or a branded/rebuilt title pull you down — sometimes sharply. Be honest in your own assessment; buyers will discover the truth on the test drive and inspection, and an inflated price just wastes everyone's time." },
      { h: "Step 4 — Factor in your local market and season", p: "Geography matters in Canada. AWD vehicles, trucks, and SUVs command a premium in Calgary, Edmonton, and Winnipeg heading into winter. Fuel-efficient compacts and hybrids move faster and hold value better in dense, congested markets like Toronto and Vancouver. Convertibles and sporty cars peak in spring and early summer. The same car can be worth several hundred dollars more or less depending on where and when you list it." },
      { h: "Step 5 — Sanity-check against trade-in and instant-offer numbers", p: "Get a dealer trade-in quote and an instant cash-offer estimate online. These come in low — they're wholesale — but they set your floor. Your private-sale target should sit comfortably above the trade-in number; the gap is what you're being paid for the effort of selling privately. If the gap is small, selling privately may not be worth the hassle, which is itself useful information." },
      { h: "Putting it together", p: "Take your comparables median, shade it down 5–10% for realism, adjust up or down for your car's condition and local demand, and confirm it sits above your trade-in floor. That's your fair-market private-sale value. From there you can decide whether to sell, and our pricing guide covers exactly how to set an asking price with the right negotiation room." },
    ],
  },

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

  /* ====================== Pillar 4 — Trust ====================== */
  { slug: "private-car-sale-scams-canada", pillar: "trust", readMins: 8,
    title: "Private car sale scams in Canada: how to protect yourself (2025)",
    meta: "The most common private car sale scams in Canada targeting both buyers and sellers, with concrete steps to avoid each one.",
    keywords: ["car sale scams canada", "private car sale scams", "used car scams canada"],
    sections: [
      { h: null, p: "The vast majority of private car sales in Canada go smoothly. But scammers actively target both sellers and buyers, and their tactics are predictable once you know them. Recognizing the common playbooks — and following a few firm rules — is most of the protection you need." },
      { h: "Overpayment and fake-cheque scams (targets sellers)", p: "A \"buyer\" offers to pay more than your asking price, sends a cheque, money order, or e-transfer for the inflated amount, then asks you to refund the difference or forward money to a \"shipper.\" The original payment later bounces or is reversed, and your refund is gone. The rule: never refund an overpayment, and only release the car against fully cleared funds. Be especially wary of any buyer who hasn't seen the car but is eager to overpay." },
      { h: "Curbstoning (targets buyers)", p: "Curbstoners are unlicensed dealers posing as private sellers to offload problem cars — often with hidden damage, rolled-back odometers, or branded titles disguised as clean. Warning signs: the same phone number attached to multiple listings, reluctance to meet at a home address, a name on the ownership that doesn't match the seller, or pressure to close fast. Always verify that the seller's name matches the registration, and run a vehicle history report." },
      { h: "Test-drive theft and the 'my mechanic' trick (targets sellers)", p: "Some thieves use a test drive to steal the car or swap keys; others insist their mechanic must take the vehicle away alone for inspection. Protect yourself: photograph the buyer's driver's licence before any test drive, always ride along, meet in a public place during daylight, and never let the car leave with someone unaccompanied. A genuine buyer will happily bring a mechanic to you or meet at a shop with you present." },
      { h: "Fake escrow and 'shipping' scams (targets both)", p: "Scammers invent fake escrow services or shipping companies, often with convincing websites, to intercept payment. If someone insists on a specific escrow site you didn't choose, or wants the car shipped and paid through an unfamiliar third party, treat it as fraud. Stick to in-person transactions for local private sales." },
      { h: "Identity and 'verification code' scams", p: "A common newer scam: a supposed buyer asks to \"verify you're real\" by sending you a code, then uses it to hijack an account or set up fraud in your name. Never share verification codes sent to your phone, and be suspicious of any inquiry that immediately tries to move you off the platform and through hoops before discussing the actual car." },
      { h: "Safe-payment rules that defeat most scams", p: "Cash counted and verified at a bank branch, a bank draft confirmed directly with the issuing bank (not just by appearance), or an in-person e-transfer you watch land in your account are the safest options. Avoid personal cheques, money orders from strangers, and any payment you can't confirm has truly settled. Complete the bill of sale and ownership transfer before the keys change hands." },
      { h: "General habits that keep you safe", p: "Meet in public during the day, bring a friend, trust your instincts, and slow down — urgency is the scammer's favourite tool. For sellers, verify the buyer; for buyers, verify the car and the seller's identity, and get a pre-purchase inspection. Keep communication and records in one place. None of this is complicated, and together it shuts down nearly every scam in circulation." },
    ],
  },
  { slug: "ontario-car-bill-of-sale", pillar: "trust", readMins: 6,
    title: "Ontario car bill of sale: what you need and how to fill it out",
    meta: "What an Ontario car bill of sale must include, how the UVIP works, and how to complete a private sale correctly.",
    keywords: ["bill of sale ontario car", "ontario bill of sale", "uvip ontario"],
    sections: [
      { h: null, p: "In Ontario, a private used-vehicle sale runs through the Used Vehicle Information Package (UVIP), and the bill of sale is part of that process. Getting the paperwork right protects both parties and lets the buyer register the car without a hitch. Here's what you need and how to complete it." },
      { h: "The UVIP is the central document", p: "Ontario law requires the seller of a used vehicle to provide the buyer with a Used Vehicle Information Package, which you purchase from ServiceOntario (online or in person). The UVIP includes the vehicle's description, registration history, any liens registered against it, and the wholesale/retail value used to calculate tax. It also contains the bill of sale section the buyer needs at registration." },
      { h: "What the bill of sale must include", p: "A complete Ontario bill of sale records the date of sale, the purchase price, the vehicle's year, make, model, and VIN, and the full names, addresses, and signatures of both the seller and the buyer. Accuracy matters — the VIN and price especially — because the buyer relies on this document to transfer ownership and the Ministry uses the price to assess tax." },
      { h: "Check for liens before money changes hands", p: "The UVIP shows whether there's a lien registered against the vehicle. A buyer should never pay for a car with an outstanding lien unless it's being cleared as part of the sale, because the lienholder can have a claim on the vehicle even after purchase. Sellers should resolve any lien before listing, or be transparent about how it will be discharged at closing." },
      { h: "Completing the sale and transfer", p: "At the sale, the seller signs the transfer portion and the bill of sale, removes the licence plates (plates stay with the seller in Ontario), and hands over the UVIP and signed documents. The buyer then takes everything to ServiceOntario to register the vehicle, provide proof of insurance, and pay retail sales tax — calculated on the greater of the purchase price or the vehicle's wholesale value shown in the UVIP." },
      { h: "Keep copies and stay safe", p: "Both parties should keep a signed copy of the bill of sale for their records. Combine correct paperwork with safe selling habits — verified payment, a public meeting place, and confirming the buyer's identity — and your Ontario private sale should close cleanly. This is general information, not legal advice; check current ServiceOntario requirements, which can change." },
    ],
  },
  { slug: "sell-car-privately-safely-ontario", pillar: "trust", readMins: 7,
    title: "How to safely sell your car privately in Ontario",
    meta: "A safety-first checklist for selling your car privately in Ontario, from screening buyers to handing over the keys.",
    keywords: ["sell car privately safely ontario", "private car sale checklist canada", "safe car sale ontario"],
    sections: [
      { h: null, p: "Selling privately in Ontario nets you more than a trade-in, but only if you handle the meeting, the money, and the paperwork safely. Use this checklist to protect yourself at every stage of the sale." },
      { h: "Before you list", p: "Purchase your Used Vehicle Information Package (UVIP) from ServiceOntario, gather your service records, and resolve any outstanding lien. Decide your asking price and your walk-away number in advance. Take clear photos and write an honest description so the buyers who contact you are realistic about the car — this filters out a lot of wasted time before anyone shows up." },
      { h: "Screening inquiries", p: "Do a quick phone or message screen before agreeing to meet. Serious buyers ask specific questions about the car; scammers and time-wasters tend to be vague, pushy about price before seeing it, or eager to move off-platform. Trust your instincts — you're under no obligation to meet anyone who feels off." },
      { h: "At the meeting", p: "Meet in a public, well-lit place during daylight — many police stations offer safe-exchange zones. Bring a friend or family member. Before any test drive, photograph the buyer's driver's licence and always ride along; never hand over the keys to drive off alone. Keep your phone on you and your own valuables out of the car." },
      { h: "Handling payment safely", p: "Accept only payment you can verify has truly cleared: cash counted at a bank, a bank draft confirmed directly with the issuing bank, or an in-person e-transfer you watch arrive. Decline personal cheques and any 'overpayment' arrangement. Don't release the vehicle or sign over ownership until the funds are confirmed in your account or hand." },
      { h: "Closing the sale", p: "Complete the UVIP bill of sale with the date, price, VIN, and both parties' names, addresses, and signatures. Sign the transfer portion, remove your licence plates (they stay with you in Ontario), and give the buyer the UVIP and signed documents. Keep a copy for yourself." },
      { h: "After the sale", p: "Notify your insurer that you've sold the vehicle and cancel or transfer coverage. Keep your copy of the bill of sale in case of any future questions about liability or tax. Following these steps turns a private sale from a nerve-wracking unknown into a routine, low-risk transaction. This is general guidance, not legal advice — confirm current ServiceOntario rules before you sell." },
    ],
  },

  /* ====================== Pillar 5 — Price ====================== */
  { slug: "how-to-price-used-car-private-sale-canada", pillar: "price", readMins: 8,
    title: "How to price your used car for private sale in Canada",
    meta: "A practical, repeatable method for pricing your used car for private sale in Canada so it sells fast without leaving money on the table.",
    keywords: ["how to price my car for private sale", "used car value canada", "price used car canada"],
    sections: [
      { h: null, p: "Pricing is where private sellers most often go wrong. Price too high and your listing goes stale while buyers scroll past; price too low and you hand money to a stranger. Here's a repeatable method to land in the sweet spot — a number that sells reasonably fast and still respects your car's value." },
      { h: "Step 1 — Build a comparable set", p: "Find 8–10 active listings of your exact trim within roughly 20,000 km of your mileage, in your province. Record each asking price and, just as importantly, how long it's been listed. Stale, high-priced ads mark the ceiling buyers are ignoring; fresh, competitively priced ones show you the real market. This live snapshot beats any single online \"value estimate.\"" },
      { h: "Step 2 — Find your fair-market value", p: "Take the median of your comparables and shade it down 5–10%, because asking prices sit above actual sale prices. Then adjust for your car's specifics: a clean history, full service records, new tires or brakes, and desirable options nudge you up; high mileage, cosmetic damage, or mechanical needs pull you down. The result is your honest fair-market value." },
      { h: "Step 3 — Set an asking price with negotiation room", p: "Most Canadian buyers expect to negotiate, so list about 5–8% above your true target to give yourself room to come down to it. If your fair value is $20,000, listing around $21,000–$21,500 lets you settle near $20,000 while the buyer feels they won a discount. Don't overshoot — too far above market and you get no inquiries to negotiate with in the first place." },
      { h: "Step 4 — Price to how search works", p: "Buyers filter by round numbers, so price just under common thresholds: $19,900 captures everyone searching \"under $20,000,\" while $20,100 misses them entirely. Round, searchable numbers ($19,500, not $19,473) also read as more credible. Small choices here meaningfully affect how many people even see your ad." },
      { h: "Step 5 — Justify your price in the listing", p: "A price lands better when you back it up. Spell out the value drivers: clean CARFAX, complete service history, recent maintenance, two sets of tires, single owner, non-smoker. When buyers understand why you're priced where you are, they're less likely to lowball and more likely to accept your number." },
      { h: "Step 6 — Read the market response and adjust", p: "Your inquiries are data. Lots of messages and quick showings mean you're priced right — or even a touch low. Crickets for a week or two usually means you're priced too high for the market. Don't be stubborn: a modest, timely price drop re-surfaces your ad and signals seriousness far better than letting it rot for a month. Set your walk-away number in advance so you negotiate from confidence, not pressure." },
      { h: "Pulling it together", p: "Comparables down 5–10% for realism, adjusted for condition, plus a small negotiation cushion, priced to a searchable threshold, and justified in the listing — that's a number that sells. Revisit it if the market goes quiet, and you'll avoid both the stale-listing trap and the leaving-money-behind trap." },
    ],
  },
  { slug: "best-time-to-sell-a-used-car-canada", pillar: "price", readMins: 5,
    title: "When is the best time to sell a used car privately in Canada?",
    meta: "How seasonality affects used car prices in Canada and when to list your vehicle for the best result.",
    keywords: ["best time to sell car canada", "when to sell used car", "best season to sell car"],
    sections: [
      { h: null, p: "Timing won't make or break a sale, but in Canada's seasonal market it can add a few hundred dollars and shave days off your listing. Here's when different vehicles sell best — and the stretches to avoid." },
      { h: "Spring and early summer are the strongest window", p: "Demand peaks from roughly March through June. Tax refunds land, the weather lifts, and buyers shop ahead of road-trip season. Most vehicles sell faster and for a bit more during this window. Convertibles, sports cars, and motorcycles do especially well as the snow clears." },
      { h: "Winter favours specific vehicles", p: "Heading into winter — late fall through the first snowfalls — AWD vehicles, trucks, and SUVs come into their own, particularly across the Prairies and in snowbelt regions. If you're selling one of these, listing as the temperature drops can work in your favour. Including a set of winter tires sweetens the deal and supports your price." },
      { h: "Avoid the dead weeks", p: "Mid-December through early January is the slowest stretch of the year: buyers are distracted by the holidays and holding onto cash. Unless you need to sell immediately, list before the holidays or wait until the new year when shoppers return and resolutions (and refunds) kick in." },
      { h: "Match timing to your situation", p: "Seasonality is a tailwind, not a rule. If you need the money now, the best time to sell is now — a fair price and a strong listing matter far more than the calendar. But if you can choose, align your timing with your vehicle type and avoid the December lull to get the most from your sale." },
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
    ],
    models: [
      ["Cadillac", "Series 62", 1959], ["Chevrolet", "Bel Air", 1957],
      ["Ford", "Mustang", 1965], ["Volkswagen", "Beetle", 1967],
      ["Citroën", "DS", 1962], ["Cadillac", "Coupe DeVille", 1965],
      ["Buick", "Roadmaster", 1953],
    ],
  },
  {
    id: "luxury", name: "Luxury", emoji: "🚘",
    tagline: "Premium marques for high-gloss, aspirational frames.",
    use: "luxury brands, music videos, real-estate & lifestyle shoots",
    rate: 340,
    images: [
      WM("2025 Bentley Continental GTC - 01.jpg"),
      WM("Moscow, Bentley Continental, Aug 2025 01.jpg"),
    ],
    models: [
      ["Rolls-Royce", "Phantom", 2020], ["Bentley", "Continental GT", 2022],
      ["Mercedes-Benz", "S-Class", 2021], ["Jaguar", "XJ", 2018],
      ["Range Rover", "Autobiography", 2022], ["Aston Martin", "DB11", 2019],
    ],
  },
  {
    id: "muscle", name: "Muscle & American", emoji: "🏎️",
    tagline: "V8 muscle and chrome — loud, low and cinematic.",
    use: "action films, car culture, streetwear, hip-hop videos",
    rate: 240,
    images: [
      WM("1969 Chevrolet Camaro.jpg"),
      WM("1969 Chevrolet Camaro SS 3.jpg"),
      WM("Ford Mustang 5312665.jpg"),
    ],
    models: [
      ["Chevrolet", "Camaro SS", 1969], ["Ford", "Mustang GT", 1968],
      ["Dodge", "Charger", 1970], ["Pontiac", "GTO", 1967],
      ["Plymouth", "Barracuda", 1971], ["Dodge", "Challenger", 1970],
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
      WM("Ferrari 308 5312150.jpg"),
    ],
    models: [
      ["Ferrari", "308 GTS", 1980], ["Lamborghini", "Countach", 1983],
      ["Porsche", "911 Turbo", 1985], ["Ferrari", "Testarossa", 1987],
      ["Lamborghini", "Huracán", 2020], ["McLaren", "570S", 2019],
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
    ],
    models: [
      ["Willys", "MB Jeep", 1944], ["AM General", "M35 Cargo Truck", 1968],
      ["Land Rover", "Defender", 1995], ["AM General", "Humvee", 1998],
      ["Dodge", "WC Carryall", 1942], ["Jeep", "M606", 1965],
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
  CATEGORIES.forEach((cat) => {
    FILM_CITIES.forEach((city) => {
      for (let i = 0; i < 5; i++) {
        const [make, model, baseYear] = cat.models[i % cat.models.length];
        const img = cat.images[i % cat.images.length];
        const cityIdx = FILM_CITIES.indexOf(city);
        const dailyRate = cat.rate + i * 20 + cityIdx * 10;
        out.push({
          id: `cat-${cat.id}-${city}-${i + 1}`,
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
          image: img,
          minAge: 25,
          shootReady: true,
          description: `${baseYear} ${make} ${model} available as a ${cat.name.split(" ")[0].toLowerCase()} backdrop for photo & film shoots in ${(CITIES.find((c) => c.slug === city) || {}).name}. Ideal for ${cat.use}. Stationary or driving shots by arrangement; owner present on set.`,
          seller: sellers[i % sellers.length],
          created: "2026-06-20",
        });
      }
    });
  });
  return out;
})();

// Merge the generated catalogue into the seed set.
SEED_LISTINGS.push(...CATALOGUE);

/* Expose globally for the prototype (no module bundler). */
window.LYC_DATA = { CITIES, FILM_CITIES, SEED_LISTINGS, PILLARS, ARTICLES, CAR_IMAGES, EDITORIAL, CATEGORIES, OCCASIONS };
