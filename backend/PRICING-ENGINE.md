# Fonzkart pricing engine

One pricing system on the Spring Boot backend and PostgreSQL, used by the website, the Customer app (live price while
answering), the Partner app (pickup check) and the Admin app (overview, suggestions, resales, repair costs).
Engine version `2026.11-v3` (v3: smartphones follow the used-phone market, see below).

## Why it changed

The old engine took the same percentage of the max value for a defect across a whole category. A cracked screen
"cost" 30% on a ₹8,000 budget phone and on a ₹1.5 lakh foldable alike. That underpaid one customer and overpaid on
the other. Every max value also had to be maintained by hand.

## The offer, step by step

Every device has a **price sheet**: what each answer takes off. The server builds it (`PriceSheetService`). The phone
downloads it once and recalculates on every tick (`mobile/packages/core/src/priceSheet.ts`). The server books the
order from the same sheet (`SheetPricer`), so the live price, the quote and the booked price are the same number.
`golden/price-sheet-cases.json` holds the cases the Java and TypeScript implementations must agree on.

```
max value (flawless, with box and bill)
 × each "how it looks and sells" share        scratches, body, age, missing accessories, bought abroad
   (answers to one question overlap: 1 − Π(1 − share), up to the question's cap)
 − each repair, in rupees, once per part      screen, camera, battery, port, board, Face ID …
 − labour (first job, less for each further one)
 → never below the lowest offer (admin %, 15% to start)
 → never above what resales show Fonzkart can pay at its margin (only once resales exist; not below the lowest offer)
 → never above the max value; rounded down to ₹10; exactly the max value when nothing is wrong
```

* **Answers that overlap are paid once.** "WiFi" + "SIM" + "Bluetooth" are one board repair. "Touch not working" +
  "cracked screen" are one display. "Camera" + "blurry camera" are one camera (`PartCatalog`).
* **The breakdown is returned with every quote.** The Customer app shows it as "How we worked out your price", so the
  customer sees where every rupee went.

## Smartphones follow the used-phone market (v3, 2026-11-27)

The owners asked for Fonzkart's offers to land near what Cashify and Cashkr pay. Both parts of the offer were measured
on those platforms in November 2026 (spreadsheet Fonzkart-Phone-Resale-Prices.xlsx) and the engine now follows them:

* **Max values:** `catalog/market-prices.json` holds the average of the two platforms' "up to" price for 1,789 phone
  variants. `MarketPriceImport` applies it once per version on startup (after the launch prices). A variant neither
  platform lists moves by the same ratio as the other storage sizes of its model. An auto variant gets the market
  factor that makes the monthly revaluation aim at the market price; if that factor would be outside 0.7–1.3 the
  variant becomes manual. Every change is in `PriceHistory`. A later launch-prices.json version re-prices auto
  variants from the rule again, so a new market file should follow it.
* **Cuts:** `MarketCuts` holds the market's cut for each smartphone answer (the two platforms averaged). A cosmetic
  answer takes that share; a repair answer costs that share of the max value less the first job's labour (so one
  problem lands exactly on the market), unless the part's repair estimate is more (foldable displays). An admin's
  rule still wins as before. Answers without market data (camera glass, bought abroad) keep the built-in figures.
* **Fonzkart's own cuts (2026-11-28):** the owners set a few figures above the market's. Screen good 15%, average 30%,
  below average 50%; "Screen Not Original" (a new Functional Problems tile, a display repair, so taken once with a
  cracked screen) 50%; a faulty fingerprint sensor on an Android phone 50% (iPhones keep the market's 23.5%).

Other categories are unchanged.

## Repair costs: from the best evidence available

`RepairCostEstimator` weighs every kind of evidence by how much it can be trusted (credibility weighting, as insurers
use when their own data is thin):

| Evidence | Weight | Where it comes from |
|---|---|---|
| Admin's own cost for the model | 8 | Admin app → Pricing engine → Repairs ("admin") |
| Official brand price list | 6, at 75% of list | Same screen ("official"), e.g. Apple, Samsung and Xiaomi India price pages |
| Fonzkart's own repair price list | 4, at 75% | the Repair service's `RepairPrice` table, already maintained |
| What Fonzkart paid on this model | 1 per repair | recorded with each resale |
| …on other models of the same kind and brand tier | 0.3 per repair, scaled by launch price | same |
| Prior: the part's usual share of the launch price | 1.5 (0.9 if the launch price is estimated) | `PartCatalog` ratios |

A brand-wide row counts 60% and a category-wide row 40%. Older evidence counts less: half after 180 days.
`confidence = Σweight / (Σweight + 4)`.

**The prior** comes from official India price lists. Apple's estimator puts the iPhone 18 Pro Max display at 24% of
launch, its back glass at 9% and its battery at 8%. The iPhone 15 display is 32%. Samsung's "key spare part cost"
page shows Galaxy S and A displays at 18–25%, and budget batteries cost ₹900–2,000. Foldable displays get their own
ratio: the iPhone Duo inner display is ₹1,49,900, half its launch price. The prior is taken at 75%, like the lists it
comes from, and falls 10% a year since launch, down to 55%, because parts for older models cost less.

**Uncertainty buys a buffer, never a guess.** A repair estimate is padded by up to 20% × (1 − confidence). A rough
prior costs the customer a little more caution, and Fonzkart is not exposed. Where nothing is known (no launch price
and no max value), the answer takes its category share as before, instead of an invented rupee figure.

**Admin rules still win, safely.** A rule for a cosmetic answer replaces the built-in share, as before. A rule for a
*repair* answer is the **least** it takes: an old "screen 20%" rule can't make a ₹40,000 foldable display cost
₹9,000.

**The model's launch price** scales repair costs. The engine looks in three places, in order:

1. The lowest launch price recorded for any variant of the model. A screen costs the same on 128 GB and 1 TB.
2. `catalog/model-reference.json`, covering about 110 of the most traded phones.
3. A launch price worked back from the max value, at most 2× and marked "estimated", so it counts for less.

## Max values that keep themselves current

A variant is **auto** when its launch price and month are known and no admin has set its price by hand. Every night
`PricingJobs` revalues each auto variant once a month:

```
max value = MaxValueRule(launch price, age) × market factor
```

Each month moves a price by at most 8%, and every change is kept in `PriceHistory`. An admin's catalog edit makes the
variant **manual**, and the engine never touches it again. The models in `catalog/launch-prices.json` (492 since
version 2026-11-16, which added the Apple Watches still on placeholder prices) start as auto. Any other variant becomes
auto once its launch price is entered: Admin app → Pricing engine, or `PUT /api/pricing/engine/variants/{id}`.

A new version of `launch-prices.json` is applied once on startup. A listed model matches every catalog model of that
brand and name under any name of its category (watch / smartwatch, tv / smarttv), duplicates included; a manual
variant keeps its price. What the run did is saved in `AppSetting` `catalog.launchPrices.lastResult`.
`catalog/model-images.json` is applied the same way for pictures: a model gets its listed picture only while it still
shows the wrong one the file names (a phone photo standing in for a watch, a missing file).

Watches whose brands keep no launch price on record for them (Samsung, Pixel, OnePlus, Xiaomi, boAt) keep the prices
the team set; the age curve has not been checked against watch resale prices outside Apple's. Earbuds are not
repaired, so a dead pair takes 70% of the max value and a case that will not charge 35%.

## Learning from Fonzkart's own data

`PricingLearningService` runs every night, and on demand from the Admin app:

1. **Resales.** For every resold device it works out the most Fonzkart could have paid at its target margin:
   `resale × (1 − margin) − repairs − logistics`. It compares that with what Fonzkart did pay. Per model, the ratio
   shows whether the max values are too high (margin lost) or too low (offers below market).
2. **Pickup checks.** It compares the price approved at pickup with what the engine says for the answers the
   executive checked. If approvers keep moving a model's price the same way, its max value is off.
3. **Catalog checks** (`CatalogChecks`) catch prices that can't be right:
   * a bigger storage variant priced below a smaller one;
   * a 5G variant below its WiFi version;
   * a Pro below the base model of the same generation;
   * a newer generation below the older one;
   * four or more models of a brand at one identical price (placeholders);
   * a price far from what the launch-price rule says;
   * unpriced variants.

   These are exactly the mistakes that had to be found by hand before.
4. **Margin alerts.** A category whose resales made less than half the target margin over 90 days raises an alert.

Evidence is shrunk toward "no change" (k = 3), so one sale can never move a price much. Suggestions are capped at
±15%. With "auto apply" on (the default), the engine applies a max-value change by itself only when it is at most 5%
and at least 60% confident. Everything else waits in Admin app → Pricing engine → Suggestions, as a one-tap Apply or
Dismiss. A dismissed suggestion stays quiet for 30 days.

Once a model has two or more resales, its price sheet carries a **profit guard**: the offer never exceeds what that
resale value allows at the target margin. It is applied live, before any max value is changed.

## External data sources, evaluated

| Source | What it gives | Reliability | Cost / access | Used how |
|---|---|---|---|---|
| Brand spare-part price pages (Apple India repair estimator, Samsung India "key spare part cost", Xiaomi India spare-part prices; Right to Repair portal for links) | Official part prices per model | High, but they are service-centre prices: above what a refurbisher pays | Free, public, no API | The 75% factor; entered as "official" rows (one row or a bulk list of up to 2,000) |
| Fonzkart's repair price list (`RepairPrice`) | Fonzkart's own repair prices | High for Fonzkart | Already maintained | Used automatically |
| Fonzkart's resales and pickup checks | Real costs and real market value | Highest, once there is volume | Free; needs resales to be recorded | The learning above |
| Launch prices (brand press releases, Indian tech press) | MRP and launch month | High | Free, manual | `launch-prices.json`, `model-reference.json`, admin entry |
| Amazon Product Advertising API | Current retail prices | — | PA-API 5 was retired in 2026 for the Creators API (OAuth, needs a qualifying Associates account) | Not used: current new prices, not used-market prices |
| Flipkart Affiliate API | Product feed with prices | Medium | Approved affiliates only, affiliate-marketing use; manual approval reported | Not used for the same reason; could feed launch prices later |
| Cashify, OLX, other resellers | Used-market prices | Medium | No API; scraping breaks their terms and breaks without warning | Not used |
| Paid price-scraping vendors (Apify actors, PriceAPI…) | Marketplace prices | Varies | Per-request fees, legally grey for some sites | Not used; possible later for launch prices only |

The decision: **no runtime dependency on a third party.** The engine runs on official lists entered once, Fonzkart's
own repair list, and above all Fonzkart's own transactions. These improve with volume and cost nothing. A paid feed
can later be added as one more "official"-type evidence row, without changing the engine.

## What the admin needs to do (and what is optional)

* **Nothing, to keep running.** Max values with launch data age by themselves, repairs are priced per model, and
  suggestions arrive nightly.
* **Recommended:** record resales (Admin app → Pricing engine → Resales: order number, sale price, grade, repairs).
  These are the data the engine learns most from.
* **Optional:**
  * paste official part prices for the most bought models;
  * add launch prices to old manual variants so they are kept current too;
  * look at the suggestions now and then.

## Trade-offs

* **The profit guard can pull offers below the max value** when resales show a model resells for less. The customer
  sees an honest "Resale market adjustment" line rather than a price Fonzkart would lose money on. It never goes below
  the lowest offer, even when resales say it should (the floor protects customers; such quotes are flagged).
* **Priors are deliberately cautious** (official-list based, padded by uncertainty). Early offers for devices with
  many repair answers are a little lower than a pure-percentage engine would give. They converge as evidence comes in.
* **Learning changes max values, not individual answers.** Deductions per answer get better through repair-cost
  evidence. Changing cosmetic shares per model from data would need far more volume than Fonzkart has today.
* **The schema is created by the backend** (`pricing/schema.sql`, `IF NOT EXISTS`, the same as
  `prisma/migrations/20261116000000_pricing_engine`), so a deploy needs no hand-run SQL. If creation failed, quotes
  still work without the engine's data.

## API

| Endpoint | Access |
|---|---|
| `GET /api/pricing/sheet?device=&variant=` — a device's price sheet | public |
| `POST /api/orders/quote` — now with `breakdown`, `confidence`, `floorApplied`, `engineVersion` | public |
| `POST /api/pricing/calculate` — optional `device` + `variant` to price from the model's sheet | public |
| `GET/PUT /api/pricing/settings` — adds `targetMarginPercent`, `logisticsCost`, `autoApply` | read public, write admins |
| `GET /api/pricing/engine/overview` · `POST /api/pricing/engine/run` | admins |
| `GET /api/pricing/engine/suggestions?status=` · `POST /api/pricing/engine/suggestions/{id}` `{action: apply\|dismiss}` | admins |
| `GET/POST /api/pricing/engine/sales` · `DELETE /api/pricing/engine/sales/{id}` | admins |
| `GET/PUT /api/pricing/engine/repair-costs` (one row or `{rows: [...]}`) · `DELETE …/{id}` | admins |
| `GET /api/pricing/engine/explain?device=&variant=` — sheet, sources, launch reference, resale evidence | admins |
| `GET/PUT /api/pricing/engine/variants/{id}` — launch data, auto/manual, history | admins |

Every quote and order price is logged in `PriceQuote`, with its breakdown, confidence and engine version.

## Tests

* `SheetPricerTest`, `RepairCostEstimatorTest`, `CatalogChecksTest`: the steps, the evidence weighting and the checks.
* `PriceSheetGoldenTest` and `mobile/packages/core/src/priceSheet.test.ts`: the same 17 cases on server and phone.
* `PricingEngineIntegrationTest` (PostgreSQL), which checks that:
  * the schema is created at startup;
  * a screen costs differently on an iPhone, a foldable and a budget phone;
  * official prices and the repair list feed the estimate;
  * an admin rule is the least a repair takes;
  * quotes are logged;
  * a price edit pins a variant;
  * monthly revaluation moves in small steps;
  * resales add a profit guard and a one-tap suggestion;
  * catalog checks give one-tap fixes;
  * settings have safe limits.
