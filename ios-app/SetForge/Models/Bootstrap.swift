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

    enum CodingKeys: String, CodingKey {
        case me, workouts, favorites, disfavorites, goals, sessions, billing, settings
        case favoriteSets = "favoriteSets"
        case disfavorSets = "disfavorSets"
        case effectiveFavorites = "effectiveFavorites"
        case effectiveDisfavorites = "effectiveDisfavorites"
        case pendingInvites = "pendingInvites"
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
    }
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
}
