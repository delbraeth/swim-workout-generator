// src/lib/mapkit.js — MapKit JS loader + geocode helper (client-side only).
//
// The token is injected into `window.__MAPKIT_TOKEN__` by server.js at serve time
// from process.env.MAPKIT_TOKEN (with a deploy-time fallback from .env). When unset
// it stays the literal placeholder "__MAPKIT_TOKEN_VALUE__", which we treat as "not
// configured" so MapKit is simply skipped (no script load, no errors) — every caller
// degrades gracefully.
//
// MapKit JS tokens are origin-scoped ES256 JWTs meant to live in the browser, so
// shipping the token in the HTML is by design (not a secret leak). Geocoding with
// a `mapkit_js`-scoped token must happen client-side; the server cannot use it.

const PLACEHOLDER = "__MAPKIT_TOKEN_VALUE__";
const MAPKIT_SRC   = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";

let _loadPromise = null;

// The configured token, or null when absent / still the build placeholder.
export function mapKitToken() {
  if (typeof window === "undefined") return null;
  const t = window.__MAPKIT_TOKEN__;
  return (t && t !== PLACEHOLDER) ? t : null;
}

export function isMapKitConfigured() {
  return !!mapKitToken();
}

// Loads + initializes MapKit JS exactly once (singleton). Resolves with the global
// `mapkit`. Rejects with Error("mapkit_not_configured") when no token is present.
export function loadMapKit() {
  if (_loadPromise) return _loadPromise;
  const token = mapKitToken();
  if (!token) {
    _loadPromise = Promise.reject(new Error("mapkit_not_configured"));
    return _loadPromise;
  }
  _loadPromise = new Promise((resolve, reject) => {
    const init = () => {
      try {
        if (!window.mapkit) { reject(new Error("mapkit_global_missing")); return; }
        if (!window.__mapkitInited) {
          window.mapkit.init({ authorizationCallback: (done) => done(token) });
          window.__mapkitInited = true;
        }
        resolve(window.mapkit);
      } catch (e) { reject(e); }
    };
    if (window.mapkit) { init(); return; }
    let s = document.getElementById("mapkit-js");
    if (!s) {
      s = document.createElement("script");
      s.id = "mapkit-js";
      s.src = MAPKIT_SRC;
      s.crossOrigin = "anonymous";
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", init, { once: true });
    s.addEventListener("error", () => reject(new Error("mapkit_load_failed")), { once: true });
  });
  return _loadPromise;
}

// Geocode a free-form address string → { latitude, longitude, formatted }.
// Rejects on no-results / lookup error / not-configured.
export function geocodeAddress(addressString) {
  return loadMapKit().then((mapkit) => new Promise((resolve, reject) => {
    const geocoder = new mapkit.Geocoder({ getsUserLocation: false, language: "en-US" });
    geocoder.lookup(addressString, (error, data) => {
      if (error) { reject(error instanceof Error ? error : new Error("geocode_failed")); return; }
      const r = data && data.results && data.results[0];
      if (!r || !r.coordinate) { reject(new Error("geocode_no_results")); return; }
      resolve({
        latitude:  r.coordinate.latitude,
        longitude: r.coordinate.longitude,
        formatted: r.formattedAddress || addressString,
      });
    });
  }));
}
