import type { Load } from "../types";
import { fmtDateTime } from "../format";
import { SyntheticBadge } from "./Badge";

interface Props {
  loads: Load[];
  loadId: string;
  soc: number;
  loading: boolean;
  onLoad: (id: string) => void;
  onSoc: (v: number) => void;
  onAssess: () => void;
}

export function Controls({ loads, loadId, soc, loading, onLoad, onSoc, onAssess }: Props) {
  const load = loads.find((l) => l.id === loadId);

  return (
    <div>
      <p className="eyebrow">Dispatch a load</p>

      <div className="field">
        <label className="lbl">Load</label>
        <select value={loadId} onChange={(e) => onLoad(e.target.value)}>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.reference} — {l.origin_label} → {l.dest_label}
            </option>
          ))}
        </select>
      </div>

      {load && (
        <div className="load-card">
          <div className="load-lane">
            {load.origin_label} <span className="arrow">→</span> {load.dest_label}
          </div>
          <div className="load-meta">
            <span>{(load.weight_lb / 1000).toFixed(1)}k lb payload</span>
            <span>·</span>
            <span>deliver by {fmtDateTime(load.delivery_window_end)}</span>
            {load.data_source === "synthetic" && <SyntheticBadge />}
          </div>
        </div>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label className="lbl">Fleet starting battery (SoC)</label>
        <div className="slider-row">
          <input type="range" min={0} max={100} step={1} value={soc} onChange={(e) => onSoc(Number(e.target.value))} />
          <span className="val">{soc}%</span>
        </div>
        <div className="hint">Assumes every truck starts at this charge (no per-truck telemetry).</div>
      </div>

      <button className="btn-primary" onClick={onAssess} disabled={loading}>
        {loading ? "Assessing fleet…" : "Assess fleet"}
      </button>
    </div>
  );
}
