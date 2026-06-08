// lib/notify.js — POLLED notify-trigger sweeps (Phase 5 #5 notify half).
//
// The push pipe (lib/push.js) + opt-in are already live; this fires real pushes
// on domain conditions that aren't tied to a single request. Event-driven
// notices (event cancellation) live inline in server.js; the POLLED ones live
// here and are called from the email worker's setInterval (lib/email.js).
//
// Currently: weather advisory — when an upcoming OUTDOOR event has a lightning
// or heat advisory in its forecast, push everyone who RSVP'd going/maybe, once
// (dedup via notifications_sent, mig 059). No-op unless BOTH push + WeatherKit
// are configured. Best-effort: never throws to the caller.
import {
  dbListUpcomingOutdoorEvents, dbListRsvpRespondentSubs, dbMarkNotifiedOnce, dbUnmarkNotifiedOnce,
  dbGetWeatherCache, dbPutWeatherCache,
  dbListUpcomingEventsForReminders, dbListUpcomingPracticesForReminders, dbListEventAudienceSubs,
} from "../db.js";
import { WEATHER_ACTIVE, getForecast } from "./weather.js";
import { PUSH_ACTIVE, sendPushToUser } from "./push.js";

const ADVISORY_WINDOW_HOURS = 48;   // only warn within ~2 days of the event
const CACHE_TTL_MS = 60 * 60 * 1000; // reuse a cached forecast for 1h
const REMINDER_WINDOW_HOURS = 48;   // nudge non-responders within ~2 days

// Resolve a forecast for an event, reusing the per-(venue,day) weather_cache so
// the sweep doesn't re-hit WeatherKit every run.
async function _forecastFor(ev) {
  const v = ev.venue;
  try {
    const cached = await dbGetWeatherCache(ev.venue_id, ev.date);
    if (cached?.payload && (Date.now() - cached.fetched_ms) < CACHE_TTL_MS) return cached.payload;
  } catch (_) {}
  const fc = await getForecast({ lat: v.latitude, lng: v.longitude, tz: v.timezone || "UTC", dayYmd: ev.date, startTime: ev.start_time || null });
  if (fc) { try { await dbPutWeatherCache(ev.venue_id, ev.date, fc); } catch (_) {} }
  return fc;
}

export async function runWeatherAdvisorySweep() {
  if (!PUSH_ACTIVE || !WEATHER_ACTIVE) return { skipped: "inactive" };
  let events;
  try { events = await dbListUpcomingOutdoorEvents(ADVISORY_WINDOW_HOURS); }
  catch (e) { console.warn(`[notify] outdoor-event query failed: ${e.message}`); return { error: e.message }; }

  let advisories = 0, pushed = 0;
  for (const ev of events) {
    if (!ev.venue || ev.venue.latitude == null) continue;
    let fc;
    try { fc = await _forecastFor(ev); } catch (e) { console.warn(`[notify] forecast failed for ${ev.id}: ${e.message}`); continue; }
    const adv = fc?.advisory;
    if (!adv || (!adv.lightning && !adv.heat)) continue;
    advisories++;
    const kind = adv.lightning ? "weather_lightning" : "weather_heat";  // distinct dedup keys
    const label = adv.lightning ? "⚡ Lightning risk" : "🥵 Heat advisory";
    let subs;
    try { subs = await dbListRsvpRespondentSubs("meet", ev.id, ["going", "maybe"]); }
    catch (e) { console.warn(`[notify] respondent lookup failed for ${ev.id}: ${e.message}`); continue; }
    for (const sub of subs) {
      let fresh;
      try { fresh = await dbMarkNotifiedOnce(kind, ev.id, sub); } catch (_) { fresh = false; }
      if (!fresh) continue;   // already warned this person about this event
      try {
        await sendPushToUser(sub, {
          title: `${label} — ${ev.name}`,
          body: `${ev.name} on ${ev.date}${ev.start_time ? ` at ${ev.start_time}` : ""}: ${adv.lightning ? "thunderstorms in the forecast" : `high near ${fc.tempMaxF}°F`}. Watch for schedule changes.`,
          url: "/assigned",
        });
        pushed++;
      } catch (e) {
        await dbUnmarkNotifiedOnce(kind, ev.id, sub);   // failed → let a later tick retry
        console.warn(`[notify] advisory push failed: ${e.message}`);
      }
    }
  }
  if (pushed) console.log(`[notify] weather sweep: ${advisories} advisory event(s), ${pushed} push(es)`);
  return { advisories, pushed };
}

// D1 — RSVP reminders. For each upcoming event/practice in the window, diff the
// audience (group/team roster, full accounts only) against who's responded, and
// push the non-responders once (dedup via notifications_sent). No-op unless push
// is configured. Best-effort: never throws to the caller.
export async function runRsvpReminderSweep() {
  if (!PUSH_ACTIVE) return { skipped: "inactive" };
  const targets = [];
  try {
    for (const e of await dbListUpcomingEventsForReminders(REMINDER_WINDOW_HOURS)) targets.push({ kind: "meet", ...e });
  } catch (e) { console.warn(`[notify] rsvp-reminder event query failed: ${e.message}`); }
  try {
    for (const p of await dbListUpcomingPracticesForReminders(REMINDER_WINDOW_HOURS)) targets.push({ kind: "practice", ...p });
  } catch (e) { console.warn(`[notify] rsvp-reminder practice query failed: ${e.message}`); }

  let reminded = 0;
  for (const t of targets) {
    let audience, responded;
    try {
      audience = await dbListEventAudienceSubs({ team_id: t.team_id, group_id: t.group_id });
      responded = new Set(await dbListRsvpRespondentSubs(t.kind, t.id, ["going", "maybe", "out"]));
    } catch (e) { console.warn(`[notify] rsvp-reminder roster failed for ${t.kind}:${t.id}: ${e.message}`); continue; }
    // Distinct dedup keys per kind so an event id and practice id never collide.
    const dedupKind = t.kind === "meet" ? "rsvp_reminder" : "rsvp_reminder_practice";
    for (const sub of audience) {
      if (responded.has(sub)) continue;
      let fresh;
      try { fresh = await dbMarkNotifiedOnce(dedupKind, t.id, sub); } catch (_) { fresh = false; }
      if (!fresh) continue;   // already nudged this person about this target
      try {
        await sendPushToUser(sub, {
          title: `📣 RSVP needed — ${t.name}`,
          body: `${t.name} on ${t.date}${t.start_time ? ` at ${t.start_time}` : ""}: you haven't responded yet.`,
          url: "/assigned",
        });
        reminded++;
      } catch (e) {
        await dbUnmarkNotifiedOnce(dedupKind, t.id, sub);   // failed → let a later tick retry
        console.warn(`[notify] rsvp reminder push failed: ${e.message}`);
      }
    }
  }
  if (reminded) console.log(`[notify] rsvp-reminder sweep: ${reminded} reminder(s)`);
  return { reminded };
}
