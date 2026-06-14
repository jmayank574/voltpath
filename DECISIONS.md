# DECISIONS.md

Running log of non-trivial engineering and modeling decisions: the choice, the reason, the tradeoff accepted, and the date. Newest at the bottom of each section.

---

## 2026-06-14 — Project kickoff

### D1. Routing + map provider: Mapbox
- **Choice:** Mapbox Directions (routing) + Mapbox GL (map view).
- **Why:** one provider covers reliable real-road routing *and* the centerpiece map; generous free tier; production-grade (the OSRM public demo server is explicitly not for production). Operator confirmed.
- **Tradeoff:** introduces an API key dependency vs. the keyless OSRM demo. Mitigated by hiding all routing behind a `RoutingProvider` interface so OSRM/Valhalla/Mapbox are swappable.
- **Security detail:** server-side Directions calls use a secret token kept on the backend; the frontend uses a separate **public `pk` token for map display only**.

### D2. External data: live from day one, no fixtures in the product
- **Choice:** integrate NREL, Open Charge Map, and Mapbox against real APIs as soon as keys land. No fabricated/cached fixture data masquerading as real.
- **Why:** the product's credibility is its real data. Operator provisioning all three keys.
- **Tradeoff:** model/API work that touches live data is blocked until keys exist — so we sequence the **pure energy/feasibility model + its unit tests first** (needs no external calls), then wire live adapters. Unit tests use fixed known-input/known-output cases; that is standard TDD, not fabricated product data.
- **Caching:** Directions and charger-API responses are cached (DB/TTL) so a feasibility check doesn't burn free-tier quota on every call.

### D3. Seed fleet: all three real trucks
- **Choice:** Freightliner eCascadia, Volvo VNR Electric, Tesla Semi.
- **Why:** spans the relevant Class 8 BEV range; Tesla Semi additionally has real NACFE *measured* consumption data, anchoring the energy model.
- **Tradeoff:** Volvo's usable-kWh is a secondary source; flagged in data and UI until an official figure is found.

### D4. Money & energy as Decimal where it's currency
- **Choice:** `Numeric`/`Decimal` for dollar amounts (energy cost). Physics quantities (kWh, miles, hours) computed as float, converted to `Decimal` at the cost boundary.
- **Why:** floats are unsafe for money; but Decimal trig/scaling in the physics core is awkward and buys nothing for kWh accuracy.
- **Tradeoff:** a float→Decimal boundary to keep straight. Documented and centralized in the cost function.

### D5. Energy model — transparent physics over opaque fit
- **Payload-adjusted consumption:** `C(p) = C_base + k·(p − p_ref)` where `p` = payload in tons.
  - `C_base` calibrated per-truck to a published/measured kWh/mi at reference payload `p_ref`.
  - `k` (marginal kWh/mi per ton) grounded in rolling-resistance physics and the cited ≈51 Wh/ton-mile figure (arXiv 1804.05974). Exposed as a visible parameter.
- **Reserve:** energy available for the trip = `usable_kwh × (SOC_start − reserve_pct)/100`. `reserve_pct` is a surfaced setting, not a magic number.
- **Charging:** time = energy_to_add ÷ `min(truck_max_kw, station_max_kw) × efficiency`. **Simplification:** modeled as constant power up to an 80% SoC cap; the high-SoC taper is *not* modeled. This is explicitly flagged in the UI. It is conservative on usable range and (slightly) optimistic on charge speed near full — stated, not hidden.
- **Verdict:** `FEASIBLE` / `FEASIBLE_WITH_CHARGING` / `INFEASIBLE`, always returned with the reasons and the underlying numbers so a dispatcher can audit it.
- **Why this approach:** a skeptical founder can read every term. Each assumption is a named parameter surfaced in a Methodology panel.

### D6. Stack
- Backend: FastAPI + PostgreSQL, SQLAlchemy + Alembic, UUID PKs.
- Frontend: React + Vite + TypeScript, Mapbox GL map.
- Deploy: Railway (backend) + Vercel (frontend).
