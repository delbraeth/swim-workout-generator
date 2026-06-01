import Foundation

/// A workout type for the Generate form (`GET /api/workout-types`). Mirrors the
/// engine's WORKOUT_TYPES entries; we keep the display bits and ignore the
/// web-only color fields.
struct WorkoutType: Decodable, Identifiable, Hashable {
    let id: String
    let label: String?
    let emoji: String?
    let blurb: String?

    enum CodingKeys: String, CodingKey {
        case id, label, emoji
        case blurb = "description"
    }
}

struct WorkoutTypesResponse: Decodable {
    let types: [WorkoutType]
}

/// A coach's assignable target (`GET /api/picker/coach-targets`) — a group the
/// caller coaches. `memberCount == 1` reads as a private student; ≥2 a group.
/// Selecting one stamps `assign_to: { group_id }` on save so the server fans the
/// workout out to active members.
struct CoachTarget: Decodable, Identifiable, Hashable {
    let id: String
    let name: String?
    let currentPhase: String?
    let teamName: String?
    let memberCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case currentPhase = "current_phase"
        case teamName = "team_name"
        case memberCount = "member_count"
    }

    var isPrivateStudent: Bool { (memberCount ?? 0) <= 1 }
}

/// Section-proportion presets (the "Mix" pills on web). Match SECTION_BIAS_RATIOS.
enum SectionBias: String, CaseIterable, Identifiable {
    case balanced, warmup_heavy, drill_heavy, long_main
    var id: String { rawValue }
    var label: String {
        switch self {
        case .balanced:     return "Balanced"
        case .warmup_heavy: return "Warm-up"
        case .drill_heavy:  return "Drill"
        case .long_main:    return "Long main"
        }
    }
}

/// Training phase (taper progression). Empty = unset (engine default).
enum TrainingPhase: String, CaseIterable, Identifiable {
    case none = "", base, build, peak, taper
    var id: String { rawValue }
    var label: String {
        switch self {
        case .none:  return "None"
        case .base:  return "Base"
        case .build: return "Build"
        case .peak:  return "Peak"
        case .taper: return "Taper"
        }
    }
}

/// The swim sections. `main` is always required (never skippable). `kick` is an
/// optional 5th section that defaults OFF — it's absent from the default
/// `includedSections` set, so it renders as an off-by-default toggle the user
/// can opt into. Enum order (warmup → drill → kick → main → cooldown) drives the
/// picker order and mirrors the engine's block order.
enum WorkoutSectionKind: String, CaseIterable, Identifiable {
    case warmup, drill, kick, main, cooldown
    var id: String { rawValue }
    var label: String {
        switch self {
        case .warmup:   return "Warm-up"
        case .drill:    return "Drill"
        case .kick:     return "Kick"
        case .main:     return "Main"
        case .cooldown: return "Cool-down"
        }
    }
    var isRequired: Bool { self == .main }
}

/// Pool course options the engine accepts.
enum PoolCourse: String, CaseIterable, Identifiable {
    case scy = "25y", scm = "25m", lcm = "50m"
    var id: String { rawValue }
    var short: String {
        switch self {
        case .scy: return "25y"
        case .scm: return "25m"
        case .lcm: return "50m"
        }
    }
}

/// The engine's equipment catalog (EQUIPMENT_LIST). `id` is the wire key the
/// server expects in the `equipment` map.
struct EquipmentItem: Identifiable, Hashable {
    let id: String
    let label: String
    let icon: String

    static let all: [EquipmentItem] = [
        .init(id: "kickboard", label: "Kickboard", icon: "🟦"),
        .init(id: "fins",      label: "Fins",      icon: "🐬"),
        .init(id: "paddles",   label: "Paddles",   icon: "🤚"),
        .init(id: "pullBuoy",  label: "Pull buoy", icon: "🛟"),
        .init(id: "snorkel",   label: "Snorkel",   icon: "🤿"),
    ]
}

/// `POST /api/generate` request. Form inputs only — curation (favorites,
/// constraints, …) is rehydrated server-side from the signed-in user's DB state.
struct GenerateRequest: Encodable {
    let typeId: String
    let maxYards: Int
    let poolMode: String
    let equipment: [String: Bool]
    let sectionBias: String
    let recoveryMode: Bool
    let phase: String?            // nil ⇒ key omitted ⇒ engine default
    let includedSections: [String]
}

/// `POST /api/generate` response. The workout is kept as raw `AnyCodable` so it
/// round-trips losslessly (every engine field survives) — important for a future
/// Save via `POST /api/log-workout`, which must re-send the exact payload.
struct GenerateResponse: Decodable {
    let ok: Bool?
    let workout: AnyCodable?

    /// Re-decode the raw workout into the typed `Workout` for rendering.
    func renderableWorkout() -> Workout? {
        guard let workout else { return nil }
        guard let data = try? JSONEncoder().encode(workout) else { return nil }
        return try? JSONDecoder().decode(Workout.self, from: data)
    }
}

/// `POST /api/log-workout` response (`{ ok, id, entry, … }`). We only need `ok`/`id`.
struct LogWorkoutResponse: Decodable {
    let ok: Bool?
    let id: String?
}
