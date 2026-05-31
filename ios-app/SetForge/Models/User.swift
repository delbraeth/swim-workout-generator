import Foundation

/// The authenticated user (`bootstrap.me`). Display names arrive already
/// resolved from the server (`persons` is the sole identity store), so the
/// client never assembles names from raw columns.
struct Me: Decodable, Identifiable {
    let sub: String?
    let email: String?
    let emailVerified: Bool?
    let displayName: String?
    let initials: String?
    let dob: String?
    let gender: String?
    let grade: Int?       // derived integer grade (gradeFromClassYear), null if class_year unset
    let classYear: Int?   // graduation year as a number, e.g. 2027
    let providers: [String]?
    let usaSwimmingId: String?
    let isAdmin: Bool?
    let supportRole: String?
    let createdAt: String?
    let lastLoginAt: String?
    let workoutCount: Int?
    /// Per-pool stat rollups, shape varies — kept open-ended.
    let statsByPool: [String: AnyCodable]?

    var id: String { sub ?? email ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey {
        case sub, email, initials, dob, gender, grade, providers
        case emailVerified = "email_verified"
        case displayName = "display_name"
        case classYear = "class_year"
        case usaSwimmingId = "usa_swimming_id"
        case isAdmin = "is_admin"
        case supportRole = "support_role"
        case createdAt = "created_at"
        case lastLoginAt = "last_login_at"
        case workoutCount = "workout_count"
        case statsByPool = "stats_by_pool"
    }

    /// First word of the display name, for greetings.
    var firstName: String? {
        displayName?.split(separator: " ").first.map(String.init)
    }
}

/// An active auth session (device-management UI). From `bootstrap.sessions`
/// and `GET /api/auth/sessions`.
struct AuthSession: Decodable, Identifiable {
    let idPrefix: String?
    let userAgent: String?
    let ip: String?
    let lastSeenAt: String?
    let isCurrent: Bool?

    var id: String { idPrefix ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey {
        case ip
        case idPrefix = "id_prefix"
        case userAgent = "user_agent"
        case lastSeenAt = "last_seen_at"
        case isCurrent = "is_current"
    }
}
