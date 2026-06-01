import Foundation

/// Models backing COACH ROLL-CALL (scheduled practices + attendance).
/// Decode-only, tolerant decoding per the house idiom in `Workout.swift`.

/// One scheduled practice from `GET /api/scheduled-workouts?start=&end=`.
struct ScheduledWorkoutSummary: Decodable, Identifiable {
    let serverId: Int
    let scheduledDate: String
    let completedAt: String?
    let completedBySub: String?
    let facilityName: String?
    let notes: String?

    var id: Int { serverId }
    var isCompleted: Bool { completedAt != nil }

    enum CodingKeys: String, CodingKey {
        case serverId = "id"
        case scheduledDate = "scheduled_date"
        case completedAt = "completed_at"
        case completedBySub = "completed_by_sub"
        case facilityName = "facility_name"
        case notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        serverId = try c.decode(Int.self, forKey: .serverId)
        scheduledDate = (try c.decodeIfPresent(String.self, forKey: .scheduledDate)) ?? ""
        completedAt = try c.decodeIfPresent(String.self, forKey: .completedAt)
        completedBySub = try c.decodeIfPresent(String.self, forKey: .completedBySub)
        facilityName = try c.decodeIfPresent(String.self, forKey: .facilityName)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }
}

/// `GET /api/scheduled-workouts/:id/attendance-context`.
struct AttendanceContext: Decodable {
    let scheduledId: Int
    let groupId: String?
    let scheduledDate: String
    let completedAt: String?
    let completedBySub: String?
    let roster: [RosterMember]
    let attendance: [AttendanceRecord]

    enum CodingKeys: String, CodingKey {
        case scheduledId = "scheduled_id"
        case groupId = "group_id"
        case scheduledDate = "scheduled_date"
        case completedAt = "completed_at"
        case completedBySub = "completed_by_sub"
        case roster
        case attendance
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        scheduledId = (try c.decodeIfPresent(Int.self, forKey: .scheduledId)) ?? 0
        groupId = try c.decodeIfPresent(String.self, forKey: .groupId)
        scheduledDate = (try c.decodeIfPresent(String.self, forKey: .scheduledDate)) ?? ""
        completedAt = try c.decodeIfPresent(String.self, forKey: .completedAt)
        completedBySub = try c.decodeIfPresent(String.self, forKey: .completedBySub)
        roster = (try c.decodeIfPresent([RosterMember].self, forKey: .roster)) ?? []
        attendance = (try c.decodeIfPresent([AttendanceRecord].self, forKey: .attendance)) ?? []
    }
}

/// A roster member in the practice's group.
struct RosterMember: Decodable, Identifiable {
    let rowId: Int
    let memberSwimmerSub: String?
    let memberManagedId: Int?
    let role: String?
    let displayName: String?
    let initials: String?

    var id: Int { rowId }

    /// Stable key for the present/absent set (mirrors the web's rowKey).
    var key: String {
        memberSwimmerSub.map { "s:\($0)" }
            ?? memberManagedId.map { "m:\($0)" }
            ?? "row:\(rowId)"
    }

    enum CodingKeys: String, CodingKey {
        case rowId = "id"
        case memberSwimmerSub = "member_swimmer_sub"
        case memberManagedId = "member_managed_id"
        case role
        case displayName = "display_name"
        case initials
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rowId = (try c.decodeIfPresent(Int.self, forKey: .rowId)) ?? 0
        memberSwimmerSub = try c.decodeIfPresent(String.self, forKey: .memberSwimmerSub)
        memberManagedId = try c.decodeIfPresent(Int.self, forKey: .memberManagedId)
        role = try c.decodeIfPresent(String.self, forKey: .role)
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName)
        initials = try c.decodeIfPresent(String.self, forKey: .initials)
    }
}

/// A previously-recorded attendance row, used to seed the absent set.
struct AttendanceRecord: Decodable {
    let swimmerSub: String?
    let managedId: Int?
    let present: Bool
    let notes: String?

    /// Same s:/m: scheme as `RosterMember.key`.
    var key: String {
        swimmerSub.map { "s:\($0)" }
            ?? managedId.map { "m:\($0)" }
            ?? ""
    }

    enum CodingKeys: String, CodingKey {
        case swimmerSub = "swimmer_sub"
        case managedId = "managed_id"
        case present
        case notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        swimmerSub = try c.decodeIfPresent(String.self, forKey: .swimmerSub)
        managedId = try c.decodeIfPresent(Int.self, forKey: .managedId)
        present = (try c.decodeIfPresent(Bool.self, forKey: .present)) ?? true
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }
}

/// One attendance mark in the complete request body. Encodes only the non-nil
/// identifier (swimmer_sub OR managed_id) plus `present`.
struct AttendanceMark: Encodable {
    let swimmerSub: String?
    let managedId: Int?
    let present: Bool

    enum CodingKeys: String, CodingKey {
        case swimmerSub = "swimmer_sub"
        case managedId = "managed_id"
        case present
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(swimmerSub, forKey: .swimmerSub)
        try c.encodeIfPresent(managedId, forKey: .managedId)
        try c.encode(present, forKey: .present)
    }
}

/// `POST /api/scheduled-workouts/:id/complete` body.
struct CompleteRequest: Encodable {
    let completedAt: String?
    let attendance: [AttendanceMark]

    enum CodingKeys: String, CodingKey {
        case completedAt = "completed_at"
        case attendance
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(completedAt, forKey: .completedAt)
        try c.encode(attendance, forKey: .attendance)
    }
}

/// `POST /api/scheduled-workouts/:id/complete` response.
struct CompleteResponse: Decodable {
    let ok: Bool?
    let completedAt: String?
    let attendanceCount: Int?

    enum CodingKeys: String, CodingKey {
        case ok
        case completedAt = "completed_at"
        case attendanceCount = "attendance_count"
    }
}
