import Foundation

/// A logged / saved workout (`GET /api/workouts`, `POST /api/log-workout`).
///
/// Unlike `/api/me`, the workout endpoints speak camelCase, so most keys map
/// 1:1. The generated set structure lives in `payload` as free-form JSON.
public struct Workout: Codable, Identifiable, Sendable {
    public let id: String
    public let sub: String?
    public let type: WorkoutType
    public let totalYards: Int
    public let poolMode: PoolMode
    public let savedAt: String?
    public let completed: Bool
    public let dateCompleted: String?    // "YYYY-MM-DD"
    public let notes: String?
    public let userInitials: String?
    public let difficulty: Int?          // 1...5
    public let focusNote: String?
    public let payload: JSONValue?

    public init(
        id: String,
        sub: String? = nil,
        type: WorkoutType,
        totalYards: Int,
        poolMode: PoolMode,
        savedAt: String? = nil,
        completed: Bool,
        dateCompleted: String? = nil,
        notes: String? = nil,
        userInitials: String? = nil,
        difficulty: Int? = nil,
        focusNote: String? = nil,
        payload: JSONValue? = nil
    ) {
        self.id = id
        self.sub = sub
        self.type = type
        self.totalYards = totalYards
        self.poolMode = poolMode
        self.savedAt = savedAt
        self.completed = completed
        self.dateCompleted = dateCompleted
        self.notes = notes
        self.userInitials = userInitials
        self.difficulty = difficulty
        self.focusNote = focusNote
        self.payload = payload
    }
}

/// Request body for `POST /api/log-workout`.
///
/// `assignTo` / `scheduledId` are coach/scheduling concerns out of scope for
/// milestone 1, so they are omitted here; the server treats them as optional.
public struct LogWorkoutRequest: Codable, Sendable {
    public let id: String
    public let type: WorkoutType
    public let totalYards: Int
    public let poolMode: PoolMode
    public let completed: Bool
    public let dateCompleted: String?
    public let notes: String?
    public let userInitials: String?
    public let difficulty: Int?
    public let focusNote: String?
    public let blocks: JSONValue?

    public init(
        id: String,
        type: WorkoutType,
        totalYards: Int,
        poolMode: PoolMode,
        completed: Bool,
        dateCompleted: String? = nil,
        notes: String? = nil,
        userInitials: String? = nil,
        difficulty: Int? = nil,
        focusNote: String? = nil,
        blocks: JSONValue? = nil
    ) {
        self.id = id
        self.type = type
        self.totalYards = totalYards
        self.poolMode = poolMode
        self.completed = completed
        self.dateCompleted = dateCompleted
        self.notes = notes
        self.userInitials = userInitials
        self.difficulty = difficulty
        self.focusNote = focusNote
        self.blocks = blocks
    }
}

/// Partial update body for `PATCH /api/workouts/:id`. Only the fields the
/// server allows mutating post-hoc are present; nil fields are dropped from
/// the encoded JSON so a patch only touches what it sets.
public struct WorkoutPatch: Codable, Sendable {
    public var notes: String??
    public var dateCompleted: String??
    public var completed: Bool?
    public var difficulty: Int??
    public var focusNote: String??

    public init(
        notes: String?? = nil,
        dateCompleted: String?? = nil,
        completed: Bool? = nil,
        difficulty: Int?? = nil,
        focusNote: String?? = nil
    ) {
        self.notes = notes
        self.dateCompleted = dateCompleted
        self.completed = completed
        self.difficulty = difficulty
        self.focusNote = focusNote
    }

    enum CodingKeys: String, CodingKey {
        case notes, dateCompleted, completed, difficulty, focusNote
    }

    // Double-optional encoding: `.some(nil)` writes an explicit JSON null,
    // `.none` omits the key entirely.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let notes { try c.encode(notes, forKey: .notes) }
        if let dateCompleted { try c.encode(dateCompleted, forKey: .dateCompleted) }
        if let completed { try c.encode(completed, forKey: .completed) }
        if let difficulty { try c.encode(difficulty, forKey: .difficulty) }
        if let focusNote { try c.encode(focusNote, forKey: .focusNote) }
    }
}
