import Foundation

/// The composite app-launch payload (`GET /api/me/bootstrap`).
///
/// The server assembles ~13 sections in one round-trip and reports any section
/// that failed in `_errors` rather than failing the whole response. We mirror
/// that resilience: each section we model is decoded defensively, so a single
/// malformed or unexpected section never sinks the entire bootstrap. Sections
/// not yet modeled for milestone 1 (favorites, anchors, billing, …) are kept
/// as raw JSON so they remain available without blocking decode.
public struct Bootstrap: Sendable {
    public let me: User?
    public let workouts: [Workout]
    public let settings: AppSettings?
    public let goals: [Goal]
    public let errors: [String]

    /// Raw sections that aren't modeled yet, keyed by their server name.
    public let raw: [String: JSONValue]
}

extension Bootstrap: Decodable {
    private struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { return nil }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicKey.self)

        func section<T: Decodable>(_ name: String, as type: T.Type) -> T? {
            guard let key = DynamicKey(stringValue: name) else { return nil }
            return try? container.decode(T.self, forKey: key)
        }

        self.me = section("me", as: User.self)
        self.workouts = section("workouts", as: [Workout].self) ?? []
        self.settings = section("settings", as: AppSettings.self)
        self.goals = section("goals", as: [Goal].self) ?? []
        self.errors = section("_errors", as: [String].self) ?? []

        // Preserve everything we didn't strongly type.
        let modeled: Set<String> = ["me", "workouts", "settings", "goals", "_errors"]
        var leftovers: [String: JSONValue] = [:]
        for key in container.allKeys where !modeled.contains(key.stringValue) {
            if let value = try? container.decode(JSONValue.self, forKey: key) {
                leftovers[key.stringValue] = value
            }
        }
        self.raw = leftovers
    }
}
