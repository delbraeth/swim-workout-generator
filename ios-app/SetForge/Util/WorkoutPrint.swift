import UIKit

/// B8 — AirPrint a workout as a clean one-pager (lane sheet). Builds simple HTML
/// and hands it to `UIPrintInteractionController` via a markup print formatter,
/// so any AirPrint-capable printer on the deck's network can produce a paper
/// lane plan. No server round-trip — works from whatever is on screen.
enum WorkoutPrinter {
    static func present(_ workout: Workout) {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = workout.title ?? "SetForge Workout"
        controller.printInfo = info
        controller.printFormatter = UIMarkupTextPrintFormatter(markupText: renderHTML(workout))

        // iPad requires presenting from a source rect/bar button; iPhone uses the
        // modal sheet. Present from the key window's center on iPad as a safe default.
        guard let window = keyWindow() else { return }
        if UIDevice.current.userInterfaceIdiom == .pad {
            let rect = CGRect(x: window.bounds.midX, y: window.bounds.midY, width: 1, height: 1)
            controller.present(from: rect, in: window, animated: true, completionHandler: nil)
        } else {
            controller.present(animated: true, completionHandler: nil)
        }
    }

    // MARK: - HTML

    private static func renderHTML(_ workout: Workout) -> String {
        var meta: [String] = []
        if let y = workout.totalYards, y > 0 {
            meta.append("\(y) \(workout.poolType == "25m" || workout.poolType == "50m" ? "m" : "yd")")
        }
        if let pool = workout.poolType { meta.append(esc(PoolMode.label(pool))) }

        var body = """
        <h1>\(esc(workout.title ?? "Workout"))</h1>
        <p class="meta">\(meta.joined(separator: " &middot; "))</p>
        """

        for block in workout.blocks {
            var head = esc(block.name ?? sectionLabel(block.section))
            if let y = block.totalYards, y > 0 { head += " <span class='y'>\(y)</span>" }
            if let r = block.roundRestSecs, r > 0 { head += " <span class='y'>:\(r) rest/round</span>" }
            body += "<h2>\(head)</h2><table>"
            if block.isDryland {
                for ex in block.exercises ?? [] {
                    var d: [String] = []
                    if let s = ex.sets { d.append("\(s)×") }
                    if let r = ex.reps, !r.isEmpty { d.append(esc(r)) }
                    if let rest = ex.rest, !rest.isEmpty { d.append("rest " + esc(rest)) }
                    body += "<tr><td class='r'>\(esc(ex.name ?? ""))</td><td>\(d.joined(separator: " "))</td></tr>"
                }
            } else {
                for set in block.sets ?? [] {
                    var d: [String] = []
                    if let i = set.interval, !i.isEmpty { d.append("@ " + esc(i)) }
                    if let desc = set.desc, !desc.isEmpty { d.append(esc(desc)) }
                    if let f = set.focus, !f.isEmpty { d.append("<i>" + esc(f) + "</i>") }
                    if let eq = set.eq, !eq.isEmpty { d.append(esc(eq.joined(separator: ", "))) }
                    body += "<tr><td class='r'>\(esc(set.repsByDist))</td><td>\(d.joined(separator: " &middot; "))</td></tr>"
                }
            }
            body += "</table>"
        }

        return """
        <html><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, Helvetica, sans-serif; color: #111; margin: 24px; }
        h1 { font-size: 26px; margin: 0 0 2px; }
        .meta { color: #666; margin: 0 0 18px; font-size: 13px; }
        h2 { font-size: 17px; margin: 18px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        h2 .y { color: #888; font-weight: normal; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 6px 3px 0; font-size: 14px; vertical-align: top; }
        td.r { font-weight: 600; white-space: nowrap; width: 90px; }
        i { color: #555; }
        </style></head><body>\(body)</body></html>
        """
    }

    private static func sectionLabel(_ s: String?) -> String {
        switch s {
        case "warmup": return "Warm-Up"
        case "drill": return "Drills"
        case "kick": return "Kick"
        case "main": return "Main"
        case "cooldown": return "Cooldown"
        case "dryland": return "Dryland"
        default: return s?.capitalized ?? "Set"
        }
    }

    /// Minimal HTML escaping for interpolated user/engine text.
    private static func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}
