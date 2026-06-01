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
    /// Linked auth providers. The server returns objects ({provider, linked_at}),
    /// so this is kept open-ended rather than [String] (which would throw and
    /// nil out the whole Me).
    let providers: [AnyCodable]?
    let usaSwimmingId: String?
    let isAdmin: Bool?
    /// True when the user can coach (server sets is_coach OR is_admin). Gates
    /// every coach-facing surface in the app (Practices, generate-for target,
    /// multi-lane, coach notes).
    let isCoach: Bool?
    let supportRole: String?
    let createdAt: String?
    let lastLoginAt: String?
    let workoutCount: Int?
    /// Per-pool stat rollups. The server returns an ARRAY of {pool_mode, count,
    /// total} objects — kept open-ended (was [String:AnyCodable], a dictionary,
    /// which threw on the array and silently niled the entire Me object).
    let statsByPool: [AnyCodable]?

    var id: String { sub ?? email ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey {
        case sub, email, initials, dob, gender, grade, providers
        case emailVerified = "email_verified"
        case displayName = "display_name"
        case classYear = "class_year"
        case usaSwimmingId = "usa_swimming_id"
        case isAdmin = "is_admin"
        case isCoach = "is_coach"
        case supportRole = "support_role"
        case createdAt = "created_at"
        case lastLoginAt = "last_login_at"
        case workoutCount = "workout_count"
        case statsByPool = "stats_by_pool"
    }

    /// Tolerant per-field decode (matches Bootstrap/Workout idiom): a single
    /// type-mismatched field (e.g. providers/stats shape drift, or me.grade)
    /// degrades to nil instead of throwing and niling the WHOLE Me — which
    /// silently broke Edit-profile + the coach Practices gate before this.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sub           = try? c.decodeIfPresent(String.self, forKey: .sub)
        email         = try? c.decodeIfPresent(String.self, forKey: .email)
        emailVerified = try? c.decodeIfPresent(Bool.self, forKey: .emailVerified)
        displayName   = try? c.decodeIfPresent(String.self, forKey: .displayName)
        initials      = try? c.decodeIfPresent(String.self, forKey: .initials)
        dob           = try? c.decodeIfPresent(String.self, forKey: .dob)
        gender        = try? c.decodeIfPresent(String.self, forKey: .gender)
        grade         = try? c.decodeIfPresent(Int.self, forKey: .grade)
        classYear     = try? c.decodeIfPresent(Int.self, forKey: .classYear)
        providers     = try? c.decodeIfPresent([AnyCodable].self, forKey: .providers)
        usaSwimmingId = try? c.decodeIfPresent(String.self, forKey: .usaSwimmingId)
        isAdmin       = try? c.decodeIfPresent(Bool.self, forKey: .isAdmin)
        isCoach       = try? c.decodeIfPresent(Bool.self, forKey: .isCoach)
        supportRole   = try? c.decodeIfPresent(String.self, forKey: .supportRole)
        createdAt     = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        lastLoginAt   = try? c.decodeIfPresent(String.self, forKey: .lastLoginAt)
        workoutCount  = try? c.decodeIfPresent(Int.self, forKey: .workoutCount)
        statsByPool   = try? c.decodeIfPresent([AnyCodable].self, forKey: .statsByPool)
    }

    /// First word of the display name, for greetings.
    var firstName: String? {
        displayName?.split(separator: " ").first.map(String.init)
    }

    /// Convenience: treat a nil flag as not-a-coach.
    var coaches: Bool { isCoach == true }
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
