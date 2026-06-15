import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Assessment, AssessParams, Load, Methodology } from "./types";
import { Controls } from "./components/Controls";
import { FleetList } from "./components/FleetList";
import { MapView } from "./components/MapView";
import { MethodologyPanel } from "./components/MethodologyPanel";

export default function App() {
  const [token, setToken] = useState("");
  const [loads, setLoads] = useState<Load[]>([]);
  const [methodology, setMethodology] = useState<Methodology | null>(null);

  const [loadId, setLoadId] = useState("");
  const [soc, setSoc] = useState(80);
  const [overrides, setOverrides] = useState<AssessParams>({});

  const [items, setItems] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, l, m] = await Promise.all([api.config(), api.loads(), api.methodology()]);
        setToken(cfg.mapbox_public_token);
        setLoads(l);
        setMethodology(m);
        if (l.length) setLoadId(l[0].id);
      } catch (e) {
        setError(`Could not reach the backend. ${(e as Error).message}`);
      }
    })();
  }, []);

  async function assessFleet(nextOverrides: AssessParams = overrides) {
    if (!loadId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.assessFleet({
        load_id: loadId,
        soc_start_pct: soc,
        params: Object.keys(nextOverrides).length ? nextOverrides : undefined,
      });
      setItems(res.items);
      setSelectedId(res.items[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Debounced re-assess when a knob moves (only once a result exists).
  const debounce = useRef<number | undefined>(undefined);
  function onKnob(name: keyof AssessParams, value: number) {
    const next = { ...overrides, [name]: value };
    setOverrides(next);
    if (!items.length) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => assessFleet(next), 350);
  }
  function resetKnobs() {
    setOverrides({});
    if (items.length) assessFleet({});
  }

  const selected = items.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">Volt<span className="spark">path</span></span>
          <span className="tag">EV load feasibility &amp; charging planner</span>
        </div>
        <button className="ghost-btn" onClick={() => setDrawer(true)}>Methodology &amp; data</button>
      </header>

      <div className="main">
        <aside className="panel">
          <Controls
            loads={loads}
            loadId={loadId}
            soc={soc}
            loading={loading}
            onLoad={(id) => { setLoadId(id); setItems([]); setSelectedId(null); }}
            onSoc={setSoc}
            onAssess={() => assessFleet()}
          />
          {error && <div className="error">{error}</div>}
          {loading && !items.length && <div className="loading">Routing the lane and scanning corridor chargers…</div>}
          {items.length > 0 && (
            <FleetList items={items} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>

        <div className="map-wrap">
          {token ? <MapView token={token} assessment={selected} /> : null}
          {!selected && (
            <div className="map-empty">
              Pick a load and assess the fleet — the best truck's route and charge
              stops plot here.
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
