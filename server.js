// Setforge — Node/Express server
//
// Reads/writes from MariaDB (vero_swimgen on the CyberPanel VM). All workout
// history, favorites, settings, sessions, audit events, and invite codes
// live in the database. See db.js for the schema and helpers.
//
// Endpoints:
//   GET  /                          → static page (public/index.html)
//   GET  /api/workouts              → list this user's workouts
//   POST /api/log-workout           → save a workout
//   PATCH  /api/workouts/:id        → update notes/dateCompleted/completed
//   DELETE /api/workouts/:id        → remove an entry
//   GET  /api/favorites             → list favorited labels (any section)
//   POST /api/favorites             → add a label (warmup/drill/main/cooldown)
//   DELETE /api/favorites/:label    → remove a label
//   GET  /api/favorite-sets         → list favorited set IDs (per-user)
//   POST /api/favorite-sets         → add a set ID
//   DELETE /api/favorite-sets/:id   → remove a set ID
//   GET  /api/settings              → user prefs (slider bounds, pace input)
//   POST /api/settings              → update prefs
//   GET  /healthz                   → liveness probe
//
//   GET  /api/auth/apple            → redirect to Apple sign-in
//                                     supports ?invite=CODE for new users
//   POST /api/auth/callback         → Apple posts back here (form_post)
//   POST /api/auth/native           → iOS native sign-in
//   GET  /api/auth/status           → { authenticated: bool }
//   GET  /api/auth/csrf             → returns CSRF token for current session
//   GET  /api/auth/sessions         → list this user's active sessions
//   POST /api/auth/signout-all-others → revoke all sessions except current
//   GET  /api/auth/signout          → revoke current session, redirect /
//
// Required env vars:
//   DB_CONFIG (JSON blob: host/user/password/port/name) — or the legacy
//   DB_HOST/DB_USER/DB_PASSWORD fallback. See db.js for details.
//
// Apple Sign-In env vars (all required when Apple auth is active):
//   APPLE_TEAM_ID            — 10-char team ID from Apple Developer console
//   APPLE_CLIENT_ID          — Services ID you registered (e.g. com.example.swimapp)
//   APPLE_NATIVE_BUNDLE_ID   — iOS app bundle ID; falls back to APPLE_CLIENT_ID if not set.
//   APPLE_KEY_ID             — Key ID of the .p8 private key
//   APPLE_PRIVATE_KEY        — Contents of the .p8 file (newlines as \n or literal)
//
// Other env vars:
//   PORT             — listen port (default: 8080, Hyperlift sets this)
//   APP_URL          — Public HTTPS URL (default: https://setforge.io)
//   ALLOW_NO_ORIGIN  — "true" to allow curl/local testing without Origin header

import express   from "express";
import crypto    from "crypto";
import path      from "path";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import helmet    from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { OAuth2Client as GoogleOAuth2Client } from "google-auth-library";
import { enqueueEmail, startEmailWorker, EMAIL_ACTIVE } from "./lib/email.js";
import { BILLING_ACTIVE, billingConfigState, createCheckoutSession, createPortalSession, processWebhookEvent, verifyWebhookSignature, grantTier, revokeTier, getBillingStatusFor, getBillingHistoryFor } from "./lib/billing.js";
import { PUSH_ACTIVE, pushConfigState, sendPushToUser } from "./lib/push.js";
import { WEATHER_ACTIVE, weatherConfigState, getForecast, weatherSelfTest } from "./lib/weather.js";
import { resolveTeamFlags, unionFlags } from "./src/lib/featureFlags.js";
import { IAP_ACTIVE, appleIapConfigState, verifyTransaction, applyVerifiedTransaction, processNotification, checkCrossChannel } from "./lib/appleIap.js";
import { buildIcs } from "./lib/ics.js";
import { toCsv } from "./lib/csv.js";
import { eventKindEmoji } from "./src/lib/eventKinds.js";

import {
  pool, dbActive, pingDb,
  dbListWorkouts, dbWorkoutExists, dbInsertWorkout, dbGetWorkout, dbPatchWorkout, dbDeleteWorkout,
  dbGetSettings, dbUpsertSettings, dbPatchSettingsExtra,
  dbListFavorites, dbAddFavorite, dbRemoveFavorite,
  dbListFavoriteSets, dbAddFavoriteSet, dbRemoveFavoriteSet,
  dbListDisfavorites, dbAddDisfavorite, dbRemoveDisfavorite,
  dbListDisfavorSets, dbAddDisfavorSet, dbRemoveDisfavorSet,
  dbGetEffectiveDisfavorites,
  dbGetEffectiveFavorites,
  dbGetUgcOverlay,
  dbCreateUgcOption, dbGetUgcOption, dbListUgcOptionsByAuthor, dbUpdateUgcOption, dbDeleteUgcOption,
  dbSetUgcOptionVisibility,
  dbListPendingUgc, dbReviewUgcOption, dbGetLatestUgcReview,
  dbListPromotableUgc, dbMarkUgcPromoted, buildUgcGraduateSnippet,
  dbGetCoachImpact,
  dbGetProgrammingMix, dbGetScheduleAdherence, dbGetCurationLog, dbGetProgramRecap,
  dbGetPlatformHealth, dbGetCurationSupport,
  dbStartImpersonation, dbEndImpersonation, dbGetActiveImpersonation, dbValidateImpersonationHeader,
  dbListGoals, dbSetGoal, dbDeleteGoal,
  dbInsertFeedback, dbAdminListFeedback, dbAdminUpdateFeedback,
  isMinor, postFeedbackToDiscord,
  dbIsUser, dbIsAdmin, dbIsCoach, dbHasLessonAccess, dbIsSupportRole, dbConsumeInviteCode, dbEnsureUser, dbAuditEvent, dbGetMe, dbUpdateMe, dbGetBootstrapForUser,
  dbGetOrCreateAppleAppAccountToken, dbGetAppleAppAccountToken,
  dbGetUserSubByProvider, dbLinkOAuthProvider, dbFindUserByVerifiedEmail,
  dbAdminListUsers, dbAdminSetUserFlag, dbAdminUpdateUser, dbAdminDeleteUser,
  dbExportAccount,
  dbAdminListInvites, dbAdminCreateInvite, dbAdminDeleteInvite,
  dbAdminListAuditEvents,
  dbCreateSession, dbGetSession, dbTouchSession,
  dbRevokeSession, dbRevokeSessionByPrefix, dbRevokeOthersByUser, dbListSessions,
  dbGetOrCreateCsrf, dbVerifyCsrf,
  dbCreateTeam, dbGetTeam, dbListTeamsForCoach, dbUpdateTeam, dbArchiveTeam,
  dbGetTeamFlagsRow, dbSetTeamFlags, dbListUserTeamsForFlags,
  dbGetTeamRole, dbListTeamCoaches, dbAddTeamCoach, dbRemoveTeamCoach, dbListCoachesForPicker,
  dbUpdateTeamCoachRole, dbTransferGroupPrimary,
  dbProposeOwnershipTransfer, dbCancelOwnershipTransfer, dbAcceptOwnershipTransfer,
  dbDeclineOwnershipTransfer, dbGetPendingTransferForTeam, dbListIncomingTransfersForCoach,
  dbAssertTeamWriter,
  dbAddTeamFavorite, dbRemoveTeamFavorite,
  dbAddTeamDisfavorite, dbRemoveTeamDisfavorite,
  dbListTeamCuration, dbGetTeamSettings, dbSetTeamDefault,
  dbListTeamFacilities, dbCreateTeamFacility, dbUpdateTeamFacility, dbArchiveTeamFacility,
  dbGetOrCreateTeamCalendarToken, dbRotateTeamCalendarToken, dbGetTeamByCalendarToken,
  dbTeamCalendarFeedData, dbTeamRosterForExport, dbListTeamCalendarsForUser,
  dbListEventTimes, dbUpsertEventTime, dbDeleteEventTime, dbResolveRaceGoals,
  dbAddEventPrHistory, dbListEventPrHistory, dbDeleteEventPrHistory,
  dbApplyTeamDefaultToRoster, dbListTeamDefaultsForUser, dbGetTeamRoster, dbGetTeamAttendanceLog,
  dbCreateParentInvite, dbRevokeParentInvite, dbConsumePendingInvitesForUser,
  dbListPendingInvitesForUser, dbAcceptParentInvite, dbDeclineParentInvite,
  dbListGuardiansForSwimmer, dbListParentInvitesForSwimmer, dbRemoveGuardian,
  dbCanAccessPersonAddress, dbIsGuardianOrSelf, dbListPersonAddresses,
  dbAddPersonAddress, dbUpdatePersonAddress, dbRemovePersonAddress,
  dbGetHomeAddrConsent, dbSetHomeAddrConsent, dbGetHouseholdSiblings,
  dbListSwimmersForParent, dbGetWeeklyDigestPayload, dbQueueWeeklyDigests,
  dbAuthzCoachOfSwimmer,
  dbCreateManagedSwimmer, dbGetManagedSwimmer, dbListManagedSwimmersForCoach,
  dbUpdateManagedSwimmer, dbArchiveManagedSwimmer, dbIsManagedSwimmerOwnedBy,
  dbBulkCreateManagedSwimmers, dbUpdateMeDob,
  dbCreateGroup, dbGetGroup, dbListGroupsForTeam, dbListGroupsForCoach,
  dbUpdateGroup, dbArchiveGroup, dbSetGroupPhase, dbGetGroupRole,
  dbSetGroupAnchor, dbClearGroupAnchor, dbGetActiveAnchor, dbExpireOrphanAnchors, dbListAnchorsForMemberSwimmer,
  dbAddSwimmerConstraint, dbRemoveSwimmerConstraint, dbGetSwimmerConstraintById,
  dbListConstraintsForSwimmer, dbGetActiveConstraintsForGroup, dbExpirePastConstraints,
  dbListMyActiveConstraints,
  dbListGroupCoaches, dbAddGroupCoach, dbRemoveGroupCoach,
  dbListGroupMembers, dbAddGroupMember, dbRemoveGroupMember, dbGetGroupMember,
  dbCreateTeamEvent, dbGetTeamEvent, dbDeleteTeamEvent, dbUpdateTeamEvent, dbListTeamEvents,
  dbCreateTeamEventSeries, dbDeleteTeamEventSeries,
  dbSetRsvp, dbGetMyRsvp, dbGetRsvpSummary, dbSetTeamEventStatus,
  dbGetPracticeContext, dbListUpcomingPracticesForUser,
  dbCreateOrLinkVenue, dbGetVenue, dbListVenues, dbArchiveVenue, dbGetWeatherCache, dbPutWeatherCache,
  dbProposeVenueEdit, dbListVenueEditProposals, dbReviewVenueEditProposal,
  dbListRsvpRespondentSubs,
  dbIsSwimmerInTeam, dbListUpcomingEventsForUser,
  dbBulkCreateAssignments, dbListAssignmentsForWorkout, dbGetAssignment, dbUpdateAssignmentCompletion,
  dbListAssignmentsForSwimmer, dbListAssignmentsForGroup,
  dbListCoachTargets,
  dbCreateGroupLanePlan, dbGetGroupLanePlan, dbListGroupLanePlans,
  dbUpdateGroupLanePlan, dbArchiveGroupLanePlan, dbSetDefaultLanePlan,
  dbCreateGroupJoinToken, dbGetGroupJoinToken, dbListGroupJoinTokens,
  dbGetPersonIdForUser, dbListPersonCredentials, dbSetPersonCredential, dbDeletePersonCredential, CREDENTIAL_SYSTEMS,
  dbAddPushSubscription, dbDeletePushSubscription,
  dbDeleteGroupJoinToken, dbRedeemGroupJoinToken,
  dbCreateClaimToken, dbGetClaimToken, dbListClaimTokensForManaged,
  dbDeleteClaimToken, dbRedeemClaimToken,
  dbCreateCoachNote, dbGetCoachNote, dbListCoachNotesForTarget,
  dbUpdateCoachNote, dbSoftDeleteCoachNote,
  dbCreateBenchmark, dbListBenchmarks, dbGetLatestAerobicBenchmark, dbDeleteBenchmark,
  dbCreateScheduledWorkout, dbGetScheduledWorkout, dbListScheduledWorkouts,
  dbUpdateScheduledWorkout, dbDeleteScheduledWorkout, dbLinkCompletedToSchedule,
  dbCompleteScheduledWorkout, dbGetPracticeAttendance, dbGetGroupRosterAsOf,
  dbIsActiveGroupCoach, extractScheduledWorkoutGroupId,
  dbRepeatWeek,
  dbGetGenerationContextForUser,
} from "./db.js";
import { generate as engineGenerate, regenerateSection as engineRegenerateSection, workoutTypes as engineWorkoutTypes, generatorReady } from "./lib/generator.js";

// Helper for audit events — pulls IP/UA off the request consistently
function reqMeta(req) {
  return {
    ip:        req.ip || req.get("X-Forwarded-For")?.split(",")[0]?.trim() || null,
    userAgent: req.get("User-Agent") || null,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT     = process.env.PORT     || 8080;
const APP_URL  = process.env.APP_URL  || "https://setforge.io";
// S5 S1 — when this is true the boot code refuses to start without Apple auth.
// Hyperlift's container build sets NODE_ENV=production; local dev usually leaves
// it unset / set to "development".
const IS_PROD  = process.env.NODE_ENV === "production";

// Apple Sign-In config — all empty until configured in Hyperlift
const APPLE_TEAM_ID      = process.env.APPLE_TEAM_ID      || "";
const APPLE_CLIENT_ID    = process.env.APPLE_CLIENT_ID    || "";
const APPLE_KEY_ID       = process.env.APPLE_KEY_ID       || "";
// .p8 files use literal newlines; some platforms encode them as \n
const APPLE_PRIVATE_KEY  = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const APPLE_AUTH_ACTIVE = !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);

// Google Sign-In config (Phase 2 · GOOGLE_OAUTH_SCOPE.md §3.1). Empty
// until configured in Hyperlift; route returns 404 when GOOGLE_AUTH_ACTIVE
// is false so dev/test envs without Google credentials still boot.
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  || "";
const GOOGLE_AUTH_ACTIVE   = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);

// Subs (Apple identifiers) that are exempt from the writeLimiter. Comma-
// separated env var. Used so admin testing across multiple devices doesn't
// trip the per-user write quota. Empty / unset = nobody is exempt.
// NOTE: this is a SEPARATE concept from is_admin (DB flag). We don't read
// the DB here to keep the limiter check synchronous and zero-cost on the
// hot path.
const ADMIN_SUBS = new Set(
  (process.env.ADMIN_SUBS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

const app = express();

// Trust Hyperlift's reverse proxy so req.ip resolves to the real client.
// '1' = trust the first hop only.
app.set("trust proxy", 1);

// Security headers. CSP is intentionally disabled — the app uses inline scripts
// throughout public/index.html, and a strict CSP needs careful crafting before
// it can be enabled. Other helmet defaults (HSTS, X-Frame-Options, X-Content-
// Type-Options, Referrer-Policy, etc.) are on.
app.use(helmet({
  contentSecurityPolicy: false,
}));

// S5 S6 — body limit. Workouts are typically <50kb (4 blocks × ~10 sets each
// + payload JSON); feedback / profile patches are <5kb. 100kb gives ~2× headroom
// without enabling pathological payloads. If a future feature needs more, raise
// it per-route rather than globally.
//
// Billing webhook exception — Stripe signature verification requires the
// raw, unparsed request body to recompute the HMAC. If express.json() runs
// first, req.body becomes a parsed object and stripe.webhooks.constructEvent
// throws "No signatures found matching the expected signature" → 400. Skip
// the JSON parser for /api/billing/webhook so the per-route express.raw()
// at the webhook handler can do its job.
app.use((req, res, next) => {
  // Both billing webhooks need the raw body for signature verification:
  // Stripe (HMAC) and Apple App Store Server Notifications (JWS signedPayload).
  if (req.originalUrl === "/api/billing/webhook") return next();
  if (req.originalUrl === "/api/billing/apple/notify") return next();
  return express.json({ limit: "100kb" })(req, res, next);
});

// ───── Rate limiters ──────────────────────────────────────────────────
// Auth: 10/min/IP. Catches brute-force probes against /api/auth/*.
const authLimiter = rateLimit({
  windowMs:         60 * 1000,
  limit:            10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: "too many auth requests, try again later" },
  handler: (req, res, _next, options) => {
    // 2026-05-23: explicit log + catch so a silent audit-insert failure is
    // visible in Hyperlift logs (previously dbAuditEvent's internal catch
    // swallowed everything and the row never landed without a trace).
    console.warn("[rate_limit.hit] scope=auth path=" + req.path + " ip=" + req.ip);
    Promise.resolve(dbAuditEvent({
      eventType: "rate_limit.hit",
      ...reqMeta(req),
      details:   { scope: "auth", path: req.path, limit: options.limit, window_ms: options.windowMs },
    })).catch(err => console.error("[rate_limit.hit audit insert failed]", err.message));
    res.status(options.statusCode).json(options.message);
  },
});

// Writes: 100/min keyed on (userSub + IP) so each device gets its own
// bucket when the same user is signed in on multiple devices. Falls back
// to IP-only when pre-auth. Catches authenticated abuse without
// punishing legitimate multi-device use (phone + iPad + laptop on the
// same Apple ID no longer share one quota).
//
// Bumped 30→100 in 2026-05-23 after multi-device dev testing repeatedly
// tripped the lower ceiling. Bumped 100→500 in 2026-05-28 after pilot
// 429s during app-load fetch storms (Profile/TeamsView/AssignedToMe all
// fire many parallel reads on mount). CSRF still gates abuse; this is
// defense-in-depth, not the primary gate.
//
// NOTE: if 429s persist after this bump, the source is likely Spaceship
// Hyperlift's platform-level rate limiting, NOT our in-app limiter.
// Real fix in that case is reducing request volume (composite bootstrap
// endpoint per ROADMAP backlog), not raising more limits.
//
// ADMIN_SUBS env-var list is exempted entirely — admin testing across
// many devices/tabs would otherwise self-DoS investigation flows.
const writeLimiter = rateLimit({
  windowMs:         60 * 1000,
  limit:            500,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => `${req.userSub || ""}|${req.ip}`,
  skip:             (req) => req.userSub && ADMIN_SUBS.has(req.userSub),
  message:          { error: "too many requests, try again later" },
  handler: (req, res, _next, options) => {
    // 2026-05-23: explicit log + catch so a silent audit-insert failure is
    // visible in Hyperlift logs (previously dbAuditEvent's internal catch
    // swallowed everything and the row never landed without a trace).
    console.warn("[rate_limit.hit] scope=write userSub=" + (req.userSub || "anon") + " path=" + req.method + " " + req.path);
    Promise.resolve(dbAuditEvent({
      userSub:   req.userSub || null,
      eventType: "rate_limit.hit",
      ...reqMeta(req),
      details:   { scope: "write", path: req.path, method: req.method, limit: options.limit, window_ms: options.windowMs },
    })).catch(err => console.error("[rate_limit.hit audit insert failed]", err.message));
    res.status(options.statusCode).json(options.message);
  },
});

// Public calendar-feed limiter. The .ics route is unauthenticated (token-only) and
// polled by calendar clients on a schedule, so keyed by IP with a generous cap.
const feedLimiter = rateLimit({
  windowMs:        60 * 1000,
  limit:           120,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.ip,
  message:         "too many requests, try again later",
});

// ───── Cookie helper ─────────────────────────────────────────────────
function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const eq = part.trim().indexOf("=");
    if (eq === -1) continue;
    const k = part.trim().slice(0, eq);
    if (k === name) return decodeURIComponent(part.trim().slice(eq + 1));
  }
  return null;
}

// ───── Session helpers (stateful — sessions table is source of truth) ─────────
const SESSION_COOKIE  = "swim_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Resolve a cookie/Bearer value to an active session row.
// Returns { id, user_sub, ... } or null if the session is missing/expired/revoked.
async function resolveSession(value) {
  if (!value) return null;
  try {
    return await dbGetSession(value);
  } catch (err) {
    console.warn("[auth] dbGetSession failed:", err.message);
    return null;
  }
}

// ───── Apple Sign-In helpers ─────────────────────────────────────────
let appleJwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getApplePublicKey(kid) {
  if (!appleJwksCache.keys || Date.now() - appleJwksCache.fetchedAt > JWKS_TTL_MS) {
    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) throw new Error("Failed to fetch Apple JWKS");
    appleJwksCache = { keys: (await res.json()).keys, fetchedAt: Date.now() };
  }
  const jwk = appleJwksCache.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error(`Apple JWKS: no key with kid=${kid}`);
  return crypto.createPublicKey({ key: jwk, format: "jwk" })
    .export({ type: "spki", format: "pem" });
}

async function verifyAppleIdToken(idToken, expectedAud = APPLE_CLIENT_ID) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header  = JSON.parse(Buffer.from(headerB64,  "base64url").toString());
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

  // Verify signature with Apple's public key
  const pem = await getApplePublicKey(header.kid);
  const ok  = crypto.createVerify("SHA256")
    .update(`${headerB64}.${payloadB64}`)
    .verify(pem, Buffer.from(sigB64, "base64url"));
  if (!ok) throw new Error("id_token signature invalid");

  // Verify standard claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== "https://appleid.apple.com") throw new Error("Wrong issuer");
  if (payload.aud !== expectedAud)                 throw new Error("Wrong audience");
  if (payload.exp < now)                           throw new Error("Token expired");

  return payload;
}

// ───── Auth middleware ───────────────────────────────────────────────
// When Apple auth is active: require a valid session cookie (web) or Bearer token (native).
// When not active: open mode — writes are unrestricted (same-origin guard still applies).
//
// With DB active, also verify the sub is in `users` and not disabled, so revoking
// access (setting users.is_disabled = 1) locks the user out within one request.
// Fails closed (503) on DB lookup error to avoid bypassing authz on transient DB issues.
async function requireAuth(req, res, next) {
  if (!APPLE_AUTH_ACTIVE) return next();
  const cookieVal  = getCookie(req, SESSION_COOKIE);
  const authHeader = req.get("Authorization") || "";
  const bearerVal  = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const sessionVal = cookieVal || bearerVal;

  const session = await resolveSession(sessionVal);
  if (!session) return res.status(401).json({ error: "not authenticated" });
  const sub = session.user_sub;

  if (dbActive) {
    try {
      const exists = await dbIsUser(sub);
      if (!exists) {
        dbAuditEvent({ userSub: sub, eventType: "auth.disabled_attempt", ...reqMeta(req), details: { path: req.path, method: req.method } });
        return res.status(403).json({ error: "not authorized" });
      }
    } catch (err) {
      console.warn("[auth] dbIsUser failed:", err.message);
      return res.status(503).json({ error: "auth backend unavailable" });
    }
  }

  // Refresh last_seen + ip; fire and forget (don't block the request)
  dbTouchSession(session.id, reqMeta(req).ip).catch(() => {});

  req.userSub    = sub;
  req.sessionId  = session.id;

  // v3 impersonation (2026-05-22 per VIEW_AS_V3_SCOPE.md). If the request
  // carries X-Impersonate-Sub, validate against an active row in
  // impersonation_sessions. On success: rewrite req.userSub to the target
  // and stash the real admin sub in req.impersonatorSub. Downstream code
  // sees the target; audit logger picks up impersonator_sub. On failure
  // (no active session, target mismatch, or expired): 401 with a reason
  // the client can read to drop its local impersonation state.
  //
  // CENTRAL WRITE BLOCK: when impersonation is active, blanket-block any
  // POST/PUT/PATCH/DELETE method except the explicit exit route. Safer
  // than per-route middleware (one place to audit, no chance of missing
  // a route). Allowlist exactly one POST: /api/impersonation/end.
  const impersonateHeader = req.get("X-Impersonate-Sub");
  if (impersonateHeader) {
    try {
      const valid = await dbValidateImpersonationHeader(sub, impersonateHeader);
      if (!valid) {
        return res.status(401).json({ error: "impersonation_session_invalid", reason: "no active session matches the X-Impersonate-Sub header — start a new session" });
      }
      // Security: privilege is otherwise checked only at session START, so a
      // mid-session admin/support revocation (account left enabled) would keep
      // honoring the header for up to 30 min. Re-verify on every request.
      if (!(await dbIsAdmin(sub) || await dbIsSupportRole(sub))) {
        return res.status(401).json({ error: "impersonation_not_privileged", reason: "your admin/support access was revoked — impersonation ended" });
      }
      req.impersonatorSub = sub;       // the real admin
      req.userSub         = impersonateHeader; // the target (rewritten)
      // Read-only enforcement.
      const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
      const isAllowlistedWrite = req.method === "POST" && req.path === "/api/impersonation/end";
      if (isWrite && !isAllowlistedWrite) {
        return res.status(403).json({
          error: "impersonation_is_read_only",
          reason: "Writes are blocked while impersonating. Exit impersonation (POST /api/impersonation/end) to make changes.",
        });
      }
      // Per-spec §1: every API call during impersonation is audit-logged.
      // Fire-and-forget. The start/end events also live in the audit log
      // (richer details); these per-request rows give forensic traceability
      // for "what did the admin look at while impersonating".
      dbAuditEvent({
        userSub:         req.userSub,           // target
        eventType:       "impersonation.access",
        ...reqMeta(req),
        details:         { path: req.path, method: req.method },
        impersonatorSub: req.impersonatorSub,
      });
    } catch (err) {
      console.warn("[impersonation] validate failed:", err.message);
      return res.status(503).json({ error: "auth backend unavailable" });
    }
  }
  next();
}

// Admin middleware — requires the authenticated user to have is_admin = 1.
// Must be applied AFTER requireAuth (which sets req.userSub).
async function requireAdmin(req, res, next) {
  try {
    if (!(await dbIsAdmin(req.userSub))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "admin.access_denied", ...reqMeta(req), details: { path: req.path, method: req.method } });
      return res.status(403).json({ error: "admin only" });
    }
  } catch (err) {
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}

// Coach middleware — requires the authenticated user to have is_coach = 1
// OR is_admin = 1 (admins implicitly inherit coach access). Used to gate
// the in-app workout-bank catalog (Phase I read-only). Must be applied
// AFTER requireAuth.
async function requireCoach(req, res, next) {
  try {
    if (!(await dbIsCoach(req.userSub))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "coach.access_denied", ...reqMeta(req), details: { path: req.path, method: req.method } });
      return res.status(403).json({ error: "coach access required" });
    }
  } catch (err) {
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}

// Lesson tier (Phase 5) — gate for surfaces shared by Coach AND Lesson tiers
// (managed-swimmer roster, per-swimmer equipment, parent recap, generate-for).
// ADDITIVE: is_coach / is_admin / tier ∈ {lesson,coach,program} all pass. Per-
// resource ownership (owner_coach_sub = req.userSub) still scopes access to the
// caller's own rows. Coach-ONLY surfaces (catalog authoring, teams, reports)
// keep requireCoach.
async function requireLessonAccess(req, res, next) {
  try {
    if (!(await dbHasLessonAccess(req.userSub))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "lesson.access_denied", ...reqMeta(req), details: { path: req.path, method: req.method } });
      return res.status(403).json({ error: "lesson or coach access required" });
    }
  } catch (err) {
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}

// CSRF middleware — required on cookie-authenticated writes.
// Bearer-token requests (native iOS) are CSRF-safe and skip the check.
async function requireCsrf(req, res, next) {
  const authHeader = req.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return next();
  if (!req.sessionId) return res.status(403).json({ error: "no session" });
  const supplied = req.get("X-CSRF-Token");
  if (!supplied) {
    dbAuditEvent({ userSub: req.userSub, eventType: "csrf.reject", ...reqMeta(req), details: { path: req.path, method: req.method, reason: "missing_header" } });
    return res.status(403).json({ error: "csrf token required" });
  }
  try {
    if (!(await dbVerifyCsrf(req.sessionId, supplied))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "csrf.reject", ...reqMeta(req), details: { path: req.path, method: req.method, reason: "mismatch" } });
      return res.status(403).json({ error: "invalid csrf token" });
    }
  } catch (err) {
    console.warn("[csrf] verify failed:", err.message);
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}


// ───── Same-origin guard ─────────────────────────────────────────────
function checkOrigin(req, res, next) {
  // Native app requests carry a Bearer token and no Origin header. Browsers
  // don't auto-send Authorization headers cross-origin (CORS preflight is required),
  // so a request with a Bearer header didn't originate from a cross-site form/script
  // — no CSRF risk here. The bearer is then validated downstream by requireAuth.
  const authHeader = req.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return next();

  const origin = req.get("Origin") || req.get("Referer") || "";
  const host   = req.get("Host") || "";
  if (origin) {
    try {
      if (new URL(origin).host === host) return next();
    } catch { /* malformed */ }
  } else if (process.env.ALLOW_NO_ORIGIN === "true") {
    return next();
  }
  return res.status(403).json({ error: "forbidden: cross-origin request" });
}

// ───── Apple auth routes ─────────────────────────────────────────────

// Redirect user to Apple's authorization endpoint.
// Optional ?invite=CODE is embedded in the OAuth state for new-user onboarding.
app.get("/api/auth/apple", authLimiter, (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.status(404).send("Apple auth not configured");
  const csrf   = crypto.randomBytes(16).toString("hex");
  const invite = (req.query.invite || "").toString().trim().slice(0, 32);
  // Period separates csrf from invite — neither component contains '.'
  const state  = invite ? `${csrf}.${invite}` : csrf;
  res.setHeader("Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=None; Max-Age=300; Path=/`
  );
  const params = new URLSearchParams({
    client_id:     APPLE_CLIENT_ID,
    redirect_uri:  `${APP_URL}/api/auth/callback`,
    response_type: "code id_token",
    response_mode: "form_post",
    scope:         "email",
    state,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// Apple posts form data here after user authenticates
app.post("/api/auth/callback", authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const meta = reqMeta(req);
  const fail = (reason, userSub = null) => {
    dbAuditEvent({ userSub, eventType: "auth.login.reject", ...meta, details: { reason, channel: "web", provider: "apple" } });
    res.redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`);
  };
  try {
    const { id_token, state, error } = req.body;
    if (error) return fail(error);

    const storedState = getCookie(req, "oauth_state");
    res.setHeader("Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`
    );
    if (!storedState || storedState !== state) return fail("state_mismatch");
    if (!id_token) return fail("missing_id_token");

    const payload = await verifyAppleIdToken(id_token);
    const sub = payload.sub;
    // Apple's id_token includes `email` and `email_verified` only on the
    // user's FIRST sign-in to this Service ID (and only if the user
    // shared it). Subsequent sign-ins omit email — we rely on what was
    // captured here.
    const appleEmail         = payload.email || null;
    const appleEmailVerified = payload.email_verified === true || payload.email_verified === "true";
    console.log(`[auth] Apple login: sub=${sub} email_verified=${appleEmailVerified}`);

    const dotIdx = state.indexOf(".");
    const invite = dotIdx > 0 ? state.slice(dotIdx + 1) : null;

    const isExisting = await dbIsUser(sub);
    if (!isExisting) {
      const result = await dbConsumeInviteCode(invite);
      if (!result.ok) {
        console.warn(`[auth] Reject new sub ${sub}: invite ${result.reason}`);
        return fail(`invite_${result.reason}`, sub);
      }
      await dbEnsureUser(sub);
      // Store email on the new user row if Apple shared it. Required for
      // Phase 2 welcome email (EMAIL_INFRA_SCOPE.md §3.6) and for the
      // Google-OAuth link-by-email path (GOOGLE_OAUTH_SCOPE.md §3.4).
      if (appleEmail) {
        try {
          await pool.query(
            "UPDATE `users` SET `email` = ?, `email_verified` = ? WHERE `sub` = ?",
            [appleEmail, appleEmailVerified ? 1 : 0, sub]
          );
        } catch (err) {
          console.warn(`[auth] failed to store email on new Apple user ${sub}: ${err.message}`);
        }
      }
      // Link the Apple identity in the new join table. Idempotent: backfill
      // already wrote this row for pre-existing users; this is for brand-new
      // ones. Per GOOGLE_OAUTH_SCOPE.md §3.2.
      await dbLinkOAuthProvider({ userSub: sub, provider: "apple", providerSub: sub });
      console.log(`[auth] New user created via invite: sub=${sub}`);
      dbAuditEvent({ userSub: sub, eventType: "invite.consume", ...meta, details: { code: invite, channel: "web", provider: "apple" } });
      dbAuditEvent({ userSub: sub, eventType: "auth.signup",    ...meta, details: { channel: "web", provider: "apple" } });

      // Welcome email (EMAIL_INFRA_SCOPE.md §3.6). Fire-and-forget;
      // minor-bypass + missing-email skip handled inside enqueueEmail.
      enqueueEmail({
        dedupKey:   `welcome:${sub}`,
        toUserSub:  sub,
        templateId: "welcome",
        manualUrl:  `${APP_URL}/manual.html`,
      }).catch(err => console.warn(`[auth] welcome email enqueue failed for ${sub}: ${err.message}`));
    }

    return signInAs({ res, meta, userSub: sub, provider: "apple" });
  } catch (err) {
    console.error("[auth/callback]", err.message);
    fail("server_error");
  }
});

// signInAs — shared end-of-callback path used by Apple + Google flows.
// Creates a session, sets the cookie, audit-logs auth.login.success with
// an explicit provider tag (GOOGLE_OAUTH_SCOPE.md decision 10), and
// redirects to /. Centralizing this means provider tagging stays
// consistent across both flows.
async function signInAs({ res, meta, userSub, provider }) {
  // I-G: a tombstoned/disabled account must not get a session. (New users are
  // never disabled, so this only ever blocks an intentionally-disabled sub.)
  if (dbActive && !(await dbIsUser(userSub))) {
    dbAuditEvent({ userSub, eventType: "auth.login.blocked_disabled", ...meta, details: { channel: "web", provider } });
    return res.redirect("/?auth_error=account_disabled");
  }
  const sessionId = await dbCreateSession({
    userSub,
    ip:        meta.ip,
    userAgent: meta.userAgent,
    ttlSeconds: SESSION_MAX_AGE,
  });
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Path=/`
  );
  dbAuditEvent({ userSub, eventType: "auth.login.success", ...meta, details: { channel: "web", provider } });
  // Parent Portal: invites are NO LONGER auto-consumed on sign-in. A parent
  // with pending invites sees an explicit "You've been invited to <swimmer>"
  // accept card (surfaced via bootstrap.pending_invites) and must Accept to
  // create the guardian link — clearer consent. See /api/parent/invites/*.
  res.redirect("/");
}

// ─── Google OAuth ─────────────────────────────────────────────────────
// Phase 2 deliverable per GOOGLE_OAUTH_SCOPE.md. Mirrors Apple's start +
// callback shape with these differences:
//   - Google uses `code` flow (GET callback with ?code=...), not Apple's
//     form_post POST callback. Token exchange happens server-side.
//   - id_token verification via google-auth-library handles cert
//     rotation + audience + expiry checks (decision 8).
//   - Account-linking by verified email (decision 1): if Google's email
//     matches an existing users.email with email_verified=1, the Google
//     sub is bound to that user instead of creating a new one. Apple-
//     relay edge case → second account by design (decision 3).
//   - users.display_name on brand-new Google sign-ups seeded from the
//     Google profile's given_name (decision 11).
const googleClient = GOOGLE_AUTH_ACTIVE
  ? new GoogleOAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null;

app.get("/api/auth/google", authLimiter, (req, res) => {
  if (!GOOGLE_AUTH_ACTIVE) return res.status(404).send("Google auth not configured");
  const csrf   = crypto.randomBytes(16).toString("hex");
  const invite = (req.query.invite || "").toString().trim().slice(0, 32);
  const state  = invite ? `${csrf}.${invite}` : csrf;
  res.setHeader("Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=None; Max-Age=300; Path=/`
  );
  const url = googleClient.generateAuthUrl({
    access_type: "online",            // we don't need refresh tokens
    scope:       ["openid", "email", "profile"],
    state,
    prompt:      "select_account",    // always show account picker, even for one-account browsers
  });
  res.redirect(url);
});

app.get("/api/auth/google/callback", authLimiter, async (req, res) => {
  const meta = reqMeta(req);
  const fail = (reason, userSub = null) => {
    dbAuditEvent({ userSub, eventType: "auth.login.reject", ...meta, details: { reason, channel: "web", provider: "google" } });
    res.redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`);
  };
  if (!GOOGLE_AUTH_ACTIVE) return fail("google_not_configured");
  try {
    const { code, state, error } = req.query;
    if (error) return fail(String(error));

    const storedState = getCookie(req, "oauth_state");
    res.setHeader("Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`
    );
    if (!storedState || storedState !== state) return fail("state_mismatch");
    if (!code) return fail("missing_code");

    // Exchange code → tokens server-side. Google requires the secret;
    // this call uses GOOGLE_CLIENT_SECRET from the OAuth2Client config.
    const { tokens } = await googleClient.getToken(String(code));
    if (!tokens.id_token) return fail("missing_id_token");

    // Verify the id_token (signature, audience, expiry). Library handles
    // Google's JWK cert rotation under the hood.
    const ticket = await googleClient.verifyIdToken({
      idToken:  tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) return fail("bad_id_token");

    const googleSub             = payload.sub;
    const googleEmail           = payload.email || null;
    const googleEmailVerified   = payload.email_verified === true;
    const googleGivenName       = payload.given_name || null;
    console.log(`[auth] Google login: sub=${googleSub} email_verified=${googleEmailVerified}`);

    const dotIdx = String(state).indexOf(".");
    const invite = dotIdx > 0 ? String(state).slice(dotIdx + 1) : null;

    // Step 1 — already-linked Google sub? Returning user, straight to session.
    let userSub = await dbGetUserSubByProvider("google", googleSub);
    if (userSub) {
      return signInAs({ res, meta, userSub, provider: "google" });
    }

    // Step 2 — link by verified email? Bind Google to an existing Apple-
    // created user with the same verified email (decision 1).
    if (googleEmailVerified && googleEmail) {
      const matched = await dbFindUserByVerifiedEmail(googleEmail);
      if (matched) {
        await dbLinkOAuthProvider({ userSub: matched.sub, provider: "google", providerSub: googleSub });
        dbAuditEvent({ userSub: matched.sub, eventType: "auth.provider.link", ...meta, details: { provider: "google", channel: "web" } });
        return signInAs({ res, meta, userSub: matched.sub, provider: "google" });
      }
    }

    // Step 3 — brand-new user. Invite gate, ensure, link, audit, sign in.
    const inviteResult = await dbConsumeInviteCode(invite);
    if (!inviteResult.ok) {
      console.warn(`[auth] Reject new Google sub ${googleSub}: invite ${inviteResult.reason}`);
      // We don't have a SetForge sub yet so audit userSub stays null —
      // the reject still records the channel + provider.
      return fail(`invite_${inviteResult.reason}`);
    }
    // New SetForge user_sub: use the Google sub as the canonical id. (Apple
    // does the same — provider_sub IS user_sub for the originating provider.)
    const newSub = googleSub;
    await dbEnsureUser(newSub, null, googleGivenName);
    await dbLinkOAuthProvider({ userSub: newSub, provider: "google", providerSub: googleSub });
    // Also store email + verified flag on the users row so the email
    // appears in admin views + audit context. dbAdminUpdateUser would
    // be the long-form path; for now a direct UPDATE.
    if (googleEmail) {
      try {
        await pool.query(
          "UPDATE `users` SET `email` = ?, `email_verified` = ? WHERE `sub` = ?",
          [googleEmail, googleEmailVerified ? 1 : 0, newSub]
        );
      } catch (err) {
        console.warn(`[auth] failed to store email on new Google user ${newSub}: ${err.message}`);
      }
    }
    dbAuditEvent({ userSub: newSub, eventType: "invite.consume", ...meta, details: { code: invite, channel: "web", provider: "google" } });
    dbAuditEvent({ userSub: newSub, eventType: "auth.signup",    ...meta, details: { channel: "web", provider: "google" } });

    // Welcome email (EMAIL_INFRA_SCOPE.md §3.6). Same pattern as Apple
    // signup path. Fire-and-forget; minor-bypass + missing-email skip
    // handled inside enqueueEmail. given_name (already used to seed
    // display_name per decision 11) is passed through as the greeting.
    enqueueEmail({
      dedupKey:    `welcome:${newSub}`,
      toUserSub:   newSub,
      templateId:  "welcome",
      displayName: googleGivenName,
      manualUrl:   `${APP_URL}/manual.html`,
    }).catch(err => console.warn(`[auth] welcome email enqueue failed for ${newSub}: ${err.message}`));

    return signInAs({ res, meta, userSub: newSub, provider: "google" });
  } catch (err) {
    console.error("[auth/google/callback]", err.message);
    fail("server_error");
  }
});

// Check whether the current request is authenticated.
// Looks up the session in the sessions table + verifies user not disabled.
app.get("/api/auth/status", async (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.json({ authenticated: true, mode: "open" });
  const session = await resolveSession(getCookie(req, SESSION_COOKIE));
  if (!session) return res.json({ authenticated: false });
  if (dbActive) {
    try {
      if (!(await dbIsUser(session.user_sub))) return res.json({ authenticated: false, reason: "not_authorized" });
    } catch (err) {
      console.warn("[auth/status] dbIsUser failed:", err.message);
      return res.json({ authenticated: false, reason: "auth_backend_error" });
    }
  }
  res.json({ authenticated: true });
});

// Return the CSRF token bound to the current session. Frontend fetches this
// after auth and includes it as X-CSRF-Token on every write request.
// No checkOrigin: GET doesn't change state, and CORS/SOP prevents cross-origin
// reads of the response body. requireAuth is the gate.
app.get("/api/auth/csrf", requireAuth, async (req, res) => {
  try {
    const token = await dbGetOrCreateCsrf(req.sessionId);
    if (!token) return res.status(401).json({ error: "no session" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Return the authenticated user's profile + workout stats. Used by the Profile UI.
// No checkOrigin: GET, no state change, CORS/SOP prevents cross-origin reads.
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const me = await dbGetMe(req.userSub);
    if (!me) return res.status(404).json({ error: "user not found" });
    res.json(me);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Bootstrap composite endpoint — single round-trip equivalent to the 13
// parallel /api/* reads the App fires on mount. See dbGetBootstrapForUser
// for which sections are included and which are intentionally kept
// separate. Billing status is composed here (not in db.js) because
// getBillingStatusFor lives in lib/billing.js.
//
// Returns 404 if the user row vanishes mid-bootstrap (rare race during
// account deletion). Each section has a documented fallback shape so the
// client doesn't have to null-check every key — _errors[] lists any
// helpers that failed so the client can decide to re-fetch lazily.
app.get("/api/me/bootstrap", requireAuth, async (req, res) => {
  try {
    const [bootstrap, billingStatus, teamCalendars] = await Promise.all([
      dbGetBootstrapForUser(req.userSub),
      getBillingStatusFor(req.userSub).catch(err => {
        console.warn(`[bootstrap] billing status failed for ${req.userSub}: ${err.message}`);
        return { tier: "free" };
      }),
      // Folded into bootstrap so the parent/swimmer calendar widget needs no extra
      // request (avoids the page-load burst that trips Hyperlift's rate limit).
      dbListTeamCalendarsForUser(req.userSub).catch(() => []),
    ]);
    if (!bootstrap || !bootstrap.me) return res.status(404).json({ error: "user not found" });
    const team_calendars = (teamCalendars || []).map(t => ({ team_id: t.team_id, team_name: t.team_name, url: calendarFeedUrl(req, t.token) }));
    // Phase 6: union visibility map across the user's teams (most-permissive — a
    // surface shows if ANY of their teams enables it; no teams ⇒ all defaults on).
    // Gates personal/nav surfaces; team-scoped surfaces use the team's own flags.
    let feature_flags;
    try {
      const teams = await dbListUserTeamsForFlags(req.userSub);
      const maps = await Promise.all(teams.map(async t => {
        const row = await dbGetTeamFlagsRow(t.id).catch(() => null);
        return resolveTeamFlags({ preset: row?.preset || null, overrides: row?.overrides || {}, hasMinors: t.team_type !== "masters" });
      }));
      feature_flags = unionFlags(maps);
    } catch (e) { console.warn(`[bootstrap] feature-flag union failed: ${e.message}`); feature_flags = unionFlags([]); }
    res.json({ ...bootstrap, team_calendars, feature_flags, billing: { status: billingStatus } });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Workout generator (native clients) ───────────────────────────────────
// The web SPA runs `generateWorkout` in-browser; native clients can't, so these
// expose the SAME engine server-side (lib/generator.js extracts it from
// index.html — single source of truth). The client sends only FORM inputs;
// curation (favorites/disfavorites/constraints/UGC) is rehydrated from the DB
// server-side and never trusted from the client.

// The workout-type catalog the client's Generate form needs (id/label/…).
// Static engine data, no DB. 503 if the engine failed to extract at boot.
app.get("/api/workout-types", requireAuth, async (req, res) => {
  if (!generatorReady()) return res.status(503).json({ error: "generator_unavailable" });
  // Lesson tier (Phase 5) — gate the `lesson` type to lesson-access users.
  // This endpoint feeds BOTH the web type grid AND the native iOS picker, so
  // gating here removes lesson from non-lesson clients everywhere (the web also
  // filters client-side; this is the authoritative gate + free iOS gating).
  let types = engineWorkoutTypes();
  try {
    if (!(await dbHasLessonAccess(req.userSub))) types = types.filter(t => t.id !== "lesson");
  } catch (_) { types = types.filter(t => t.id !== "lesson"); }  // fail closed
  res.json({ types });
});

const POOL_MODES = ["25y", "25m", "50m"];
// Must include every section the engine accepts, or the /api/generate route
// silently strips unknown sections from includedSections. "kick" is the opt-in
// 5th section — omitting it here made native clients' kick requests no-op.
const SECTION_NAMES = ["warmup", "drill", "kick", "main", "cooldown"];

app.post("/api/generate", requireAuth, writeLimiter, async (req, res) => {
  if (!generatorReady()) return res.status(503).json({ error: "generator_unavailable" });
  try {
    const b = req.body || {};

    // Validate the two required form inputs.
    const typeId = String(b.typeId || "");
    if (!engineWorkoutTypes().some(t => t.id === typeId))
      return res.status(400).json({ error: "invalid typeId" });
    const maxYards = Number(b.maxYards);
    if (!Number.isFinite(maxYards) || maxYards < 500 || maxYards > 20000)
      return res.status(400).json({ error: "maxYards out of range (500–20000)" });

    // FORM inputs — client-controlled, whitelisted with sane defaults.
    const poolMode    = POOL_MODES.includes(b.poolMode) ? b.poolMode : "25y";
    const equipment   = (b.equipment && typeof b.equipment === "object") ? b.equipment : {};
    const sectionBias = typeof b.sectionBias === "string" ? b.sectionBias : "balanced";
    const includedSections = Array.isArray(b.includedSections) && b.includedSections.length
      ? b.includedSections.filter(s => SECTION_NAMES.includes(s))
      : SECTION_NAMES.slice();
    const recoveryMode = !!b.recoveryMode;
    const phase        = (typeof b.phase === "string" && b.phase) ? b.phase : null;
    const userMin      = Number.isFinite(Number(b.userMin)) ? Number(b.userMin) : null;
    const sectionSources = (b.sectionSources && typeof b.sectionSources === "object") ? b.sectionSources : null;
    const lanesPaceSecs  = Array.isArray(b.lanesPaceSecs) && b.lanesPaceSecs.length
      ? b.lanesPaceSecs.map(Number).filter(Number.isFinite)
      : null;

    // CURATION — server-authoritative, rehydrated from the DB (own + coach union).
    const curation = (await dbGetGenerationContextForUser(req.userSub)) || {};

    // Phase 5 #4 — race-pace (native/iOS path; web resolves goals client-side).
    // Goals resolve goal→pr for the caller at the requested course (poolMode).
    const racePace  = !!b.racePace;
    const raceEvent = (typeof b.raceEvent === "string") ? b.raceEvent : "free_100";
    const raceKind  = b.raceKind === "pr" ? "pr" : "goal";
    const usrpt     = !!b.usrpt;
    const raceGoals = racePace ? await dbResolveRaceGoals({ userSub: req.userSub, course: poolMode }) : {};
    const youthMode = !!b.youthMode;   // Eval #5 — Learn-to-Swim youth bank (native/iOS path)

    const workout = engineGenerate({
      typeId, maxYards, poolMode, equipment, sectionBias, includedSections,
      recoveryMode, phase, userMin, sectionSources, lanesPaceSecs,
      racePace, raceEvent, raceKind, usrpt, raceGoals,
      ...curation,
      youthMode,
    });

    // Engine failure sentinel (e.g. required equipment can't be satisfied).
    if (workout && workout.__generateFailure)
      return res.status(422).json({ error: workout.error || "could not build a workout matching your constraints", reason: workout.reason || null });
    if (!workout || !Array.isArray(workout.blocks))
      return res.status(500).json({ error: "generator returned no workout" });

    res.json({ ok: true, workout });
  } catch (err) {
    console.error("[api/generate]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Re-roll a SINGLE section of an existing workout. The web does this in-browser;
// native can't, so it POSTs the current workout + the section to re-roll and we
// run the same engine path. Auth + curation rehydration mirror /api/generate
// exactly (server-authoritative favorites/disfavorites/overlay).
app.post("/api/regenerate-section", requireAuth, writeLimiter, async (req, res) => {
  if (!generatorReady()) return res.status(503).json({ error: "generator_unavailable" });
  try {
    const b = req.body || {};

    // Required inputs.
    const workout = b.workout;
    if (!workout || typeof workout !== "object" || !Array.isArray(workout.blocks))
      return res.status(400).json({ error: "workout (object with blocks array) required" });
    const typeId = String(b.typeId || "");
    if (!typeId) return res.status(400).json({ error: "typeId required" });
    const sectionKey = String(b.sectionKey || "");
    if (!sectionKey) return res.status(400).json({ error: "sectionKey required" });

    // FORM inputs — client-controlled, mirrored from the live workout's settings.
    const maxYards     = Number(b.maxYards);
    const equipment    = (b.equipment && typeof b.equipment === "object") ? b.equipment : {};
    const poolMode     = POOL_MODES.includes(b.poolMode) ? b.poolMode : "25y";
    const userMin      = Number.isFinite(Number(b.userMin)) ? Number(b.userMin) : null;
    const recoveryMode = !!b.recoveryMode;
    const phase        = (typeof b.phase === "string" && b.phase) ? b.phase : null;
    const sectionSource = (typeof b.sectionSource === "string" && b.sectionSource) ? b.sectionSource : null;
    const disfavorMode  = (typeof b.disfavorMode === "string" && b.disfavorMode) ? b.disfavorMode : null;
    const lanesPaceSecs = Array.isArray(b.lanesPaceSecs) && b.lanesPaceSecs.length
      ? b.lanesPaceSecs.map(Number).filter(Number.isFinite)
      : null;

    // CURATION — server-authoritative, rehydrated from the DB (own + coach union).
    const curation = (await dbGetGenerationContextForUser(req.userSub)) || {};

    const result = engineRegenerateSection({
      workout, typeId, sectionKey,
      maxYards, equipment, poolMode, userMin, recoveryMode, phase,
      sectionSource, disfavorMode, lanesPaceSecs,
      ...curation,
    });

    // regenerateSection returns { workout, error }.
    if (result && result.error)
      return res.status(422).json({ error: result.error });
    if (!result || !result.workout || !Array.isArray(result.workout.blocks))
      return res.status(500).json({ error: "regenerate returned no workout" });

    res.json({ ok: true, workout: result.workout });
  } catch (err) {
    console.error("[api/regenerate-section]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Self-serve profile editing — display_name, email, initials. Same
// validation rules as the admin path. Changing email also resets
// email_verified (handled in dbUpdateMe).
app.patch("/api/me", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const allowed = ["email", "display_name", "initials", "gender", "class_year", "usa_swimming_id"];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if ("email" in patch && patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) {
      return res.status(400).json({ error: "bad email format" });
    }
    if ("display_name" in patch && patch.display_name && String(patch.display_name).length > 120) {
      return res.status(400).json({ error: "display_name max 120 chars" });
    }
    if ("initials" in patch && patch.initials && String(patch.initials).length > 8) {
      return res.status(400).json({ error: "initials max 8 chars" });
    }
    if ("class_year" in patch && patch.class_year !== null && patch.class_year !== "") {
      const cy = Number(patch.class_year);
      if (!Number.isInteger(cy) || cy < 1990 || cy > 2100) {
        return res.status(400).json({ error: "class_year must be a year between 1990 and 2100" });
      }
    }
    // Gender validation happens in db.js (enum check). Server just passes through.
    const r = await dbUpdateMe(req.userSub, patch);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "user.profile.update",
      ...reqMeta(req),
      details:   { fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Admin routes ──────────────────────────────────────────────────
// All require: authenticated user with is_admin = 1.
// Writes additionally require CSRF token.

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await dbAdminListUsers()); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.patch("/api/admin/users/:sub", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const allowed = ["email", "initials", "display_name", "gender", "class_year", "usa_swimming_id"];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if ("email" in patch && patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) {
      return res.status(400).json({ error: "bad email format" });
    }
    if ("initials" in patch && patch.initials && String(patch.initials).length > 8) {
      return res.status(400).json({ error: "initials max 8 chars" });
    }
    if ("display_name" in patch && patch.display_name && String(patch.display_name).length > 120) {
      return res.status(400).json({ error: "display_name max 120 chars" });
    }
    const r = await dbAdminUpdateUser(req.params.sub, patch);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "admin.user.update",
      ...reqMeta(req),
      details:   { target_sub: req.params.sub, fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/users/:sub/disable", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    if (req.params.sub === req.userSub) return res.status(400).json({ error: "cannot disable self" });
    const r = await dbAdminSetUserFlag(req.params.sub, "is_disabled", true);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.user.disable", ...reqMeta(req), details: { target_sub: req.params.sub } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/users/:sub/enable", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const r = await dbAdminSetUserFlag(req.params.sub, "is_disabled", false);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.user.enable", ...reqMeta(req), details: { target_sub: req.params.sub } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach role toggle — body { granted: true|false }. Admins implicitly have
// coach capability via dbIsCoach, so toggling this is mainly for non-admin
// users who should be able to browse the workout-bank catalog.
app.post("/api/admin/users/:sub/coach", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const granted = !!(req.body && req.body.granted);
    const r = await dbAdminSetUserFlag(req.params.sub, "is_coach", granted);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: granted ? "admin.user.coach.grant" : "admin.user.coach.revoke",
      ...reqMeta(req),
      details:   { target_sub: req.params.sub },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/admin/users/:sub", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    if (req.params.sub === req.userSub) return res.status(400).json({ error: "cannot delete self" });
    // I-G: default is tombstone-on-delete (anonymize identity, disable account,
    // keep operational history). ?hard=1 is the explicit cascade-wipe override.
    const hard = req.query.hard === "1" || req.query.hard === "true";
    const r = await dbAdminDeleteUser(req.params.sub, { hard });
    if (!r.ok && r.reason === "not_found") return res.status(404).json({ error: "user not found" });
    dbAuditEvent({
      userSub: req.userSub,
      eventType: hard ? "admin.user.delete" : "admin.user.tombstone",
      ...reqMeta(req),
      details: { target_sub: req.params.sub, mode: r.mode, person_id: r.person_id, anonymized_as: r.anonymizedAs, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// v3 impersonation — grant/revoke support_role on a user.
// Admin-only (support_role can NOT elevate itself or other users — only
// is_admin can grant). This is a deliberate constraint: support_role lets
// someone DO support work, but only admins decide WHO is support.
app.post("/api/admin/users/:sub/support-role", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const granted = !!(req.body && req.body.granted);
    const r = await dbAdminSetUserFlag(req.params.sub, "support_role", granted);
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       granted ? "admin.user.support_role.grant" : "admin.user.support_role.revoke",
      ...reqMeta(req),
      details:         { target_sub: req.params.sub },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Admin tier grant — bypasses Stripe for testers/pilots. Sets users.tier
// with tier_source='admin_grant' so the lib/billing.js admin_grant bypass
// kicks in (revoke also works without BILLING_ACTIVE). Audit-logged.
// Body: { tier: 'lesson' | 'coach' | 'program' | 'free' }
app.post("/api/admin/users/:sub/tier", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const tier = String(req.body?.tier || "").toLowerCase();
    if (!["free", "lesson", "coach", "program"].includes(tier)) {   // Lesson tier (Phase 5)
      return res.status(400).json({ error: "invalid_tier", message: "tier must be free, lesson, coach, or program" });
    }
    const targetSub = req.params.sub;
    let result;
    if (tier === "free") {
      result = await revokeTier({ userSub: targetSub, reason: "admin_grant_revoke" });
    } else {
      result = await grantTier({ userSub: targetSub, tier, source: "admin_grant" });
    }
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       tier === "free" ? "admin.user.tier.revoke" : "admin.user.tier.grant",
      ...reqMeta(req),
      details:         { target_sub: targetSub, tier, result },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json({ ok: true, tier, result });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// v3 impersonation routes. Caller must be admin OR support_role.
// Start a new session (auto-ends any prior active session for this admin).
app.post("/api/impersonation/start", checkOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    // Block impersonation FROM within an impersonation session.
    if (req.impersonatorSub) {
      return res.status(403).json({ error: "nested_impersonation_forbidden" });
    }
    // Authorize: admin OR support_role.
    const [isAdmin, isSupport] = await Promise.all([
      dbIsAdmin(req.userSub),
      dbIsSupportRole(req.userSub),
    ]);
    if (!isAdmin && !isSupport) {
      return res.status(403).json({ error: "not authorized to impersonate" });
    }
    const { target_sub } = req.body || {};
    if (!target_sub || typeof target_sub !== "string") {
      return res.status(400).json({ error: "target_sub required" });
    }
    const r = await dbStartImpersonation(req.userSub, target_sub);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   target_sub,      // the impersonated user (so per-user audit query surfaces it)
      eventType: "impersonation.start",
      ...reqMeta(req),
      details:   { session_id: Number(r.session.id), expires_at: r.session.expires_at },
      impersonatorSub: req.userSub,
    });
    res.json({
      ok: true,
      session_id: Number(r.session.id),
      target_sub: r.session.target_sub,
      started_at: r.session.started_at,
      expires_at: r.session.expires_at,
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// End the caller's active impersonation session. This is a write-method
// route but does NOT use requireWritable — it's the mechanism to exit.
// req.userSub at this point is the target (if header was sent) OR the
// admin (if no header). Either way, dbEndImpersonation needs the ADMIN's
// sub — derive from impersonatorSub if set, else from userSub.
app.post("/api/impersonation/end", checkOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const adminSub = req.impersonatorSub || req.userSub;
    const r = await dbEndImpersonation(adminSub, "exit");
    if (r.ended > 0) {
      dbAuditEvent({
        userSub:         req.userSub,    // target (or admin if no session was active)
        eventType:       "impersonation.end",
        ...reqMeta(req),
        details:         { ended_count: r.ended, reason: "exit" },
        impersonatorSub: req.impersonatorSub || null,
      });
    }
    res.json({ ok: true, ended: r.ended });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Returns the caller's currently-active impersonation session (if any).
// Client polls this on mount to recover state across page reloads.
// Note: if the request itself comes WITH a valid X-Impersonate-Sub header,
// req.userSub is already the target — but we want the ADMIN's session, so
// derive from impersonatorSub.
app.get("/api/impersonation/active", requireAuth, async (req, res) => {
  try {
    const adminSub = req.impersonatorSub || req.userSub;
    const active = await dbGetActiveImpersonation(adminSub);
    if (!active) return res.json({ active: null });
    res.json({
      active: {
        session_id: Number(active.id),
        target_sub: active.target_sub,
        started_at: active.started_at,
        expires_at: active.expires_at,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/admin/invites", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await dbAdminListInvites()); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/invites", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const { note = null, maxUses = 1, expiresAt = null } = req.body || {};
    const code = await dbAdminCreateInvite({ note, maxUses, expiresAt, createdBy: req.userSub });
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.invite.create", ...reqMeta(req), details: { code, maxUses, expiresAt, note } });
    res.json({ ok: true, code });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/admin/invites/:code", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const r = await dbAdminDeleteInvite(req.params.code);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.invite.delete", ...reqMeta(req), details: { code: req.params.code, affected: r.affected } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/admin/audit-events", requireAuth, requireAdmin, async (req, res) => {
  try {
    // 2026-05-23: default limit 100→500. Impersonation chatter (per-request
    // audit rows during a support session) buries other event types in a
    // 100-row window; 500 gives meaningful headroom.
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || "500", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
    // event_type_groups is a comma-sep list of group keys mapped server-side
    // (auth/admin/impersonation/coach/rate_limit/csrf/other). Unknown keys
    // are silently dropped so client/server enum drift never returns 400.
    const groupsRaw = (req.query.event_type_groups || "").trim();
    const eventTypeGroups = groupsRaw
      ? groupsRaw.split(",").map(s => s.trim()).filter(Boolean)
      : null;
    const events = await dbAdminListAuditEvents({
      limit, offset,
      eventType:       req.query.event_type || null,
      eventTypeGroups,
      userSub:         req.query.user_sub   || null,
    });
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Native iOS Sign in with Apple — accepts an identityToken from ASAuthorizationAppleIDCredential,
// verifies it, and returns a session token the app stores in Keychain and sends as Bearer.
app.post("/api/auth/native", authLimiter, async (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.status(404).json({ error: "Apple auth not configured" });
  const meta = reqMeta(req);
  try {
    const { identityToken, inviteCode } = req.body || {};
    if (!identityToken || typeof identityToken !== "string")
      return res.status(400).json({ error: "identityToken required" });
    const nativeAud = process.env.APPLE_NATIVE_BUNDLE_ID || APPLE_CLIENT_ID;
    const payload = await verifyAppleIdToken(identityToken, nativeAud);
    const sub = payload.sub;
    console.log(`[auth/native] Apple login: sub=${sub}`);

    const isExisting = await dbIsUser(sub);
    if (!isExisting) {
      const result = await dbConsumeInviteCode(inviteCode);
      if (!result.ok) {
        console.warn(`[auth/native] Reject new sub ${sub}: invite ${result.reason}`);
        dbAuditEvent({ userSub: sub, eventType: "auth.login.reject", ...meta, details: { reason: `invite_${result.reason}`, channel: "native" } });
        return res.status(403).json({ error: `invite_${result.reason}` });
      }
      await dbEnsureUser(sub);
      console.log(`[auth/native] New user created via invite: sub=${sub}`);
      dbAuditEvent({ userSub: sub, eventType: "invite.consume", ...meta, details: { code: inviteCode, channel: "native" } });
      dbAuditEvent({ userSub: sub, eventType: "auth.signup",    ...meta, details: { channel: "native" } });
    }
    // I-G: refuse a disabled/tombstoned account (new users are never disabled).
    if (dbActive && !(await dbIsUser(sub))) {
      dbAuditEvent({ userSub: sub, eventType: "auth.login.blocked_disabled", ...meta, details: { channel: "native" } });
      return res.status(403).json({ error: "account_disabled" });
    }
    const token = await dbCreateSession({
      userSub:    sub,
      ip:         meta.ip,
      userAgent:  meta.userAgent,
      ttlSeconds: SESSION_MAX_AGE,
    });
    dbAuditEvent({ userSub: sub, eventType: "auth.login.success", ...meta, details: { channel: "native" } });
    res.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/native]", err.message);
    res.status(401).json({ error: err.message });
  }
});

// Native Google sign-in (iOS). Mirrors /api/auth/google/callback's identity
// resolution (provider-link → verified-email-link → invite-gated create) but
// takes a GoogleSignIn id_token directly and returns a Bearer token (no cookie),
// exactly like /api/auth/native does for Apple. Native tokens' audience is the
// iOS OAuth client id, so we accept GOOGLE_NATIVE_CLIENT_ID in addition to the
// web GOOGLE_CLIENT_ID.
app.post("/api/auth/google-native", authLimiter, async (req, res) => {
  if (!GOOGLE_AUTH_ACTIVE || !googleClient) return res.status(404).json({ error: "Google auth not configured" });
  const meta = reqMeta(req);
  try {
    const { idToken, inviteCode } = req.body || {};
    if (!idToken || typeof idToken !== "string") return res.status(400).json({ error: "idToken required" });

    const audiences = [GOOGLE_CLIENT_ID, process.env.GOOGLE_NATIVE_CLIENT_ID].filter(Boolean);
    const ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) return res.status(401).json({ error: "bad_id_token" });

    const googleSub           = payload.sub;
    const googleEmail         = payload.email || null;
    const googleEmailVerified = payload.email_verified === true;
    const googleGivenName     = payload.given_name || null;
    console.log(`[auth/google-native] Google login: sub=${googleSub} email_verified=${googleEmailVerified}`);

    // Step 1 — already-linked Google sub.
    let userSub = await dbGetUserSubByProvider("google", googleSub);

    // Step 2 — link by verified email to an existing user.
    if (!userSub && googleEmailVerified && googleEmail) {
      const matched = await dbFindUserByVerifiedEmail(googleEmail);
      if (matched) {
        await dbLinkOAuthProvider({ userSub: matched.sub, provider: "google", providerSub: googleSub });
        dbAuditEvent({ userSub: matched.sub, eventType: "auth.provider.link", ...meta, details: { provider: "google", channel: "native" } });
        userSub = matched.sub;
      }
    }

    // Step 3 — brand-new user: invite-gated create.
    if (!userSub) {
      const inviteResult = await dbConsumeInviteCode(inviteCode);
      if (!inviteResult.ok) {
        console.warn(`[auth/google-native] Reject new Google sub ${googleSub}: invite ${inviteResult.reason}`);
        dbAuditEvent({ userSub: null, eventType: "auth.login.reject", ...meta, details: { reason: `invite_${inviteResult.reason}`, channel: "native", provider: "google" } });
        return res.status(403).json({ error: `invite_${inviteResult.reason}` });
      }
      const newSub = googleSub;
      await dbEnsureUser(newSub, null, googleGivenName);
      await dbLinkOAuthProvider({ userSub: newSub, provider: "google", providerSub: googleSub });
      if (googleEmail) {
        try {
          await pool.query("UPDATE `users` SET `email` = ?, `email_verified` = ? WHERE `sub` = ?",
            [googleEmail, googleEmailVerified ? 1 : 0, newSub]);
        } catch (err) {
          console.warn(`[auth/google-native] failed to store email on new user ${newSub}: ${err.message}`);
        }
      }
      dbAuditEvent({ userSub: newSub, eventType: "invite.consume", ...meta, details: { code: inviteCode, channel: "native", provider: "google" } });
      dbAuditEvent({ userSub: newSub, eventType: "auth.signup",    ...meta, details: { channel: "native", provider: "google" } });
      enqueueEmail({
        dedupKey:    `welcome:${newSub}`,
        toUserSub:   newSub,
        templateId:  "welcome",
        displayName: googleGivenName,
        manualUrl:   `${APP_URL}/manual.html`,
      }).catch(err => console.warn(`[auth/google-native] welcome email enqueue failed for ${newSub}: ${err.message}`));
      userSub = newSub;
    }

    // I-G: refuse a disabled/tombstoned account (new users are never disabled).
    if (dbActive && !(await dbIsUser(userSub))) {
      dbAuditEvent({ userSub, eventType: "auth.login.blocked_disabled", ...meta, details: { channel: "native", provider: "google" } });
      return res.status(403).json({ error: "account_disabled" });
    }
    const token = await dbCreateSession({ userSub, ip: meta.ip, userAgent: meta.userAgent, ttlSeconds: SESSION_MAX_AGE });
    dbAuditEvent({ userSub, eventType: "auth.login.success", ...meta, details: { channel: "native", provider: "google" } });
    res.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/google-native]", err.message);
    res.status(401).json({ error: err.message });
  }
});

// Revoke current session and clear the cookie
app.get("/api/auth/signout", async (req, res) => {
  const cookieVal = getCookie(req, SESSION_COOKIE);
  const session = await resolveSession(cookieVal);
  if (session) {
    await dbRevokeSession(session.id);
    dbAuditEvent({ userSub: session.user_sub, eventType: "auth.signout", ...reqMeta(req) });
  }
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  );
  res.redirect("/");
});

// List the authenticated user's active sessions. No checkOrigin (GET, no state change, SOP protects response).
app.get("/api/auth/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await dbListSessions(req.userSub);
    const withCurrent = sessions.map(s => ({
      ...s,
      is_current: req.sessionId && req.sessionId.startsWith(s.id_prefix),
    }));
    res.json(withCurrent);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Revoke a single session by id prefix, scoped to the current user.
// Refuses to revoke the current session — use /api/auth/signout for that.
app.delete("/api/auth/sessions/:prefix", checkOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const prefix = String(req.params.prefix || "").trim();
    if (req.sessionId && req.sessionId.startsWith(prefix)) {
      return res.status(400).json({ error: "cannot revoke current session via this endpoint" });
    }
    const r = await dbRevokeSessionByPrefix(req.userSub, prefix);
    if (!r.ok) return res.status(404).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "auth.signout.session",
      ...reqMeta(req),
      details:   { prefix, revoked_id: r.revoked },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Revoke all other sessions for the current user (keeps current alive)
app.post("/api/auth/signout-all-others", checkOrigin, requireAuth, async (req, res) => {
  try {
    const count = await dbRevokeOthersByUser(req.userSub, req.sessionId);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "auth.signout.others",
      ...reqMeta(req),
      details:   { revoked_count: count },
    });
    res.json({ ok: true, revoked: count });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── API routes ────────────────────────────────────────────────────
// S5 S2 — /healthz now probes the DB (when configured) so Hyperlift's health
// check distinguishes "Node process is alive" from "Node process is alive AND
// can serve API traffic." When DB is not configured (dev mode), returns ok with
// db: "not_configured" so local testing isn't blocked.
app.get("/healthz", async (req, res) => {
  const base = { ok: true, service: "swim-workout-generator" };
  if (!dbActive) return res.json({ ...base, db: "not_configured" });
  try {
    const r = await pingDb();
    return res.json({ ...base, db: r.ok ? "ok" : "unknown" });
  } catch (err) {
    return res.status(503).json({ ok: false, service: "swim-workout-generator", db: "unreachable", error: err.message || String(err) });
  }
});

app.get("/api/workouts", requireAuth, async (req, res) => {
  try {
    const entries = await dbListWorkouts(req.userSub);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Allowed enum values for workout entries — kept here (not imported) because
// server.js is the validation boundary for /api/log-workout.
const VALID_WORKOUT_TYPES = new Set([
  "im", "distance", "sprint", "endurance", "technique", "mixed", "back", "breast", "fly",
]);
const VALID_POOL_MODES   = new Set(["25y", "25m", "50m"]);
const REQUIRED_SECTIONS  = ["warmup", "drill", "main", "cooldown"];

// Validate a workout entry's required shape. Extras are allowed (they get
// jammed into payload JSON by db.entryToWorkoutRow). Returns null on success
// or a string describing the first failure.
function validateWorkoutEntry(entry) {
  if (!entry || typeof entry !== "object")             return "entry must be an object";
  if (typeof entry.id !== "string" || !entry.id)       return "entry.id (string) required";
  // The `workouts.id` column is VARCHAR(32); an over-long id (e.g. a client
  // sending "w" + full UUID) otherwise dies at the DB layer with an opaque
  // 1406 "Data too long". Reject cleanly here. Canonical ids are makeEntryId()
  // output: "w" + base36 — short and [a-z0-9]. Be lenient on charset (allow the
  // legacy set) but strict on length so nothing can overflow the column.
  if (entry.id.length > 32)                            return "entry.id too long (max 32 chars)";
  if (!/^[A-Za-z0-9_-]+$/.test(entry.id))              return "entry.id has invalid characters";
  if (!VALID_WORKOUT_TYPES.has(entry.type))            return `entry.type must be one of: ${[...VALID_WORKOUT_TYPES].join(", ")}`;
  if (!Number.isFinite(entry.totalYards) || entry.totalYards <= 0)
                                                       return "entry.totalYards must be a positive number";
  if (!VALID_POOL_MODES.has(entry.poolMode))           return `entry.poolMode must be one of: ${[...VALID_POOL_MODES].join(", ")}`;
  // Section model (2026-05-30): blocks are no longer a fixed 4. Coaches can
  // skip warmup/drill/cooldown (Part A) and add dryland blocks (Part B). Rule:
  // a non-empty list, exactly one of the swim sections is "main", swim blocks
  // carry non-empty sets, dryland blocks carry an exercises array.
  if (!Array.isArray(entry.blocks) || entry.blocks.length === 0)
                                                       return "entry.blocks must be a non-empty array";
  let hasMain = false;
  for (let i = 0; i < entry.blocks.length; i++) {
    const b = entry.blocks[i];
    if (!b || typeof b !== "object")                   return `entry.blocks[${i}] must be an object`;
    if (b.kind === "dryland") {
      if (!Array.isArray(b.exercises))                 return `entry.blocks[${i}] (dryland) must have an exercises array`;
      continue;
    }
    if (!REQUIRED_SECTIONS.includes(b.section))        return `entry.blocks[${i}].section must be one of ${REQUIRED_SECTIONS.join(", ")} (got "${b.section}")`;
    if (!Array.isArray(b.sets) || b.sets.length === 0) return `entry.blocks[${i}].sets must be a non-empty array`;
    if (b.section === "main") hasMain = true;
  }
  if (!hasMain)                                        return "entry.blocks must include a main section";
  return null;
}

app.post("/api/log-workout", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const entry = req.body;
    // F3 — minimal-shape validation. Required fields must be present and well-typed.
    // Anything else is allowed and ends up in the payload JSON via entryToWorkoutRow.
    const validationError = validateWorkoutEntry(entry);
    if (validationError) return res.status(400).json({ error: validationError });
    // Per the user_sub policy: new writes must be attributed to a user.
    // Open-mode (APPLE_AUTH_ACTIVE=false) has no userSub and is rejected here.
    // Existing legacy rows with user_sub IS NULL are preserved by dbListWorkouts.
    if (!req.userSub) return res.status(401).json({ error: "user_sub required for new writes" });
    entry.sub = req.userSub;
    if (await dbWorkoutExists(entry.id)) {
      return res.status(409).json({ error: "duplicate id", id: entry.id });
    }

    // R-D — optional assign_to clause for fanout. Validate BEFORE the insert
    // so we can reject early and avoid an orphan workout if the fanout would
    // fail. Two shapes:
    //   { assign_to: { group_id: "gr_..." } } — fan out to every active
    //       member of the group; each gets a row keyed to their stored
    //       pace per the workout's poolMode (managed-only in Stage 3).
    //   { assign_to: { managed_id: "ms_..." } } — single private-student
    //       assignment.
    const assignTo = entry.assign_to || (req.body && req.body.assign_to) || null;
    let assignmentPlan = null;                                                  // computed targets[] for fanout
    if (assignTo) {
      if (assignTo.group_id) {
        const groupRole = await dbGetGroupRole(assignTo.group_id, req.userSub);
        if (!groupRole) return res.status(403).json({ error: "not a coach on this group" });

        // R-E: if assign_to includes lane_plan_id, the plan is authoritative
        // for the member list (with lane_pace + lane_idx + lane_label from
        // the plan). Otherwise fall back to all-current-members each at
        // their stored pace (R-D behavior).
        if (assignTo.lane_plan_id) {
          const plan = await dbGetGroupLanePlan(assignTo.lane_plan_id);
          if (!plan) return res.status(404).json({ error: "lane plan not found" });
          if (plan.group_id !== assignTo.group_id) return res.status(400).json({ error: "lane plan does not belong to this group" });
          if (plan.archived) return res.status(400).json({ error: "lane plan is archived" });

          // Build a set of currently-active managed IDs in this group so we
          // can skip stale member references in the plan (per scope §7).
          const currentMembers = await dbListGroupMembers(assignTo.group_id);
          const activeManaged  = new Set(currentMembers.map(m => m.member_managed_id).filter(Boolean));

          // R-F follow-up: also build a set of active swimmer-sub members
          // so we can include full-account swimmers referenced in the plan.
          const activeSwimmers = new Set(currentMembers.map(m => m.member_swimmer_sub).filter(Boolean));

          assignmentPlan = { group_id: assignTo.group_id, lane_plan_id: assignTo.lane_plan_id, targets: [] };
          for (const lane of (plan.plan_data?.lanes || [])) {
            for (const m of (lane.members || [])) {
              if (m.managed_id) {
                if (!activeManaged.has(m.managed_id)) continue;                 // stale-member skip
                assignmentPlan.targets.push({
                  managed_id:  m.managed_id,
                  lane_idx:    lane.idx,
                  lane_label:  lane.label || null,
                  lane_pace:   lane.target_pace_100 || null,
                });
              } else if (m.swimmer_sub) {
                if (!activeSwimmers.has(m.swimmer_sub)) continue;               // stale-member skip
                assignmentPlan.targets.push({
                  swimmer_sub: m.swimmer_sub,
                  lane_idx:    lane.idx,
                  lane_label:  lane.label || null,
                  lane_pace:   lane.target_pace_100 || null,
                });
              }
            }
          }
          if (assignmentPlan.targets.length === 0) {
            return res.status(400).json({ error: "lane plan has no currently-active members (all stale or empty)" });
          }
        } else {
          // No plan → all-current-members at stored pace. Both polymorphic
          // member types are now supported (R-F).
          const members = await dbListGroupMembers(assignTo.group_id);
          if (members.length === 0) return res.status(400).json({ error: "group has no active members" });
          assignmentPlan = { group_id: assignTo.group_id, targets: [] };
          for (const m of members) {
            if (m.member_managed_id) {
              const pace = await resolveManagedPaceForRoute(m.member_managed_id, entry.poolMode);
              assignmentPlan.targets.push({ managed_id: m.member_managed_id, lane_pace: pace });
            } else if (m.member_swimmer_sub) {
              const pace = await resolveSwimmerPaceForRoute(m.member_swimmer_sub);
              assignmentPlan.targets.push({ swimmer_sub: m.member_swimmer_sub, lane_pace: pace });
            }
          }
          if (assignmentPlan.targets.length === 0) {
            return res.status(400).json({ error: "no assignable members in this group" });
          }
        }
      } else if (assignTo.managed_id) {
        const owns = await dbIsManagedSwimmerOwnedBy(assignTo.managed_id, req.userSub);
        if (!owns) return res.status(403).json({ error: "must own this managed swimmer to assign" });
        const pace = await resolveManagedPaceForRoute(assignTo.managed_id, entry.poolMode);
        assignmentPlan = { group_id: null, targets: [{ managed_id: assignTo.managed_id, lane_pace: pace }] };
      } else {
        return res.status(400).json({ error: "assign_to must have group_id or managed_id" });
      }
    }

    await dbInsertWorkout(entry);

    // I — Phase 1: scheduled_id link. If the client passed a scheduled_id
    // (i.e., this workout is being logged as the completion of a scheduled
    // row), stamp the schedule row's completed_workout_id to point at this
    // new workout. Best-effort: surface the link result in the response but
    // don't fail the workout insert if linking fails.
    const scheduledId = entry.scheduled_id || (req.body && req.body.scheduled_id) || null;
    let scheduleLink = null;
    if (scheduledId) {
      try {
        const linkResult = await dbLinkCompletedToSchedule({
          scheduledId, callerSub: req.userSub, workoutId: entry.id,
          // I Phase 2b: pass payload so an intent-mode row can flip to payload
          // atomically with the link. Self-only payload-mode rows ignore this.
          workoutPayload: entry,
        });
        if (linkResult.ok) {
          scheduleLink = { ok: true, scheduled_id: Number(scheduledId), already_linked: !!linkResult.already_linked };
        } else {
          scheduleLink = { ok: false, scheduled_id: Number(scheduledId), reason: linkResult.reason };
        }
      } catch (e) {
        scheduleLink = { ok: false, scheduled_id: Number(scheduledId), reason: e.message || String(e) };
      }
    }

    let assignmentSummary = null;
    if (assignmentPlan) {
      try {
        const r = await dbBulkCreateAssignments({
          workoutId:  entry.id,
          groupId:    assignmentPlan.group_id,
          lanePlanId: assignmentPlan.lane_plan_id || null,
          targets:    assignmentPlan.targets,
        });
        assignmentSummary = { count: r.count, ids: r.ids, group_id: assignmentPlan.group_id, lane_plan_id: assignmentPlan.lane_plan_id || null };
        dbAuditEvent({
          userSub:   req.userSub,
          eventType: assignmentPlan.group_id ? "workout.assign_to_group" : "workout.assign_to_managed",
          ...reqMeta(req),
          details:   { workout_id: entry.id, group_id: assignmentPlan.group_id, lane_plan_id: assignmentPlan.lane_plan_id || null, count: r.count },
        });
      } catch (err) {
        // Workout already inserted; surface assignment error but keep workout.
        // Coach can retry assignment via a follow-up endpoint (not in v1 — for
        // R-D they'll just delete and re-save if needed).
        return res.status(500).json({ ok: false, id: entry.id, error: "workout saved but assignment fanout failed: " + (err.message || String(err)) });
      }
    }

    // F1 — read-back: return the DB's view of the row, not the client's payload.
    // This ensures the client's optimistic state replacement reflects any
    // server-side coercion (defaults, JSON round-tripping, type narrowing).
    const stored = await dbGetWorkout(entry.id);
    res.json({ ok: true, id: entry.id, entry: stored || entry, assignment: assignmentSummary, schedule_link: scheduleLink });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Tiny local helper to avoid exposing resolveManagedPace from db.js. It maps
// pool mode → the correct pace column and returns null if unset.
async function resolveManagedPaceForRoute(managedId, poolMode) {
  if (!managedId || !poolMode) return null;
  const ms = await dbGetManagedSwimmer(managedId);
  if (!ms) return null;
  if (poolMode === "25y") return ms.pace_scy_100 || null;
  if (poolMode === "25m") return ms.pace_scm_100 || null;
  if (poolMode === "50m") return ms.pace_lcm_100 || null;
  return null;
}
// Full-account swimmers (R-F) have a single `settings.pace_input` instead of
// per-pool paces. The pace concept-mismatch is a known piece of debt; for
// now, return that value regardless of pool mode. Pace-model consolidation
// is a future refactor.
async function resolveSwimmerPaceForRoute(swimmerSub /* , poolMode */) {
  if (!swimmerSub) return null;
  try {
    const s = await dbGetSettings(swimmerSub);
    return s?.paceInput || null;
  } catch (_) { return null; }
}

// Coach-targets list for the generate-for picker (R-D). Returns active
// groups the caller coaches with member counts + current_phase + team name.
app.get("/api/picker/coach-targets", requireAuth, requireLessonAccess, async (req, res) => {
  try { res.json(await dbListCoachTargets(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List assignments for a workout. Visible to the workout owner (coach) OR
// to any target swimmer (R-G "Assigned to me" prep).
app.get("/api/workouts/:id/assignments", requireAuth, async (req, res) => {
  try {
    const w = await dbGetWorkout(req.params.id);
    if (!w) return res.status(404).json({ error: "workout not found" });
    const isOwner = w.sub === req.userSub;
    const isTarget = !isOwner;                                                 // we'll verify after fetch
    const list = await dbListAssignmentsForWorkout(req.params.id);
    if (!isOwner) {
      const userIsTarget = list.some(a => a.target_swimmer_sub === req.userSub);
      if (!userIsTarget) return res.status(403).json({ error: "not authorized" });
    }
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.patch("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const patch  = req.body || {};
    const r = await dbPatchWorkout(id, patch, req.userSub);
    if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
    res.json({ ok: true, entry: r.entry });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await dbDeleteWorkout(id, req.userSub);
    if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
    dbAuditEvent({ userSub: req.userSub, eventType: "workout.delete", ...reqMeta(req), details: { id } });
    res.json({ ok: true, removed: r.removed });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── User settings routes ──────────────────────────────────────────
app.get("/api/settings", requireAuth, async (req, res) => {
  try {
    res.json(await dbGetSettings(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/settings", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    await dbUpsertSettings(req.userSub, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Merge-patch `settings.extra` (JSON blob). Keys with null value are deleted.
// Currently used by item Q (next-event countdown).
app.post("/api/settings/extra", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const patch = req.body || {};
    if (typeof patch !== "object" || Array.isArray(patch)) {
      return res.status(400).json({ error: "object body required" });
    }
    // Validate next_event shape if present.
    if ("next_event" in patch && patch.next_event !== null) {
      const ev = patch.next_event;
      if (typeof ev !== "object" || typeof ev.name !== "string" || typeof ev.date !== "string") {
        return res.status(400).json({ error: "next_event must be { name, date }" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
        return res.status(400).json({ error: "next_event.date must be YYYY-MM-DD" });
      }
      if (ev.name.length > 80) {
        return res.status(400).json({ error: "next_event.name max 80 chars" });
      }
    }
    // Validate phase enum if present (N5).
    if ("phase" in patch && patch.phase !== null) {
      const allowed = ["base", "build", "peak", "taper", "recovery"];
      if (typeof patch.phase !== "string" || !allowed.includes(patch.phase)) {
        return res.status(400).json({ error: "phase must be one of: " + allowed.join(", ") });
      }
    }
    // Validate level enum if present (J — swimmer-level presets).
    if ("level" in patch && patch.level !== null) {
      const allowed = ["recreational", "masters", "competitive"];
      if (typeof patch.level !== "string" || !allowed.includes(patch.level)) {
        return res.status(400).json({ error: "level must be one of: " + allowed.join(", ") });
      }
    }
    // Validate engine_section_sources if present (S3 — template engine
    // per-section toggle state). Object with optional keys warmup/drill/
    // main/cooldown, each value ∈ "bank" | "engine" | "mix". Anything
    // unrecognized is rejected.
    if ("engine_section_sources" in patch && patch.engine_section_sources !== null) {
      const ss = patch.engine_section_sources;
      if (!ss || typeof ss !== "object" || Array.isArray(ss)) {
        return res.status(400).json({ error: "engine_section_sources must be an object" });
      }
      const VALID_SECTIONS = ["warmup", "drill", "main", "cooldown"];
      const VALID_SOURCES = ["bank", "engine", "mix"];
      for (const k of Object.keys(ss)) {
        if (!VALID_SECTIONS.includes(k)) {
          return res.status(400).json({ error: `engine_section_sources: unknown section "${k}"` });
        }
        if (!VALID_SOURCES.includes(ss[k])) {
          return res.status(400).json({ error: `engine_section_sources.${k} must be one of: ${VALID_SOURCES.join(", ")}` });
        }
      }
    }
    // v1.8 — Validate disfavor_mode if present. Single user-level toggle
    // controlling how all disfavor types (label / set ID / engine template)
    // affect the picker. "downweight" = current 0.25× behavior;
    // "exclude" = hard-exclude (weight 0; silent fallback to including
    // excluded items if pool would empty).
    if ("disfavor_mode" in patch && patch.disfavor_mode !== null) {
      const allowed = ["downweight", "exclude"];
      if (typeof patch.disfavor_mode !== "string" || !allowed.includes(patch.disfavor_mode)) {
        return res.status(400).json({ error: "disfavor_mode must be one of: " + allowed.join(", ") });
      }
    }
    // v1.3 — Validate engine_disfavorites if present. Array of (template_id,
    // stroke) tuples the user has marked as disfavored in engine output.
    // Engine template picker applies 0.25× weight to matching tuples.
    // Capped at 50 entries (engine has ~17 templates × ~7 strokes; 50 is
    // plenty of headroom without runaway). Mirror of engine_recent_templates
    // shape but no ts (these are persistent prefs, not a rolling window).
    if ("engine_disfavorites" in patch && patch.engine_disfavorites !== null) {
      const arr = patch.engine_disfavorites;
      if (!Array.isArray(arr)) {
        return res.status(400).json({ error: "engine_disfavorites must be an array" });
      }
      if (arr.length > 50) {
        return res.status(400).json({ error: "engine_disfavorites max length is 50" });
      }
      const VALID_STROKES = ["free", "back", "breast", "fly", "IM", "choice", "kick"];
      for (const [i, e] of arr.entries()) {
        if (!e || typeof e !== "object") {
          return res.status(400).json({ error: `engine_disfavorites[${i}] must be an object` });
        }
        if (typeof e.template_id !== "string" || e.template_id.length === 0 || e.template_id.length > 64) {
          return res.status(400).json({ error: `engine_disfavorites[${i}].template_id must be a 1-64 char string` });
        }
        if (typeof e.stroke !== "string" || !VALID_STROKES.includes(e.stroke)) {
          return res.status(400).json({ error: `engine_disfavorites[${i}].stroke must be one of: ${VALID_STROKES.join(", ")}` });
        }
      }
    }
    // v2.0 polish — Validate multi_lane state if present. Shape:
    //   { enabled: bool, lanes: [{ lane_label: string, pace: string }] }
    // Pace strings are validated as M:SS where SS<60 and total in 30..300s.
    // lanes capped at 12 (no real-world masters pool has more).
    if ("multi_lane" in patch && patch.multi_lane !== null) {
      const ml = patch.multi_lane;
      if (typeof ml !== "object" || Array.isArray(ml)) {
        return res.status(400).json({ error: "multi_lane must be an object" });
      }
      if ("enabled" in ml && typeof ml.enabled !== "boolean") {
        return res.status(400).json({ error: "multi_lane.enabled must be boolean" });
      }
      if ("lanes" in ml) {
        if (!Array.isArray(ml.lanes)) {
          return res.status(400).json({ error: "multi_lane.lanes must be an array" });
        }
        if (ml.lanes.length > 12) {
          return res.status(400).json({ error: "multi_lane.lanes max length is 12" });
        }
        for (const [i, lane] of ml.lanes.entries()) {
          if (!lane || typeof lane !== "object") {
            return res.status(400).json({ error: `multi_lane.lanes[${i}] must be an object` });
          }
          if (typeof lane.lane_label !== "string" || lane.lane_label.length > 40) {
            return res.status(400).json({ error: `multi_lane.lanes[${i}].lane_label must be a string ≤ 40 chars` });
          }
          if (typeof lane.pace !== "string") {
            return res.status(400).json({ error: `multi_lane.lanes[${i}].pace must be a string` });
          }
          // Allow empty pace (in-progress edit); strict-validate non-empty.
          if (lane.pace !== "") {
            const m = lane.pace.match(/^(\d{1,2}):(\d{2})$/);
            if (!m) {
              return res.status(400).json({ error: `multi_lane.lanes[${i}].pace must be M:SS or empty` });
            }
            const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
            if (total < 30 || total > 300) {
              return res.status(400).json({ error: `multi_lane.lanes[${i}].pace seconds must be in 30..300` });
            }
          }
        }
      }
    }
    // v1.13 — Validate engine_favorites if present. Same shape as
    // engine_disfavorites (array of (template_id, stroke)). Engine template
    // picker applies 3× weight to matching tuples. Capped at 50 entries.
    // No mutex with engine_disfavorites enforced here — client-side
    // handlers manage that, and the DB column is a single JSON blob.
    if ("engine_favorites" in patch && patch.engine_favorites !== null) {
      const arr = patch.engine_favorites;
      if (!Array.isArray(arr)) {
        return res.status(400).json({ error: "engine_favorites must be an array" });
      }
      if (arr.length > 50) {
        return res.status(400).json({ error: "engine_favorites max length is 50" });
      }
      const VALID_STROKES = ["free", "back", "breast", "fly", "IM", "choice", "kick"];
      for (const [i, e] of arr.entries()) {
        if (!e || typeof e !== "object") {
          return res.status(400).json({ error: `engine_favorites[${i}] must be an object` });
        }
        if (typeof e.template_id !== "string" || e.template_id.length === 0 || e.template_id.length > 64) {
          return res.status(400).json({ error: `engine_favorites[${i}].template_id must be a 1-64 char string` });
        }
        if (typeof e.stroke !== "string" || !VALID_STROKES.includes(e.stroke)) {
          return res.status(400).json({ error: `engine_favorites[${i}].stroke must be one of: ${VALID_STROKES.join(", ")}` });
        }
      }
    }
    // Validate engine_recent_templates if present (S2.5 — template engine
    // anti-repeat memory per TEMPLATE_ENGINE_SCOPE.md §6). Array of up to 10
    // { template_id, stroke, ts } entries. Engine excludes (template_id,
    // stroke) tuples present in the last 10 when generating.
    if ("engine_recent_templates" in patch && patch.engine_recent_templates !== null) {
      const arr = patch.engine_recent_templates;
      if (!Array.isArray(arr)) {
        return res.status(400).json({ error: "engine_recent_templates must be an array" });
      }
      if (arr.length > 10) {
        return res.status(400).json({ error: "engine_recent_templates max length is 10" });
      }
      const VALID_STROKES = ["free", "back", "breast", "fly", "IM", "choice", "kick"];
      for (const [i, e] of arr.entries()) {
        if (!e || typeof e !== "object") {
          return res.status(400).json({ error: `engine_recent_templates[${i}] must be an object` });
        }
        if (typeof e.template_id !== "string" || e.template_id.length === 0 || e.template_id.length > 64) {
          return res.status(400).json({ error: `engine_recent_templates[${i}].template_id must be a 1-64 char string` });
        }
        if (typeof e.stroke !== "string" || !VALID_STROKES.includes(e.stroke)) {
          return res.status(400).json({ error: `engine_recent_templates[${i}].stroke must be one of: ${VALID_STROKES.join(", ")}` });
        }
        if (e.ts != null && (typeof e.ts !== "number" || !Number.isFinite(e.ts))) {
          return res.status(400).json({ error: `engine_recent_templates[${i}].ts must be a finite number or omitted` });
        }
      }
    }
    // Run-screen v1 — Validate lap_button (boolean). When false, PaceClockView
    // drops the ✓ Lap button and splits pill; timer auto-advances only and
    // ⏸ Pause becomes the primary action. Default behavior (lap_button=true
    // or absent) preserves the existing ✓ Lap UX.
    if ("lap_button" in patch && patch.lap_button !== null) {
      if (typeof patch.lap_button !== "boolean") {
        return res.status(400).json({ error: "lap_button must be boolean" });
      }
    }
    await dbPatchSettingsExtra(req.userSub, patch);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Favorites routes (per-user) ───────────────────────────────────
app.get("/api/favorites", requireAuth, async (req, res) => {
  try {
    res.json(await dbListFavorites(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { label } = req.body || {};
    if (!label || typeof label !== "string") return res.status(400).json({ error: "label required" });
    await dbAddFavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label);
    await dbRemoveFavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Disfavorites routes (v1.2 — per-user) ──────────────────────────
// Inverse of favorites — disfavored labels get 0.25× weight in the bank
// picker. Mutex with favorites enforced in dbAdd* helpers.
app.get("/api/disfavorites", requireAuth, async (req, res) => {
  try {
    res.json(await dbListDisfavorites(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/disfavorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { label } = req.body || {};
    if (!label || typeof label !== "string") return res.status(400).json({ error: "label required" });
    if (label.length > 255) return res.status(400).json({ error: "label too long (max 255)" });
    await dbAddDisfavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/disfavorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label);
    await dbRemoveDisfavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Set-level disfavorites (v1.5 — mirror of /api/favorite-sets) ────
// IDs from tools/assign_set_ids.py. dbAddDisfavorSet validates format and
// enforces mutex with user_favorite_sets.
app.get("/api/disfavor-sets", requireAuth, async (req, res) => {
  try {
    res.json(await dbListDisfavorSets(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/disfavor-sets", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    // v1.6 — align to /api/favorite-sets convention (camelCase `setId`).
    // No existing client used /api/disfavor-sets POST yet (v1.5 shipped
    // server route only, no UI), so this isn't a breaking change.
    const { setId } = req.body || {};
    if (!setId || typeof setId !== "string") return res.status(400).json({ error: "setId required" });
    await dbAddDisfavorSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    // dbAddDisfavorSet throws on bad ID format; surface as 400 not 500.
    const msg = err.message || String(err);
    const status = /bad set_id format/i.test(msg) ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

app.delete("/api/disfavor-sets/:setId", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const setId = decodeURIComponent(req.params.setId);
    await dbRemoveDisfavorSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// v1.7 — Effective disfavorites endpoint. Returns the union of this user's
// own disfavorites with any primary coach's disfavorites for groups this
// user belongs to. Used by the client picker to apply coach-pushed-down
// disfavor silently. The OWN-only lists are still served by /api/disfavorites
// + /api/disfavor-sets + settings.engine_disfavorites for the audit panel.
app.get("/api/effective-disfavorites", requireAuth, async (req, res) => {
  try {
    res.json(await dbGetEffectiveDisfavorites(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// v1.13 — Mirror of /api/effective-disfavorites. Returns the union of own
// favorites (labels + set_ids + engine tuples) with every coach (primary
// AND assistant) favorite from every group the user is in. Audit panel
// still reads own-only via /api/favorites and /api/favorite-sets.
app.get("/api/effective-favorites", requireAuth, async (req, res) => {
  try {
    res.json(await dbGetEffectiveFavorites(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// UGC bank overlay (Phase B of UGC coach-authored sets).
// Returns the caller's UGC overlay shaped to match the 12 JS bank
// constants (WARMUP_OPTIONS, DRILL_OPTIONS, etc) so the client can
// merge with simple concatenation. Polled every 5 min by the client.
// Visibility scoping: own + admin-approved public + team-shared where
// caller is in the team. Promoted rows (in JS now) excluded.
// Spec: UGC_COACH_SETS_SCOPE.md §4 + §7.
app.get("/api/bank/my-overlay", requireAuth, async (req, res) => {
  try {
    res.json(await dbGetUgcOverlay(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// UGC bank authoring (Phase C of UGC coach-authored sets).
// Coach-only. CRUD on the caller's own bank_options + bank_sets rows.
// Phase C scope: visibility forced to 'private'; team + public flows
// land in D + E. Edit/delete enforce author_sub = caller at db layer.
// Spec: UGC_COACH_SETS_SCOPE.md §4 + §5.

// List caller's authored UGC options. Used by the "My Sets" page.
app.get("/api/bank-options/mine", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    res.json(await dbListUgcOptionsByAuthor(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch a single UGC option (with sets). Returns 404 if not found.
// Phase C: own-only — the edit modal uses this to populate fields.
// Team/public peek by other callers lands in later phases.
app.get("/api/bank-options/:id", requireAuth, async (req, res) => {
  try {
    const row = await dbGetUgcOption(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    // Author can always read their own row. Admin can read any row (needed
    // for Phase E AdminPendingUgc preview + Phase F AdminPublicUgc Graduate
    // preview). Non-author non-admin readers get the option via the overlay
    // endpoint instead — they don't need direct row access.
    const isAuthor = row.author_sub === req.userSub;
    if (!isAuthor) {
      const isAdmin = await dbIsAdmin(req.userSub);
      if (!isAdmin) return res.status(403).json({ error: "not_authorized" });
    }
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Create a new UGC option. Body: full payload per validateUgcPayload.
// Phase D: accepts visibility ∈ {private, team} + team_ids when team.
// Public (Phase E) still rejected at validation layer.
app.post("/api/bank-options", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, async (req, res) => {
  try {
    const r = await dbCreateUgcOption(req.userSub, req.body || {});
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.create",
      ...reqMeta(req),
      details:         {
        option_id:  r.id,
        section:    (req.body && req.body.section)    || null,
        pool_mode:  (req.body && req.body.pool_mode)  || null,
        visibility: (req.body && req.body.visibility) || "private",
        team_count: Array.isArray(req.body && req.body.team_ids) ? req.body.team_ids.length : 0,
      },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    // Validation errors come from validateUgcPayload — surface as 400.
    const msg = err.message || String(err);
    let status = 500;
    if (msg.startsWith("not_authorized")) status = 403;
    else if (/required|bad |out of range|chars|drift|max |UGC quota|visibility/.test(msg)) status = 400;
    res.status(status).json({ error: msg });
  }
});

// Update an existing UGC option. Body: full payload (validateUgcPayload).
// Phase D: accepts visibility ∈ {private, team} + team_ids when team.
app.patch("/api/bank-options/:id", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, async (req, res) => {
  try {
    const r = await dbUpdateUgcOption(req.userSub, req.params.id, req.body || {});
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.update",
      ...reqMeta(req),
      details:         { option_id: req.params.id, visibility: r.visibility },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    const msg = err.message || String(err);
    let status = 500;
    if (msg === "not_found")       status = 404;
    else if (msg.startsWith("not_authorized")) status = 403;
    else if (msg.startsWith("frozen:")) status = 409;
    else if (/required|bad |out of range|chars|drift|max |visibility/.test(msg)) status = 400;
    res.status(status).json({ error: msg });
  }
});

// Standalone visibility change. Body: { visibility, team_ids? }.
// Lighter than PATCH (no set rewrite, no version bump). Used by the
// MySetsView "Change visibility" quick-action.
app.post("/api/bank-options/:id/visibility", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, async (req, res) => {
  try {
    const { visibility, team_ids = [] } = req.body || {};
    const r = await dbSetUgcOptionVisibility(req.userSub, req.params.id, { visibility, team_ids });
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.visibility",
      ...reqMeta(req),
      details:         { option_id: req.params.id, visibility: r.visibility, team_count: Array.isArray(team_ids) ? team_ids.length : 0 },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    const msg = err.message || String(err);
    let status = 500;
    if (msg === "not_found")       status = 404;
    else if (msg.startsWith("not_authorized")) status = 403;
    else if (msg.startsWith("frozen:")) status = 409;
    else if (/required|bad |team_ids/.test(msg)) status = 400;
    res.status(status).json({ error: msg });
  }
});

// Latest review for a UGC option. Author-only (used by MySetsView to
// show rejection reason on rejected rows). Admin can also fetch.
app.get("/api/bank-options/:id/latest-review", requireAuth, async (req, res) => {
  try {
    const opt = await dbGetUgcOption(req.params.id);
    if (!opt) return res.status(404).json({ error: "not_found" });
    const isOwn   = opt.author_sub === req.userSub;
    const isAdmin = await dbIsAdmin(req.userSub);
    if (!isOwn && !isAdmin) return res.status(403).json({ error: "not_authorized" });
    const review = await dbGetLatestUgcReview(req.params.id);
    res.json({ review });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Phase E — admin moderation queue.
// GET /api/admin/pending-ugc — paginated list of visibility='pending' rows.
app.get("/api/admin/pending-ugc", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  || "100", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
    res.json(await dbListPendingUgc({ limit, offset }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Phase F — list public UGC eligible for graduation into the JS bank.
app.get("/api/admin/promotable-ugc", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  || "100", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
    res.json(await dbListPromotableUgc({ limit, offset }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Returns the JS snippet + target constant + paste instructions for a
// promotable option. Read-only — does NOT stamp promoted_at. Admin
// pastes the snippet into local public/index.html, commits, pushes,
// then POSTs /graduate (below) to confirm.
app.get("/api/admin/ugc/:id/graduate-snippet", requireAuth, requireAdmin, async (req, res) => {
  try {
    const opt = await dbGetUgcOption(req.params.id);
    if (!opt) return res.status(404).json({ error: "not_found" });
    if (opt.visibility !== "public") {
      return res.status(409).json({ error: `bad state: visibility=${opt.visibility}, need public` });
    }
    if (opt.promoted_at) return res.status(409).json({ error: "already_promoted" });
    const pack = buildUgcGraduateSnippet(opt);
    res.json({
      ok:          true,
      option_id:   opt.id,
      label:       opt.label,
      ...pack,  // snippet, constantName, subKey, instructions
    });
  } catch (err) {
    // multi_tag_not_supported was a Stage 1 limitation; canonical bank now
    // accepts multi-tag so the snippet builder no longer throws that. Any
    // remaining error is genuine 500.
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Stamps promoted_at + promoted_by_sub. Admin calls this AFTER pasting
// the snippet locally, committing, and pushing. Overlay endpoint then
// stops returning the row (filtered by promoted_at IS NOT NULL) — the
// JS file becomes the source of truth for this set.
app.post("/api/admin/ugc/:id/graduate", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const r = await dbMarkUgcPromoted(req.userSub, req.params.id);
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.graduate",
      ...reqMeta(req),
      details:         { option_id: req.params.id },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    const msg = err.message || String(err);
    let status = 500;
    if (msg === "not_found")        status = 404;
    else if (msg === "already_promoted") status = 409;
    else if (msg.startsWith("bad state")) status = 409;
    res.status(status).json({ error: msg });
  }
});

// Approve or reject a pending UGC option. Body: { decision, reason? }.
// reason required on reject; ignored on approve. Stamps bank_option_reviews +
// flips visibility to 'public' or 'rejected' atomically.
app.post("/api/admin/pending-ugc/:id/review", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const { decision, reason = null } = req.body || {};
    const r = await dbReviewUgcOption(req.userSub, req.params.id, { decision, reason });
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.review",
      ...reqMeta(req),
      details:         { option_id: req.params.id, decision, has_reason: !!reason },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    const msg = err.message || String(err);
    let status = 500;
    if (msg === "not_found")       status = 404;
    else if (/required|bad |decision|reject requires/.test(msg)) status = 400;
    res.status(status).json({ error: msg });
  }
});

// Delete (hard) a UGC option. Cascades to bank_sets via FK.
// Owner-only in Phase C (admin override for frozen rows = future).
app.delete("/api/bank-options/:id", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, async (req, res) => {
  try {
    const r = await dbDeleteUgcOption(req.userSub, req.params.id);
    dbAuditEvent({
      userSub:         req.userSub,
      eventType:       "ugc.option.delete",
      ...reqMeta(req),
      details:         { option_id: req.params.id, deleted: r.deleted },
      impersonatorSub: req.impersonatorSub || null,
    });
    res.json(r);
  } catch (err) {
    const msg = err.message || String(err);
    let status = 500;
    if (msg === "not_authorized") status = 403;
    else if (msg.startsWith("frozen:")) status = 409;
    res.status(status).json({ error: msg });
  }
});

// v3.0 — Coach curation impact. Coach-only. Returns per-curation-item
// reach + effectiveness counts over the last 30 days, across all swimmers
// in groups the coach coaches. Privacy: aggregate counts only, no names.
app.get("/api/coach/curation-impact", requireAuth, requireCoach, async (req, res) => {
  try {
    res.json(await dbGetCoachImpact(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Reporting v1 Phase B — coach reports (R1-R3) ──────────────────
// Spec: REPORTING_SCOPE.md §2 + §4. Self-only — caller is always
// req.userSub. Optional group_id query param narrows R1/R2 to a specific
// group. Range is one of week / month / quarter / season-to-date / custom.

// Normalize ?range= + optional ?start= / ?end= into { startYmd, endYmd }.
// Falls back to last 30 days for malformed input rather than 400 — reports
// are read-only, soft failure to "no data" is friendlier than rejection.
function _parseReportRange(q = {}) {
  const today = new Date();
  const ymd   = (d) => d.toISOString().slice(0, 10);
  const back  = (days) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - days); return d; };
  const range = String(q.range || "month").toLowerCase();
  if (range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(q.start) && /^\d{4}-\d{2}-\d{2}$/.test(q.end)) {
    return { startYmd: q.start, endYmd: q.end };
  }
  switch (range) {
    case "week":              return { startYmd: ymd(back(7)),   endYmd: ymd(today) };
    case "month":             return { startYmd: ymd(back(30)),  endYmd: ymd(today) };
    case "quarter":           return { startYmd: ymd(back(90)),  endYmd: ymd(today) };
    case "season-to-date": {
      // Crude season anchor: Sept 1 of the most recent September (US club
      // season convention). Past coaches asked for season metrics; this is
      // a sensible-ish default until we add per-coach season config.
      const yr = today.getUTCMonth() >= 8 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
      return { startYmd: `${yr}-09-01`, endYmd: ymd(today) };
    }
    default:                  return { startYmd: ymd(back(30)),  endYmd: ymd(today) };
  }
}

app.get("/api/reports/programming-mix", requireAuth, requireCoach, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const groupId = req.query.group_id || null;
    const data = await dbGetProgrammingMix(req.userSub, { startYmd, endYmd, groupId });
    res.json({ startYmd, endYmd, groupId, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/reports/schedule-adherence", requireAuth, requireCoach, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const groupId = req.query.group_id || null;
    const data = await dbGetScheduleAdherence(req.userSub, { startYmd, endYmd, groupId });
    res.json({ startYmd, endYmd, groupId, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/reports/curation-log", requireAuth, requireCoach, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const data = await dbGetCurationLog(req.userSub, { startYmd, endYmd });
    res.json({ startYmd, endYmd, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// R4 — Program Recap. Solo/masters report. Open to any authenticated user
// (not coach-gated) — solo swimmers are the primary audience. Coaches can
// also view their own recap.
app.get("/api/reports/program-recap", requireAuth, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const data = await dbGetProgramRecap(req.userSub, { startYmd, endYmd });
    res.json({ startYmd, endYmd, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// R5 — Platform Health (admin). Active coaches, workouts/week, feature
// adoption, fallback rate trended. Optional team_id query param narrows
// to one team.
app.get("/api/reports/platform-health", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const teamId = req.query.team_id || null;
    const data = await dbGetPlatformHealth({ startYmd, endYmd, teamId });
    res.json({ startYmd, endYmd, teamId, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// R6 — Curation & Support Activity (admin). Per-team propagating disfavor
// counts, impersonation activity by actor, per-team audit rollups.
app.get("/api/reports/curation-support", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { startYmd, endYmd } = _parseReportRange(req.query);
    const data = await dbGetCurationSupport({ startYmd, endYmd });
    res.json({ startYmd, endYmd, ...data });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Set-level favorites (set IDs from assign_set_ids.py) ────────────
app.get("/api/favorite-sets", requireAuth, async (req, res) => {
  try {
    res.json(await dbListFavoriteSets(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorite-sets", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { setId } = req.body || {};
    if (!setId || typeof setId !== "string") return res.status(400).json({ error: "setId required" });
    await dbAddFavoriteSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    // dbAddFavoriteSet throws on bad ID format; surface as 400 not 500.
    if (/bad set_id format/.test(err.message)) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorite-sets/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const setId = decodeURIComponent(req.params.id);
    await dbRemoveFavoriteSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Goals ──────────────────────────────────────────────────────────
// Recurring goals only (period_start = NULL). One active goal per metric.
// Allowed metrics: workouts_per_week | yards_per_week | yards_per_month.
app.get("/api/goals", requireAuth, async (req, res) => {
  try {
    res.json(await dbListGoals(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/goals", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { metric, target_value } = req.body || {};
    if (!metric || typeof metric !== "string") return res.status(400).json({ error: "metric required" });
    if (target_value == null) return res.status(400).json({ error: "target_value required" });
    await dbSetGoal(req.userSub, metric, target_value);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.delete("/api/goals/:metric", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const metric = decodeURIComponent(req.params.metric);
    await dbDeleteGoal(req.userSub, metric);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Feedback (Session 5) ───────────────────────────────────────────
// User submission. category + subject + body required. page + user_agent
// auto-captured client-side. Logs a `feedback.submit` audit event.
app.post("/api/feedback", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { category, subject, body, page, user_agent } = req.body || {};
    const r = await dbInsertFeedback({
      userSub:   req.userSub,
      category,
      subject,
      body,
      page,
      userAgent: user_agent || req.get("user-agent"),
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "feedback.submit",
      ...reqMeta(req),
      details:   { feedback_id: r.id, category },
    });
    res.json({ ok: true, id: r.id });

    // ── Discord webhook (DISCORD_SCOPE.md §6) ─────────────────────────
    // Fire-and-forget AFTER res.json so the user never waits on Discord.
    // Bypass when DOB is unknown (null) or user is under 18 — minor
    // protection per scope §6 + §2 audience-is-adults-only. The DB row
    // is canonical; missing the Discord post degrades triage UX but
    // never user data integrity.
    pool.query(
      "SELECT p.`first_name`, p.`last_name`, p.`preferred_name`, p.`dob` " +
      "FROM `users` u LEFT JOIN `persons` p ON p.`id` = u.`person_id` WHERE u.`sub` = ?",
      [req.userSub])
      .then(async (rows) => {
        const u = rows[0];
        if (!u) return;
        const minor = isMinor(u.dob);
        if (minor === null || minor === true) {
          // null DOB (unknown) → safer-side bypass; true → enforced bypass.
          dbAuditEvent({
            userSub:   req.userSub,
            eventType: "feedback.discord.bypassed",
            ...reqMeta(req),
            details:   { feedback_id: r.id, reason: minor === null ? "dob_unknown" : "minor" },
          });
          return;
        }
        const result = await postFeedbackToDiscord({
          category, subject, body, page,
          displayName: ((u.preferred_name || u.first_name || "") + " " + (u.last_name || "")).trim() || "(unknown)",
        });
        dbAuditEvent({
          userSub:   req.userSub,
          eventType: result.posted ? "feedback.discord.posted" : "feedback.discord.failed",
          ...reqMeta(req),
          details:   { feedback_id: r.id, reason: result.reason || null },
        });
      })
      .catch(err => console.warn(`[feedback] Discord dispatch path threw: ${err.message}`));
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// Admin: list feedback (default filter: status=new). Optional ?status= and ?user_sub=.
app.get("/api/admin/feedback", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, user_sub } = req.query;
    res.json(await dbAdminListFeedback({ status, userSub: user_sub }));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Admin: update status and/or admin_note. Stamps reviewer/reviewed_at when
// status transitions out of "new". Logs admin.feedback.update.
app.patch("/api/admin/feedback/:id", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
    const { status, admin_note } = req.body || {};
    const r = await dbAdminUpdateFeedback(id, { status, admin_note }, req.userSub);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "admin.feedback.update",
      ...reqMeta(req),
      details:   { feedback_id: id, status, has_note: admin_note != null },
    });
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// Admin: send a test email to yourself. Fires through the real enqueueEmail
// path (lib/email.js) so all the production guards apply — minor-bypass,
// EMAIL_ACTIVE check, dedup_key uniqueness, audit logging. The returned
// shape mirrors enqueueEmail's: { id } on enqueue, { bypassed: reason }
// when minor-bypass triggered, { skipped: reason } for inactive / unknown
// user / missing email. The UI uses this to give an honest worker result.
//
// dedup_key includes Date.now() so repeated test sends from the same
// admin don't collide. template_id defaults to 'welcome'; future templates
// can be tested by passing template_id in the body.
// ───── Vendor paper kit (Phase 3 deliverable 3 of 4) ─────────────────
// Per VENDOR_PAPER_KIT_SCOPE.md §3.5. Admin-only. The route renders
// vendor-kit/cover-letter.md with {{ORG_NAME}} + {{TREASURER_NAME}} +
// {{TODAY_YMD}} placeholders substituted, lists the expected PDF
// attachments (which Cap'n attaches manually from vendor-kit/build/),
// and audit-logs the send. Returns the rendered letter + attachment
// filenames so the client can build a mailto: link.
//
// v1 does NOT send the kit via Resend (no attachment support in the
// current email worker; the PDFs are static files on disk that need
// to ship with the mailto:). Client opens mailto: and Cap'n attaches
// the files from vendor-kit/build/ in his mail client.
app.post("/api/admin/vendor-kit/send", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const recipientEmail   = String(req.body?.recipient_email   || "").trim();
    const organizationName = String(req.body?.organization_name || "").trim();
    const treasurerName    = String(req.body?.treasurer_name    || "").trim();
    if (!recipientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      return res.status(400).json({ error: "valid recipient_email required" });
    }
    if (!organizationName) return res.status(400).json({ error: "organization_name required" });
    if (!treasurerName)    return res.status(400).json({ error: "treasurer_name required" });

    // Load + substitute the cover letter. File ships with the repo at
    // vendor-kit/cover-letter.md. If the file is missing in prod (e.g.,
    // Dockerfile COPY allowlist forgot it), surface a clear error rather
    // than a 500.
    const kitDir = path.join(__dirname, "vendor-kit");
    let letterTemplate;
    try {
      letterTemplate = await readFile(path.join(kitDir, "cover-letter.md"), "utf8");
    } catch (e) {
      return res.status(500).json({ error: "vendor-kit/cover-letter.md missing from server — Dockerfile COPY needed" });
    }
    const todayYmd = new Date().toISOString().slice(0, 10);
    const renderedLetter = letterTemplate
      .replaceAll("{{ORG_NAME}}",       organizationName)
      .replaceAll("{{TREASURER_NAME}}", treasurerName)
      .replaceAll("{{TODAY_YMD}}",      todayYmd);

    // Expected PDF attachments — these live in vendor-kit/build/ on
    // Cap'n's local machine after running build.sh. Listed for the
    // client to display so Cap'n knows what to attach.
    const attachmentFilenames = [
      "services-agreement.pdf",
      "dpa.pdf",
      "breach-notification-sla.pdf",
      "continuity-commitment.pdf",
      "sub-processor-list.pdf",
      "w-9.pdf",
    ];

    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "vendor_kit.sent",
      ...reqMeta(req),
      details:   {
        recipient_email:   recipientEmail,
        organization_name: organizationName,
        treasurer_name:    treasurerName,
      },
    });

    res.json({
      rendered_letter:      renderedLetter,
      attachment_filenames: attachmentFilenames,
      recipient_email:      recipientEmail,
      subject:              `SetForge — vendor paperwork for ${organizationName}`,
    });
  } catch (err) {
    console.error("[admin/vendor-kit/send]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Billing thin slice (Phase 3 deliverable 4 of 4 — SCAFFOLD) ────
// Per BILLING_SCOPE.md §3.4. Five routes, all returning 501 in scaffold
// mode (BILLING_ACTIVE=false). Real Stripe SDK + body implementations
// land in the "fill it in" slice that ships when first paying pilot
// triggers.
//
// The route shapes + auth + audit-event names are locked here so the
// route surface is stable; the inside-the-try bodies are the placeholders.
// status + history routes are functional NOW against the migration-038
// schema even before Stripe is live (they read DB columns / table only).

function billingInactiveResponse(res) {
  return res.status(501).json({
    error:   "billing_not_configured",
    message: "Billing isn't configured in this environment. Set STRIPE_SECRET_KEY + STRIPE_PRICE_ID_COACH_MONTHLY to enable.",
  });
}

app.post("/api/billing/checkout", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!BILLING_ACTIVE) return billingInactiveResponse(res);
    // Double-pay guard: don't open a Stripe checkout if the user already holds
    // an active Apple IAP subscription (would bill them on both channels).
    const xc = await checkCrossChannel(req.userSub, "stripe");
    if (xc.blocked) {
      return res.status(409).json({
        error:   "already_subscribed_other_channel",
        channel: xc.otherChannel,                                              // "apple"
        message: "You already have an active subscription through the App Store. Manage it in your iPhone's Settings → Apple Account → Subscriptions.",
      });
    }
    // tier: "coach" (default), "lesson", or "supporter". Lesson + supporter are
    // inert until their price_id is configured (returns no_price_id otherwise).
    // Supporter (eval #7) is an optional "support SetForge" sub that gates nothing.
    const _t = req.body && req.body.tier;
    const tier = (_t === "lesson" || _t === "supporter") ? _t : "coach";
    const result = await createCheckoutSession({
      userSub:    req.userSub,
      successUrl: `${APP_URL}/?upgrade=success`,
      cancelUrl:  `${APP_URL}/?upgrade=cancelled`,
      tier,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "billing.checkout.start",
      ...reqMeta(req),
      details:   { tier, result_type: result?.url ? "session_created" : (result?.error || result?.skipped || "unknown") },
    });
    if (result?.url) return res.json({ url: result.url });
    if (result?.error === "no_price_id") return res.status(500).json({ error: "no_price_id", message: tier === "lesson" ? "Lesson price not configured yet (set price_id_lesson_monthly in STRIPE_CONFIG)." : tier === "supporter" ? "Supporter price not configured yet (set price_id_supporter_monthly in STRIPE_CONFIG)." : "Stripe price ID not configured. Set STRIPE_PRICE_ID_COACH_MONTHLY in env." });
    res.status(500).json({ error: "checkout_session_failed", result });
  } catch (err) {
    console.error("[billing/checkout]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/billing/portal", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!BILLING_ACTIVE) return billingInactiveResponse(res);
    const result = await createPortalSession({ userSub: req.userSub });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "billing.portal.open",
      ...reqMeta(req),
      details:   { result_type: result?.url ? "portal_session_created" : (result?.error || result?.skipped || "unknown") },
    });
    if (result?.url) return res.json({ url: result.url });
    if (result?.error === "no_customer") return res.status(400).json({ error: "no_stripe_customer", message: "No Stripe customer on file. Subscribe first via Checkout." });
    res.status(500).json({ error: "portal_session_failed", result });
  } catch (err) {
    console.error("[billing/portal]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Webhook: NO auth (Stripe is the caller). Real implementation MUST
// verify Stripe signature via STRIPE_WEBHOOK_SECRET BEFORE inserting
// the event into stripe_webhook_events. Scaffold returns 501 so
// Stripe will retry — by the time the trigger fires, this route gets
// signature verification + idempotency insert + processWebhookEvent call.
//
// Note: webhook route is exempt from checkOrigin (Stripe doesn't set
// Origin) and from CSRF (Stripe doesn't have access to user's CSRF
// token). Signature verification is the auth.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!BILLING_ACTIVE) {
      // Return 200 so Stripe stops retrying during a test in an
      // environment where billing isn't configured. The audit log
      // captures the missed event so we know it happened.
      console.warn("[billing/webhook] received event but BILLING_ACTIVE=false; acking + dropping");
      return res.status(200).json({ acked: true, dropped: "billing_inactive" });
    }

    // Step 1: verify Stripe signature against raw body. Throws on bad
    // signature → 400 (do NOT 200 here; bad signature could be an
    // attacker, we want Stripe-side alerting on the dashboard).
    const sigHeader = req.headers["stripe-signature"];
    let stripeEvent;
    try {
      stripeEvent = verifyWebhookSignature(req.body, sigHeader);
    } catch (sigErr) {
      console.error("[billing/webhook] signature verify failed:", sigErr.message);
      return res.status(400).json({ error: "invalid_signature" });
    }

    // Step 2: idempotency insert. Stripe re-sends on retry; we record
    // the event_id with status=pending and rely on the PK to dedupe.
    // ER_DUP_ENTRY means we've seen this event before — but we only skip
    // processing if a PRIOR attempt already SUCCEEDED (processed_status=
    // 'processed'). A row left 'pending'/'failed' means a previous attempt
    // never completed (DB blip, Stripe API timeout); since we 200 even on
    // failure, Stripe would otherwise never retry it — so we fall through
    // and (re)process to avoid silently losing the event.
    try {
      await pool.query(
        "INSERT INTO `stripe_webhook_events` (`stripe_event_id`, `event_type`, `payload_json`) VALUES (?, ?, ?)",
        [stripeEvent.id, stripeEvent.type, JSON.stringify(stripeEvent).slice(0, 16777215)]
      );
    } catch (dupErr) {
      if (dupErr.code === "ER_DUP_ENTRY" || /duplicate/i.test(dupErr.message || "")) {
        const priorRows = await pool.query(
          "SELECT `processed_status` FROM `stripe_webhook_events` WHERE `stripe_event_id` = ?",
          [stripeEvent.id]
        );
        if (priorRows[0]?.processed_status === "processed") {
          return res.status(200).json({ ok: true, deduped: true, event_id: stripeEvent.id });
        }
        // Prior attempt left the row pending/failed — fall through to reprocess.
      } else {
        throw dupErr;
      }
    }

    // Step 3: dispatch + mark processed. Errors here flip the row to
    // failed but we still 200 (Stripe retries on non-200; we'd rather
    // investigate ourselves via processed_status='failed').
    try {
      const result = await processWebhookEvent(stripeEvent);
      await pool.query(
        "UPDATE `stripe_webhook_events` SET `processed_status` = 'processed' WHERE `stripe_event_id` = ?",
        [stripeEvent.id]
      );
      res.status(200).json({ ok: true, result });
    } catch (procErr) {
      console.error("[billing/webhook] process failed:", procErr.message);
      await pool.query(
        "UPDATE `stripe_webhook_events` SET `processed_status` = 'failed', `last_error` = ? WHERE `stripe_event_id` = ?",
        [String(procErr.message || procErr).slice(0, 1000), stripeEvent.id]
      );
      res.status(200).json({ ok: false, error: procErr.message });
    }
  } catch (err) {
    console.error("[billing/webhook]", err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// ── Apple In-App Purchase (scaffold, parallel to Stripe above) ──────
// Both routes are INERT until APPLE_IAP_CONFIG env is set (IAP_ACTIVE=false)
// and the @apple/app-store-server-library package is installed. They resolve
// to the SAME tier seam Stripe uses (grantTier/revokeTier via lib/appleIap.js).
// See IAP_PLAN.md for the activation checklist.

// Client (StoreKit 2) posts its signed transaction after a purchase/restore;
// the server verifies it with Apple and grants the tier. Bearer auth (native).
// Pre-purchase eligibility — the iOS paywall calls this BEFORE triggering a
// StoreKit purchase so we can block an Apple buy when the user already has an
// active web (Stripe) subscription, before any money changes hands.
// { eligible: bool, reason?, otherChannel? }
app.get("/api/billing/apple/eligibility", requireAuth, async (req, res) => {
  try {
    const xc = await checkCrossChannel(req.userSub, "apple");
    if (xc.blocked) {
      return res.json({
        eligible:     false,
        reason:       xc.reason,            // "active_stripe_subscription"
        otherChannel: xc.otherChannel,      // "stripe"
        message:      "You already have an active subscription on the web. Manage it at setforge.io before subscribing here.",
      });
    }
    res.json({ eligible: true });
  } catch (err) {
    // Fail open: an eligibility-check error shouldn't block a legit purchase.
    console.error("[billing/apple/eligibility]", err.message);
    res.json({ eligible: true });
  }
});

app.post("/api/billing/apple/verify", requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!IAP_ACTIVE) return res.status(503).json({ error: "iap_inactive" });
    const jws = req.body?.signedTransaction || req.body?.jws;
    if (!jws || typeof jws !== "string") return res.status(400).json({ error: "signedTransaction required" });
    const v = await verifyTransaction(jws);
    if (v.skipped || v.error) return res.status(v.error === "not_activated" ? 503 : 400).json(v);
    // Security (Critical): bind the transaction to THIS user. The app passes a
    // per-user appAccountToken at purchase that Apple bakes into the receipt; if a
    // token is present it MUST match the caller's stored one — otherwise this is a
    // signed receipt being replayed onto another account. (Legacy receipts with no
    // token fall through to the originalTransactionId cross-user check below.)
    if (v.appAccountToken) {
      const myToken = await dbGetAppleAppAccountToken(req.userSub);
      if (!myToken || String(v.appAccountToken).toLowerCase() !== String(myToken).toLowerCase()) {
        dbAuditEvent({ userSub: req.userSub, eventType: "billing.apple.token_mismatch", ...reqMeta(req),
          details: { original_txn_id: v.originalTransactionId || null } });
        return res.status(403).json({ error: "transaction_not_yours" });
      }
    }
    // Capture cross-channel state BEFORE applying — applyVerifiedTransaction
    // overwrites tier_source to apple_iap_*, after which checkCrossChannel would
    // see apple===apple and always report blocked:false (dead double-pay warning).
    const xc = await checkCrossChannel(req.userSub, "apple");
    const result = await applyVerifiedTransaction({
      userSub:               req.userSub,
      productId:             v.productId,
      originalTransactionId: v.originalTransactionId,
      expiresDate:           v.expiresDate,
      revoked:               v.revoked,
    });
    // A receipt whose originalTransactionId already belongs to another account.
    if (result && result.error === "txn_belongs_to_another_user") {
      dbAuditEvent({ userSub: req.userSub, eventType: "billing.apple.txn_reuse", ...reqMeta(req),
        details: { original_txn_id: v.originalTransactionId || null } });
      return res.status(403).json({ error: "transaction_not_yours" });
    }
    // Double-pay note: if the user ALSO has an active Stripe sub, Apple has
    // already charged them — we still grant the tier (never take their money
    // and deny access) but flag it so we (and they) can cancel the redundant
    // Stripe sub.
    if (xc.blocked) {
      dbAuditEvent({
        userSub:   req.userSub,
        eventType: "billing.double_pay.detected",
        ...reqMeta(req),
        details:   { active_other: xc.otherChannel, note: "apple purchase while stripe active — cancel stripe" },
      });
      return res.json({ ok: true, result, warning: "active_stripe_subscription", message: "You also have a web subscription — please cancel it to avoid double billing." });
    }
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[billing/apple/verify]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// The per-user appAccountToken (UUID) the iOS app must pass into the StoreKit
// purchase so the resulting receipt is bound to THIS account. Stable per user.
app.get("/api/billing/apple/account-token", requireAuth, async (req, res) => {
  try {
    const token = await dbGetOrCreateAppleAppAccountToken(req.userSub);
    if (!token) return res.status(404).json({ error: "user_not_found" });
    res.json({ token });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// App Store Server Notifications V2 — Apple POSTs a signed payload on
// subscription lifecycle changes. Raw body (the JSON-parser skip is wired
// above). Idempotency via apple_iap_events. Always 200 once we've recorded it
// so Apple stops retrying (we investigate failures via processed_status).
app.post("/api/billing/apple/notify", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!IAP_ACTIVE) {
      console.warn("[billing/apple/notify] received but IAP_ACTIVE=false; acking + dropping");
      return res.status(200).json({ acked: true, dropped: "iap_inactive" });
    }
    let body;
    try { body = JSON.parse(req.body.toString("utf8")); }
    catch (_) { return res.status(400).json({ error: "invalid_json" }); }
    const signedPayload = body?.signedPayload;
    if (!signedPayload) return res.status(400).json({ error: "signedPayload required" });

    // Bad signature → 400 (do NOT 200; could be an attacker, and Apple only
    // retries on non-2xx for genuine delivery failures, not forged ones).
    let result;
    try {
      result = await processNotification(signedPayload);
    } catch (procErr) {
      console.error("[billing/apple/notify] process threw:", procErr.message);
      return res.status(200).json({ ok: false, error: procErr.message });
    }
    if (result?.error === "notification_verify_failed" || result?.error === "transaction_verify_failed") {
      return res.status(400).json({ error: result.error });
    }

    // Idempotency is now handled INSIDE processNotification: it reserves the
    // notificationUUID (INSERT IGNORE) BEFORE applying the grant/revoke, so an Apple
    // retry can't re-run the side effect. A retry comes back as result.deduped.
    if (result?.deduped) {
      return res.status(200).json({ ok: true, deduped: true, notification_uuid: result.notificationUUID });
    }
    res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("[billing/apple/notify]", err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// Status: SAFE to call now (reads users.tier + stripe_customer_id from
// migration 038). When tier hasn't been set (free), returns tier: 'free'.
app.get("/api/billing/status", requireAuth, async (req, res) => {
  try {
    const status = await getBillingStatusFor(req.userSub);
    res.json(status);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// History: SAFE to call now (reads billing_history from migration 038).
// Empty array until first invoice arrives via webhook.
app.get("/api/billing/history", requireAuth, async (req, res) => {
  try {
    const rows = await getBillingHistoryFor(req.userSub, req.query?.limit || 10);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Admin diagnostic — reports which STRIPE_CONFIG fields are populated
// without exposing the secret values themselves. Use to confirm at-a-glance
// that BILLING_ACTIVE is true and all four fields are loaded. Returns
// { active, config_source, has_secret_key, has_webhook, has_price_id,
//   portal_return }.
app.get("/api/admin/billing/config", requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({ stripe: billingConfigState(), apple_iap: appleIapConfigState(), push: pushConfigState(), weather: weatherConfigState() });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// WeatherKit live probe (admin) — signs a token + makes one real WeatherKit
// call so config issues surface as a concrete HTTP status (200 ok / 401 bad
// sub-or-token / 403 capability missing). See lib/weather.js weatherSelfTest.
app.get("/api/admin/weather/selftest", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await weatherSelfTest()); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/email/test", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const templateId = (req.body?.template_id || "welcome").toString().slice(0, 64);
    // Vars passed through to the renderer. For welcome we look up the
    // admin's display_name. Future templates can pull other fields.
    const userRows = await pool.query(
      "SELECT p.`first_name`, p.`last_name`, p.`preferred_name` " +
      "FROM `users` u LEFT JOIN `persons` p ON p.`id` = u.`person_id` WHERE u.`sub` = ?",
      [req.userSub]
    );
    const _u = userRows[0];
    const displayName = _u ? (((_u.preferred_name || _u.first_name || "") + " " + (_u.last_name || "")).trim() || null) : null;

    const result = await enqueueEmail({
      dedupKey:    `test:${templateId}:${req.userSub}:${Date.now()}`,
      toUserSub:   req.userSub,
      templateId,
      displayName,
      manualUrl:   `${APP_URL}/manual.html`,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "admin.email.test",
      ...reqMeta(req),
      details:   { template_id: templateId, result },
    });
    res.json(result);
  } catch (err) {
    console.error("[admin/email/test]", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Teams (relationships scope, Stage 1 / R-A) ────────────────────
// See RELATIONSHIPS_SCOPE.md. v1 surfaces only the owner role; admin tier
// is in the data model but no UI to set it until R-J. Coach-gated overall
// (must have is_coach=1 or is_admin=1 to create a team). Inside a team,
// gating is by team_coaches.role (owner / admin / coach). Global admin
// does NOT auto-pass team-role checks here — use the existing /api/admin
// routes for admin-side moderation if ever needed (not built v1).

// Inline helper: returns the caller's role in this team, or null. Used as
// a gate inside each handler so we don't need a per-team middleware factory.
async function getCallerTeamRole(teamId, sub) {
  return await dbGetTeamRole(teamId, sub);
}

// List teams the caller is an active coach in. Returns role per team.
app.get("/api/teams", requireAuth, async (req, res) => {
  try { res.json(await dbListTeamsForCoach(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List coaches for picker UIs (Teams add-coach, group_coaches add — R-C).
// Excludes the caller. Minimal info to limit PII exposure. requireCoach.
// See db.js dbListCoachesForPicker for the v1 privacy caveat.
app.get("/api/coaches", requireAuth, requireCoach, async (req, res) => {
  try { res.json(await dbListCoachesForPicker(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Create a team. Requires is_coach (or is_admin). Caller becomes owner.
app.post("/api/teams", checkOrigin, requireAuth, requireCoach, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { name, team_type } = req.body || {};
    if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
    if (!team_type) return res.status(400).json({ error: "team_type required" });
    const r = await dbCreateTeam({ ownerSub: req.userSub, name, teamType: team_type });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.create",
      ...reqMeta(req),
      details:   { team_id: r.id, name, team_type },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// Resolve a team's effective Phase-6 visibility map (preset + overrides, with
// compliance force-ON for non-masters teams — F5). team must be a dbGetTeam row.
async function teamFeatureFlags(team) {
  const row = await dbGetTeamFlagsRow(team.id).catch(() => null);
  // A5: no explicit config + a Lesson-tier owner → default to the Simple preset
  // (the lesson/private coach gets the stripped-down app out of the box).
  let preset = row?.preset || null;
  if (!row && team.owner_coach_sub) {
    const owner = await dbGetMe(team.owner_coach_sub).catch(() => null);
    if (owner && owner.tier === "lesson") preset = "simple";
  }
  // A6: a declared "no minors" team lifts the F5 compliance force-on.
  const hasMinors = team.team_type !== "masters" && !(row && row.no_minors);
  return resolveTeamFlags({ preset, overrides: row?.overrides || {}, hasMinors });
}

// Team detail. Requires active membership of any role.
app.get("/api/teams/:id", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const coaches = await dbListTeamCoaches(req.params.id);
    res.json({ ...team, viewer_role: role, coaches, feature_flags: await teamFeatureFlags(team) });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Read the team's visibility config (raw preset+overrides + resolved map).
// Any team member can read (so the client knows what to render); writes are owner/admin.
app.get("/api/teams/:id/feature-flags", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const row = await dbGetTeamFlagsRow(team.id);
    res.json({
      preset: row?.preset || null,
      overrides: row?.overrides || {},
      no_minors: !!(row && row.no_minors),
      resolved: await teamFeatureFlags(team),
      team_type: team.team_type,
      can_edit: role === "owner" || role === "admin",
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Write the team's visibility config (owner/admin). Body: { preset?, overrides? }.
app.put("/api/teams/:id/feature-flags", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (role !== "owner" && role !== "admin") return res.status(403).json({ error: "owner or admin required" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const { preset = null, overrides = {}, no_minors } = req.body || {};
    const clean = (overrides && typeof overrides === "object") ? overrides : {};
    const r = await dbSetTeamFlags(req.params.id, { preset, overrides: clean, noMinors: (no_minors === undefined ? undefined : !!no_minors) }, req.userSub);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.feature_flags", ...reqMeta(req), details: { team_id: req.params.id, preset: preset || null } });
    res.json({ ok: true, resolved: await teamFeatureFlags(team) });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Composite team-detail bootstrap — one GET returns the team (with coaches +
// viewer_role), its groups, and its events, so opening a team fires ONE
// request instead of 3 parallel ones (the burst that, combined with the
// roster + managed-roster fetches, tripped Hyperlift's 429 and made the
// Groups tab render "No groups yet"). Same play as /api/me/bootstrap. The
// TeamsView seeds detail/groups/events from this; the per-section loaders
// stay for post-mutation refresh.
app.get("/api/teams/:id/detail", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const [coaches, groups, events] = await Promise.all([
      dbListTeamCoaches(req.params.id),
      dbListGroupsForTeam(req.params.id, { includeArchived: false }),
      dbListTeamEvents(req.params.id),
    ]);
    res.json({ team: { ...team, viewer_role: role, coaches, feature_flags: await teamFeatureFlags(team) }, groups, events });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Rename a team. Owner only.
app.patch("/api/teams/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (role !== "owner") return res.status(403).json({ error: "owner only" });
    const { name, team_code } = req.body || {};
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (team_code !== undefined) patch.team_code = team_code;
    const r = await dbUpdateTeam(req.params.id, patch);
    if (!r.ok) return res.status(400).json({ error: r.reason || "update failed" });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.update",
      ...reqMeta(req),
      details:   { team_id: req.params.id, fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Archive / unarchive a team. Owner only. Body { archived: true|false }.
// Per decision #13 archiving a team does NOT cascade to groups. Groups
// don't exist yet (R-C); when they do, archive route returns a warning
// about active groups in the response.
app.post("/api/teams/:id/archive", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (role !== "owner") return res.status(403).json({ error: "owner only" });
    const archived = req.body?.archived !== false;                              // default true
    // Ownership transfer decision 12: can't archive while a transfer is pending.
    if (archived) {
      const pending = await dbGetPendingTransferForTeam(req.params.id);
      if (pending) return res.status(409).json({ error: "pending_transfer", message: "Resolve the pending ownership transfer before archiving this team." });
    }
    const r = await dbArchiveTeam(req.params.id, archived);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: archived ? "team.archive" : "team.unarchive",
      ...reqMeta(req),
      details:   { team_id: req.params.id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List a team's active coaches. Requires any-role membership.
app.get("/api/teams/:id/coaches", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    res.json(await dbListTeamCoaches(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Add a coach to a team. Owner only in v1 (admin tier wired in data model
// but not exposed in UI until R-J). Body { coach_sub, role? } — role
// defaults to "coach"; "owner" rejected (set at create only).
app.post("/api/teams/:id/coaches", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerTeamRole(req.params.id, req.userSub);
    if (callerRole !== "owner") return res.status(403).json({ error: "owner only" });
    const { coach_sub, role = "coach" } = req.body || {};
    if (!coach_sub) return res.status(400).json({ error: "coach_sub required" });
    const r = await dbAddTeamCoach(req.params.id, coach_sub, role);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.add_coach",
      ...reqMeta(req),
      details:   { team_id: req.params.id, target_sub: coach_sub, role, reactivated: !!r.reactivated },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// R-J: promote/demote a team coach between 'admin' and 'coach' roles.
// Owner only. The owner's role is immutable here (ownership transfer is its
// own flow, not v1).
app.patch("/api/teams/:id/coaches/:sub", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerTeamRole(req.params.id, req.userSub);
    if (callerRole !== "owner") return res.status(403).json({ error: "owner only" });
    const { role } = req.body || {};
    const r = await dbUpdateTeamCoachRole(req.params.id, req.params.sub, role);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.change_coach_role",
      ...reqMeta(req),
      details:   { team_id: req.params.id, target_sub: req.params.sub, new_role: role },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// R-J: transfer a group's primary coach to a different coach. Used when
// removing a team coach who's primary on groups — actor walks through the
// removal modal, picks a destination per group, this endpoint executes each
// transfer atomically. Caller must be team owner OR the current primary
// coach (so a primary can hand off without owner action).
app.post("/api/groups/:id/primary-coach", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const group = await dbGetGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "group not found" });
    let allowed = false;
    if (group.team_id) {
      const tr = await dbGetTeamRole(group.team_id, req.userSub);
      if (tr === "owner") allowed = true;
    }
    const gr = await dbGetGroupRole(req.params.id, req.userSub);
    if (gr === "primary") allowed = true;
    if (!allowed) return res.status(403).json({ error: "team owner or current primary coach required" });
    const { new_primary_sub } = req.body || {};
    if (!new_primary_sub) return res.status(400).json({ error: "new_primary_sub required" });
    const r = await dbTransferGroupPrimary(req.params.id, new_primary_sub);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.transfer_primary",
      ...reqMeta(req),
      details:   { group_id: req.params.id, prior_primary: r.prior_primary, new_primary: new_primary_sub },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Remove a coach from a team (sets removed_at; row preserved). Owner only
// in v1. Owner cannot be removed via this endpoint (would orphan FK).
// R-J: also refuses with conflict info if the target is still primary on
// any active group in this team — UI prompts for per-group transfer first.
app.delete("/api/teams/:id/coaches/:sub", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerTeamRole(req.params.id, req.userSub);
    if (callerRole !== "owner") return res.status(403).json({ error: "owner only" });
    const r = await dbRemoveTeamCoach(req.params.id, req.params.sub);
    if (!r.ok) {
      // Surface "primary_on_groups" with the conflict list so UI can prompt
      // for per-group transfer before retrying the remove.
      return res.status(400).json({ error: r.reason, ...r });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.remove_coach",
      ...reqMeta(req),
      details:   { team_id: req.params.id, target_sub: req.params.sub, ugc_reassigned: r.ugc_reassigned || 0 },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Team ownership transfer (Phase 4 / OWNERSHIP_TRANSFER_SCOPE.md) ─────
// Reversible hand-off: owner proposes an existing admin → 30-day cooldown during
// which the new owner can Accept early or Decline, or the owner can Cancel; the
// email-worker cron auto-completes after 30 days. Emails are best-effort; the
// in-app banner is authoritative.

app.post("/api/teams/:id/transfer-ownership", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { to_sub } = req.body || {};
    if (!to_sub) return res.status(400).json({ error: "to_sub required" });
    const r = await dbProposeOwnershipTransfer({ teamId: req.params.id, fromSub: req.userSub, toSub: to_sub });
    if (!r.ok) {
      const code = r.reason === "already_pending" ? 409 : (r.reason === "not_owner" ? 403 : 400);
      return res.status(code).json({ error: r.reason });
    }
    dbAuditEvent({ userSub: req.userSub, eventType: "team.transfer.proposed", ...reqMeta(req), details: { team_id: req.params.id, to_sub, transfer_id: r.id } });
    const team = await dbGetTeam(req.params.id);
    enqueueEmail({ dedupKey: `transfer-proposed:${r.id}`, toUserSub: to_sub, templateId: "transfer-proposed", teamName: team?.name || "your team" }).catch(() => {});
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/teams/:id/transfer-ownership/cancel", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbCancelOwnershipTransfer({ teamId: req.params.id, byCoachSub: req.userSub, reason: req.body?.reason });
    if (!r.ok) return res.status(r.reason === "not_proposer" ? 403 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.transfer.cancelled", ...reqMeta(req), details: { team_id: req.params.id, transfer_id: r.transfer.id } });
    const team = await dbGetTeam(req.params.id);
    enqueueEmail({ dedupKey: `transfer-cancelled:${r.transfer.id}`, toUserSub: r.transfer.to_sub, templateId: "transfer-cancelled", teamName: team?.name || "a team" }).catch(() => {});
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/teams/:id/transfer-ownership/accept", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbAcceptOwnershipTransfer({ teamId: req.params.id, byCoachSub: req.userSub });
    if (!r.ok) return res.status(r.reason === "not_proposed_owner" ? 403 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.transfer.accepted", ...reqMeta(req), details: { team_id: req.params.id, transfer_id: r.transfer.id, from_sub: r.transfer.from_sub, ugc_reassigned: r.ugc_reassigned } });
    const team = await dbGetTeam(req.params.id);
    enqueueEmail({ dedupKey: `transfer-accepted:${r.transfer.id}`, toUserSub: r.transfer.from_sub, templateId: "transfer-accepted", teamName: team?.name || "your team" }).catch(() => {});
    res.json({ ok: true, ugc_reassigned: r.ugc_reassigned });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/teams/:id/transfer-ownership/decline", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbDeclineOwnershipTransfer({ teamId: req.params.id, byCoachSub: req.userSub, reason: req.body?.reason });
    if (!r.ok) return res.status(r.reason === "not_proposed_owner" ? 403 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.transfer.declined", ...reqMeta(req), details: { team_id: req.params.id, transfer_id: r.transfer.id } });
    const team = await dbGetTeam(req.params.id);
    enqueueEmail({ dedupKey: `transfer-declined:${r.transfer.id}`, toUserSub: r.transfer.from_sub, templateId: "transfer-declined", teamName: team?.name || "a team" }).catch(() => {});
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/teams/:id/pending-transfer", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    res.json((await dbGetPendingTransferForTeam(req.params.id)) || {});
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Ownership transfers proposed TO the caller — drives the accept/decline banner.
app.get("/api/me/incoming-transfers", requireAuth, async (req, res) => {
  try { res.json(await dbListIncomingTransfersForCoach(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Team curation (Phase 4 / TEAM_CURATION_SCOPE.md) ─────────────
// Owners + admins write team-level favorites + disfavorites + defaults.
// Regular coaches read-only. Cascade extension into dbGetEffective*
// ships in slice 3 — until then these routes work but the picker
// doesn't see team rows yet.

// Read team curation: any team coach (owner/admin/coach).
app.get("/api/teams/:id/curation", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    res.json(await dbListTeamCuration(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Add team favorite: owner+admin.
app.post("/api/teams/:id/favorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const { label } = req.body || {};
    if (!label) return res.status(400).json({ error: "label required" });
    const r = await dbAddTeamFavorite({ teamId: req.params.id, label, byCoachSub: req.userSub });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.fav.add",
      ...reqMeta(req),
      details:   { team_id: req.params.id, label, role },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/teams/:id/favorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const label = decodeURIComponent(req.params.label);
    const r = await dbRemoveTeamFavorite({ teamId: req.params.id, label });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.fav.remove",
      ...reqMeta(req),
      details:   { team_id: req.params.id, label, role, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/teams/:id/disfavorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const { label } = req.body || {};
    if (!label) return res.status(400).json({ error: "label required" });
    const r = await dbAddTeamDisfavorite({ teamId: req.params.id, label, byCoachSub: req.userSub });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.disfav.add",
      ...reqMeta(req),
      details:   { team_id: req.params.id, label, role },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/teams/:id/disfavorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const label = decodeURIComponent(req.params.label);
    const r = await dbRemoveTeamDisfavorite({ teamId: req.params.id, label });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.disfav.remove",
      ...reqMeta(req),
      details:   { team_id: req.params.id, label, role, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Team settings: read (any team coach), write (owner+admin).
app.get("/api/teams/:id/settings", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const settings = await dbGetTeamSettings(req.params.id);
    if (!settings) return res.status(404).json({ error: "team not found" });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.patch("/api/teams/:id/settings", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const body = req.body || {};
    const allowed = ["pace_base", "disfavor_mode", "equipment_modes"];
    const updates = [];
    for (const field of allowed) {
      if (field in body) {
        const r = await dbSetTeamDefault({ teamId: req.params.id, field, value: body[field] });
        if (!r.ok) return res.status(400).json({ error: `${field}: ${r.reason}` });
        updates.push({ field, value: body[field], affected: r.affected });
      }
    }
    // (teams.school removed in P5 — team facilities supersede it.)
    if (updates.length === 0) return res.status(400).json({ error: "no fields to update" });
    for (const u of updates) {
      dbAuditEvent({
        userSub:   req.userSub,
        eventType: "team.default.update",
        ...reqMeta(req),
        details:   { team_id: req.params.id, field: u.field, value: u.value, role },
      });
    }
    res.json({ ok: true, updates });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Apply-to-roster: one-time bulk push of a default to every swimmer in
// any group under this team. v1 supports pace_base only; other fields
// return 400 with reason field_not_apply_capable_yet.
app.post("/api/teams/:id/settings/apply-to-roster", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const { field } = req.body || {};
    if (!field) return res.status(400).json({ error: "field required" });
    const r = await dbApplyTeamDefaultToRoster({ teamId: req.params.id, field });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team.default.apply_to_roster",
      ...reqMeta(req),
      details:   { team_id: req.params.id, field, value: r.value, count: r.count, role },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Team practice facilities (Locations P1, LOCATIONS_SCOPE.md) ──────
// Read = any team member; write = owner/admin (mirrors team settings).
app.get("/api/teams/:id/facilities", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    res.json(await dbListTeamFacilities(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/teams/:id/facilities", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const b = req.body || {};
    const r = await dbCreateTeamFacility({ teamId: req.params.id, name: b.name, course: b.course ?? null, lanes: b.lanes ?? null, is_primary: !!b.is_primary, address: b.address || null });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.facility.create", ...reqMeta(req), details: { team_id: req.params.id, facility_id: r.id, name: b.name, role } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.patch("/api/teams/:id/facilities/:fid", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const r = await dbUpdateTeamFacility(Number(req.params.fid), req.params.id, req.body || {});
    if (!r.ok) return res.status(r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.facility.update", ...reqMeta(req), details: { team_id: req.params.id, facility_id: req.params.fid, fields: Object.keys(req.body || {}), role } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/teams/:id/facilities/:fid", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await dbAssertTeamWriter(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "owner or admin required" });
    const r = await dbArchiveTeamFacility(Number(req.params.fid), req.params.id);
    if (!r.ok) return res.status(r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.facility.archive", ...reqMeta(req), details: { team_id: req.params.id, facility_id: req.params.fid, role } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Parent Portal MVP (Phase 4 / PARENT_PORTAL_MVP_SCOPE.md) ────
// Coach issues invite → parent gets email → parent OAuth sign-in →
// signInAs auto-consumes invite → guardians row created → on next
// page load, ParentDashboard renders instead of App.
//
// Identifier parsing: `:swimmerRef` accepts either `ms_xxxxxx` (managed
// swimmer id) or a users.sub (real account). Detect by `ms_` prefix.
function _parseSwimmerRef(ref) {
  if (!ref) return { managedId: null, swimmerSub: null };
  if (String(ref).startsWith("ms_")) return { managedId: ref, swimmerSub: null };
  return { managedId: null, swimmerSub: ref };
}

// Coach issues parent invite for a swimmer. Authz: caller must be
// coach-of-swimmer (primary or assistant; for managed = owner).
app.post("/api/swimmers/:swimmerRef/parent-invite", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const tgt = _parseSwimmerRef(req.params.swimmerRef);
    const authz = await dbAuthzCoachOfSwimmer(req.userSub, tgt);
    if (!authz) return res.status(403).json({ error: "not coach of this swimmer" });
    const { parent_email } = req.body || {};
    if (!parent_email) return res.status(400).json({ error: "parent_email required" });
    const r = await dbCreateParentInvite({ ...tgt, parentEmail: parent_email, byCoachSub: req.userSub });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "parent.invite.create",
      ...reqMeta(req),
      details:   { ...tgt, parent_email, invite_id: r.id, already: !!r.already },
    });
    // Fire the invite email via the existing worker. Best-effort.
    if (!r.already) {
      try {
        // Resolve swimmer's display name + coach's display name for the template.
        const swimmerRow = tgt.managedId
          ? await dbGetManagedSwimmer(tgt.managedId)
          : await dbGetMe(tgt.swimmerSub).catch(() => null);
        const coachRow = await dbGetMe(req.userSub).catch(() => null);
        const swimmerName = swimmerRow?.display_name || "your swimmer";
        const coachName   = coachRow?.display_name || "Your swimmer's coach";
        await enqueueEmail({
          dedupKey:   `parent-invite:${r.id}`,
          toEmail:    parent_email,
          templateId: "parent-invite",
          // template vars (spread at top level, not nested):
          swimmerName,
          coachName,
          signInUrl:  `${APP_URL}/`,
        });
      } catch (e) {
        console.warn(`[parent-invite] email enqueue failed: ${e.message}`);
      }
    }
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach (or original inviter) revokes a pending invite before parent
// accepts. Idempotent on already-accepted/expired — returns ok with
// affected=0 in that case.
app.delete("/api/parent-invites/:id", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbRevokeParentInvite(req.params.id, req.userSub);
    if (!r.ok) return res.status(r.reason === "forbidden" ? 403 : r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "parent.invite.revoke",
      ...reqMeta(req),
      details:   { invite_id: req.params.id, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Parent-side explicit consent: accept / decline a pending invite. Not
// requireParent — a not-yet-linked invitee isn't is_parent yet. The
// verified-email match (inside the db helper) is the authorization gate.
async function _verifiedEmailFor(userSub) {
  const ur = await pool.query("SELECT `email`, `email_verified` FROM `users` WHERE `sub` = ? LIMIT 1", [userSub]);
  const u = ur[0];
  return (u && u.email && u.email_verified) ? u.email : null;
}
app.post("/api/parent/invites/:id/accept", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const email = await _verifiedEmailFor(req.userSub);
    if (!email) return res.status(403).json({ error: "verified email required" });
    const r = await dbAcceptParentInvite(req.params.id, req.userSub, email);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "parent.invite.accepted", ...reqMeta(req), details: { invite_id: req.params.id, via: "explicit" } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/parent/invites/:id/decline", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const email = await _verifiedEmailFor(req.userSub);
    if (!email) return res.status(403).json({ error: "verified email required" });
    const r = await dbDeclineParentInvite(req.params.id, req.userSub, email);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "parent.invite.declined", ...reqMeta(req), details: { invite_id: req.params.id } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Home/person addresses (Locations P2, LOCATIONS_SCOPE.md) ───────────
// requireAuth + per-target authz (dbCanAccessPersonAddress): self +
// guardians always; coach-of-swimmer only when the consent toggle is on.
// Sensitive minor PII — writes + consent changes are audited. Self manages
// own by passing their own sub as :ref.
app.get("/api/swimmers/:ref/addresses", requireAuth, async (req, res) => {
  try {
    const acc = await dbCanAccessPersonAddress(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!acc.read) return res.status(403).json({ error: "not authorized" });
    const [addresses, coachVisible] = await Promise.all([dbListPersonAddresses(acc.personId), dbGetHomeAddrConsent(acc.personId)]);
    res.json({ addresses, coach_visible: coachVisible, can_write: acc.write });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/swimmers/:ref/addresses", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const acc = await dbCanAccessPersonAddress(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!acc.write) return res.status(403).json({ error: "not authorized" });
    const b = req.body || {};
    const r = await dbAddPersonAddress(acc.personId, { kind: b.kind || "home", is_primary: b.is_primary !== false, address: b.address || {} });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "person.address.add", ...reqMeta(req), details: { person_id: acc.personId, link_id: r.id } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.patch("/api/swimmers/:ref/addresses/:linkId", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const acc = await dbCanAccessPersonAddress(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!acc.write) return res.status(403).json({ error: "not authorized" });
    const r = await dbUpdatePersonAddress(req.params.linkId, acc.personId, req.body || {});
    if (!r.ok) return res.status(r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "person.address.update", ...reqMeta(req), details: { person_id: acc.personId, link_id: req.params.linkId } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/swimmers/:ref/addresses/:linkId", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const acc = await dbCanAccessPersonAddress(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!acc.write) return res.status(403).json({ error: "not authorized" });
    const r = await dbRemovePersonAddress(req.params.linkId, acc.personId);
    dbAuditEvent({ userSub: req.userSub, eventType: "person.address.remove", ...reqMeta(req), details: { person_id: acc.personId, link_id: req.params.linkId } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
// Consent toggle — guardian or self ONLY (a coach can't self-authorize access).
app.patch("/api/swimmers/:ref/address-consent", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const gs = await dbIsGuardianOrSelf(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!gs.ok) return res.status(403).json({ error: "guardian or self only" });
    const { coach_visible } = req.body || {};
    if (typeof coach_visible !== "boolean") return res.status(400).json({ error: "coach_visible must be boolean" });
    await dbSetHomeAddrConsent(gs.personId, coach_visible);
    dbAuditEvent({ userSub: req.userSub, eventType: "person.address.consent", ...reqMeta(req), details: { person_id: gs.personId, coach_visible } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Household / siblings (Locations P3) — DERIVED (shared address + guardian).
// Gate: viewer must have address-read on the target; then each sibling is
// only included if the viewer ALSO has address-read on that sibling (so a
// coach without consent on a sibling never learns of them). requireAuth +
// the same per-target authz as addresses.
app.get("/api/swimmers/:ref/household", requireAuth, async (req, res) => {
  try {
    const acc = await dbCanAccessPersonAddress(req.userSub, _parseSwimmerRef(req.params.ref));
    if (!acc.read) return res.status(403).json({ error: "not authorized" });
    const raw = await dbGetHouseholdSiblings(acc.personId);
    const out = [];
    for (const s of raw) {
      const sref = s.managed_id ? { managedId: s.managed_id } : (s.swimmer_sub ? { swimmerSub: s.swimmer_sub } : null);
      if (!sref) continue;
      const sacc = await dbCanAccessPersonAddress(req.userSub, sref);
      if (sacc.read) out.push({ display_name: s.display_name, ref: s.managed_id || s.swimmer_sub });
    }
    res.json({ siblings: out });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach lists parents + pending invites for a swimmer. Used by the
// "Parents/Guardians" section in the swimmer-edit modal.
app.get("/api/swimmers/:swimmerRef/parents", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const tgt = _parseSwimmerRef(req.params.swimmerRef);
    const authz = await dbAuthzCoachOfSwimmer(req.userSub, tgt);
    if (!authz) return res.status(403).json({ error: "not coach of this swimmer" });
    const [guardians, invites] = await Promise.all([
      dbListGuardiansForSwimmer(tgt),
      dbListParentInvitesForSwimmer(tgt),
    ]);
    res.json({ guardians, invites });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach removes a guardian (tombstones the row). Authz: must be
// coach-of-swimmer (re-checked via the guardians row indirectly —
// caller must own the swimmer this guardian is attached to).
app.delete("/api/guardians/:id", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    // Ownership scope enforced in dbRemoveGuardian (Phase 5): caller must coach
    // the swimmer this guardian belongs to (closes the prior unscoped IDOR).
    const r = await dbRemoveGuardian(req.params.id, req.userSub);
    if (!r.ok) return res.status(r.reason === "forbidden" ? 403 : r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "parent.guardian.remove",
      ...reqMeta(req),
      details:   { guardian_id: req.params.id, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Parent endpoints — gated on me.is_parent (computed in dbGetMe from
// guardians table presence). Light helper to avoid duplicating the
// gate in every route.
async function requireParent(req, res, next) {
  try {
    const me = await dbGetMe(req.userSub);
    if (!me || !me.is_parent) return res.status(403).json({ error: "parent role required" });
    req.me = me;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

app.get("/api/parent/swimmers", requireAuth, requireParent, async (req, res) => {
  try {
    const swimmers = await dbListSwimmersForParent(req.userSub);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "parent.view.swimmer",
      ...reqMeta(req),
      details:   { swimmer_count: swimmers.length },
    });
    res.json(swimmers);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Per-swimmer or per-week digest payload. ?week=YYYY-MM-DD picks a
// specific week (Monday). Defaults to the most recent complete week
// (Monday-of-last-week).
app.get("/api/parent/digest", requireAuth, requireParent, async (req, res) => {
  try {
    let week = (req.query.week || "").toString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      // Default to Monday of the just-ended week.
      const now = new Date();
      const dow = now.getUTCDay();              // 0=Sun
      // Monday of the week ending the most recent Sunday on-or-before today.
      // Matches the digest cron's recap window (cron uses Sunday − 6), so the
      // dashboard default and the emailed digest cover the SAME week. On a
      // Sunday this is the current Mon–Sun week (not the prior one, which the
      // old `daysSinceMon+7` gave). (Residual sub-day UTC-vs-ET edge near
      // midnight is acceptable.)
      const daysBack = dow + 6;
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - daysBack);
      week = d.toISOString().slice(0, 10);
    }
    const payload = await dbGetWeeklyDigestPayload({ parentSub: req.userSub, weekStart: week });
    // Fold team calendar links into the digest so the parent portal's calendar
    // widget needs no extra request (Hyperlift burst-limit avoidance). guardianOnly:
    // the parent portal shows only the kids' teams, not the parent's own.
    const tc = await dbListTeamCalendarsForUser(req.userSub, { guardianOnly: true }).catch(() => []);
    const team_calendars = (tc || []).map(t => ({ team_id: t.team_id, team_name: t.team_name, url: calendarFeedUrl(req, t.token) }));
    res.json({ ...payload, team_calendars });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Parent toggles digest_paused. Only that field is writable here;
// other settings keys go through the existing /api/settings.
app.patch("/api/parent/settings", checkOrigin, requireAuth, requireParent, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { digest_paused } = req.body || {};
    if (typeof digest_paused !== "boolean" && digest_paused !== 0 && digest_paused !== 1) {
      return res.status(400).json({ error: "digest_paused must be boolean" });
    }
    const v = digest_paused ? 1 : 0;
    // UPSERT into settings.
    await pool.query(
      "INSERT INTO `settings` (`user_sub`, `digest_paused`) VALUES (?, ?) " +
      "ON DUPLICATE KEY UPDATE `digest_paused` = VALUES(`digest_paused`)",
      [req.userSub, v]
    );
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "parent.settings.update",
      ...reqMeta(req),
      details:   { digest_paused: !!v },
    });
    res.json({ ok: true, digest_paused: !!v });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Managed swimmers (relationships scope, Stage 1 / R-B) ─────────
// Coach-owned roster entries. requireCoach gates all of these. Per-resource
// ownership check via dbIsManagedSwimmerOwnedBy — a coach can only see/edit
// their OWN managed swimmers (no cross-coach visibility in v1).

// List the caller's own managed swimmers. Optionally include archived.
app.get("/api/managed-swimmers", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const includeArchived = req.query.archived === "1" || req.query.archived === "true";
    res.json(await dbListManagedSwimmersForCoach(req.userSub, { includeArchived }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Create a managed swimmer in the caller's roster.
app.post("/api/managed-swimmers", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const r = await dbCreateManagedSwimmer({
      ownerSub:            req.userSub,
      display_name:        b.display_name,
      dob:                 b.dob,
      initials:            b.initials,
      class_year:          b.class_year,
      usa_swimming_id:     b.usa_swimming_id,
      parental_contact:    b.parental_contact,
      parent_managed_flag: !!b.parent_managed_flag,
      pace_scy_100:        b.pace_scy_100,
      pace_scm_100:        b.pace_scm_100,
      pace_lcm_100:        b.pace_lcm_100,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "coach.create_managed_swimmer",
      ...reqMeta(req),
      details:   { managed_id: r.id, display_name: b.display_name },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// Get a managed swimmer detail (owner only).
app.get("/api/managed-swimmers/:id", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const owned = await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub);
    if (!owned) return res.status(403).json({ error: "not owner of this profile" });
    const ms = await dbGetManagedSwimmer(req.params.id);
    if (!ms) return res.status(404).json({ error: "not found" });
    res.json(ms);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Composite detail bootstrap — one GET returns the swimmer + everything the
// detail panels need, so opening a managed swimmer fires ONE request instead
// of ~7 (the burst that tripped Hyperlift's platform rate-limit → 429s).
// Same play as /api/me/bootstrap. Panels seed from this; they keep their own
// fetch as a post-mutation refresh fallback.
app.get("/api/managed-swimmers/:id/detail", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const id = req.params.id;
    const owned = await dbIsManagedSwimmerOwnedBy(id, req.userSub);
    if (!owned) return res.status(403).json({ error: "not owner of this profile" });
    const tgt = { managedId: id };
    const [swimmer, claim_tokens, constraintsRes, guardians, invites, coach_notes, acc] = await Promise.all([
      dbGetManagedSwimmer(id),
      dbListClaimTokensForManaged(id, {}),
      dbListConstraintsForSwimmer(tgt, {}),
      dbListGuardiansForSwimmer(tgt),
      dbListParentInvitesForSwimmer(tgt),
      dbListCoachNotesForTarget({ managedId: id, callerSub: req.userSub }),
      dbCanAccessPersonAddress(req.userSub, tgt),
    ]);
    if (!swimmer) return res.status(404).json({ error: "not found" });
    // Address + household are address-access-gated (acc). For an owned managed
    // swimmer the owner-coach has access (P2 decision), so this normally fills.
    let addresses = [], coach_visible = false, household = [];
    if (acc.read && acc.personId) {
      addresses = await dbListPersonAddresses(acc.personId);
      coach_visible = await dbGetHomeAddrConsent(acc.personId);
      const raw = await dbGetHouseholdSiblings(acc.personId);
      for (const s of raw) {
        const sref = s.managed_id ? { managedId: s.managed_id } : (s.swimmer_sub ? { swimmerSub: s.swimmer_sub } : null);
        if (!sref) continue;
        const sacc = await dbCanAccessPersonAddress(req.userSub, sref);
        if (sacc.read) household.push({ display_name: s.display_name, ref: s.managed_id || s.swimmer_sub });
      }
    }
    res.json({
      swimmer,
      claim_tokens,
      constraints: Array.isArray(constraintsRes) ? constraintsRes : (constraintsRes?.constraints || constraintsRes || []),
      parents: { guardians, invites },
      coach_notes,
      addresses, address_can_write: acc.write, coach_visible,
      household,
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Update a managed swimmer (owner only). Patch shape mirrors db.js whitelist.
app.patch("/api/managed-swimmers/:id", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const owned = await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub);
    if (!owned) return res.status(403).json({ error: "not owner of this profile" });
    const r = await dbUpdateManagedSwimmer(req.params.id, req.body || {});
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "coach.update_managed_swimmer",
      ...reqMeta(req),
      details:   { managed_id: req.params.id, fields: Object.keys(req.body || {}) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Archive / unarchive a managed swimmer (owner only). Body { archived: true|false }.
app.post("/api/managed-swimmers/:id/archive", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const owned = await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub);
    if (!owned) return res.status(403).json({ error: "not owner of this profile" });
    const archived = req.body?.archived !== false;
    const r = await dbArchiveManagedSwimmer(req.params.id, archived);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: archived ? "coach.archive_managed_swimmer" : "coach.unarchive_managed_swimmer",
      ...reqMeta(req),
      details:   { managed_id: req.params.id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Lesson tier (Phase 5) — parent recap export. Coach/instructor emails a
// branded one-pager of a lesson workout to the managed swimmer's guardian(s).
// Recipient is the GUARDIAN's email (an adult) → enqueued via toEmail, so the
// minor-bypass (which protects emailing minors) does not apply. Gated to lesson
// access; per-resource ownership enforced via dbIsManagedSwimmerOwnedBy.
// Body: { managed_id, workout: {typeLabel,totalYards,estimatedMin,unit,blocks},
//         note? }. Returns { sent, skipped: [{guardian, reason}] }.
app.post("/api/lessons/recap", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const managedId = req.body?.managed_id;
    const workout   = req.body?.workout;
    const note      = typeof req.body?.note === "string" ? req.body.note.slice(0, 1000) : null;
    if (!managedId) return res.status(400).json({ error: "managed_id required" });
    if (!workout || !Array.isArray(workout.blocks)) return res.status(400).json({ error: "workout with blocks required" });
    const owned = await dbIsManagedSwimmerOwnedBy(managedId, req.userSub);
    if (!owned) return res.status(403).json({ error: "not owner of this profile" });

    const swimmer   = await dbGetManagedSwimmer(managedId);
    const me        = await dbGetMe(req.userSub).catch(() => null);
    const guardians = await dbListGuardiansForSwimmer({ managedId });
    const withEmail = guardians.filter(g => g.email);
    if (withEmail.length === 0) {
      return res.status(409).json({ error: "no_guardian_email", message: "No parent/guardian with an email is linked to this swimmer. Add or invite one first." });
    }

    // Sanitize the workout to the recap template's expected shape (never trust
    // client blob wholesale). Only the fields the template reads.
    const safeWorkout = {
      typeLabel:    typeof workout.typeLabel === "string" ? workout.typeLabel.slice(0, 60) : "Lesson",
      totalYards:   Number(workout.totalYards) || 0,
      estimatedMin: Number(workout.estimatedMin) || null,
      unit:         workout.unit === "m" ? "m" : "yds",
      blocks:       workout.blocks.slice(0, 12).map(b => ({
        name:       typeof b.name === "string" ? b.name.slice(0, 80) : "Section",
        totalYards: Number(b.totalYards) || 0,
        sets:       (Array.isArray(b.sets) ? b.sets : []).slice(0, 30).map(s => ({
          reps:     s.reps != null ? Number(s.reps) || null : null,
          dist:     s.dist != null ? Number(s.dist) || null : null,
          desc:     typeof s.desc === "string" ? s.desc.slice(0, 200) : "",
          interval: typeof s.interval === "string" ? s.interval.slice(0, 20) : "",
        })),
      })),
    };

    const sent = [], skipped = [];
    for (const g of withEmail) {
      const ts = Date.now();
      const r = await enqueueEmail({
        dedupKey:    `lesson-recap:${managedId}:${g.id}:${ts}`,
        toEmail:     g.email,
        templateId:  "lesson-recap",
        swimmerName: swimmer?.display_name || "your swimmer",
        coachName:   me?.display_name || null,
        note,
        workout:     safeWorkout,
      }).catch(err => ({ error: err.message || String(err) }));
      if (r && r.id) sent.push(g.email);
      else skipped.push({ guardian: g.email, reason: r?.skipped || r?.bypassed || r?.error || "unknown" });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "lesson.recap_sent",
      ...reqMeta(req),
      details:   { managed_id: managedId, sent: sent.length, skipped: skipped.length },
    });
    res.json({ sent: sent.length, recipients: sent, skipped });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Bulk import (R-B'). Accepts an array of swimmer-shaped rows (already
// validated and normalized client-side) and inserts them per-row-atomic.
// Cap at 500 rows per call to prevent runaway writes; the importer chunks
// larger files. Returns {inserted, errors: [{row_idx, error}]}.
app.post("/api/managed-swimmers/bulk", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const rows    = (req.body && req.body.rows) || [];
    const team_id = (req.body && req.body.team_id) || null;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows must be array" });
    if (rows.length === 0) return res.status(400).json({ error: "rows must be non-empty" });
    if (rows.length > 500) return res.status(400).json({ error: "max 500 rows per call" });
    const r = await dbBulkCreateManagedSwimmers(req.userSub, rows, { team_id });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "coach.bulk_create_managed_swimmers",
      ...reqMeta(req),
      details:   { attempted: rows.length, inserted: r.inserted, error_count: r.errors.length, team_id },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// ───── DOB self-write (relationships scope, R-B + decision #37) ──────
// Soft-prompt path. Modal in the UI surfaces this when me.dob is null.
// Hard gates that require DOB (group join, coach invite accept) land in R-F.
app.post("/api/me/dob", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { dob } = req.body || {};
    const r = await dbUpdateMeDob(req.userSub, dob);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "user.dob.set",
      ...reqMeta(req),
      details:   { had_prior: false },                                        // we don't track prior; "set" is the event
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Groups (Stage 2 / R-C) ────────────────────────────────────────
// Groups belong to teams (v1 UI requires a team; data model permits
// team_id NULL for forward compat). Permission model:
//   * Create group: team owner or team admin
//   * Update / archive / set phase: group primary coach (R-J adds team
//     admin override)
//   * Add/remove group coaches: group primary
//   * Add/remove members: group primary or assistant
//
// Members in R-C are managed-only; full-account members come in R-F.

async function getCallerGroupRole(groupId, sub) {
  return await dbGetGroupRole(groupId, sub);
}

// List groups in a team. Visible to anyone with a team-coach role.
app.get("/api/teams/:teamId/groups", requireAuth, async (req, res) => {
  try {
    const role = await dbGetTeamRole(req.params.teamId, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team coach" });
    const includeArchived = req.query.archived === "1" || req.query.archived === "true";
    res.json(await dbListGroupsForTeam(req.params.teamId, { includeArchived }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Create a group within a team. Caller must have owner or admin role on the team.
app.post("/api/teams/:teamId/groups", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const callerTeamRole = await dbGetTeamRole(teamId, req.userSub);
    if (callerTeamRole !== "owner" && callerTeamRole !== "admin") {
      return res.status(403).json({ error: "team owner or admin required to create groups" });
    }
    const { name, pool_mode_default = null } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const r = await dbCreateGroup({
      teamId,
      primaryCoachSub: req.userSub,
      name,
      poolModeDefault: pool_mode_default,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.create",
      ...reqMeta(req),
      details:   { group_id: r.id, team_id: teamId, name },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// Group detail — visible to any group coach.
app.get("/api/groups/:id", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const group = await dbGetGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "not found" });
    const coaches = await dbListGroupCoaches(req.params.id);
    const members = await dbListGroupMembers(req.params.id);
    res.json({ ...group, viewer_role: role, coaches, members });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Update group (name, pool_mode_default, roster_visible_to_members). Primary only in v1.
app.patch("/api/groups/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const r = await dbUpdateGroup(req.params.id, req.body || {});
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.update",
      ...reqMeta(req),
      details:   { group_id: req.params.id, fields: Object.keys(req.body || {}) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Archive / unarchive. Primary only.
app.post("/api/groups/:id/archive", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const archived = req.body?.archived !== false;
    const r = await dbArchiveGroup(req.params.id, archived);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: archived ? "group.archive" : "group.unarchive",
      ...reqMeta(req),
      details:   { group_id: req.params.id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Set or clear the current training phase (decision #39).
app.post("/api/groups/:id/phase", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const { phase = null } = req.body || {};
    const r = await dbSetGroupPhase(req.params.id, phase);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.phase.set",
      ...reqMeta(req),
      details:   { group_id: req.params.id, phase },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Group anchor (meet-anchored taper, cheap version) ────────────────
// MEET_ANCHORED_TAPER_SCOPE.md §3.4. Anchor = one event from this team's
// calendar that drives the suggested Training Phase week-to-week. Read
// open to coach-of-group OR swimmer-in-group; writes restricted to
// coach-of-group only.

// Helper: is this user a swimmer member of this group? Used by the GET
// read-side authz to allow swimmers to see "Week N of 14 toward X" on
// their AssignedToMe cards.
async function isSwimmerInGroup(groupId, userSub) {
  if (!groupId || !userSub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `group_members` WHERE `group_id` = ? AND `member_swimmer_sub` = ? AND `left_at` IS NULL LIMIT 1",
    [groupId, userSub]
  );
  return rows.length > 0;
}

app.get("/api/groups/:id/anchor", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    const isMember = role ? false : await isSwimmerInGroup(req.params.id, req.userSub);
    if (!role && !isMember) return res.status(403).json({ error: "not a member of this group" });
    const anchor = await dbGetActiveAnchor(req.params.id);
    res.json({ anchor }); // anchor may be null when no active anchor
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/groups/:id/anchor", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    // event_id is a VARCHAR string (ev_xxx); not a number. Validate length + non-empty.
    const eventId = String(req.body?.event_id || "").trim();
    if (!eventId) {
      console.warn("[anchor.set] event_id rejected — group:", req.params.id, "body:", JSON.stringify(req.body), "userSub:", req.userSub);
      return res.status(400).json({ error: "event_id required" });
    }
    // Sanity check: the event must belong to the same team as the group.
    // dbGetGroup returns the group's team_id; dbGetTeamEvent returns the event's team_id.
    const group = await dbGetGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "group not found" });
    const event = await dbGetTeamEvent(eventId);
    if (!event) return res.status(404).json({ error: "event not found" });
    if (event.team_id !== group.team_id) return res.status(400).json({ error: "event/team mismatch" });
    // Only meets are taper-anchor eligible (MEET_SCHEDULE_WEATHER_SCOPE §3.3.1 / §8 #10):
    // a banquet or meeting must never become a taper anchor.
    if (event.kind && event.kind !== "meet") return res.status(400).json({ error: "only meets can be taper anchors" });

    const anchorId = await dbSetGroupAnchor({
      groupId:     req.params.id,
      eventId,
      byCoachSub:  req.userSub,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "anchor.set",
      ...reqMeta(req),
      details:   { group_id: req.params.id, event_id: eventId, event_date: event.date, anchor_id: anchorId },
    });
    const anchor = await dbGetActiveAnchor(req.params.id);
    res.json({ anchor });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/groups/:id/anchor", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const r = await dbClearGroupAnchor({ groupId: req.params.id, byCoachSub: req.userSub });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "anchor.clear",
      ...reqMeta(req),
      details:   { group_id: req.params.id, cleared: r.cleared },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Bulk-fetch active anchors for every group the caller is a swimmer
// member of. Returns a map keyed by group_id so the client can
// per-card look up "is this card's source group anchored?" without
// N+1 round trips. Drives the AssignedToMe countdown badge.
app.get("/api/me/group-anchors", requireAuth, async (req, res) => {
  try {
    const anchors = await dbListAnchorsForMemberSwimmer(req.userSub);
    // Shape as { [group_id]: anchorInfo } for O(1) client lookup.
    const map = {};
    for (const a of anchors) map[a.group_id] = a;
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Phase 4 / continuity: self-serve full-account JSON export ("a club can leave
// with their data"). Self-scoped to the caller via requireAuth → req.userSub.
// Read-only GET (no CSRF needed). Streams as a download attachment.
app.get("/api/me/export", requireAuth, async (req, res) => {
  try {
    const out = await dbExportAccount(req.userSub);
    if (!out.ok) return res.status(500).json({ error: out.reason || "export_failed" });
    dbAuditEvent({ userSub: req.userSub, eventType: "account.export", ...reqMeta(req), details: null });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="setforge-export-${stamp}.json"`);
    res.send(JSON.stringify(out.data, null, 2));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Export bridges (Phase 5 Slice A): team calendar feed ────────────────
// Build the absolute live-subscribe URL from the proxied request.
function calendarFeedUrl(req, token) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "setforge.io";
  return `${proto}://${host}/calendar/${token}.ics`;
}
// A team's calendar link (token lazy-creates on first read). Any team coach can
// read it (to share with families); only owner/admin can rotate it.
app.get("/api/teams/:id/calendar-token", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const token = await dbGetOrCreateTeamCalendarToken(req.params.id);
    if (!token) return res.status(404).json({ error: "team not found" });
    res.json({ token, url: calendarFeedUrl(req, token) });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
// Rotate (revoke + reissue) — any previously shared URL stops working. Owner/admin.
app.post("/api/teams/:id/calendar-token/rotate", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (role !== "owner" && role !== "admin") return res.status(403).json({ error: "owner or admin required" });
    const token = await dbRotateTeamCalendarToken(req.params.id);
    if (!token) return res.status(404).json({ error: "team not found" });
    dbAuditEvent({ userSub: req.userSub, eventType: "team.calendar.token_rotate", ...reqMeta(req), details: { team_id: req.params.id } });
    res.json({ token, url: calendarFeedUrl(req, token) });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
// Calendar feed links for every team the caller is connected to (coach, swimmer,
// or guardian) — drives the copy buttons in the parent + swimmer portals. Returns
// the URL so the client can copy it without rendering it. MAAP-safe: the feed has
// no minor PII, and this only exposes (not rotates) the shared team token.
app.get("/api/me/team-calendars", requireAuth, async (req, res) => {
  try {
    const teams = await dbListTeamCalendarsForUser(req.userSub);
    res.json(teams.map(t => ({ team_id: t.team_id, team_name: t.team_name, url: calendarFeedUrl(req, t.token) })));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
// Public live-subscribe feed — the token IS the authorization (no cookies/CSRF).
// URL shape is /calendar/<token>.ics; we capture the filename and strip .ics so
// the route is unambiguous (base64url tokens contain no dot).
app.get("/calendar/:file", feedLimiter, async (req, res) => {
  try {
    const token = String(req.params.file || "").replace(/\.ics$/i, "");
    const team = token ? await dbGetTeamByCalendarToken(token) : null;
    if (!team) return res.status(404).type("text/plain").send("Not found");
    const { scheduled, events } = await dbTeamCalendarFeedData(team.id);
    const items = [];
    for (const sw of scheduled) {
      const title = (sw.payload && (sw.payload.title || sw.payload.name)) || "Practice";
      const groupBit = sw.group_name ? ` (${sw.group_name})` : "";
      items.push({
        uid: "sw-" + sw.id, date: sw.scheduled_date, summary: "🏊 " + title + groupBit,
        description: sw.notes || "", location: sw.facility_name || "",
      });
    }
    for (const ev of events) {
      const item = { uid: "te-" + ev.id, date: ev.date, summary: `${eventKindEmoji(ev.kind)} ${ev.name || "Team event"}` };
      // Venue → LOCATION (name only; venues carry no city/region field).
      if (ev.venue && ev.venue.name) item.location = ev.venue.name;
      // start_time + venue tz → timed DTSTART (UTC); otherwise stays all-day.
      if (ev.start_time && ev.venue && ev.venue.timezone) {
        item.start = { date: ev.date, time: ev.start_time, tz: ev.venue.timezone };
      }
      items.push(item);
    }
    const ics = buildIcs(items, { calName: team.name || "SetForge", nowIso: new Date().toISOString() });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="team.ics"');
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(ics);
  } catch (err) { res.status(500).type("text/plain").send("error"); }
});

// Team Curation v1 slice 5 (2026-05-27): list every team default the
// caller inherits. Drives ProfileModal inheritance disclosure. Empty
// array = user isn't in any team that has set defaults yet.
app.get("/api/me/team-defaults", requireAuth, async (req, res) => {
  try {
    res.json(await dbListTeamDefaultsForUser(req.userSub));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Team roster v1 (2026-05-27): grouped roster across every active group
// under a team. Any team coach can read. Authz mirrors GET /coaches.
app.get("/api/teams/:id/roster", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    res.json(await dbGetTeamRoster(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Export bridges (Phase 5 Slice A): roster CSV in Hy-Tek Meet Manager import
// format. Required column order: Swimming ID, Date of Birth, First Name, Last
// Name, Gender, Team Name (+ optional Preferred Name). Gender spelled out
// (M→MALE, F→FEMALE); X / prefer_not_to_say → blank (coach fills in MM). DOB as
// MM/DD/YYYY (Hy-Tek's expected format). Source = active managed swimmers on the
// team. Any team coach can export.
app.get("/api/teams/:id/roster.csv", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const roster = await dbTeamRosterForExport(req.params.id);
    const genderMap = { M: "MALE", F: "FEMALE" };
    const ymdToMdy = (ymd) => {
      if (!ymd) return "";
      const [y, m, d] = String(ymd).split("-");
      return (y && m && d) ? `${m}/${d}/${y}` : "";
    };
    const headers = ["Swimming ID", "Date of Birth", "First Name", "Last Name", "Gender", "Team Name", "Preferred Name"];
    const rows = roster.map(s => [
      s.usa_swimming_id || "",
      ymdToMdy(s.dob),
      s.first_name || "",
      s.last_name || "",
      genderMap[s.gender] || "",
      team.team_code || team.name || "",   // Hy-Tek "Team Name" wants the abbreviation
      s.preferred_name || "",
    ]);
    const csv = toCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (team.name || "team").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="roster-${safeName}-${stamp}.csv"`);
    dbAuditEvent({ userSub: req.userSub, eventType: "team.roster.export_csv", ...reqMeta(req), details: { team_id: req.params.id, count: rows.length } });
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// MAAP exports (eval 2026-06-06 #3) — coach/owner-only safety records.
// Anonymized roster: initials + age + gender + group only (no names/DOB/contact).
app.get("/api/teams/:id/roster-anon.csv", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const sections = await dbGetTeamRoster(req.params.id);
    const headers = ["Group", "Initials", "Age", "Gender"];
    const rows = [];
    for (const sec of sections) {
      for (const m of (sec.members || [])) {
        rows.push([sec.group_name || "", m.initials || "", m.age != null ? m.age : "", m.gender || ""]);
      }
    }
    const csv = toCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (team.name || "team").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="roster-anon-${safeName}-${stamp}.csv"`);
    dbAuditEvent({ userSub: req.userSub, eventType: "team.roster.export_anon_csv", ...reqMeta(req), details: { team_id: req.params.id, count: rows.length } });
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Attendance log: per-swimmer present/absent across completed practices in a
// range (default last 90 days). A coach-side safety/attendance record.
app.get("/api/teams/:id/attendance.csv", requireAuth, async (req, res) => {
  try {
    const role = await getCallerTeamRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team member" });
    const team = await dbGetTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "team not found" });
    const ymd = (d) => d.toISOString().slice(0, 10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(req.query.end || "") ? req.query.end : ymd(new Date());
    const start = /^\d{4}-\d{2}-\d{2}$/.test(req.query.start || "") ? req.query.start : ymd(new Date(Date.now() - 90 * 86400000));
    const log = await dbGetTeamAttendanceLog(req.params.id, { startYmd: start, endYmd: end });
    const headers = ["Date", "Group", "Swimmer", "Initials", "Present"];
    const rows = log.map(r => [r.date, r.group, r.name, r.initials, r.present ? "Y" : "N"]);
    const csv = toCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (team.name || "team").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeName}-${stamp}.csv"`);
    dbAuditEvent({ userSub: req.userSub, eventType: "team.attendance.export_csv", ...reqMeta(req), details: { team_id: req.params.id, count: rows.length, start, end } });
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Per-Swimmer Constraints (PSC) — Phase 3 ─────────────────────────
// Read/write the swimmer_constraints table (migration 037). Authz:
// - reads: coach-of-swimmer OR the swimmer themselves
// - writes: coach-of-swimmer only (decision 7)
// Both swimmer_sub and managed_id targets supported; exactly one of
// the two must be supplied per request.

// Parse + validate target from query/body. Returns { swimmerSub, managedId }
// with exactly one populated, or throws. Strings only — no type coercion.
function parsePscTarget(src) {
  const swimmerSub = src?.swimmer_sub ? String(src.swimmer_sub).trim() : "";
  const managedId  = src?.managed_id  ? String(src.managed_id).trim()  : "";
  if (!!swimmerSub === !!managedId) {
    throw new Error("exactly one of swimmer_sub or managed_id required");
  }
  return {
    swimmerSub: swimmerSub || null,
    managedId:  managedId  || null,
  };
}

// GET /api/swimmer-constraints?swimmer_sub=... OR ?managed_id=...
// Returns active rows only by default; ?include_inactive=1 for audit.
app.get("/api/swimmer-constraints", requireAuth, async (req, res) => {
  try {
    let target;
    try { target = parsePscTarget(req.query); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    // Authz: the swimmer themselves (for swimmer_sub) OR coach-of-this-swimmer.
    const isSelf = target.swimmerSub && target.swimmerSub === req.userSub;
    if (!isSelf) {
      const ok = await dbAuthzCoachOfSwimmer(req.userSub, target);
      if (!ok) return res.status(403).json({ error: "not a coach of this swimmer" });
    }
    const includeInactive = req.query?.include_inactive === "1" || req.query?.include_inactive === "true";
    const rows = await dbListConstraintsForSwimmer(target, { includeInactive });
    res.json({ constraints: rows });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// POST /api/swimmer-constraints
// body: { swimmer_sub | managed_id, constraint_type, value_num?, value_str?, expires_at? }
app.post("/api/swimmer-constraints", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    let target;
    try { target = parsePscTarget(req.body); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    const ok = await dbAuthzCoachOfSwimmer(req.userSub, target);
    if (!ok) return res.status(403).json({ error: "not a coach of this swimmer" });

    const constraintType = String(req.body?.constraint_type || "").trim();
    const valueNum = req.body?.value_num != null ? Number(req.body.value_num) : null;
    const valueStr = req.body?.value_str != null ? String(req.body.value_str) : null;
    const expiresAt = req.body?.expires_at || null;

    let id;
    try {
      id = await dbAddSwimmerConstraint({
        ...target,
        setByCoachSub: req.userSub,
        constraintType,
        valueNum,
        valueStr,
        expiresAt,
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "psc.set",
      ...reqMeta(req),
      details:   {
        constraint_id:   id,
        swimmer_sub:     target.swimmerSub,
        managed_id:      target.managedId,
        constraint_type: constraintType,
        value_num:       valueNum,
        value_str:       valueStr,
        expires_at:      expiresAt,
      },
    });
    const row = await dbGetSwimmerConstraintById(id);
    res.json({ constraint: row });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// DELETE /api/swimmer-constraints/:id — soft-delete (sets active=0).
// Authz: coach-of-swimmer (target derived from the row).
app.delete("/api/swimmer-constraints/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const row = await dbGetSwimmerConstraintById(req.params.id);
    if (!row) return res.status(404).json({ error: "constraint not found" });
    const target = {
      swimmerSub: row.swimmer_sub || null,
      managedId:  row.managed_id  || null,
    };
    const ok = await dbAuthzCoachOfSwimmer(req.userSub, target);
    if (!ok) return res.status(403).json({ error: "not a coach of this swimmer" });
    const r = await dbRemoveSwimmerConstraint(req.params.id);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "psc.remove",
      ...reqMeta(req),
      details:   {
        constraint_id:   Number(req.params.id),
        swimmer_sub:     target.swimmerSub,
        managed_id:      target.managedId,
        constraint_type: row.constraint_type,
        was_active:      r.removed,
      },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// GET /api/groups/:id/active-constraints — group-scoped roll-up for the
// Generate-time per-practice checklist. Authz: coach-of-group.
// Shape: { [swimmerSub|managedId]: [constraint rows...] }
app.get("/api/groups/:id/active-constraints", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const map = await dbGetActiveConstraintsForGroup(req.params.id);
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// GET /api/me/constraints — the caller's own active constraints, for
// ProfileModal + AssignedToMe substitution rendering. Read-only view
// for the swimmer themselves.
app.get("/api/me/constraints", requireAuth, async (req, res) => {
  try {
    const rows = await dbListMyActiveConstraints(req.userSub);
    res.json({ constraints: rows });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Group coaches list / add / remove
app.get("/api/groups/:id/coaches", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    res.json(await dbListGroupCoaches(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/groups/:id/coaches", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerGroupRole(req.params.id, req.userSub);
    if (callerRole !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const { coach_sub, role = "assistant" } = req.body || {};
    if (!coach_sub) return res.status(400).json({ error: "coach_sub required" });
    const r = await dbAddGroupCoach(req.params.id, coach_sub, role);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.add_coach",
      ...reqMeta(req),
      details:   { group_id: req.params.id, target_sub: coach_sub, role, reactivated: !!r.reactivated },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/groups/:id/coaches/:sub", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerGroupRole(req.params.id, req.userSub);
    if (callerRole !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const r = await dbRemoveGroupCoach(req.params.id, req.params.sub);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.remove_coach",
      ...reqMeta(req),
      details:   { group_id: req.params.id, target_sub: req.params.sub },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Group members list / add (managed-only in R-C) / remove
app.get("/api/groups/:id/members", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    res.json(await dbListGroupMembers(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/groups/:id/members", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerGroupRole(req.params.id, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "group coach required" });
    const { managed_id = null, role = "primary" } = req.body || {};
    // R-C ships managed-only adds. Full-account swimmer adds land in R-F.
    if (!managed_id) return res.status(400).json({ error: "managed_id required (full-account adds land in R-F)" });
    // The caller must own the managed swimmer they're adding (no cross-coach
    // adds). dbAddGroupMember doesn't enforce this; gate here.
    const owned = await dbIsManagedSwimmerOwnedBy(managed_id, req.userSub);
    if (!owned) return res.status(403).json({ error: "must own this managed swimmer to add them" });
    const r = await dbAddGroupMember(req.params.id, { managedId: managed_id, role });
    if (!r.ok) return res.status(400).json({ error: r.reason, ...r });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.add_member",
      ...reqMeta(req),
      details:   { group_id: req.params.id, managed_id, role, member_id: r.id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/groups/:id/members/:memberId", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await getCallerGroupRole(req.params.id, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "group coach required" });
    // Verify the member belongs to this group (preventing cross-group misuse).
    const m = await dbGetGroupMember(req.params.memberId);
    if (!m || m.group_id !== req.params.id) return res.status(404).json({ error: "member not in this group" });
    const reason = (req.body && req.body.reason) || null;
    const r = await dbRemoveGroupMember(req.params.memberId, { reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.remove_member",
      ...reqMeta(req),
      details:   { group_id: req.params.id, member_id: Number(req.params.memberId), reason },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Lesson groups (Phase 5) ───────────────────────────────────────
// Minimal group creation for the Lesson tier WITHOUT exposing the Coach
// team/club machinery. Lesson groups are "independent" groups (team_id NULL —
// a first-class shape per dbCreateGroup) so a lesson coach can make a small-
// group lesson (e.g. "9am Sunday") and fan a workout out to its members.
// Member add/remove + detail reuse the existing /api/groups/:id* routes (those
// are group-role-gated, not Coach-gated, so a lesson owner already passes).
// Coach-tier users keep using full Teams → Groups; this is the lightweight path.
app.get("/api/lesson-groups", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    // Only the caller's team-less (lesson) groups — keeps this list distinct
    // from any team groups a coach manages in the Teams view.
    const all = await dbListGroupsForCoach(req.userSub, {});
    res.json(all.filter(g => g.team_id == null));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/lesson-groups", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const name = (req.body && req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    if (name.length > 120) return res.status(400).json({ error: "name max 120 chars" });
    // team_id NULL → independent lesson group; creator is added to group_coaches
    // as primary (so it appears in their generate-for picker + assignment auth).
    const r = await dbCreateGroup({ teamId: null, primaryCoachSub: req.userSub, name });
    dbAuditEvent({ userSub: req.userSub, eventType: "lesson_group.create", ...reqMeta(req), details: { group_id: r.id, name } });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// ───── Managed-swimmer claim tokens (Stage 5 / R-I) ──────────────────
// Per scope §10 + Flow J. Coach issues a one-time token; swimmer (with own
// SSO account) redeems to migrate the managed profile into their account.

// Coach issues a claim token for a managed swimmer they own.
app.post("/api/managed-swimmers/:id/claim-tokens", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const owns = await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub);
    if (!owns) return res.status(403).json({ error: "not owner of this managed profile" });
    try {
      const r = await dbCreateClaimToken({ managedId: req.params.id, issuedByCoach: req.userSub });
      dbAuditEvent({
        userSub:   req.userSub,
        eventType: "managed.claim_token.issue",
        ...reqMeta(req),
        details:   { managed_id: req.params.id, token: r.token },
      });
      res.json(r);
    } catch (e) {
      // Surface the #28 gate errors as 400s with structured reason.
      const msg = e.message || String(e);
      if (msg === "claim_blocked_under_13" || msg === "claim_blocked_parent_managed") {
        return res.status(400).json({ error: msg, reason: msg });
      }
      throw e;
    }
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/managed-swimmers/:id/claim-tokens", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const owns = await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub);
    if (!owns) return res.status(403).json({ error: "not owner of this managed profile" });
    const includeRedeemed = req.query.redeemed === "1";
    const includeExpired  = req.query.expired === "1";
    res.json(await dbListClaimTokensForManaged(req.params.id, { includeRedeemed, includeExpired }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/claim-tokens/:token", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const tok = await dbGetClaimToken(req.params.token);
    if (!tok) return res.status(404).json({ error: "not found" });
    if (tok.issued_by_coach !== req.userSub) return res.status(403).json({ error: "only issuer can revoke" });
    const r = await dbDeleteClaimToken(req.params.token);
    if (r.affected === 0) return res.status(409).json({ error: "token already redeemed or expired" });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "managed.claim_token.revoke",
      ...reqMeta(req),
      details:   { token: req.params.token, managed_id: tok.managed_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Preview a claim token (lets the swimmer see who/what they're about to
// claim BEFORE committing). Token itself is the secret; any authed user
// can look it up.
app.get("/api/claim-tokens/:token/preview", requireAuth, feedLimiter, async (req, res) => {
  try {
    const tok = await dbGetClaimToken(req.params.token);
    if (!tok) return res.status(404).json({ error: "invalid_token" });
    // Privacy: a redeemed/expired token must NOT keep serving the (minor) swimmer's
    // name + coach name to anyone who ever held the link. Generic 410, no PII.
    if (tok.is_redeemed || tok.is_expired) return res.status(410).json({ error: "token_no_longer_valid" });
    res.json({
      managed_id:   tok.managed_id,
      managed_name: tok.managed_name,
      coach_name:   tok.coach_name,
      expires_at:   tok.expires_at,
      is_expired:   tok.is_expired,
      is_redeemed:  tok.is_redeemed,
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Swimmer redeems the token. Server validates + runs the atomic migration
// per Flow J. Returns the identity-diff payload for the post-claim review
// screen (#30).
app.post("/api/claim-tokens/:token/redeem", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbRedeemClaimToken(req.params.token, req.userSub);
    if (!r.ok) return res.status(400).json({ error: r.reason, ...r });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "managed.claim_token.redeem",
      ...reqMeta(req),
      details:   {
        token: req.params.token,
        managed_id: r.managed_id,
        coach_sub: r.coach_sub,
        diff_field_count: (r.identity_diff || []).length,
        repointed: r.repointed,
      },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Coach private notes journal (Stage 5 / R-H) ───────────────────
// Per scope §15 + decision #15. Multiple timestamped notes per
// (coach, swimmer) pair. Visibility scopes who else can read; per-team-
// type defaults applied client-side at create-form time.

// Resolve the scope context for a note: looks up the target's team_id +
// primary group with the author. Used at create-time so the row captures
// where visibility will resolve later, without later lookups.
async function resolveNoteScope({ authorCoachSub, swimmerSub, managedId }) {
  let teamId = null, groupId = null;
  if (managedId) {
    const ms = await dbGetManagedSwimmer(managedId);
    if (ms) teamId = ms.team_id || null;
    // Find the first active group the managed is in that the author coaches.
    const grpRows = await pool.query(
      "SELECT g.`id`, g.`team_id` FROM `group_members` gm " +
      "JOIN `groups` g ON g.`id` = gm.`group_id` " +
      "WHERE gm.`member_managed_id` = ? AND gm.`left_at` IS NULL " +
      "  AND g.`primary_coach_sub` = ? " +
      "LIMIT 1",
      [managedId, authorCoachSub]
    );
    if (grpRows[0]) { groupId = grpRows[0].id; if (!teamId) teamId = grpRows[0].team_id || null; }
  } else if (swimmerSub) {
    const grpRows = await pool.query(
      "SELECT g.`id`, g.`team_id` FROM `group_members` gm " +
      "JOIN `groups` g ON g.`id` = gm.`group_id` " +
      "WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL " +
      "  AND g.`primary_coach_sub` = ? " +
      "LIMIT 1",
      [swimmerSub, authorCoachSub]
    );
    if (grpRows[0]) { groupId = grpRows[0].id; teamId = grpRows[0].team_id || null; }
  }
  return { teamId, groupId };
}

// Create a coach note. Visibility default is applied client-side from
// the swimmer's team_type; server just validates the enum + scope.
app.post("/api/coach-notes", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const swimmerSub = b.swimmer_sub || null;
    const managedId  = b.managed_id  || null;
    const visibility = b.visibility  || "private";
    const body       = b.body || "";
    const workoutId  = b.workout_id || null;
    if ((swimmerSub == null) === (managedId == null)) {
      return res.status(400).json({ error: "specify exactly one of swimmer_sub or managed_id" });
    }
    // Ownership / scope authorization. For managed targets the author must
    // own the managed row. For full-account swimmers the author must share
    // an active group with them (otherwise they have no business writing
    // private notes about that swimmer).
    if (managedId) {
      const owns = await dbIsManagedSwimmerOwnedBy(managedId, req.userSub);
      if (!owns) return res.status(403).json({ error: "not owner of this managed profile" });
    } else {
      // Verify caller coaches a group that contains the swimmer.
      const rows = await pool.query(
        "SELECT 1 FROM `group_members` gm " +
        "JOIN `group_coaches` gc ON gc.`group_id` = gm.`group_id` " +
        "WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL " +
        "  AND gc.`coach_sub` = ? AND gc.`removed_at` IS NULL LIMIT 1",
        [swimmerSub, req.userSub]
      );
      if (!rows.length) return res.status(403).json({ error: "no coaching relationship with this swimmer" });
    }
    // Resolve scope (team_id + primary group) from the target's relationship
    // to the author. Stored on the row so visibility is a stable snapshot.
    const { teamId, groupId } = await resolveNoteScope({ authorCoachSub: req.userSub, swimmerSub, managedId });
    try {
      const r = await dbCreateCoachNote({
        authorCoachSub: req.userSub,
        swimmerSub, managedId,
        teamId, groupId, workoutId,
        visibility, body,
      });
      dbAuditEvent({
        userSub:   req.userSub,
        eventType: "coach_note.create",
        ...reqMeta(req),
        details:   { note_id: r.id, swimmer_sub: swimmerSub, managed_id: managedId, visibility, workout_id: workoutId },
      });
      // MAAP parent-CC (eval 2026-06-06 #3): if the target swimmer is a minor,
      // CC their guardian(s) so coach↔minor communication is parent-visible.
      // Fire-and-forget + fully guarded — never blocks or breaks note creation.
      (async () => {
        try {
          let dob = null, swimmerName = "your swimmer";
          if (managedId) { const ms = await dbGetManagedSwimmer(managedId); dob = ms?.dob || null; swimmerName = ms?.display_name || swimmerName; }
          else { const u = await dbGetMe(swimmerSub); dob = u?.dob || null; swimmerName = u?.display_name || u?.first_name || swimmerName; }
          if (isMinor(dob) !== true) return;
          const guardians = await dbListGuardiansForSwimmer({ swimmerSub, managedId });
          const author = await dbGetMe(req.userSub);
          const coachName = author?.display_name || author?.first_name || "Your coach";
          for (const g of guardians) {
            if (!g.email && !g.user_sub) continue;
            enqueueEmail({
              dedupKey:  `coach-note-guardian:${r.id}:${g.id}`,
              toEmail:   g.email || null,
              toUserSub: g.email ? null : g.user_sub,
              templateId: "coach-note-guardian",
              swimmerName, coachName, note: body,
            }).catch(() => {});
          }
        } catch (_) { /* parent-CC is best-effort */ }
      })();
      res.json(r);
    } catch (e) {
      const msg = e.message || String(e);
      if (["bad_visibility","body_required","body_too_long","group_coaches_requires_group","team_coaches_requires_team"].includes(msg)) {
        return res.status(400).json({ error: msg });
      }
      throw e;
    }
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List visible notes for a target. Caller must be a coach connected to
// the target via team/group OR be the author of any of the returned notes.
// `dbListCoachNotesForTarget` already filters on the caller's coaching
// scope, so we only need a light auth gate here.
app.get("/api/coach-notes", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    const swimmerSub = req.query.swimmer_sub || null;
    const managedId  = req.query.managed_id  || null;
    if ((swimmerSub == null) === (managedId == null)) {
      return res.status(400).json({ error: "specify exactly one of swimmer_sub or managed_id" });
    }
    if (managedId) {
      const owns = await dbIsManagedSwimmerOwnedBy(managedId, req.userSub);
      if (!owns) return res.status(403).json({ error: "not owner of this managed profile" });
    }
    const notes = await dbListCoachNotesForTarget({
      swimmerSub, managedId, callerSub: req.userSub,
      limit: Math.min(500, Number(req.query.limit) || 100),
    });
    res.json(notes);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Edit own note. Body / visibility only.
app.patch("/api/coach-notes/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const patch = req.body || {};
    const r = await dbUpdateCoachNote(req.params.id, req.userSub, patch);
    if (!r.ok) {
      const status = r.reason === "not_found" ? 404 : r.reason === "not_author" ? 403 : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "coach_note.update",
      ...reqMeta(req),
      details:   { note_id: Number(req.params.id), fields: Object.keys(patch || {}) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Soft-delete own note.
app.delete("/api/coach-notes/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbSoftDeleteCoachNote(req.params.id, req.userSub);
    if (!r.ok) {
      const status = r.reason === "not_found" ? 404 : r.reason === "not_author" ? 403 : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "coach_note.delete",
      ...reqMeta(req),
      details:   { note_id: Number(req.params.id) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Benchmarks (N7) ────────────────────────────────────────────────
// Per-user test-set log. v1 kinds: t30 / tt500 / broken500. Pace auto-fills
// the generator paceInput on save for t30/tt500 (client reads pace_100_secs
// off the response).

app.post("/api/benchmarks", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const r = await dbCreateBenchmark({
      userSub:    req.userSub,
      kind:       b.kind,
      poolMode:   b.pool_mode || "25y",
      totalYards: b.total_yards != null ? Number(b.total_yards) : null,
      totalSecs:  b.total_secs  != null ? Number(b.total_secs)  : null,
      splits:     b.splits || null,
      notes:      b.notes  || null,
    });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "benchmark.create",
      ...reqMeta(req),
      details:   { benchmark_id: r.id, kind: b.kind, pool_mode: b.pool_mode, pace_100_secs: r.pace_100_secs },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/benchmarks", requireAuth, async (req, res) => {
  try {
    const kind  = req.query.kind || null;
    const limit = Math.min(200, Number(req.query.limit) || 50);
    res.json(await dbListBenchmarks(req.userSub, { kind, limit }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Compliance credentials (Phase 5 #3 MAAP, Slice A) ────────────────
// SELF — a coach records their own USA-Swimming ID, SafeSport cert (+ expiry),
// and background-check ID. Display + expiry warning only; nothing is gated.
app.get("/api/me/credentials", requireAuth, async (req, res) => {
  try {
    const personId = await dbGetPersonIdForUser(req.userSub);
    if (!personId) return res.json([]);
    res.json(await dbListPersonCredentials(personId));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.put("/api/me/credentials", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const personId = await dbGetPersonIdForUser(req.userSub);
    if (!personId) return res.status(400).json({ error: "no_person" });
    const { system, external_id, expires_at } = req.body || {};
    const r = await dbSetPersonCredential({ personId, system, externalId: external_id, expiresAt: expires_at || null });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/me/credentials/:system", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const personId = await dbGetPersonIdForUser(req.userSub);
    if (!personId) return res.status(400).json({ error: "no_person" });
    res.json(await dbDeletePersonCredential(personId, req.params.system));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Web Push (notification infrastructure) ───────────────────────────
// Inert until VAPID keys are set (PUSH_CONFIG). Minor-safety: subscribing is
// refused for minors server-side, mirroring the email/Discord minor-bypass.
app.get("/api/push/config", requireAuth, async (req, res) => {
  res.json(pushConfigState());
});
// Security (SSRF): the push endpoint is later POSTed to by the server (push/test
// + cron sweeps). It must be an HTTPS URL on a known push-service host — never an
// internal/metadata address or http://. Allowlist the real Web-Push providers.
function isAllowedPushEndpoint(endpoint) {
  let u;
  try { u = new URL(String(endpoint)); } catch (_) { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  const allow = [".push.apple.com", "fcm.googleapis.com", ".notify.windows.com",
                 "updates.push.services.mozilla.com", ".push.services.mozilla.com"];
  return allow.some(s => s.startsWith(".") ? host.endsWith(s) : host === s);
}
app.post("/api/push/subscribe", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!PUSH_ACTIVE) return res.status(503).json({ error: "push_not_configured" });
    const me = await dbGetMe(req.userSub);
    if (me?.is_minor) return res.status(403).json({ error: "minor_not_eligible" });
    const s = req.body?.subscription || req.body || {};
    const endpoint = s.endpoint;
    const p256dh = s.keys?.p256dh, auth = s.keys?.auth;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: "bad_subscription" });
    if (!isAllowedPushEndpoint(endpoint)) return res.status(400).json({ error: "bad_endpoint" });
    const r = await dbAddPushSubscription({
      userSub: req.userSub, endpoint, p256dh, auth,
      platform: "web", userAgent: (req.get("user-agent") || "").slice(0, 255),
    });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/push/unsubscribe", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: "no_endpoint" });
    res.json(await dbDeletePushSubscription(endpoint, req.userSub));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/push/test", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await sendPushToUser(req.userSub, { title: "SetForge", body: "🔔 Notifications are working.", url: "/" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ── Race event goal/PR times (Phase 5 #4) ────────────────────────────
// SELF — any authed swimmer manages their own goal/PR times.
app.get("/api/me/event-times", requireAuth, async (req, res) => {
  try { res.json(await dbListEventTimes({ userSub: req.userSub })); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.put("/api/me/event-times", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { event, course, kind, time_secs } = req.body || {};
    const r = await dbUpsertEventTime({ userSub: req.userSub, event, course, kind, timeSecs: time_secs });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/me/event-times/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try { res.json(await dbDeleteEventTime(req.params.id, { userSub: req.userSub })); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// MANAGED swimmers — coach-owned (lesson access + per-resource owner check).
app.get("/api/managed-swimmers/:id/event-times", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    res.json(await dbListEventTimes({ managedId: Number(req.params.id) }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.put("/api/managed-swimmers/:id/event-times", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    const { event, course, kind, time_secs } = req.body || {};
    const r = await dbUpsertEventTime({ managedId: Number(req.params.id), event, course, kind, timeSecs: time_secs });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/managed-swimmers/:id/event-times/:etid", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    res.json(await dbDeleteEventTime(req.params.etid, { managedId: Number(req.params.id) }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ─── Per-event PR history (eval 2026-06-06 #7 — progression) ──────────────────
// Logging a dated result also PROMOTES the current PR when it's faster, so the
// two systems (current PR ↔ dated history) stay in sync.
async function _promotePrIfFaster(owner, event, course, timeSecs) {
  try {
    const times = await dbListEventTimes(owner);
    const cur = times.find(x => x.event === event && x.course === course && x.kind === "pr");
    if (!cur || Number(timeSecs) < Number(cur.time_secs)) {
      await dbUpsertEventTime({ ...owner, event, course, kind: "pr", timeSecs, skipHistory: true });
      return true;
    }
  } catch (_) { /* promotion is best-effort */ }
  return false;
}

app.get("/api/me/event-pr-history", requireAuth, async (req, res) => {
  try { res.json(await dbListEventPrHistory({ userSub: req.userSub })); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/me/event-pr-history", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { event, course, time_secs, achieved_on, note } = req.body || {};
    const r = await dbAddEventPrHistory({ userSub: req.userSub, event, course, timeSecs: time_secs, achievedOn: achieved_on, note: note || null, source: "logged" });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    const promoted = await _promotePrIfFaster({ userSub: req.userSub }, event, course, time_secs);
    res.json({ ...r, promoted });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/me/event-pr-history/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try { res.json(await dbDeleteEventPrHistory(req.params.id, { userSub: req.userSub })); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// MANAGED variant — coach-owned (lesson access + owner check).
app.get("/api/managed-swimmers/:id/event-pr-history", requireAuth, requireLessonAccess, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    res.json(await dbListEventPrHistory({ managedId: Number(req.params.id) }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.post("/api/managed-swimmers/:id/event-pr-history", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    const { event, course, time_secs, achieved_on, note } = req.body || {};
    const r = await dbAddEventPrHistory({ managedId: Number(req.params.id), event, course, timeSecs: time_secs, achievedOn: achieved_on, note: note || null, source: "logged" });
    if (!r.ok) return res.status(400).json({ error: r.reason || "bad_request" });
    const promoted = await _promotePrIfFaster({ managedId: Number(req.params.id) }, event, course, time_secs);
    res.json({ ...r, promoted });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});
app.delete("/api/managed-swimmers/:id/event-pr-history/:hid", checkOrigin, requireAuth, requireLessonAccess, requireCsrf, writeLimiter, async (req, res) => {
  try {
    if (!(await dbIsManagedSwimmerOwnedBy(req.params.id, req.userSub))) return res.status(403).json({ error: "not owner of this profile" });
    res.json(await dbDeleteEventPrHistory(req.params.hid, { managedId: Number(req.params.id) }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Convenience: latest aerobic-pace benchmark for the caller. Used by the
// generator's "pace auto-fill" hint when paceInput is empty on first load.
app.get("/api/benchmarks/latest-aerobic", requireAuth, async (req, res) => {
  try {
    const r = await dbGetLatestAerobicBenchmark(req.userSub);
    res.json(r || null);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/benchmarks/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbDeleteBenchmark(req.params.id, req.userSub);
    if (!r.ok) {
      const status = r.reason === "not_found" ? 404 : r.reason === "not_owner" ? 403 : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "benchmark.delete",
      ...reqMeta(req),
      details:   { benchmark_id: Number(req.params.id) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Scheduled workouts (I — Week-view planning, Phase 1) ──────────
// Per-user week planner. Payload-mode rows hold a full workout snapshot.
// On completion, /api/log-workout (above) stamps completed_workout_id via
// dbLinkCompletedToSchedule when called with scheduled_id.

// I Phase 2b — semantic validation for intent_params.group_id +
// intent_params.lane_plan_id. Returns { ok: true } or { ok: false, status, error }.
// Caller must have coach role on the group; lane plan must belong to the
// group and not be archived. Self-only intents (no group_id) bypass entirely.
async function validateIntentParams(ip, callerSub) {
  if (!ip || typeof ip !== "object") return { ok: true };
  if (!ip.group_id) return { ok: true };
  if (typeof ip.group_id !== "string" || !/^gr_/.test(ip.group_id)) {
    return { ok: false, status: 400, error: "intent_params.group_id must be a group id (gr_...)" };
  }
  const role = await dbGetGroupRole(ip.group_id, callerSub);
  if (!role) return { ok: false, status: 403, error: "not a coach on this group" };
  if (ip.lane_plan_id) {
    if (typeof ip.lane_plan_id !== "string" || !/^lp_/.test(ip.lane_plan_id)) {
      return { ok: false, status: 400, error: "intent_params.lane_plan_id must be a lane plan id (lp_...)" };
    }
    const plan = await dbGetGroupLanePlan(ip.lane_plan_id);
    if (!plan) return { ok: false, status: 404, error: "lane plan not found" };
    if (plan.group_id !== ip.group_id) return { ok: false, status: 400, error: "lane plan does not belong to this group" };
    if (plan.archived) return { ok: false, status: 400, error: "lane plan is archived" };
  }
  return { ok: true };
}

app.post("/api/scheduled-workouts", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    // I Phase 2b — validate intent_params.group_id + lane_plan_id semantics
    // (coach role, plan ownership) before the row is created.
    if (b.intent_params) {
      const v = await validateIntentParams(b.intent_params, req.userSub);
      if (!v.ok) return res.status(v.status).json({ error: v.error });
    }
    // Phase 2a — accept either payload (pre-generated) or intent_params
    // (generator inputs only). Helper enforces exactly-one-of invariant.
    const r = await dbCreateScheduledWorkout({
      userSub:       req.userSub,
      scheduledDate: b.scheduled_date,
      payload:       b.payload || null,
      intentParams:  b.intent_params || null,
      notes:         b.notes || null,
      facilityId:    b.facility_id != null ? b.facility_id : null,
    });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "scheduled_workout.create",
      ...reqMeta(req),
      details:   { scheduled_id: r.id, date: b.scheduled_date, mode: r.mode },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Phase 2a — bulk-copy the current week's scheduled rows forward by 7 days.
// Body: { start_date: "YYYY-MM-DD" } where start_date is the Monday of the
// source week. Server returns counts (copied + skipped).
app.post("/api/scheduled-workouts/repeat-week", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const startDate = (req.body && req.body.start_date) || null;
    if (!startDate) return res.status(400).json({ error: "start_date (YYYY-MM-DD) required" });
    const r = await dbRepeatWeek(req.userSub, startDate);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "scheduled_workout.repeat_week",
      ...reqMeta(req),
      details:   { source_week_start: r.source_week_start, target_week_start: r.target_week_start, copied: r.copied, skipped: r.skipped },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List schedule rows for the caller within a date range. start required,
// end optional (defaults to start + 7d server-side).
app.get("/api/scheduled-workouts", requireAuth, async (req, res) => {
  try {
    const startDate = req.query.start || null;
    const endDate   = req.query.end   || null;
    if (!startDate) return res.status(400).json({ error: "start (YYYY-MM-DD) required" });
    res.json(await dbListScheduledWorkouts(req.userSub, { startDate, endDate }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/scheduled-workouts/:id", requireAuth, async (req, res) => {
  try {
    const r = await dbGetScheduledWorkout(req.params.id);
    if (!r) return res.status(404).json({ error: "not found" });
    if (r.user_sub !== req.userSub) return res.status(403).json({ error: "not owner" });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.patch("/api/scheduled-workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    // I Phase 2b — same semantic validation as POST when intent_params being
    // patched in.
    if (req.body && req.body.intent_params) {
      const v = await validateIntentParams(req.body.intent_params, req.userSub);
      if (!v.ok) return res.status(v.status).json({ error: v.error });
    }
    const r = await dbUpdateScheduledWorkout(req.params.id, req.userSub, req.body || {});
    if (!r.ok) {
      const status = r.reason === "not_found" ? 404 : r.reason === "not_owner" ? 403 : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "scheduled_workout.update",
      ...reqMeta(req),
      details:   { scheduled_id: Number(req.params.id), fields: Object.keys(req.body || {}) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/scheduled-workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbDeleteScheduledWorkout(req.params.id, req.userSub);
    if (!r.ok) {
      const status = r.reason === "not_found" ? 404 : r.reason === "not_owner" ? 403 : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "scheduled_workout.delete",
      ...reqMeta(req),
      details:   { scheduled_id: Number(req.params.id) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Practice attendance (Reporting v1 Phase A) ─────────────────────
// Spec: REPORTING_SCOPE.md §3-4. The /attendance-context GET bundles
// everything the "Mark practice done" modal needs in one call:
//   * Point-in-time roster (group_members as of scheduled_date)
//   * Any existing attendance rows (for the Edit case)
//   * Completion stamp (completed_at, completed_by_sub)
// The /complete POST records attendance + stamps completion atomically.
//
// Authz for both: owner OR any active coach in the workout's group
// (group_id stored in intent_params or payload from Phase 2b fanout).
// Same check used in dbCompleteScheduledWorkout; we re-inline it here for
// the GET path since the DB helper doesn't expose it separately.
// Shared authz: caller is owner of scheduled workout OR active coach of
// the group it's tied to. group_id is parsed from intent_params or payload.
async function _checkScheduledWorkoutCoachAccess(sw, callerSub) {
  if (!sw) return { ok: false, reason: "not_found" };
  if (sw.user_sub === callerSub) return { ok: true };
  const groupId = extractScheduledWorkoutGroupId(sw);
  if (!groupId) return { ok: false, reason: "not_owner" };
  if (!(await dbIsActiveGroupCoach(groupId, callerSub))) {
    return { ok: false, reason: "not_owner_not_coach" };
  }
  return { ok: true };
}

app.get("/api/scheduled-workouts/:id/attendance-context", requireAuth, async (req, res) => {
  try {
    const sw = await dbGetScheduledWorkout(req.params.id);
    if (!sw) return res.status(404).json({ error: "not_found" });
    const authz = await _checkScheduledWorkoutCoachAccess(sw, req.userSub);
    if (!authz.ok) return res.status(403).json({ error: authz.reason });
    // Roster: only populated if the workout is tied to a group. Uses the shared
    // helper, which also resolves payload.assignment_target.group_id — this
    // route previously checked only the top-level group_id, so coach-fanout
    // practices loaded an empty roster. Now consistent with the authz + complete
    // paths.
    let roster = [];
    const groupId = extractScheduledWorkoutGroupId(sw);
    if (groupId) {
      roster = await dbGetGroupRosterAsOf(groupId, sw.scheduled_date);
    }
    const attendance = await dbGetPracticeAttendance(req.params.id);
    res.json({
      scheduled_id:     Number(req.params.id),
      group_id:         groupId,
      scheduled_date:   sw.scheduled_date,
      completed_at:     sw.completed_at,
      completed_by_sub: sw.completed_by_sub,
      roster, attendance,
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/scheduled-workouts/:id/complete", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    // Body shape: { completed_at?: ISO string, attendance: [{ swimmer_sub|managed_id, present, notes? }] }
    const body = req.body || {};
    if (body.attendance != null && !Array.isArray(body.attendance)) {
      return res.status(400).json({ error: "attendance must be array" });
    }
    let completedAt = null;
    if (body.completed_at) {
      const d = new Date(body.completed_at);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "completed_at not parseable" });
      completedAt = d;
    }
    const r = await dbCompleteScheduledWorkout({
      scheduledId: Number(req.params.id),
      callerSub:   req.userSub,
      completedAt,
      attendance:  body.attendance || [],
    });
    if (!r.ok) {
      const status = r.reason === "schedule_not_found" ? 404
                   : r.reason === "not_owner" || r.reason === "not_owner_not_coach" ? 403
                   : 400;
      return res.status(status).json({ error: r.reason });
    }
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "practice.completed",
      ...reqMeta(req),
      details:   { scheduled_id: Number(req.params.id), attendance_count: r.attendance_count },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Workout assignments — completion (Stage 4 / R-G) ──────────────
// Swimmer-side "Assigned to me" + Flow N coach-mark-on-behalf path.

// List the caller's assignments. Optional ?state= filter (not_started /
// partial / complete / missed). Authenticated users only — returns ONLY the
// caller's own assignments.
app.get("/api/me/assignments", requireAuth, async (req, res) => {
  try {
    const state = req.query.state || null;
    res.json(await dbListAssignmentsForSwimmer(req.userSub, { state }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// List a group's assignments (coach-mark-on-behalf view, Flow N). Any
// group coach can read. Used in GroupRow's "Recent assignments" subsection.
app.get("/api/groups/:id/assignments", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const state = req.query.state || null;
    res.json(await dbListAssignmentsForGroup(req.params.id, { state }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Update an assignment's completion state + splits + difficulty + focus_note.
// Auth: target swimmer (self-log path) OR coach on the source group (Flow N
// coach-mark-on-behalf path). For coach-marked updates, stamp
// completed_by_coach_sub so the swimmer sees the "marked by coach" tag.
app.patch("/api/assignments/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const a = await dbGetAssignment(req.params.id);
    if (!a) return res.status(404).json({ error: "not found" });

    // Authorization: caller is target swimmer (self-log), coach on the
    // assignment's source group (Flow N coach-mark-on-behalf), OR the
    // workout owner (covers direct-to-managed assigns where group_id is
    // NULL and the target managed swimmer has no login). Managed targets
    // can only be coach-marked.
    const isTargetSwimmer = a.target_swimmer_sub === req.userSub;
    const isGroupCoach    = a.assigned_via_group_id
                          ? !!(await dbGetGroupRole(a.assigned_via_group_id, req.userSub))
                          : false;
    const isWorkoutOwner  = a.workout_user_sub === req.userSub;
    if (!isTargetSwimmer && !isGroupCoach && !isWorkoutOwner) {
      return res.status(403).json({ error: "not target, group coach, or workout owner" });
    }
    // For audit + coach-mark-stamp purposes, both the group-coach and the
    // workout-owner paths are "coach-marked on behalf" — neither is the
    // target swimmer logging themselves in.
    const isCoachMarkPath = (isGroupCoach || isWorkoutOwner) && !isTargetSwimmer;

    // Allowed fields. completion_state required for state transitions; the
    // rest optional. completed_by_coach_sub set automatically by server for
    // coach-marked updates; clients can't set it directly.
    const patch = {};
    const b = req.body || {};
    if ("completion_state" in b) patch.completion_state = b.completion_state;
    if ("splits_payload"   in b) patch.splits_payload   = b.splits_payload;
    if ("difficulty"       in b) patch.difficulty       = b.difficulty;
    if ("focus_note"       in b) patch.focus_note       = b.focus_note;
    // Server determines coach-marked vs self-marked.
    if (isCoachMarkPath) {
      patch.completed_by_coach_sub = req.userSub;
    } else {
      // Self-log path explicitly clears any prior coach-mark stamp (swimmer
      // is now claiming the completion themselves).
      patch.completed_by_coach_sub = null;
    }

    const r = await dbUpdateAssignmentCompletion(req.params.id, patch);
    if (!r.ok) return res.status(400).json({ error: r.reason });

    dbAuditEvent({
      userSub:   req.userSub,
      eventType: isCoachMarkPath ? "assignment.coach_marked" : "assignment.self_logged",
      ...reqMeta(req),
      details:   { assignment_id: Number(req.params.id), workout_id: a.workout_id, completion_state: patch.completion_state },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Group join tokens (Stage 4 / R-F) ─────────────────────────────
// Code-based join flow per decision #6 (no email). Coach issues a token,
// hands it to the swimmer out-of-band. Swimmer redeems via the app.
// Permission: any group coach can issue; only the swimmer themselves can
// redeem.

// Coach issues a token. Returns the token string + expiry — coach shares
// it out-of-band. Token is 30-day expiry per scope.
app.post("/api/groups/:id/join-tokens", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const { intended_role = "primary" } = req.body || {};
    const r = await dbCreateGroupJoinToken({
      groupId:       req.params.id,
      issuedByCoach: req.userSub,
      intendedRole:  intended_role,
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.join_token.issue",
      ...reqMeta(req),
      details:   { group_id: req.params.id, token: r.token, intended_role },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// Coach lists outstanding tokens for a group (default: unredeemed +
// unexpired). Coach UI uses this to show "you have N pending invites."
app.get("/api/groups/:id/join-tokens", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const includeRedeemed = req.query.redeemed === "1";
    const includeExpired  = req.query.expired === "1";
    res.json(await dbListGroupJoinTokens(req.params.id, { includeRedeemed, includeExpired }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach revokes an unredeemed token (e.g., sent to wrong person, decided
// not to add). Redeemed tokens cannot be revoked — they've already created
// a membership.
app.delete("/api/join-tokens/:token", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const tok = await dbGetGroupJoinToken(req.params.token);
    if (!tok) return res.status(404).json({ error: "not found" });
    const role = await getCallerGroupRole(tok.group_id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const r = await dbDeleteGroupJoinToken(req.params.token);
    if (r.affected === 0) return res.status(409).json({ error: "token already redeemed or expired" });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.join_token.revoke",
      ...reqMeta(req),
      details:   { token: req.params.token, group_id: tok.group_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Pre-redeem preview: swimmer can look up a token they were given to see
// which group they're about to join, without committing. Open to any auth'd
// user (the token itself is the secret).
app.get("/api/join-tokens/:token/preview", requireAuth, feedLimiter, async (req, res) => {
  try {
    const tok = await dbGetGroupJoinToken(req.params.token);
    if (!tok) return res.status(404).json({ error: "invalid_token" });
    if (tok.is_redeemed || tok.is_expired) return res.status(410).json({ error: "token_no_longer_valid" });
    res.json({
      group_id:      tok.group_id,
      group_name:    tok.group_name,
      intended_role: tok.intended_role,
      expires_at:    tok.expires_at,
      is_expired:    tok.is_expired,
      is_redeemed:   tok.is_redeemed,
    });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Swimmer redeems. Requires DOB on file (per scope R-F note "DOB collection
// at this point if swimmer doesn't have it"); surfaces "dob_required" so
// the UI can prompt before retrying. Atomic group-membership write per #33.
app.post("/api/join-tokens/:token/redeem", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    // Hard gate: DOB required per scope (joining a group triggers minor-
    // compliance derivations). MAAP (Phase 5 #3) team-type posture: MASTERS
    // (adults-only) groups don't run minor derivations, so they skip the DOB
    // gate — removes the friction the Masters coach flagged in the eval.
    const tok = await dbGetGroupJoinToken(req.params.token);
    const dobExempt = tok?.team_type === "masters";
    const me = await dbGetMe(req.userSub);
    if (!me) return res.status(404).json({ error: "user not found" });
    if (!dobExempt && !me.dob) return res.status(400).json({ error: "dob_required", reason: "dob_required" });

    const r = await dbRedeemGroupJoinToken(req.params.token, req.userSub);
    if (!r.ok) return res.status(400).json({ error: r.reason, ...r });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.join_token.redeem",
      ...reqMeta(req),
      details:   { token: req.params.token, group_id: r.group_id, role: r.role, member_id: r.member_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Group lane plans (Stage 3 / R-E) ──────────────────────────────
// Per scope §7 + decision #14. Coach-managed reusable lane configs per
// group. Read: any group coach. Write: group primary coach only in v1.

app.get("/api/groups/:id/lane-plans", requireAuth, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a group coach" });
    const includeArchived = req.query.archived === "1" || req.query.archived === "true";
    res.json(await dbListGroupLanePlans(req.params.id, { includeArchived }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/groups/:id/lane-plans", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const role = await getCallerGroupRole(req.params.id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const { name, is_default = false, plan_data } = req.body || {};
    if (!plan_data) return res.status(400).json({ error: "plan_data required" });
    const r = await dbCreateGroupLanePlan({ groupId: req.params.id, name, is_default: !!is_default, plan_data });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.lane_plan.create",
      ...reqMeta(req),
      details:   { group_id: req.params.id, plan_id: r.id, name, is_default: !!is_default, lane_count: (plan_data.lanes || []).length },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

app.patch("/api/lane-plans/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const plan = await dbGetGroupLanePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "not found" });
    const role = await getCallerGroupRole(plan.group_id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const r = await dbUpdateGroupLanePlan(req.params.id, req.body || {});
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.lane_plan.update",
      ...reqMeta(req),
      details:   { plan_id: req.params.id, group_id: plan.group_id, fields: Object.keys(req.body || {}) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/lane-plans/:id/archive", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const plan = await dbGetGroupLanePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "not found" });
    const role = await getCallerGroupRole(plan.group_id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const archived = req.body?.archived !== false;
    const r = await dbArchiveGroupLanePlan(req.params.id, archived);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: archived ? "group.lane_plan.archive" : "group.lane_plan.unarchive",
      ...reqMeta(req),
      details:   { plan_id: req.params.id, group_id: plan.group_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/lane-plans/:id/default", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const plan = await dbGetGroupLanePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "not found" });
    const role = await getCallerGroupRole(plan.group_id, req.userSub);
    if (role !== "primary") return res.status(403).json({ error: "group primary coach required" });
    const r = await dbSetDefaultLanePlan(plan.group_id, req.params.id);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "group.lane_plan.set_default",
      ...reqMeta(req),
      details:   { plan_id: req.params.id, group_id: plan.group_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Team events (decision #38) ────────────────────────────────────

// Coach-only create. Caller must have any role on the team.
app.post("/api/teams/:teamId/events", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const callerRole = await dbGetTeamRole(req.params.teamId, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "not a team coach" });
    const { name, date, kind, venue_id, start_time, group_id, recurrence } = req.body || {};
    // Security: a group target must belong to THIS team (else a coach could aim an
    // event at another team's group, leaking it into that team's swimmers' feeds).
    if (group_id) {
      const grp = await dbGetGroup(group_id);
      if (!grp || grp.team_id !== req.params.teamId || grp.archived) return res.status(400).json({ error: "group_not_in_team" });
    }
    const base = { teamId: req.params.teamId, name, date, kind, venueId: venue_id || null, startTime: start_time || null, groupId: group_id || null, createdByCoachSub: req.userSub };
    // C5 — a recurrence ({ freq, interval?, count?|until? }) materializes a series.
    const r = (recurrence && recurrence.freq)
      ? await dbCreateTeamEventSeries(base, recurrence)
      : await dbCreateTeamEvent(base);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team_event.create",
      ...reqMeta(req),
      details:   { event_id: r.id, team_id: req.params.teamId, name, date, kind: kind || "meet", venue_id: venue_id || null, group_id: group_id || null, series_id: r.series_id || null, count: r.count || 1 },
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message || String(err) }); }
});

// List events for a specific team. Visible to team coaches AND members of any
// group in the team.
app.get("/api/teams/:teamId/events", requireAuth, async (req, res) => {
  try {
    // Visibility check: caller must have a team-coach role OR be a swimmer
    // in any of the team's groups. Cheap to check coach side first.
    const callerRole = await dbGetTeamRole(req.params.teamId, req.userSub);
    if (!callerRole) {
      // Fall back to swimmer-side check — caller may be a group member.
      const isMember = await dbIsSwimmerInTeam(req.userSub, req.params.teamId);
      if (!isMember) return res.status(403).json({ error: "no access to this team's events" });
    }
    res.json(await dbListTeamEvents(req.params.teamId));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── RSVP (Phase 5 #5 Slice B) ─────────────────────────────────────
// Set an RSVP: self (swimmer_sub = caller) or coach-on-behalf (managed_id).
app.put("/api/rsvp", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { target_kind, target_id, status, managed_id } = req.body || {};
    if (!["meet", "practice"].includes(target_kind) || !target_id) return res.status(400).json({ error: "bad_target" });
    let teamId = null, practiceGroupId = null;
    if (target_kind === "meet") {
      const ev = await dbGetTeamEvent(target_id);
      if (!ev) return res.status(404).json({ error: "event not found" });
      if (ev.status === "cancelled") return res.status(409).json({ error: "event_cancelled" });
      teamId = ev.team_id;
    } else {
      // C2 — practice RSVP. Resolve the practice's group/team for access scope.
      const ctx = await dbGetPracticeContext(target_id);
      if (!ctx) return res.status(404).json({ error: "practice not found" });
      if (!ctx.teamId) return res.status(400).json({ error: "practice_not_team_scoped" });
      teamId = ctx.teamId;
      practiceGroupId = ctx.groupId;
    }
    if (managed_id) {
      // Security: RSVP-on-behalf requires OWNING the managed swimmer — matching every
      // other managed-swimmer write (dbIsManagedSwimmerOwnedBy). A bare team role is
      // NOT enough; otherwise any team coach could write RSVP rows for arbitrary
      // managed ids (incl. swimmers on other teams), polluting the tally.
      const owns = await dbIsManagedSwimmerOwnedBy(managed_id, req.userSub).catch(() => false);
      if (!owns) return res.status(403).json({ error: "not authorized for this swimmer" });
      const r = await dbSetRsvp({ targetKind: target_kind, targetId: target_id, managedId: Number(managed_id), status, respondedBySub: req.userSub });
      return r.ok ? res.json(r) : res.status(400).json({ error: r.reason });
    }
    // self
    const role = await dbGetTeamRole(teamId, req.userSub);
    let canSee = !!role;
    if (!canSee) {
      // Meets: team membership. Practices: membership of the targeted group.
      canSee = practiceGroupId
        ? (await dbListGroupMembers(practiceGroupId)).some(m => m.member_swimmer_sub === req.userSub)
        : await dbIsSwimmerInTeam(req.userSub, teamId);
    }
    if (!canSee) return res.status(403).json({ error: "no access to this event" });
    const r = await dbSetRsvp({ targetKind: target_kind, targetId: target_id, swimmerSub: req.userSub, status, respondedBySub: req.userSub });
    return r.ok ? res.json(r) : res.status(400).json({ error: r.reason });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach view: RSVP tally + per-swimmer list for an event or practice.
app.get("/api/rsvp/:kind/:id", requireAuth, async (req, res) => {
  try {
    const { kind, id } = req.params;
    if (kind === "meet") {
      const ev = await dbGetTeamEvent(id);
      if (!ev) return res.status(404).json({ error: "event not found" });
      const role = await dbGetTeamRole(ev.team_id, req.userSub);
      if (!role) return res.status(403).json({ error: "not a team coach" });
    } else if (kind === "practice") {
      const ctx = await dbGetPracticeContext(id);
      if (!ctx) return res.status(404).json({ error: "practice not found" });
      const role = ctx.teamId ? await dbGetTeamRole(ctx.teamId, req.userSub) : null;
      // The practice owner (the coach who scheduled it) can always see its RSVPs.
      if (!role && ctx.ownerSub !== req.userSub) return res.status(403).json({ error: "not a team coach" });
    } else {
      return res.status(400).json({ error: "unsupported_kind" });
    }
    res.json(await dbGetRsvpSummary(kind, id));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Swimmer self: my upcoming group practices with RSVP status (C2).
app.get("/api/me/practices/upcoming", requireAuth, async (req, res) => {
  try { res.json(await dbListUpcomingPracticesForUser(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Swimmer self: my RSVP status for an event.
app.get("/api/me/rsvp/:kind/:id", requireAuth, async (req, res) => {
  try {
    const status = await dbGetMyRsvp({ targetKind: req.params.kind, targetId: req.params.id, swimmerSub: req.userSub });
    res.json({ status });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Cancel / un-cancel an event (coach of the team). Freezes RSVP + shows CANCELLED.
app.post("/api/events/:id/status", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const ev = await dbGetTeamEvent(req.params.id);
    if (!ev) return res.status(404).json({ error: "not found" });
    const role = await dbGetTeamRole(ev.team_id, req.userSub);
    if (!role) return res.status(403).json({ error: "not a team coach" });
    const { status, note } = req.body || {};
    const r = await dbSetTeamEventStatus(req.params.id, status, note);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "team_event.status", ...reqMeta(req), details: { event_id: req.params.id, status, note: note || null } });
    // Notify trigger: on cancellation, push everyone who RSVP'd going/maybe.
    // Event-driven (fires on the coach's explicit action) so no dedup needed.
    if (status === "cancelled" && PUSH_ACTIVE) {
      dbListRsvpRespondentSubs("meet", req.params.id, ["going", "maybe"])
        .then(subs => Promise.all(subs.map(sub => sendPushToUser(sub, {
          title: "⚠️ Event cancelled",
          body: `${ev.name} on ${ev.date} is cancelled${note ? ` — ${note}` : ""}.`,
          url: "/assigned",
        }))))
        .then(out => { if (out.length) console.log(`[notify] cancellation push fanned to ${out.length} swimmer(s) for ${req.params.id}`); })
        .catch(e => console.warn(`[notify] cancellation push failed: ${e.message}`));
    }
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Update event. Caller must have any role on the event's team. Editable: name, date.
app.patch("/api/events/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const ev = await dbGetTeamEvent(req.params.id);
    if (!ev) return res.status(404).json({ error: "not found" });
    const callerRole = await dbGetTeamRole(ev.team_id, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "not a team coach" });
    const { name, date, kind, venue_id, start_time, group_id } = req.body || {};
    // Security: re-targeting to a group must keep it within the event's own team.
    if (group_id) {
      const grp = await dbGetGroup(group_id);
      if (!grp || grp.team_id !== ev.team_id || grp.archived) return res.status(400).json({ error: "group_not_in_team" });
    }
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (date !== undefined) patch.date = date;
    if (kind !== undefined) patch.kind = kind;
    if (venue_id !== undefined) patch.venueId = venue_id;
    if (start_time !== undefined) patch.startTime = start_time;
    if (group_id !== undefined) patch.groupId = group_id;
    const r = await dbUpdateTeamEvent(req.params.id, patch);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team_event.update",
      ...reqMeta(req),
      details:   { event_id: req.params.id, team_id: ev.team_id, fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Delete event. Caller must have any role on the event's team.
app.delete("/api/events/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const ev = await dbGetTeamEvent(req.params.id);
    if (!ev) return res.status(404).json({ error: "not found" });
    const callerRole = await dbGetTeamRole(ev.team_id, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "not a team coach" });
    const r = await dbDeleteTeamEvent(req.params.id);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team_event.delete",
      ...reqMeta(req),
      details:   { event_id: req.params.id, team_id: ev.team_id },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// C5 — delete a recurring series. ?scope=future (default) deletes this occurrence
// and all later ones; ?scope=all deletes the whole series. Coach-only.
app.delete("/api/events/:id/series", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const ev = await dbGetTeamEvent(req.params.id);
    if (!ev) return res.status(404).json({ error: "not found" });
    const callerRole = await dbGetTeamRole(ev.team_id, req.userSub);
    if (!callerRole) return res.status(403).json({ error: "not a team coach" });
    if (!ev.series_id) return res.status(400).json({ error: "not_a_series" });
    const scope = req.query.scope === "all" ? "all" : "future";
    const r = await dbDeleteTeamEventSeries(ev.series_id, { fromDate: scope === "future" ? ev.date : null });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "team_event.delete_series",
      ...reqMeta(req),
      details:   { event_id: req.params.id, series_id: ev.series_id, team_id: ev.team_id, scope, affected: r.affected },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Aggregated upcoming events for the pool-mode pill row (decision #38).
app.get("/api/events/upcoming", requireAuth, async (req, res) => {
  try { res.json(await dbListUpcomingEventsForUser(req.userSub)); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Venues (universal pool catalog) + WeatherKit (Phase 5 #5 Slice B) ─────
// Create or link a venue. Coach-gated (any coach may extend the shared catalog).
// The CLIENT geocodes the address via MapKit JS (browser-scoped token) and POSTs
// latitude/longitude/timezone — the server cannot use the MapKit token itself.
app.post("/api/venues", checkOrigin, requireAuth, requireCoach, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { name, address, latitude, longitude, indoor_outdoor, course, timezone } = req.body || {};
    const r = await dbCreateOrLinkVenue({
      name, address: address || null,
      latitude: latitude ?? null, longitude: longitude ?? null,
      indoorOutdoor: indoor_outdoor || "unknown", course: course || null,
      timezone: timezone || null, coachSub: req.userSub,
    });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    const venue = await dbGetVenue(r.id);
    res.json({ ...r, venue });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Soft-archive a venue (admin-only — universal catalog, edits/removal moderated
// per scope §2 #4). Events keep their venue_id; it drops from search + weather.
app.delete("/api/venues/:id", checkOrigin, requireAuth, requireAdmin, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const r = await dbArchiveVenue(req.params.id);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "venue.archive", ...reqMeta(req), details: { venue_id: req.params.id } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Search the venue catalog for the picker (coach-only). Nearest-first when lat/lng given.
app.get("/api/venues", requireAuth, requireCoach, async (req, res) => {
  try {
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const near = (Number.isFinite(lat) && Number.isFinite(lng)) ? { latitude: lat, longitude: lng } : null;
    res.json(await dbListVenues({ q: req.query.q || null, near, limit: 20 }));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// C4 — a coach proposes a correction to a shared venue's fields. Stored pending;
// applied only on admin approval (the catalog is universal, so no silent edits).
app.post("/api/venues/:id/propose-edit", checkOrigin, requireAuth, requireCoach, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { changes, note } = req.body || {};
    const r = await dbProposeVenueEdit({ venueId: req.params.id, changes, note: note || null, proposedBySub: req.userSub });
    if (!r.ok) return res.status(r.reason === "venue_not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "venue.propose_edit", ...reqMeta(req), details: { venue_id: req.params.id, proposal_id: r.id } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// C4 — admin moderation queue: list venue-edit proposals (default pending).
app.get("/api/admin/venue-edits", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status === "" ? null : (req.query.status || "pending");
    res.json(await dbListVenueEditProposals(status));
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// C4 — admin approves (applies to venues) or rejects a proposal.
app.post("/api/admin/venue-edits/:id/review", checkOrigin, requireAuth, requireAdmin, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { action, review_note } = req.body || {};
    const r = await dbReviewVenueEditProposal({ id: req.params.id, action, reviewerSub: req.userSub, reviewNote: review_note || null });
    if (!r.ok) return res.status(r.reason === "not_found" ? 404 : 400).json({ error: r.reason });
    dbAuditEvent({ userSub: req.userSub, eventType: "venue.review_edit", ...reqMeta(req), details: { proposal_id: req.params.id, action, applied: r.applied } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Outdoor-venue forecast for an event. Visible to anyone who can see the event.
// Returns { weather: null, reason } when not applicable (indoor / no coords /
// not configured / outside horizon) — never an error, so the event still renders.
app.get("/api/events/:id/weather", requireAuth, async (req, res) => {
  try {
    const ev = await dbGetTeamEvent(req.params.id);
    if (!ev) return res.status(404).json({ error: "not found" });
    const role = await dbGetTeamRole(ev.team_id, req.userSub);
    if (!role) {
      const isMember = await dbIsSwimmerInTeam(req.userSub, ev.team_id);
      if (!isMember) return res.status(403).json({ error: "no access to this event" });
    }
    const v = ev.venue;
    if (!v || v.latitude == null || v.longitude == null) return res.json({ weather: null, reason: "no_venue_coords" });
    if (v.indoor_outdoor !== "outdoor") return res.json({ weather: null, reason: "not_outdoor" });
    if (!WEATHER_ACTIVE) return res.json({ weather: null, reason: "not_configured" });

    // Cache per (venue, day); refresh hourly within 24h of the event, else 6-hourly.
    const cached = await dbGetWeatherCache(v.id, ev.date);
    const hrsToEvent = (new Date(`${ev.date}T12:00:00Z`).getTime() - Date.now()) / 3600000;
    const ttlMs = (hrsToEvent <= 24 ? 1 : 6) * 3600000;
    if (cached && cached.payload && (Date.now() - cached.fetched_ms) < ttlMs) {
      return res.json({ weather: cached.payload, cached: true });
    }
    const fc = await getForecast({ lat: v.latitude, lng: v.longitude, tz: v.timezone || "UTC", dayYmd: ev.date, startTime: ev.start_time || null });
    if (!fc) return res.json({ weather: cached?.payload || null, reason: "no_forecast", cached: !!cached?.payload });
    await dbPutWeatherCache(v.id, ev.date, fc);
    res.json({ weather: fc, cached: false });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Static files ───────────────────────────────────────────────────
// index.html is served with the MapKit JS token substituted at boot from the
// runtime env (MAPKIT_TOKEN — an origin-scoped, client-public ES256 JWT). Cached
// once; process.env is fixed for the process lifetime. The token lives only in the
// platform env (never the repo) and is rotatable without a code redeploy — just a
// restart. When unset, the literal "__MAPKIT_TOKEN__" placeholder remains, which the
// client loader treats as "not configured" and skips MapKit. The `__BUILD_STAMP__`/
// `__BUILD_SHA__` placeholders were already replaced at deploy time by _deploy.py.
const INDEX_HTML_PATH = path.join(__dirname, "public", "index.html");
let INDEX_HTML = "";
try {
  INDEX_HTML = readFileSync(INDEX_HTML_PATH, "utf8")
    .replaceAll("__MAPKIT_TOKEN_VALUE__", process.env.MAPKIT_TOKEN || "__MAPKIT_TOKEN_VALUE__");
  console.log(`[web] index.html preloaded (MapKit token ${process.env.MAPKIT_TOKEN ? "injected" : "absent"})`);
} catch (e) {
  console.warn("[web] could not preload index.html — falling back to sendFile:", e.message);
}
function sendIndex(res) {
  res.setHeader("Cache-Control", "no-cache");
  if (INDEX_HTML) return res.type("html").send(INDEX_HTML);
  return res.sendFile(INDEX_HTML_PATH);
}
// Serve the templated index for the document routes BEFORE express.static, so the
// raw (un-templated) file isn't returned for "/" or "/index.html".
app.get(["/", "/index.html"], (req, res) => sendIndex(res));

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".json")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

// SPA client-route fallback: the web app uses History-API routes (/teams, /reports,
// /week, …). A deep link or refresh on one of those isn't a real file, so after
// express.static misses, serve index.html for non-/api GET navigations that accept
// HTML — the client router then renders the right view. Everything else 404s (API
// routes return their own JSON 404s above; assets/unknown paths fall through here).
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (!(req.headers.accept || "").includes("text/html")) return next();
  sendIndex(res);
});

app.use((req, res) => res.status(404).send("Not found"));

// ─── Boot sequence ────────────────────────────────────────────────────
// S5 S1+S3 — Gate prod readiness before accepting traffic:
//   1. Refuse to start in NODE_ENV=production with Apple auth not configured.
//   2. Await the DB ping; exit non-zero if it fails (Hyperlift restart policy
//      will retry, which is the right behavior for transient DB-network issues).
// In dev (NODE_ENV !== production) both checks degrade to warnings so local
// testing without Apple/DB credentials still works.
async function boot() {
  // S5 S1 — prod-only auth requirement.
  if (IS_PROD && !APPLE_AUTH_ACTIVE) {
    console.error("[boot] FATAL: NODE_ENV=production but Apple Sign-In is not configured. " +
                  "Set APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in the environment, " +
                  "or unset NODE_ENV for local dev.");
    process.exit(1);
  }

  // S5 S3 — await pingDb before listening.
  if (dbActive) {
    try {
      const r = await pingDb();
      console.log("[db]", r);
    } catch (err) {
      if (IS_PROD) {
        console.error("[boot] FATAL: DB ping failed in production:", err.message);
        process.exit(1);
      }
      console.warn("[db] ping failed (dev mode — continuing):", err.message);
    }
  } else if (IS_PROD) {
    console.error("[boot] FATAL: NODE_ENV=production but DB env vars are missing.");
    process.exit(1);
  } else {
    console.warn("[db] not configured — DB env vars missing (dev mode)");
  }

  const server = app.listen(PORT, () => {
    console.log(`[swim-workout-generator] listening on :${PORT}`);
    if (APPLE_AUTH_ACTIVE)  console.log(`[auth] Apple Sign-In active. Gate: existing user in DB OR valid invite code`);
    else                    console.warn("[auth] Apple auth not configured (dev mode)");
    if (GOOGLE_AUTH_ACTIVE) console.log(`[auth] Google Sign-In active.`);
    else                    console.warn("[auth] Google auth not configured");
    if (EMAIL_ACTIVE)       startEmailWorker();
    else                    console.warn("[email] EMAIL_ACTIVE=false; worker not started");
  });

  // S5 S4 — Graceful shutdown on SIGTERM. Docker / Hyperlift send SIGTERM
  // before SIGKILL on container stop. server.close() stops accepting new
  // connections, finishes in-flight ones, then resolves; we exit cleanly.
  // 10-second hard timeout in case a request is hung.
  const shutdown = (signal) => {
    console.log(`[boot] ${signal} received — draining connections…`);
    const forceExit = setTimeout(() => {
      console.warn("[boot] graceful shutdown timed out after 10s; forcing exit");
      process.exit(1);
    }, 10000);
    forceExit.unref();
    server.close(() => {
      console.log("[boot] all connections closed; exiting cleanly");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // Log container outbound IP at startup. Useful for confirming firewall
  // allow rules at the DB VM if egress ever changes. Fire-and-forget — this
  // is a diagnostic, not a readiness gate.
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(d => console.log(`[egress-ip] ${d.ip}`))
    .catch(err => console.warn("[egress-ip] lookup failed:", err.message));
}

boot().catch(err => {
  console.error("[boot] unexpected boot error:", err);
  process.exit(1);
});
