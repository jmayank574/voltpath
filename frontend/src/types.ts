export interface Provenance {
  [field: string]: { trust: string; source_url?: string; accessed_date?: string; note?: string };
}

export interface Truck {
  id: string;
  make: string;
  model: string;
  variant: string;
  usable_kwh: number;
  published_range_mi: number;
  gvwr_lb: number;
  max_charge_kw: number;
  base_consumption_kwh_per_mi: number;
  reference_payload_lb: number;
  spec_source_url: string;
  spec_accessed_date: string;
  provenance: Provenance;
}

export interface Load {
  id: string;
  reference: string;
  origin_label: string;
  origin_lat: number;
  origin_lon: number;
  dest_label: string;
  dest_lat: number;
  dest_lon: number;
  weight_lb: number;
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_window_start: string;
  delivery_window_end: string;
  data_source: string;
}

export interface ChargerUsed {
  source: string;
  external_id: string;
  name: string | null;
  network: string | null;
  lat: number;
  lon: number;
  max_power_kw: number | null;
  num_dc_fast_ports: number | null;
  connector_types: string[];
  along_route_mi: number;
  picked: boolean;
}

export type Verdict = "feasible" | "feasible_with_charging" | "infeasible";

export interface Assessment {
  id: string;
  verdict: Verdict;
  reasons: string[];
  consumption_kwh_per_mi: number;
  energy_required_kwh: number;
  usable_energy_for_trip_kwh: number;
  charging_required: boolean;
  energy_to_add_kwh: number;
  charge_time_hours: number;
  charge_cost_usd: number;
  route_distance_mi: number;
  route_drive_hours: number;
  total_hours: number;
  projected_arrival: string;
  on_time: boolean;
  routing_provider: string;
  route_geometry: { type: string; coordinates: [number, number][] } | null;
  chargers_used: ChargerUsed[];
  soc_start_pct: number;
  reserve_pct: number;
  dwell_buffer_min: number;
  payload_coefficient_kwh_per_mi_per_ton: number;
  charge_efficiency: number;
  charge_soc_cap_pct: number;
  energy_price_per_kwh_usd: number;
  truck_snapshot: Record<string, unknown>;
  load_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface ParamDoc {
  name: string;
  value: number;
  unit: string;
  description: string;
  is_estimate: boolean;
}

export interface SourceDoc {
  name: string;
  url: string;
  used_for: string;
  trust: string;
}

export interface Methodology {
  params: ParamDoc[];
  sources: SourceDoc[];
  notes: string[];
}

export interface AssessParams {
  reserve_pct?: number;
  dwell_buffer_min?: number;
  payload_coefficient_kwh_per_mi_per_ton?: number;
  charge_efficiency?: number;
  charge_soc_cap_pct?: number;
  energy_price_per_kwh_usd?: number;
}
