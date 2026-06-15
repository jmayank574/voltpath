import type { AssessParams, Methodology } from "../types";
import { EstimateBadge, TrustBadge } from "./Badge";

interface Props {
  methodology: Methodology;
  overrides: AssessParams;
  onChange: (name: keyof AssessParams, value: number) => void;
  onReset: () => void;
  onClose: () => void;
}

// Sensible slider ranges per knob.
const RANGE: Record<string, { min: number; max: number; step: number }> = {
  reserve_pct: { min: 0, max: 40, step: 1 },
  dwell_buffer_min: { min: 0, max: 120, step: 5 },
  payload_coefficient_kwh_per_mi_per_ton: { min: 0, max: 0.1, step: 0.005 },
  charge_efficiency: { min: 0.7, max: 1.0, step: 0.01 },
  charge_soc_cap_pct: { min: 50, max: 100, step: 1 },
  min_charger_power_kw: { min: 0, max: 400, step: 10 },
  energy_price_per_kwh_usd: { min: 0, max: 1, step: 0.01 },
};

export function MethodologyPanel({ methodology, overrides, onChange, onReset, onClose }: Props) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h2>Methodology &amp; data</h2>
            <p className="sub">
              Every assumption is a visible knob. Turn one and re-assess to see how
              much the verdict depends on it.
            </p>
          </div>
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="section-title">Model parameters</p>
        {methodology.params.map((p) => {
          const r = RANGE[p.name] ?? { min: 0, max: p.value * 2, step: p.value / 20 };
          const current = (overrides[p.name as keyof AssessParams] as number | undefined) ?? p.value;
          return (
            <div className="knob" key={p.name}>
              <div className="knob-head">
                <span className="knob-name">
                  {p.name} {p.is_estimate && <EstimateBadge />}
                </span>
                <span className="val">
                  {current}
                  {p.unit && p.unit !== "fraction" ? ` ${p.unit.replace("kWh/mi per ton", "")}` : ""}
                </span>
              </div>
              <div className="knob-desc">{p.description}</div>
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={current}
                onChange={(e) => onChange(p.name as keyof AssessParams, Number(e.target.value))}
              />
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, margin: "8px 0 24px" }}>
          <button className="ghost-btn" onClick={onReset}>
            Reset to defaults
          </button>
        </div>

        <p className="section-title">Real data sources</p>
        {methodology.sources.map((s) => (
          <div className="source-item" key={s.url}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
              <TrustBadge trust={s.trust.split(" ")[0]} />
            </div>
            <div className="used">{s.used_for}</div>
          </div>
        ))}

        <p className="section-title" style={{ marginTop: 24 }}>
          Stated assumptions &amp; simplifications
        </p>
        {methodology.notes.map((n, i) => (
          <p className="note" key={i}>
            {n}
          </p>
        ))}
      </div>
    </>
  );
}
