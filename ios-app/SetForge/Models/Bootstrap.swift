import Foundation

/// The composite launch payload: `GET /api/me/bootstrap`. One request that
/// returns the user + history + favorites/disfavorites + effective sets +
/// settings + sessions + flags, so the client never fans out many mount-time
/// GETs (the 30 req/min platform cap makes fan-out dangerous).
///
/// Every field is optional/tolerant: the SPA's `applyBootstrap` guards each key
/// with a shape check and ignores anything malformed, so we do the same rather
/// than fail the whole launch on one unexpected value.
struct Bootstrap: Decodable {
    let me: Me?
    let workouts: [Workout]?              // history
    let favorites: [String]?
    let disfavorites: [String]?
    let favoriteSets: [String]?           // set IDs
    let disfavorSets: [String]?           // set IDs
    let effectiveFavorites: EffectiveCuration?
    let effectiveDisfavorites: EffectiveCuration?
    let goals: [AnyCodable]?
    let sessions: [AuthSession]?
    let pendingInvites: [AnyCodable]?
    let billing: Billing?
    let settings: [String: AnyCodable]?
    /// Team/meet event anchors for the swimmer's groups (one per anchored group).
    let groupAnchors: [GroupAnchor]?
    /// Phase 6 union visibility map (most-permissive across the user's teams).
    /// nil ⇒ everything on. Use `flag(_:)` to read with the all-on default.
    let featureFlags: [String: Bool]?

    enum CodingKeys: String, CodingKey {
        case me, workouts, favorites, disfavorites, goals, sessions, billing, settings
        case favoriteSets = "favoriteSets"
        case disfavorSets = "disfavorSets"
        case effectiveFavorites = "effectiveFavorites"
        case effectiveDisfavorites = "effectiveDisfavorites"
        case pendingInvites = "pendingInvites"
        case groupAnchors
        case featureFlags = "feature_flags"
    }

    /// Per-section tolerant decode (matches the SPA's `applyBootstrap`): an
    /// unexpected shape in ONE section comes back nil instead of failing the
    /// whole launch. Synthesized `Decodable` would instead throw on the first
    /// type mismatch (e.g. a number where a String is expected), blanking the
    /// entire home screen — which is exactly the failure mode we hit on `me.grade`.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        me                    = try? c.decodeIfPresent(Me.self, forKey: .me)
        workouts              = try? c.decodeIfPresent([Workout].self, forKey: .workouts)
        favorites             = try? c.decodeIfPresent([String].self, forKey: .favorites)
        disfavorites          = try? c.decodeIfPresent([String].self, forKey: .disfavorites)
        favoriteSets          = try? c.decodeIfPresent([String].self, forKey: .favoriteSets)
        disfavorSets          = try? c.decodeIfPresent([String].self, forKey: .disfavorSets)
        effectiveFavorites    = try? c.decodeIfPresent(EffectiveCuration.self, forKey: .effectiveFavorites)
        effectiveDisfavorites = try? c.decodeIfPresent(EffectiveCuration.self, forKey: .effectiveDisfavorites)
        goals                 = try? c.decodeIfPresent([AnyCodable].self, forKey: .goals)
        sessions              = try? c.decodeIfPresent([AuthSession].self, forKey: .sessions)
        pendingInvites        = try? c.decodeIfPresent([AnyCodable].self, forKey: .pendingInvites)
        billing               = try? c.decodeIfPresent(Billing.self, forKey: .billing)
        settings              = try? c.decodeIfPresent([String: AnyCodable].self, forKey: .settings)
        groupAnchors          = try? c.decodeIfPresent([GroupAnchor].self, forKey: .groupAnchors)
    }
}

/// A team/meet event anchor (`bootstrap.groupAnchors`). `weeksOut` is the
/// server-computed countdown (0 = this week); the server only includes
/// future-or-current anchors.
struct GroupAnchor: Decodable, Identifiable {
    let groupId: String?
    let eventId: String?
    let eventName: String?
    let eventDate: String?
    let weeksOut: Int?
    let suggestedPhase: String?

    var id: String { eventId ?? groupId ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case eventId = "event_id"
        case eventName = "event_name"
        case eventDate = "event_date"
        case weeksOut = "weeks_out"
        case suggestedPhase = "suggested_phase"
    }
}

/// The individual "Next event" the swimmer set (`settings.next_event = {name,date}`).
struct NextEvent {
    let name: String
    let date: String?
}

/// Coach-propagated curation has three states each (per-user + inherited):
/// free-text `labels`, curated `set_ids`, and engine-template ids.
struct EffectiveCuration: Decodable {
    let labels: [String]?
    let setIds: [String]?
    let engine: [AnyCodable]?

    enum CodingKeys: String, CodingKey {
        case labels, engine
        case setIds = "set_ids"
    }
}

struct Billing: Decodable {
    let status: String?   // subscription tier / state
}

extension Bootstrap {
    /// The user's effective pool course, read from settings if present.
    var poolMode: String? {
        settings?["poolType"]?.stringValue
            ?? settings?["pool_type"]?.stringValue
    }

    var favoriteSetCount: Int { favoriteSets?.count ?? 0 }
    var effectiveFavoriteCount: Int {
        (effectiveFavorites?.setIds?.count ?? 0) + (effectiveFavorites?.labels?.count ?? 0)
    }

    /// The individual "Next event" from settings.next_event ({ name, date }).
    /// Returns nil when unset or nameless.
    var nextEvent: NextEvent? {
        guard let obj = settings?["next_event"]?.objectValue,
              let name = obj["name"]?.stringValue, !name.isEmpty else { return nil }
        return NextEvent(name: name, date: obj["date"]?.stringValue)
    }

    /// Phase 6 visibility read with the all-on default: an unset flag (nil map
    /// or missing key) is treated as ON, matching the web union semantics and
    /// keeping the app fully functional when the server omits feature_flags.
    func flag(_ key: String) -> Bool { featureFlags?[key] ?? true }

    /// Anchors with a valid future-or-current countdown, nearest first.
    var upcomingAnchors: [GroupAnchor] {
        (groupAnchors ?? [])
            .filter { ($0.weeksOut ?? -1) >= 0 && ($0.eventName?.isEmpty == false) }
            .sorted { ($0.weeksOut ?? .max) < ($1.weeksOut ?? .max) }
    }
}
