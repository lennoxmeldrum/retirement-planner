# 🌏 Retirement Cost Planner

Estimate what retirement costs in different parts of the world — rent from a zoomable
map, a granular cost-of-living builder, future-year projections and multi-currency
totals. Built as a static Vite + React app, deployed to Google Cloud Run.

## Built-in regions (researched July 2026)

| Region | Zones | Currency |
|---|---|---|
| 🇦🇺 South-East Queensland (Brisbane, Gold Coast, Sunshine Coast, Noosa, Toowoomba) | 11 | AUD |
| 🇨🇦 Eastern Ontario corridor (Toronto → Kingston → Ottawa → Quebec border) | 9 | CAD |
| 🇹🇭 Bangkok to Hua Hin (central BKK, Nonthaburi, Cha-am, Hua Hin, Pranburi) | 8 | THB |

## How it works

- **Map-driven rent** — each region is divided into hand-drawn price zones
  (polygons, not circles, so a beachfront strip is priced differently from the
  suburb one street back). The rent estimate is the area-weighted average of the
  zones visible in the viewport for your requirements (property type, bedrooms,
  furnished). Zoom in for a tighter estimate, or click a zone to lock to it.
- **Cost-of-living builder** — 7 categories, ~27 inputs, ~90 granular options:
  utilities, internet/mobile tiers, groceries by brand tier, dining, transport
  (new/used car, scooter, bicycle, public transport), health insurance,
  visas & income tax, lifestyle, and per-event luxury items (concerts, domestic
  trips, international flights, cruises) with a quantity-per-year control.
- **Quick or granular** — four lifestyle bands (Essential / Comfortable /
  Premium / Luxury) set every option instantly; everything stays individually
  tunable afterwards.
- **Year slider** — projects costs to any year through 2051 using per-region CPI
  assumptions (editable). FX is held constant and editable.
- **Currencies** — totals in US$, CA$ or A$.
- **Funding & Monte Carlo** — the "Can I afford this?" panel simulates 1,000
  market futures against your portfolio, contributions, allocation, government
  pensions (means-tested Australian Age Pension built in), other income streams,
  a legacy target, and an optional Australian property (postcode-based growth
  assumption; sale adds 80% of gross value to the portfolio in your chosen year).
- **Settings** — add a *new region anywhere in the world* via Gemini research with
  Google Search grounding (zones, polygons, full price map), refresh prices for
  existing regions, discover cost inputs the planner doesn't cover yet, and
  export/import all your data (stored in browser localStorage).

The three built-in regions work entirely offline from curated datasets — Gemini is
only needed for the research features.

## Local development

```bash
npm install
npm run dev
```

Optional: put a Gemini API key in Settings (stored in localStorage) to enable
research features locally.

## Deploying to Cloud Run

The repo is connected directly to Cloud Run (Cloud Run → "Set up continuous
deployment"), so every push to `main` triggers a Cloud Build that builds the
`Dockerfile` (Vite build served by nginx on port 8080) and rolls out a new
revision. No GitHub Actions workflow is needed.

On the Cloud Run service, set `GEMINI_API_KEY` (or generic `API_KEY`) to enable the
research features — it's injected at container start via `runtime-config.js`, no
rebuild needed.

## Accuracy notes

Prices are median/typical figures researched July 2026 (sources listed inside each
region dataset and shown in the app). Baselines: RTA/SQM median rents (QLD),
Rentals.ca / liv.rent reports (Ontario), FazWaz & expat cost guides (Thailand),
insurer pricing for age ~65. Tax and visa figures are indicative — the app shows
its assumptions in the Taxes & visas category. Always verify the big-ticket items
before committing to a move.
