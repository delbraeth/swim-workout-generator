import SwiftUI
import UIKit

/// "Run mode" — a full-screen, on-deck view for actually doing a workout: a
/// running pace clock, the current set front-and-center, a rep tracker, and
/// set-by-set navigation. Keeps the screen awake while active.
struct RunWorkoutView: View {
    let workout: Workout
    @Environment(\.dismiss) private var dismiss

    @State private var steps: [RunStep] = []
    @State private var index = 0
    @State private var repDone = 0

    // Pace clock state: banked time + the start of the current running segment
    // (nil ⇒ paused). The analog clock computes elapsed off this via TimelineView.
    @State private var accumulated: TimeInterval = 0
    @State private var segmentStart: Date? = Date()

    private var running: Bool { segmentStart != nil }
    private func currentElapsed() -> TimeInterval {
        accumulated + (segmentStart.map { Date().timeIntervalSince($0) } ?? 0)
    }
    private var step: RunStep? { steps.indices.contains(index) ? steps[index] : nil }

    var body: some View {
        ZStack {
            Brand.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                Divider().overlay(Brand.border)
                Spacer(minLength: 0)
                if let step { stepCard(step) } else { emptyState }
                Spacer(minLength: 0)
                controls
            }
            .padding()
        }
        .onAppear {
            steps = RunStep.build(from: workout)
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .statusBarHidden(true)
    }

    // MARK: - Header (clock + progress)

    private var header: some View {
        VStack(spacing: 10) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2).foregroundStyle(Brand.textMuted)
                }
                Spacer()
                if !steps.isEmpty {
                    Text("Set \(index + 1) of \(steps.count)")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.textMuted)
                }
                Spacer()
                Button { running ? pause() : resume() } label: {
                    Image(systemName: running ? "pause.circle.fill" : "play.circle.fill")
                        .font(.title2).foregroundStyle(Brand.primary)
                }
            }
            PaceClock(accumulated: accumulated, segmentStart: segmentStart)
            if !steps.isEmpty {
                ProgressView(value: Double(index + 1), total: Double(steps.count))
                    .tint(Brand.primary)
            }
        }
    }

    // MARK: - Current step

    private func stepCard(_ step: RunStep) -> some View {
        VStack(spacing: 16) {
            Text(step.sectionLabel.uppercased())
                .font(.caption.weight(.heavy)).foregroundStyle(Brand.textMuted)
            Text(step.title)
                .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Brand.text)
                .minimumScaleFactor(0.5).lineLimit(1)
            if let interval = step.interval, !interval.isEmpty {
                Text(interval)
                    .font(.title3.weight(.bold)).foregroundStyle(Brand.primary)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(Brand.primary.opacity(0.15), in: Capsule())
            }
            if let desc = step.detail, !desc.isEmpty {
                Text(desc).font(.body).foregroundStyle(Brand.textMuted)
                    .multilineTextAlignment(.center)
            }
            if let focus = step.focus, !focus.isEmpty {
                Text(focus).font(.footnote).italic().foregroundStyle(Brand.textDim)
                    .multilineTextAlignment(.center)
            }
            if step.reps > 1 { repTracker(step) }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Brand.border, lineWidth: 1))
    }

    private func repTracker(_ step: RunStep) -> some View {
        Button {
            if repDone < step.reps { repDone += 1; haptic() }
        } label: {
            VStack(spacing: 4) {
                Text("\(repDone) / \(step.reps)")
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundStyle(repDone >= step.reps ? Brand.positive : Brand.text)
                Text(repDone >= step.reps ? "Set complete — tap Next" : "Tap to count a rep")
                    .font(.caption2).foregroundStyle(Brand.textDim)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Brand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        Text("This workout has no sets to run.")
            .foregroundStyle(Brand.textMuted)
    }

    // MARK: - Controls

    private var controls: some View {
        HStack(spacing: 12) {
            Button { go(-1) } label: {
                Label("Prev", systemImage: "chevron.left").frame(maxWidth: .infinity).padding(.vertical, 10)
            }
            .buttonStyle(.bordered).tint(Brand.textMuted)
            .disabled(index == 0)

            Button { go(1) } label: {
                Label(index >= steps.count - 1 ? "Finish" : "Next",
                      systemImage: index >= steps.count - 1 ? "checkmark" : "chevron.right")
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent).tint(Brand.primary)
        }
        .padding(.top, 8)
    }

    // MARK: - Actions

    private func go(_ delta: Int) {
        let next = index + delta
        if next >= steps.count { dismiss(); return }   // finished
        guard steps.indices.contains(next) else { return }
        withAnimation(.easeInOut(duration: 0.15)) { index = next }
        repDone = 0
        haptic()
    }

    private func pause() {
        accumulated = currentElapsed()
        segmentStart = nil
    }
    private func resume() {
        segmentStart = Date()
    }

    private func haptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

// MARK: - Pace clock (analog 60s sweep + digital)

/// A swim pace clock: an analog face with a sweeping second hand (one rev per
/// 60s) plus a digital total. Driven by `TimelineView(.animation)` so the hand
/// sweeps smoothly; `paused` freezes it when the run is paused.
private struct PaceClock: View {
    let accumulated: TimeInterval
    let segmentStart: Date?

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: segmentStart == nil)) { context in
            let elapsed = accumulated + (segmentStart.map { context.date.timeIntervalSince($0) } ?? 0)
            VStack(spacing: 10) {
                ClockFace(seconds: elapsed)
                    .frame(width: 190, height: 190)
                Text(String(format: "%02d:%02d", Int(elapsed) / 60, Int(elapsed) % 60))
                    .font(.system(size: 32, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(segmentStart == nil ? Brand.textMuted : Brand.text)
            }
        }
    }
}

private struct ClockFace: View {
    let seconds: TimeInterval

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)

            // Face
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)),
                       with: .color(Brand.borderStrong), lineWidth: 3)

            // Second ticks (bold every 5s)
            for i in 0..<60 {
                let major = i % 5 == 0
                let a = Double(i) / 60 * 2 * .pi
                let outer = r - 5
                let inner = r - (major ? 15 : 9)
                var p = Path()
                p.move(to: CGPoint(x: c.x + sin(a) * outer, y: c.y - cos(a) * outer))
                p.addLine(to: CGPoint(x: c.x + sin(a) * inner, y: c.y - cos(a) * inner))
                ctx.stroke(p, with: .color(major ? Brand.text : Brand.textDim), lineWidth: major ? 2 : 1)
            }

            // 5-second labels (60 at top, then 5,10,…,55 clockwise)
            for i in stride(from: 0, to: 60, by: 5) {
                let a = Double(i) / 60 * 2 * .pi
                let lr = r - 30
                let pt = CGPoint(x: c.x + sin(a) * lr, y: c.y - cos(a) * lr)
                let label = i == 0 ? "60" : "\(i)"
                ctx.draw(Text(label).font(.system(size: 12, weight: .semibold)).foregroundColor(Brand.textMuted),
                         at: pt)
            }

            // Sweeping second hand (one revolution per minute)
            let a = (seconds.truncatingRemainder(dividingBy: 60)) / 60 * 2 * .pi
            let len = r - 22
            var hand = Path()
            hand.move(to: c)
            hand.addLine(to: CGPoint(x: c.x + sin(a) * len, y: c.y - cos(a) * len))
            ctx.stroke(hand, with: .color(Brand.destructive), lineWidth: 3)

            // Hub
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10)),
                     with: .color(Brand.destructive))
        }
    }
}

/// One thing to do in run mode — a swim set or a dryland exercise.
struct RunStep: Identifiable {
    let id = UUID()
    let sectionLabel: String
    let title: String
    let detail: String?
    let interval: String?
    let focus: String?
    let reps: Int

    static func build(from workout: Workout) -> [RunStep] {
        var out: [RunStep] = []
        for block in workout.blocks {
            if block.isDryland {
                for ex in block.exercises ?? [] {
                    var parts: [String] = []
                    if let reps = ex.reps, !reps.isEmpty { parts.append(reps) }
                    if let rest = ex.rest, !rest.isEmpty { parts.append("rest \(rest)") }
                    out.append(RunStep(
                        sectionLabel: block.name ?? "Dryland",
                        title: ex.name ?? "Exercise",
                        detail: parts.isEmpty ? nil : parts.joined(separator: " · "),
                        interval: nil, focus: nil,
                        reps: ex.sets ?? 1))
                }
            } else {
                for s in block.sets ?? [] {
                    out.append(RunStep(
                        sectionLabel: block.name ?? sectionTitle(block.section),
                        title: s.repsByDist,
                        detail: s.desc,
                        interval: s.interval,
                        focus: s.focus,
                        reps: s.reps ?? 1))
                }
            }
        }
        return out
    }

    private static func sectionTitle(_ section: String?) -> String {
        switch section {
        case "warmup":   return "Warm-Up"
        case "drill":    return "Drill / Pre-Main"
        case "main":     return "Main Set"
        case "cooldown": return "Cool-Down"
        default:         return section?.capitalized ?? "Set"
        }
    }
}
