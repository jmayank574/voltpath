import type { Assessment } from "../types";

const VERDICT_META: Record<string, { cls: string; label: string }> = {
  feasible: { cls: "v-feasible", label: "Feasible" },
  feasible_with_charging: { cls: "v-charging", label: "Feasible with charging" },
  infeasible: { cls: "v-infeasible", label: "Infeasible" },
};

function fmtHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

function fmtArrival(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function VerdictCard({ a }: { a: Assessment }) {
  const meta = VERDICT_META[a.verdict];
  const picked = a.chargers_used.find((c) => c.picked);

  return (
    <div className={`verdict ${meta.cls}`}>
      <div className="v-head">
        <span className="v-dot" />
        <span className="v-label">{meta.label}</span>
      </div>

      <ul className="reasons">
        {a.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="metrics">
        <div className="metric">
          <div className="k">Route</div>
          <div className="v">
            {a.route_distance_mi.toFixed(0)} <small>mi</small>
          </div>
        </div>
        <div className="metric">
          <div className="k">Drive time</div>
          <div className="v">{fmtHours(a.route_drive_hours)}</div>
        </div>
        <div className="metric">
          <div className="k">Energy needed</div>
          <div className="v">
            {a.energy_required_kwh.toFixed(0)} <small>kWh</small>
          </div>
        </div>
        <div className="metric">
          <div className="k">Usable on board</div>
          <div className="v">
            {a.usable_energy_for_trip_kwh.toFixed(0)} <small>kWh</small>
          </div>
        </div>
        <div className="metric">
          <div className="k">Projected arrival</div>
          <div className="v" style={{ fontSize: 15 }}>
            {fmtArrival(a.projected_arrival)}
          </div>
        </div>
        <div className="metric">
          <div className="k">On time</div>
          <div className="v">{a.on_time ? "Yes" : "No"}</div>
        </div>
      </div>

      {a.charging_required && picked && (
        <div className="charge-plan">
          <div className="cp-title">⚡ Charge plan</div>
          <div className="cp-body">
            Add <strong>{a.energy_to_add_kwh.toFixed(0)} kWh</strong> (
            {fmtHours(a.charge_time_hours)}) at{" "}
            <strong>{picked.name ?? picked.network ?? "corridor charger"}</strong>
            {picked.max_power_kw ? ` — up to ${picked.max_power_kw} kW` : ""}, ~
            {picked.along_route_mi.toFixed(0)} mi in. Est. cost{" "}
            <strong>${a.charge_cost_usd.toFixed(2)}</strong>.
          </div>
        </div>
      )}

      {a.charging_required && !picked && (
        <div className="charge-plan">
          <div className="cp-title">No viable charge stop</div>
          <div className="cp-body">
            This run needs charging, but no reachable corridor charger with known
            power was found within the model's limits.
          </div>
        </div>
      )}
    </div>
  );
}
