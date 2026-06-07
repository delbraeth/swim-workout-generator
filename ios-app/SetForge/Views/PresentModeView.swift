import SwiftUI
import UIKit

/// B8 — Deck / present mode. A full-screen, giant-type, high-contrast rendering
/// of a workout for a pool-deck phone (or AirPlay'd to a TV). One block per
/// swipeable page; the idle timer is disabled so the screen never sleeps mid-set.
///
/// Pure black/white (not the Brand dark theme) on purpose: maximum legibility in
/// natatorium glare and from across a deck. Read-only — no editing here.
struct PresentModeView: View {
    let workout: Workout
    @Environment(\.dismiss) private var dismiss
    @State private var page = 0

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { idx, pg in
                    pageView(pg).tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: pages.count > 1 ? .always : .never))
            .indexViewStyle(.page(backgroundDisplayMode: .interactive))

            // Top controls float above the paged content.
            HStack {
                Button { WorkoutPrinter.present(workout) } label: {
                    Image(systemName: "printer").font(.title2)
                }
                Spacer()
                Text("\(min(page + 1, pages.count))/\(pages.count)")
                    .font(.headline.monospacedDigit())
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill").font(.title)
                }
            }
            .foregroundStyle(.white.opacity(0.85))
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .statusBarHidden(true)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: - Page rendering

    @ViewBuilder
    private func pageView(_ pg: PresentPage) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(pg.header)
                        .font(.system(size: 34, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                    if let sub = pg.sub {
                        Text(sub)
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                }
                .padding(.top, 44)

                ForEach(Array(pg.lines.enumerated()), id: \.offset) { _, line in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(line.primary)
                            .font(.system(size: 46, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        if let s = line.secondary, !s.isEmpty {
                            Text(s)
                                .font(.system(size: 24, weight: .medium, design: .rounded))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 40)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Page model

    private struct PresentPage {
        let header: String
        let sub: String?
        let lines: [PresentLine]
    }
    private struct PresentLine {
        let primary: String
        let secondary: String?
    }

    /// Title page first, then one page per block.
    private var pages: [PresentPage] {
        var out: [PresentPage] = []

        var titleSub: [String] = []
        if let y = workout.totalYards, y > 0 {
            titleSub.append("\(y) \(workout.poolType == "25m" || workout.poolType == "50m" ? "m" : "yd")")
        }
        if let pool = workout.poolType { titleSub.append(PoolMode.label(pool)) }
        out.append(PresentPage(
            header: workout.title ?? "Workout",
            sub: titleSub.isEmpty ? nil : titleSub.joined(separator: " · "),
            lines: []))

        for block in workout.blocks {
            var sub: [String] = []
            if let y = block.totalYards, y > 0 { sub.append("\(y)") }
            if let r = block.roundRestSecs, r > 0 { sub.append(":\(r) rest/round") }
            out.append(PresentPage(
                header: block.name ?? sectionLabel(block.section),
                sub: sub.isEmpty ? nil : sub.joined(separator: " · "),
                lines: block.isDryland ? drylandLines(block) : swimLines(block)))
        }
        return out
    }

    private func swimLines(_ block: WorkoutBlock) -> [PresentLine] {
        (block.sets ?? []).map { set in
            var parts: [String] = []
            if let i = set.interval, !i.isEmpty { parts.append("@ \(i)") }
            if let d = set.desc, !d.isEmpty { parts.append(d) }
            if let f = set.focus, !f.isEmpty { parts.append(f) }
            if let eq = set.eq, !eq.isEmpty { parts.append(eq.joined(separator: ", ")) }
            return PresentLine(primary: set.repsByDist, secondary: parts.isEmpty ? nil : parts.joined(separator: "  ·  "))
        }
    }

    private func drylandLines(_ block: WorkoutBlock) -> [PresentLine] {
        (block.exercises ?? []).map { ex in
            var parts: [String] = []
            if let s = ex.sets { parts.append("\(s) set\(s == 1 ? "" : "s")") }
            if let r = ex.reps, !r.isEmpty { parts.append(r) }
            if let rest = ex.rest, !rest.isEmpty { parts.append("rest \(rest)") }
            return PresentLine(primary: ex.name ?? "Exercise", secondary: parts.isEmpty ? nil : parts.joined(separator: "  ·  "))
        }
    }

    private func sectionLabel(_ s: String?) -> String {
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
}
