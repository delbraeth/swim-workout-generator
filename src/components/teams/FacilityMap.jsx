// src/components/teams/FacilityMap.jsx — client-side MapKit JS map for a single
// facility's address. Geocodes the address on mount, then drops a pin. Renders a
// small status line (and no map) when MapKit isn't configured, there's no address,
// or the address can't be located. React is a runtime global.
import { loadMapKit, geocodeAddress, isMapKitConfigured } from "../../lib/mapkit.js";

function facilityAddressString(f) {
  const a = f && f.address;
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.region, a.postal_code, a.country]
    .filter(Boolean).join(", ");
}

export function FacilityMap({ facility = null, height = 220 }) {
  const ref = React.useRef(null);
  // loading | ready | error | empty | unconfigured
  const [status, setStatus] = React.useState("loading");

  const addr = facilityAddressString(facility);
  const name = (facility && facility.name) || "Facility";

  React.useEffect(() => {
    let alive = true;
    let map = null;
    if (!isMapKitConfigured()) { setStatus("unconfigured"); return; }
    if (!addr) { setStatus("empty"); return; }
    setStatus("loading");
    (async () => {
      try {
        const mapkit = await loadMapKit();
        const { latitude, longitude, formatted } = await geocodeAddress(addr);
        if (!alive || !ref.current) return;
        const coord = new mapkit.Coordinate(latitude, longitude);
        map = new mapkit.Map(ref.current, {
          showsZoomControl:  true,
          showsCompass:      mapkit.FeatureVisibility.Hidden,
          isRotationEnabled: false,
        });
        map.region = new mapkit.CoordinateRegion(
          coord, new mapkit.CoordinateSpan(0.008, 0.008));
        map.addAnnotation(new mapkit.MarkerAnnotation(coord, {
          title: name, subtitle: formatted,
        }));
        if (alive) setStatus("ready");
      } catch (e) {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      if (map) { try { map.destroy(); } catch (_) {} }
    };
  }, [addr, name]);

  const note = {
    unconfigured: "Map unavailable (location service not configured).",
    empty:        "No address on file to map.",
    error:        "Couldn’t locate this address on the map.",
    loading:      "Loading map…",
  }[status];

  // The map div must have real dimensions while MapKit attaches, so keep it
  // visible during loading too — only hide it for the no-map states.
  const showBox = status === "ready" || status === "loading";

  return (
    <div style={{ marginTop: 4, marginBottom: 4 }}>
      {status !== "ready" && (
        <div style={{ fontSize: 11, color: "var(--color-text-dim)", padding: "4px 2px" }}>{note}</div>
      )}
      <div
        ref={ref}
        style={{
          width: "100%", height, borderRadius: 8, overflow: "hidden",
          border: "1px solid var(--color-border)",
          display: showBox ? "block" : "none",
        }}
      />
    </div>
  );
}
