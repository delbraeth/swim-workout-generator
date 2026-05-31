import Foundation

/// Pool / course mode. Server raw values are `25y`, `25m`, `50m`
/// (SCY / SCM / LCM respectively).
public enum PoolMode: String, Codable, CaseIterable, Sendable {
    case scy = "25y"
    case scm = "25m"
    case lcm = "50m"

    /// Short label suitable for UI ("SCY" / "SCM" / "LCM").
    public var displayCode: String {
        switch self {
        case .scy: return "SCY"
        case .scm: return "SCM"
        case .lcm: return "LCM"
        }
    }
}

/// Workout category. Mirrors the server's `workouts.type` enum.
public enum WorkoutType: String, Codable, CaseIterable, Sendable {
    case im
    case distance
    case sprint
    case endurance
    case technique
    case mixed
    case back
    case breast
    case fly
}

/// Self-reported gender, matching the `persons.gender` enum on the server.
public enum Gender: String, Codable, Sendable {
    case male = "M"
    case female = "F"
    case nonbinary = "X"
    case preferNotToSay = "prefer_not_to_say"
}

/// Training phase stored in user settings.
public enum TrainingPhase: String, Codable, Sendable {
    case base, build, peak, taper, recovery
}

/// Experience level stored in user settings.
public enum SwimmerLevel: String, Codable, Sendable {
    case recreational, masters, competitive
}
