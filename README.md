# Voltpath — EV Load Feasibility & Charging Planner

When a dispatcher assigns a freight load to an **electric** truck, someone has to
answer: *can this specific truck complete this specific run on time, given its
battery state, the payload weight, the route, and where it can actually charge
along the way?* For a diesel carrier that's trivial. For an electric carrier it's
the core operational risk. Voltpath makes that judgment **explicit, fast, and
auditable**.

Pick a load + a candidate truck → Voltpath returns a verdict:

- ✅ **Feasible** — completes on time, no charging needed
- ⚡ **Feasible with charging** — here's the charge plan (where, how long, cost, ETA)
- ❌ **Infeasible** — why (out of range with no viable charger, or charging blows the appointment)

…always with the supporting numbers and reasons behind it.

## The one rule: everything is grounded in real, citable data

This is the whole point. See **[DATA_SOURCES.md](DATA_SOURCES.md)** — every spec,
every API, every consumption figure, with URLs and access dates and a trust
label (`manufacturer` / `regulatory` / `measured` / `secondary` / `derived` /
`assumption`).

- **Real data is the default:** charging stations (NREL/NLR AFDC + Open Charge
  Map), routing (Mapbox Directions), truck specs (manufacturer / CARB filings).
- **The only synthetic data** is the sample load roster — every such row carries
  `data_source: "synthetic"` and renders a "sample data" badge. Trivial to swap
  for a real CSV.
- **Numbers are never invented to fill a gap.** Where a figure is derived or
  assumed, it's labeled as such in the UI (the methodology panel) and in code.
  If a provider is unreachable, the API fails loudly (HTTP 502) rather than
  fabricating values.

## The model (auditable, not a black box)

Every assumption is a named, surfaced parameter (see
[backend/app/domain/energy.py](backend/app/domain/energy.py) and
**[DECISIONS.md](DECISIONS.md)**):

- **Payload-adjusted consumption:** `C(p) = C_base + k·(p − p_ref)`, with `k`
  grounded in rolling-resistance physics (~51 Wh/ton-mile, arXiv:1804.05974).
- **Reserve:** arrive with ≥ `reserve_pct` battery (a visible setting).
- **Charging:** modeled to an 80% SoC cap; the high-SoC taper is explicitly not
  modeled (stated, not hidden). Charge power is the weaker of truck/charger.
- **Verdict:** range + time → one of three states, **with reasons + numbers**.

Each knob is **live-adjustable in the UI** — turn the payload coefficient and
watch the verdict move. The assumption that most affects the answer is the one
you can interrogate yourself.

## Stack

- **Backend:** FastAPI · PostgreSQL · SQLAlchemy + Alembic · UUID PKs · `Numeric`/`Decimal` for money & energy.
- **Frontend:** React + Vite + TypeScript · Mapbox GL map centerpiece.
- **External (swappable adapters, cached):** Mapbox Directions · NREL/NLR AFDC · Open Charge Map.
- **Tests:** 56 passing — exhaustive on the energy/feasibility model, plus schema/seed, adapters, service, and API integration.

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# Postgres (Docker). Host port 5433 avoids clashing with a local Postgres.
docker run -d --name voltpath-pg -e POSTGRES_USER=voltpath \
  -e POSTGRES_PASSWORD=voltpath -e POSTGRES_DB=voltpath -p 5433:5432 postgres:16

cp .env.example .env   # then fill in NREL_API_KEY, OPENCHARGEMAP_API_KEY, MAPBOX_TOKEN, MAPBOX_PUBLIC_TOKEN
#   DATABASE_URL=postgresql+psycopg://voltpath:voltpath@localhost:5433/voltpath

alembic upgrade head        # create schema
python -m app.seed.seed     # seed real trucks + synthetic loads
uvicorn app.main:app --reload --port 8000

pytest                      # 56 tests
```

API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_BASE=http://127.0.0.1:8000
npm run dev                 # http://localhost:5173
```

The Mapbox **public** token is served to the browser via `/api/config`; the
server-side token stays on the backend.

## Get the API keys (free)

- NREL/NLR: https://developer.nlr.gov/ (note: NREL retired `nrel.gov` on
  2026-05-29; keys are unchanged — see DATA_SOURCES.md)
- Open Charge Map: https://openchargemap.org/site/develop/api
- Mapbox: https://account.mapbox.com/ (a public `pk.` token works for both map + Directions)

## Deploy

### Backend → Railway
1. New project → Deploy from GitHub repo → set **Root Directory** to `backend`.
2. Add a **PostgreSQL** plugin (Railway injects `DATABASE_URL`; the app
   normalizes the scheme automatically).
3. Set env vars: `NREL_API_KEY`, `OPENCHARGEMAP_API_KEY`, `MAPBOX_TOKEN`,
   `MAPBOX_PUBLIC_TOKEN`.
4. The [Procfile](backend/Procfile) runs `alembic upgrade head` + seed + uvicorn.

### Frontend → Vercel
1. Import the GitHub repo → set **Root Directory** to `frontend`.
2. Set env var `VITE_API_BASE` to your Railway backend URL.
3. Vercel auto-detects Vite ([vercel.json](frontend/vercel.json) handles SPA rewrites).

## Honesty surface in the product

Open **"Methodology & data"** in the app: every model parameter with its value,
units, and an `estimate` badge where applicable; the real data sources with trust
labels and links; and the stated assumptions & simplifications. Synthetic loads
are badged. Per-truck specs show provenance (e.g. Volvo's usable-kWh is flagged
`secondary`, Tesla's battery is `regulatory` from the CARB filing).
