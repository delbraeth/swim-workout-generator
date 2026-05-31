import Foundation

/// A linked sign-in provider for the current user (`/api/me` → `providers`).
public struct AuthProvider: Codable, Hashable, Sendable {
    public let provider: String   // "apple" | "google"
    public let linkedAt: String?

    enum CodingKeys: String, CodingKey {
        case provider
        case linkedAt = "linked_at"
    }
}

/// Per-pool workout count + yardage rollup (`/api/me` → `stats_by_pool`).
public struct PoolStat: Codable, Hashable, Sendable {
    public let poolMode: PoolMode
    public let count: Int
    public let total: Int

    enum CodingKeys: String, CodingKey {
        case poolMode = "pool_mode"
        case count
        case total
    }
}

/// The authenticated user's profile + activity rollups.
///
/// Mirrors the `GET /api/me` response. The server emits snake_case keys here,
/// so the field mapping is explicit. Fields the server may omit or null out are
/// modeled as optionals.
public struct User: Codable, Identifiable, Sendable {
    public var id: String { sub }

    public let sub: String
    public let email: String?
    public let emailVerified: Bool?
    public let displayName: String
    public let initials: String?
    public let dob: String?              // "YYYY-MM-DD"
    public let isMinor: Bool?
    public let gender: Gender?
    public let classYear: Int?
    public let grade: String?
    public let usaSwimmingId: String?
    public let isAdmin: Bool
    public let isCoach: Bool
    public let createdAt: String?
    public let lastLoginAt: String?
    public let workoutCount: Int
    public let statsByPool: [PoolStat]
    public let pendingFeedbackCount: Int?
    public let isParent: Bool?
    public let digestPaused: Bool?
    public let providers: [AuthProvider]?

    enum CodingKeys: String, CodingKey {
        case sub
        case email
        case emailVerified = "email_verified"
        case displayName = "display_name"
        case initials
        case dob
        case isMinor = "is_minor"
        case gender
        case classYear = "class_year"
        case grade
        case usaSwimmingId = "usa_swimming_id"
        case isAdmin = "is_admin"
        case isCoach = "is_coach"
        case createdAt = "created_at"
        case lastLoginAt = "last_login_at"
        case workoutCount = "workout_count"
        case statsByPool = "stats_by_pool"
        case pendingFeedbackCount = "pending_feedback_count"
        case isParent = "is_parent"
        case digestPaused = "digest_paused"
        case providers
    }
}
