import type { Load, Truck } from "../types";
import { SyntheticBadge, TrustBadge } from "./Badge";

interface Props {
  loads: Load[];
  trucks: Truck[];
  loadId: string;
  truckId: string;
  soc: number;
  loading: boolean;
  onLoad: (id: string) => void;
  onTruck: (id: string) => void;
  onSoc: (v: number) => void;
  onAssess: () => void;
}

export function Controls({
  loads,
  trucks,
  loadId,
  truckId,
  soc,
  loading,
  onLoad,
  onTruck,
  onSoc,
  onAssess,
}: Props) {
  const load = loads.find((l) => l.id === loadId);
  const truck = trucks.find((t) => t.id === truckId);

  return (
    <div>
      <p className="section-title">Dispatch</p>

      <div className="field">
        <label>Load</label>
        <select value={loadId} onChange={(e) => onLoad(e.target.value)}>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.reference} — {l.origin_label} → {l.dest_label}
            </option>
          ))}
        </select>
        {load && (
          <div className="hint">
            {(load.weight_lb / 1000).toFixed(1)}k lb &nbsp;·&nbsp; deliver by{" "}
            {new Date(load.delivery_window_end).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            &nbsp; {load.data_source === "synthetic" && <SyntheticBadge />}
          </div>
        )}
      </div>

      <div className="field">
        <label>Candidate truck</label>
        <select value={truckId} onChange={(e) => onTruck(e.target.value)}>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.make} {t.model} — {t.variant}
            </option>
          ))}
        </select>
        {truck && (
          <div style={{ marginTop: 10 }}>
            <div className="spec-line">
              <span>Usable battery</span>
              <span className="sp-val">
                {truck.usable_kwh} kWh
                <TrustBadge trust={truck.provenance.usable_kwh?.trust ?? "—"} />
              </span>
            </div>
            <div className="spec-line">
              <span>Consumption (base)</span>
              <span className="sp-val">
                {truck.base_consumption_kwh_per_mi} kWh/mi
                <TrustBadge
                  trust={truck.provenance.base_consumption_kwh_per_mi?.trust ?? "—"}
                />
              </span>
            </div>
            <div className="spec-line">
              <span>Max charge power</span>
              <span className="sp-val">
                {truck.max_charge_kw} kW
                <TrustBadge trust={truck.provenance.max_charge_kw?.trust ?? "—"} />
              </span>
            </div>
            <div className="spec-line">
              <span>Reference payload</span>
              <span className="sp-val">
                {(truck.reference_payload_lb / 1000).toFixed(0)}k lb
                <TrustBadge
                  trust={truck.provenance.reference_payload_lb?.trust ?? "—"}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label>Starting battery (SoC)</label>
        <div className="slider-row">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={soc}
            onChange={(e) => onSoc(Number(e.target.value))}
          />
          <span className="val">{soc}%</span>
        </div>
      </div>

      <button className="btn-primary" onClick={onAssess} disabled={loading}>
        {loading ? "Assessing…" : "Assess feasibility"}
      </button>
    </div>
  );
}
