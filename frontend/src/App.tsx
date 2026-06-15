import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Assessment, AssessParams, Load, Methodology, Truck } from "./types";
import { Controls } from "./components/Controls";
import { VerdictCard } from "./components/VerdictCard";
import { MapView } from "./components/MapView";
import { MethodologyPanel } from "./components/MethodologyPanel";

export default function App() {
  const [token, setToken] = useState("");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [methodology, setMethodology] = useState<Methodology | null>(null);

  const [loadId, setLoadId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [soc, setSoc] = useState(80);
  const [overrides, setOverrides] = useState<AssessParams>({});

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  // Bootstrap.
  useEffect(() => {
    (async () => {
      try {
        const [cfg, t, l, m] = await Promise.all([
          api.config(),
          api.trucks(),
          api.loads(),
          api.methodology(),
        ]);
        setToken(cfg.mapbox_public_token);
        setTrucks(t);
        setLoads(l);
        setMethodology(m);
        if (l.length) setLoadId(l[0].id);
        if (t.length) setTruckId(t[0].id);
      } catch (e) {
        setError(`Could not reach the backend. ${(e as Error).message}`);
      }
    })();
  }, []);

  async function assess(nextOverrides: AssessParams = overrides) {
    if (!loadId || !truckId) return;
    setLoading(true);
    setError(null);
    try {
      const a = await api.assess({
        truck_id: truckId,
        load_id: loadId,
        soc_start_pct: soc,
        params: Object.keys(nextOverrides).length ? nextOverrides : undefined,
      });
      setAssessment(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Debounced re-assess when a knob moves (only if we already have a result).
  const debounce = useRef<number | undefined>(undefined);
  function onKnob(name: keyof AssessParams, value: number) {
    const next = { ...overrides, [name]: value };
    setOverrides(next);
    if (!assessment) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => assess(next), 350);
  }

  function resetKnobs() {
    setOverrides({});
    if (assessment) assess({});
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">
            Volt<span className="spark">path</span>
          </span>
          <span className="tag">EV load feasibility &amp; charging planner</span>
        </div>
        <button className="ghost-btn" onClick={() => setDrawer(true)}>
          Methodology &amp; data
        </button>
      </header>

      <div className="main">
        <aside className="panel">
          <Controls
            loads={loads}
            trucks={trucks}
            loadId={loadId}
            truckId={truckId}
            soc={soc}
            loading={loading}
            onLoad={setLoadId}
            onTruck={setTruckId}
            onSoc={setSoc}
            onAssess={() => assess()}
          />
          {error && <div className="error">{error}</div>}
          {assessment && <VerdictCard a={assessment} />}
        </aside>

        <div className="map-wrap">
          {token ? <MapView token={token} assessment={assessment} /> : null}
          {!assessment && (
            <div className="map-empty">
              Select a load and truck, then assess feasibility to see the route and
              charging plan.
            </div>
          )}
        </div>
      </div>

      {drawer && methodology && (
        <MethodologyPanel
          methodology={methodology}
          overrides={overrides}
          onChange={onKnob}
          onReset={resetKnobs}
          onClose={() => setDrawer(false)}
        />
      )}
    </div>
  );
}
