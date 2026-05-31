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

    // Pace clock: date-based elapsed (accurate), refreshed by a periodic tick.
    @State private var accumulated: TimeInterval = 0
    @State private var segmentStart: Date? = Date()
    @State private var tick = Date()
    private let timer = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    private var running: Bool { segmentStart != nil }
    private var elapsed: TimeInterval {
        accumulated + (segmentStart.map { tick.timeIntervalSince($0) } ?? 0)
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
        .onReceive(timer) { now in if running { tick = now } }
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
            Text(Self.clock(elapsed))
                .font(.system(size: 64, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(running ? Brand.text : Brand.textMuted)
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
        accumulated = elapsed
        segmentStart = nil
    }
    private func resume() {
        segmentStart = Date()
        tick = Date()
    }

    private func haptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private static func clock(_ t: TimeInterval) -> String {
        let total = Int(t)
        return String(format: "%02d:%02d", total / 60, total % 60)
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
