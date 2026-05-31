import Foundation

/// A workout is a generic `blocks[]` array (the "section model"). Swim blocks
/// carry `sets[]`; dryland blocks carry `kind:"dryland"` + `exercises[]` and
/// NO `sets`. Any code touching `sets` must guard for dryland — that guard is
/// expressed here by the optionality of `sets`/`exercises`.
struct Workout: Decodable, Identifiable {
    /// Stable local identity for SwiftUI lists (history entries may share or
    /// lack a server id). The server id, when present, is `serverId`.
    let id = UUID()
    let serverId: String?
    let title: String?
    let poolType: String?      // "25y" | "25m" | "50m" (legacy "yds")
    let totalYards: Int?
    let createdAt: String?
    let blocks: [WorkoutBlock]

    enum CodingKeys: String, CodingKey {
        case id, title, blocks
        case poolType = "poolType"
        case totalYards = "totalYards"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        serverId = try c.decodeIfPresent(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        poolType = try c.decodeIfPresent(String.self, forKey: .poolType)
        totalYards = try c.decodeIfPresent(Int.self, forKey: .totalYards)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        // Lossy: a single malformed block drops just that block, not the
        // whole workout (the silent-empty failure mode we hit before).
        blocks = c.decodeLossyArray(WorkoutBlock.self, forKey: .blocks) ?? []
    }
}

/// One block in a workout. Discriminated by `kind` (absent ⇒ "swim", which
/// keeps every existing saved workout decodable).
struct WorkoutBlock: Decodable, Identifiable {
    let kind: String          // "swim" (default) | "dryland"
    let name: String?
    let section: String?      // "warmup" | "drill" | "main" | "cooldown" | "dryland"
    let totalYards: Int?
    let placement: String?    // dryland only: "pre" | "post"
    let sets: [SwimSet]?      // swim only
    let exercises: [DrylandExercise]? // dryland only

    var id = UUID()
    var isDryland: Bool { kind == "dryland" }

    enum CodingKeys: String, CodingKey {
        case kind, name, section, totalYards, placement, sets, exercises
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = (try c.decodeIfPresent(String.self, forKey: .kind)) ?? "swim"
        name = try c.decodeIfPresent(String.self, forKey: .name)
        section = try c.decodeIfPresent(String.self, forKey: .section)
        totalYards = try c.decodeIfPresent(Int.self, forKey: .totalYards)
        placement = try c.decodeIfPresent(String.self, forKey: .placement)
        // Lossy per-element: one bad set/exercise is skipped, the rest render.
        sets = c.decodeLossyArray(SwimSet.self, forKey: .sets)
        exercises = c.decodeLossyArray(DrylandExercise.self, forKey: .exercises)
    }
}

/// A swim set: `{ id, reps, dist, desc, interval, focus, eq? }`.
struct SwimSet: Decodable, Identifiable {
    let id = UUID()           // stable local identity for SwiftUI lists
    let serverId: String?
    let reps: Int?
    let dist: Int?
    let desc: String?
    let interval: String?
    let focus: String?
    let eq: [String]?

    enum CodingKeys: String, CodingKey {
        case serverId = "id"
        case reps, dist, desc, interval, focus, eq
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        serverId = try c.decodeIfPresent(String.self, forKey: .serverId)
        reps     = try c.decodeIfPresent(Int.self,    forKey: .reps)
        dist     = try c.decodeIfPresent(Int.self,    forKey: .dist)
        desc     = try c.decodeIfPresent(String.self, forKey: .desc)
        interval = try c.decodeIfPresent(String.self, forKey: .interval)
        focus    = try c.decodeIfPresent(String.self, forKey: .focus)
        // `eq` is a single string from the engine ("pull", "kick", "snorkel"),
        // but tolerate an array too (defensive). Normalize to [String] so the
        // renderer can join them.
        if let arr = try? c.decode([String].self, forKey: .eq) {
            eq = arr
        } else if let one = try? c.decode(String.self, forKey: .eq), !one.isEmpty {
            eq = [one]
        } else {
            eq = nil
        }
    }

    /// e.g. "4 × 100" or "1 × 400".
    var repsByDist: String {
        let r = reps ?? 1
        let d = dist ?? 0
        return "\(r) × \(d)"
    }
}

/// A dryland exercise: `{ name, sets, reps, rest }`. NOTE `reps` and `rest` are
/// free-text on the server ("20 each way", "45s hold", "20s", or null) — decode
/// as strings, not numbers.
struct DrylandExercise: Decodable, Identifiable {
    let name: String?
    let sets: Int?
    let reps: String?
    let rest: String?

    var id = UUID()

    enum CodingKeys: String, CodingKey {
        case name, sets, reps, rest
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        sets = try c.decodeIfPresent(Int.self, forKey: .sets)
        // `reps` may arrive as a string or a number depending on the preset.
        if let s = try? c.decode(String.self, forKey: .reps) {
            reps = s
        } else if let n = try? c.decode(Int.self, forKey: .reps) {
            reps = String(n)
        } else {
            reps = nil
        }
        rest = try c.decodeIfPresent(String.self, forKey: .rest)
    }
}

/// Pool-course helpers, mirroring the SPA's `poolModeLabel`.
enum PoolMode {
    static func label(_ m: String?) -> String {
        switch m {
        case "25y": return "SCY (25y)"
        case "25m": return "SCM (25m)"
        case "50m": return "LCM (50m)"
        case "yds": return "SCY (legacy)"
        default:    return m ?? "—"
        }
    }
}
