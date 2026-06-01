import Foundation

/// A coach note attached to a swimmer (`GET /api/coach-notes?swimmer_sub=|managed_id=`).
/// Visibility is one of private / group_coaches / team_coaches. Only the author
/// may edit or delete (server-enforced).
struct CoachNote: Decodable, Identifiable {
    let id: Int
    let authorCoachSub: String?
    let authorName: String?
    let visibility: String?
    let body: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body, visibility
        case authorCoachSub = "author_coach_sub"
        case authorName = "author_name"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Note visibility scopes. `teamShared`/`groupShared` are only valid when the
/// swimmer has a team / is in one of the coach's groups (server validates).
enum NoteVisibility: String, CaseIterable, Identifiable {
    case `private` = "private"
    case groupCoaches = "group_coaches"
    case teamCoaches = "team_coaches"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .private:      return "Private"
        case .groupCoaches: return "Group coaches"
        case .teamCoaches:  return "Team coaches"
        }
    }
}

/// `POST /api/coach-notes` body. Exactly one of swimmerSub / managedId is set.
struct CoachNoteCreate: Encodable {
    let swimmerSub: String?
    let managedId: Int?
    let visibility: String
    let body: String

    enum CodingKeys: String, CodingKey {
        case visibility, body
        case swimmerSub = "swimmer_sub"
        case managedId = "managed_id"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(swimmerSub, forKey: .swimmerSub)
        try c.encodeIfPresent(managedId, forKey: .managedId)
        try c.encode(visibility, forKey: .visibility)
        try c.encode(body, forKey: .body)
    }
}
