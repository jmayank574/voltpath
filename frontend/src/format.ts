import type { Assessment, Verdict } from "./types";

export function verdictClass(v: Verdict): string {
  return v === "feasible" ? "v-feasible" : v === "feasible_with_charging" ? "v-charging" : "v-infeasible";
}

export function verdictLabel(v: Verdict): string {
  return v === "feasible" ? "Feasible" : v === "feasible_with_charging" ? "Charging" : "Infeasible";
}

/** minutes -> "2h 10m" / "45m" / "on the dot" */
export function fmtDur(min: number): string {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return `${h}h ${r}m`;
  return `${r}m`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The single number that decides each row, by verdict. */
export function deciding(a: Assessment): { value: string; label: string } {
  if (a.verdict === "feasible") {
    const m = a.arrival_margin_min ?? 0;
    return { value: m >= 0 ? `${fmtDur(m)}` : `${fmtDur(m)}`, label: m >= 0 ? "slack" : "late" };
  }
  if (a.verdict === "feasible_with_charging") {
    return { value: `${a.num_charge_stops}`, label: a.num_charge_stops === 1 ? "charge stop" : "charge stops" };
  }
  // infeasible: distinguish range gap from late arrival.
  const isRange = a.reasons.some((r) => /out of range|strand/i.test(r));
  if (isRange) return { value: "Out of range", label: "no charger closes the gap" };
  const m = a.arrival_margin_min ?? 0;
  return { value: fmtDur(m), label: "past the window" };
}
