import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Assessment } from "../types";

interface Props {
  token: string;
  assessment: Assessment | null;
}

export function MapView({ token, assessment }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const loadedRef = useRef(false);

  // Initialize the map once.
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-119.4, 35.5],
      zoom: 5,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      loadedRef.current = true;
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#12a36b", "line-width": 4, "line-opacity": 0.85 },
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [token]);

  // Redraw whenever the assessment changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !assessment) return;

    const draw = () => {
      const geom = assessment.route_geometry;
      const coords = (geom?.coordinates ?? []) as [number, number][];
      const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        });
      }

      // Reset markers.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = new mapboxgl.LngLatBounds();

      if (coords.length) {
        const origin = coords[0];
        const dest = coords[coords.length - 1];
        for (const [pt, cls] of [
          [origin, "origin"],
          [dest, "dest"],
        ] as [[number, number], string][]) {
          const el = document.createElement("div");
          el.className = `map-endpoint ${cls}`;
          markersRef.current.push(new mapboxgl.Marker(el).setLngLat(pt).addTo(map));
          bounds.extend(pt);
        }
      }

      for (const c of assessment.chargers_used) {
        const el = document.createElement("div");
        el.className = `map-charger-pin${c.picked ? " picked" : ""}`;
        const label = `${c.name ?? c.network ?? "Charger"}${
          c.max_power_kw ? ` · ${c.max_power_kw} kW` : ""
        }${c.picked ? " · charge stop" : ""}`;
        const marker = new mapboxgl.Marker(el)
          .setLngLat([c.lon, c.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(label))
          .addTo(map);
        markersRef.current.push(marker);
        if (c.picked) bounds.extend([c.lon, c.lat]);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 600 });
      }
    };

    if (loadedRef.current) draw();
    else map.once("load", draw);
  }, [assessment]);

  return <div id="map" ref={containerRef} />;
}
