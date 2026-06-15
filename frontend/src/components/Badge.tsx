export function TrustBadge({ trust }: { trust: string }) {
  return <span className={`badge trust-${trust}`}>{trust}</span>;
}

export function SyntheticBadge() {
  return <span className="badge synthetic" title="Invented sample data, not real freight">sample data</span>;
}

export function EstimateBadge() {
  return <span className="badge estimate" title="An estimate, not a measured/published value">estimate</span>;
}
