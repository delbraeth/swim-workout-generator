import Foundation

/// Upcoming meet/event stored in settings.
public struct NextEvent: Codable, Hashable, Sendable {
    public let name: String
    public let date: String   // "YYYY-MM-DD"
}

/// User preferences (`GET /api/settings`).
///
/// The server keeps a stable core (slider bounds, pace input) plus a flexible
/// `extra` blob. We model the documented core fields and retain the rest of the
/// schema-flexible sections as `JSONValue` so nothing is dropped on round-trip.
public struct AppSettings: Codable, Sendable {
    public let sliderMin: Int?
    public let sliderMax: Int?
    public let paceInput: String?
    public let nextEvent: NextEvent?
    public let phase: TrainingPhase?
    public let level: SwimmerLevel?
    public let lapButton: Bool?
    public let multiLane: JSONValue?
    public let engineSectionSources: JSONValue?

    enum CodingKeys: String, CodingKey {
        case sliderMin
        case sliderMax
        case paceInput
        case nextEvent = "next_event"
        case phase
        case level
        case lapButton = "lap_button"
        case multiLane = "multi_lane"
        case engineSectionSources = "engine_section_sources"
    }
}

/// A user training goal (`/api/me/bootstrap` → `goals`).
public struct Goal: Codable, Identifiable, Sendable {
    public let metric: String          // e.g. "workouts_per_week"
    public let targetValue: Int?
    public let periodStart: String?
    public let periodEnd: String?

    public var id: String { metric + (periodStart ?? "") }

    enum CodingKeys: String, CodingKey {
        case metric
        case targetValue = "target_value"
        case periodStart = "period_start"
        case periodEnd = "period_end"
    }
}
