// lib/weather.js — Apple WeatherKit REST client for outdoor-event forecasts.
// Per MEET_SCHEDULE_WEATHER_SCOPE.md §4. Weather is fetched only for OUTDOOR
// venues within the forecast horizon, keyed on (venue lat/lng, event datetime
// in the venue tz). Aggressively cached upstream (db `weather_cache`, one row
// per venue+day) so a 50-swimmer meet collapses to one WeatherKit call/day.
//
// Mirrors the lib/push.js / lib/billing.js "inert until configured" pattern:
// WEATHER_ACTIVE is false until the key + ids are set, and EVERY failure path
// (no config, bad key, non-200, parse error, outside horizon) returns null so
// weather never blocks an event from rendering.
//
// Config — TWO accepted forms (the second respects the 20-env-var Hyperlift cap):
//   A) raw PEM + separate ids:
//        WEATHERKIT_CONFIG     = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
//        WEATHERKIT_KEY_ID     = the .p8 key id (10 chars)
//        APPLE_TEAM_ID         = the Apple Developer team id (already set for Apple auth)
//        WEATHERKIT_SERVICE_ID = the registered WeatherKit Service ID (e.g. com.delbraeth.swimworkout.weather)
//   B) single JSON blob in WEATHERKIT_CONFIG (one var total):
//        WEATHERKIT_CONFIG={"private_key":"-----BEGIN…","key_id":"..","team_id":"..","service_id":".."}
// The JWT is ES256, signed locally with Node crypto — no extra dependency.
import crypto from "crypto";

const HORIZON_DAYS = 10;        // WeatherKit daily forecast window
const HEAT_C = 32;              // ~90°F → heat advisory
const LIGHTNING_CODES = new Set(["Thunderstorms", "IsolatedThunderstorms", "ScatteredThunderstorms", "StrongStorms", "SevereThunderstorm", "Hurricane", "TropicalStorm"]);

function _loadConfig() {
  const raw = process.env.WEATHERKIT_CONFIG || process.env.WEATHERKIT_PRIVATE_KEY || "";
  // Form B: a single JSON blob carrying everything (respects the env-var cap).
  if (raw.trim().startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      let pem = j.private_key || j.privateKey || "";
      if (pem.indexOf("\\n") !== -1) pem = pem.replace(/\\n/g, "\n");
      return {
        pem: pem.trim(),
        keyId:     String(j.key_id || j.keyId || process.env.WEATHERKIT_KEY_ID || "").trim(),
        teamId:    String(j.team_id || j.teamId || process.env.APPLE_TEAM_ID || "").trim(),
        serviceId: String(j.service_id || j.serviceId || process.env.WEATHERKIT_SERVICE_ID || "").trim(),
      };
    } catch (_) { /* fall through to PEM form */ }
  }
  // Form A: raw PEM + separate id vars.
  let pem = raw;
  if (pem && pem.indexOf("\\n") !== -1) pem = pem.replace(/\\n/g, "\n");
  return {
    pem:       pem.trim(),
    keyId:     (process.env.WEATHERKIT_KEY_ID || "").trim(),
    teamId:    (process.env.APPLE_TEAM_ID || process.env.WEATHERKIT_TEAM_ID || "").trim(),
    serviceId: (process.env.WEATHERKIT_SERVICE_ID || "").trim(),
  };
}
const CFG = _loadConfig();
export const WEATHER_ACTIVE = !!(CFG.pem && CFG.keyId && CFG.teamId && CFG.serviceId);

export function weatherConfigState() {
  // Field-presence booleans (never the secret values) so the admin diagnostic
  // can pinpoint which of the four required pieces is missing when inactive.
  return {
    active: WEATHER_ACTIVE,
    service_id: WEATHER_ACTIVE ? CFG.serviceId : null,
    has_private_key: !!CFG.pem,
    has_key_id:      !!CFG.keyId,
    has_team_id:     !!CFG.teamId,
    has_service_id:  !!CFG.serviceId,
  };
}

// ── ES256 JWT (cached until shortly before expiry) ──────────────────────────
const _b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let _tokenCache = { jwt: null, exp: 0 };

function _mintToken() {
  const nowS = Math.floor(Date.now() / 1000);
  if (_tokenCache.jwt && _tokenCache.exp - nowS > 120) return _tokenCache.jwt;
  const exp = nowS + 30 * 60;
  const header  = { alg: "ES256", kid: CFG.keyId, id: `${CFG.teamId}.${CFG.serviceId}`, typ: "JWT" };
  const payload = { iss: CFG.teamId, iat: nowS, exp, sub: CFG.serviceId };
  const signingInput = `${_b64url(JSON.stringify(header))}.${_b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey({ key: CFG.pem });
  // dsaEncoding ieee-p1363 → raw r||s signature (JWT/JWS form), not DER.
  const sig = crypto.sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  const jwt = `${signingInput}.${_b64url(sig)}`;
  _tokenCache = { jwt, exp };
  return jwt;
}

// Admin diagnostic: sign a token and make ONE real WeatherKit call, surfacing
// the raw HTTP status so config problems are unambiguous:
//   200 → token + sub accepted (working).
//   401 → bad token / wrong `sub` (Service ID) / key not WeatherKit-enabled.
//   403 → identifier lacks the WeatherKit capability.
// Never throws; returns a structured result for /api/admin/weather/selftest.
export async function weatherSelfTest({ lat = 40.7128, lng = -74.0060, tz = "America/New_York" } = {}) {
  const state = weatherConfigState();
  if (!WEATHER_ACTIVE) return { active: false, reason: "not_configured", state };
  let token;
  try { token = _mintToken(); }
  catch (e) { return { active: true, stage: "sign", error: String(e.message || e), state }; }
  const url = `https://weatherkit.apple.com/api/v1/weather/en-US/${lat}/${lng}?dataSets=forecastDaily&timezone=${encodeURIComponent(tz)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    let bodyNote = null;
    if (!res.ok) { try { bodyNote = (await res.text()).slice(0, 200); } catch (_) {} }
    return { active: true, http_status: res.status, ok: res.ok, body_note: bodyNote, service_id: state.service_id };
  } catch (e) { return { active: true, stage: "fetch", error: String(e.message || e) }; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const C_TO_F = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));

// Local YYYY-MM-DD for an ISO instant in a given IANA tz (robust day matching).
function _localYmd(iso, tz) {
  try {
    const d = new Date(iso);
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    return f.format(d); // en-CA → "2026-07-05"
  } catch (_) { return String(iso).slice(0, 10); }
}

// WeatherKit conditionCode → a coarse human label + emoji.
function _conditionMeta(code) {
  const c = String(code || "");
  const emoji =
    /Thunder|Storm|Hurricane|Tropical/.test(c) ? "⛈️" :
    /Snow|Sleet|Flurries|Wintry|Blizzard|Ice|Hail/.test(c) ? "❄️" :
    /Rain|Drizzle|Shower/.test(c) ? "🌧️" :
    /Fog|Haze|Smoke/.test(c) ? "🌫️" :
    /Wind|Breezy/.test(c) ? "💨" :
    /Partly|MostlyCloudy|MostlyClear/.test(c) ? "⛅" :
    /Cloudy|Overcast/.test(c) ? "☁️" :
    /Clear|Sunny/.test(c) ? "☀️" : "🌡️";
  // Space out the CamelCase code for display ("PartlyCloudy" → "Partly Cloudy").
  const label = c.replace(/([a-z])([A-Z])/g, "$1 $2") || "Unknown";
  return { emoji, label };
}

// Fetch + shape the forecast for an outdoor venue on a given local day.
// Returns null on any not-configured / out-of-horizon / error condition.
//   lat, lng   : venue coordinates (required)
//   tz         : IANA timezone of the venue (for day/hour matching + display)
//   dayYmd     : "YYYY-MM-DD" event date (venue-local)
//   startTime  : "HH:MM" venue-local start (optional → enriches at-start + advisory)
export async function getForecast({ lat, lng, tz = "UTC", dayYmd, startTime = null }) {
  if (!WEATHER_ACTIVE) return null;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || !dayYmd) return null;
  // Horizon guard: skip past days and anything beyond the daily window.
  const todayMs = Date.now();
  const dayMs = new Date(`${dayYmd}T12:00:00Z`).getTime();
  if (!Number.isFinite(dayMs)) return null;
  const aheadDays = (dayMs - todayMs) / 86400000;
  if (aheadDays < -1 || aheadDays > HORIZON_DAYS + 1) return null;

  const wantHourly = !!startTime;
  const dataSets = wantHourly ? "forecastDaily,forecastHourly" : "forecastDaily";
  const url = `https://weatherkit.apple.com/api/v1/weather/en-US/${Number(lat)}/${Number(lng)}` +
              `?dataSets=${dataSets}&timezone=${encodeURIComponent(tz || "UTC")}`;
  let body;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${_mintToken()}` } });
    if (!res.ok) return null;
    body = await res.json();
  } catch (_) { return null; }

  const days = body?.forecastDaily?.days || [];
  const day = days.find(d => _localYmd(d.forecastStart, tz) === dayYmd);
  if (!day) return null;

  const { emoji, label } = _conditionMeta(day.conditionCode);
  const tMaxC = day.temperatureMax == null ? null : Math.round(day.temperatureMax);
  const tMinC = day.temperatureMin == null ? null : Math.round(day.temperatureMin);

  let atStart = null, lightning = false;
  if (wantHourly) {
    const hours = body?.forecastHourly?.hours || [];
    // Hours that fall on the event's local day → scan for storms; pick the hour
    // nearest the start time for the at-start snapshot.
    const dayHours = hours.filter(h => _localYmd(h.forecastStart, tz) === dayYmd);
    for (const h of dayHours) if (LIGHTNING_CODES.has(String(h.conditionCode))) lightning = true;
    const [sh] = String(startTime).split(":");
    const startHour = Number(sh);
    let best = null, bestDiff = 99;
    for (const h of dayHours) {
      let lh;
      try { lh = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", hour: "2-digit", hour12: false }).format(new Date(h.forecastStart))); }
      catch (_) { lh = new Date(h.forecastStart).getUTCHours(); }
      const diff = Math.abs(lh - startHour);
      if (diff < bestDiff) { bestDiff = diff; best = h; }
    }
    if (best) {
      const m = _conditionMeta(best.conditionCode);
      atStart = {
        conditionCode: best.conditionCode, condition: m.label, emoji: m.emoji,
        tempC: best.temperature == null ? null : Math.round(best.temperature),
        tempF: C_TO_F(best.temperature),
        precipChance: best.precipitationChance == null ? null : Number(best.precipitationChance),
      };
    }
  }

  return {
    day: dayYmd, source: "weatherkit",
    conditionCode: day.conditionCode, condition: label, emoji,
    tempMaxC: tMaxC, tempMinC: tMinC, tempMaxF: C_TO_F(day.temperatureMax), tempMinF: C_TO_F(day.temperatureMin),
    precipChance: day.precipitationChance == null ? null : Number(day.precipitationChance),
    atStart,
    advisory: {
      lightning,
      heat: tMaxC != null && tMaxC >= HEAT_C,
    },
  };
}
