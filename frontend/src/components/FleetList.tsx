import type { Assessment } from "../types";
import { deciding, verdictClass, verdictLabel } from "../format";
import { VerdictDetail } from "./VerdictDetail";

interface Props {
  items: Assessment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FleetList({ items, selectedId, onSelect }: Props) {
  return (
    <div className="fleet">
      <div className="fleet-head">
        <p className="eyebrow" style={{ margin: 0 }}>Fleet ranking</p>
        <span className="count">{items.length} trucks · best first</span>
      </div>

      {items.map((a, i) => {
        const vc = verdictClass(a.verdict);
        const d = deciding(a);
        const sel = a.id === selectedId;
        const t = a.truck_snapshot as Record<string, unknown>;
        return (
          <div className={`frow ${vc} ${sel ? "sel" : ""}`} key={a.id}>
            <div className="frow-main" onClick={() => onSelect(a.id)}>
              <div className="frank">{i + 1}</div>
              <div className="ftruck">
                <div className="name">{String(t.make)} {String(t.model)}</div>
                <div className="variant">{String(t.variant)}</div>
              </div>
              <div className="fright">
                <span className={`pill ${vc}`}>
                  <span className="dot" />
                  {verdictLabel(a.verdict)}
                </span>
                <span className="deciding">
                  <span className="em">{d.value}</span> {d.label}
                </span>
              </div>
            </div>
            {sel && <VerdictDetail a={a} />}
          </div>
        );
      })}
    </div>
  );
}
