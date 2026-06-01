import Foundation

// Shared helpers that were previously duplicated across the view files
// (RunWorkoutView, GenerateView, WorkoutBlockView). Centralized so a section
// rename, an interval-format tweak, or a bounds-check fix happens in one place.

extension Array {
    /// Bounds-checked element access — returns nil instead of trapping when the
    /// index is out of range. Used wherever a view indexes into a workout's
    /// blocks/sets that may have changed underneath it.
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

/// Display name for a workout section key. The single source of truth for the
/// five swim sections (warmup → drill → kick → main → cooldown) plus dryland.
func sectionDisplayTitle(_ section: String?) -> String {
    switch section {
    case "warmup":   return "Warm-Up"
    case "drill":    return "Drill / Pre-Main"
    case "kick":     return "Kick Set"
    case "main":     return "Main Set"
    case "cooldown": return "Cool-Down"
    case "dryland":  return "Dryland"
    default:         return section?.capitalized ?? "Set"
    }
}

/// Parsing/formatting of swim send-off intervals ("On M:SS"). One robust parser
/// shared by Run Mode (timer) and the generator's pace-rescale editor.
enum IntervalFormat {
    /// Seconds from an interval string, or nil for "No interval"/unparseable.
    /// Accepts "On 2:00", "2:00", ":30" — and explicitly rejects "no interval".
    static func parseSeconds(_ str: String?) -> Int? {
        guard let str, !str.isEmpty,
              str.range(of: "no interval", options: .caseInsensitive) == nil else { return nil }
        if let m = str.range(of: #"(\d+):(\d{2})"#, options: .regularExpression) {
            let parts = str[m].split(separator: ":")
            if parts.count == 2, let mm = Int(parts[0]), let ss = Int(parts[1]) { return mm * 60 + ss }
        }
        if let m = str.range(of: #":(\d{2})"#, options: .regularExpression) {
            let ss = Int(str[m].dropFirst())
            if let ss { return ss }
        }
        return nil
    }

    /// Canonical "On M:SS" rendering of a seconds value.
    static func format(_ secs: Int) -> String {
        let m = secs / 60, s = secs % 60
        return String(format: "On %d:%02d", m, s)
    }
}
