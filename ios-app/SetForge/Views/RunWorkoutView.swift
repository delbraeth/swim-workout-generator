import SwiftUI
import UIKit

// MARK: - Run configuration

/// Rest between sets — matches the web REST_OPTIONS (Manual = no auto-advance).
enum RestOption: Identifiable, Hashable {
    case manual
    case seconds(Int)

    static let all: [RestOption] = [.manual, .seconds(0), .seconds(30), .seconds(45), .seconds(60)]
    var id: String { label }
    var label: String {
        switch self {
        case .manual:          return "Manual"
        case .seconds(let s):  return "\(s)s"
        }
    }
    /// Rest seconds, or nil for manual (advance by tapping).
    var secs: Int? { if case .seconds(let s) = self { return s }; return nil }
}

/// Pre-start run options (the "Start Workout" sheet).
struct RunConfig {
    var rest: RestOption = .seconds(30)
    var audioCues = false
    var lapButton = true
}

// MARK: - Run mode

/// On-deck run mode. Shows a pre-start options sheet (rest / audio cues / lap
/// button), then runs the workout as an interval timer: each timed set counts
/// DOWN per rep and auto-advances; a rest countdown runs between sets (with
/// 3-2-1 + "go" audio cues); lap mode records per-rep splits. Mirrors the web
/// PaceClockView / RunWorkoutOverlay.
struct RunWorkoutView: View {
    let workout: Workout
    @Environment(\.dismiss) private var dismiss
    /// Wide = width > height. True for iPhone landscape AND iPad landscape —
    /// size classes can't tell iPad orientation apart (both regular/regular),
    /// so we measure. Drives the two-column run layout.
    @State private var isWide = false

    private enum Phase { case swimming, resting, restManual, finished }

    @State private var steps: [RunStep] = []
    @State private var config: RunConfig?          // nil = options sheet showing
    @State private var showOptions = true

    @State private var stepIdx = 0
    @State private var repIdx = 0
    @State private var phase: Phase = .swimming
    @State private var secsLeft = 0                // current rep countdown
    @State private var restLeft = 0                // rest countdown
    @State private var totalElapsed = 0            // whole-session, for the pace clock
    @State private var running = true
    @State private var lastDelta: Int?             // transient lap-split feedback

    @State private var audio = RunAudio()
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var step: RunStep? { steps.indices.contains(stepIdx) ? steps[stepIdx] : nil }

    var body: some View {
        ZStack {
            Brand.bg.ignoresSafeArea()
            if showOptions {
                RunOptionsSheet(audio: audio) { cfg in
                    config = cfg
                    startRun()
                } onCancel: { dismiss() }
            } else {
                GeometryReader { geo in
                    runUI
                        .onAppear { isWide = geo.size.width > geo.size.height }
                        .onChange(of: geo.size) { isWide = geo.size.width > geo.size.height }
                }
            }
        }
        .onAppear {
            steps = RunStep.build(from: workout)
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            audio.stop()
        }
        .onReceive(ticker) { _ in tick() }
        .statusBarHidden(true)
    }

    // MARK: - Run UI

    private var landscape: Bool { isWide }

    @ViewBuilder
    private var runUI: some View {
        if phase == .finished {
            VStack(spacing: 16) { Spacer(); finishedCard; Spacer(); controls }.padding()
        } else if landscape {
            landscapeRun
        } else {
            portraitRun
        }
    }

    private var portraitRun: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(Brand.border)
            Spacer(minLength: 0)
            activeCard
            Spacer(minLength: 0)
            controls
        }
        .padding()
    }

    /// Two columns: timer hero on the left, set details + controls on the right.
    private var landscapeRun: some View {
        HStack(spacing: 12) {
            VStack(spacing: 6) {
                HStack { closeButton; Spacer(); elapsedReadout }
                Spacer(minLength: 0)
                timerHero
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity)
            .padding(16)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Brand.border, lineWidth: 1))

            VStack(spacing: 8) {
                HStack { if !steps.isEmpty { setCountLabel }; Spacer(); pauseButton }
                Spacer(minLength: 0)
                setDetails
                Spacer(minLength: 0)
                controls
            }
            .frame(maxWidth: .infinity)
        }
        .padding(12)
    }

    // MARK: Chrome

    private var closeButton: some View {
        Button { dismiss() } label: {
            Image(systemName: "xmark.circle.fill").font(.title2).foregroundStyle(Brand.textMuted)
        }
    }
    private var pauseButton: some View {
        Button { running.toggle() } label: {
            Image(systemName: running ? "pause.circle.fill" : "play.circle.fill")
                .font(.title2).foregroundStyle(Brand.primary)
        }
    }
    private var setCountLabel: some View {
        Text("Set \(stepIdx + 1) of \(steps.count)")
            .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.textMuted)
    }
    private var elapsedReadout: some View {
        HStack(spacing: 5) {
            Image(systemName: "clock").font(.caption2).foregroundStyle(Brand.textDim)
            Text(Self.clock(totalElapsed))
                .font(.subheadline.weight(.bold).monospacedDigit()).foregroundStyle(Brand.textMuted)
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            HStack {
                closeButton
                Spacer()
                if !steps.isEmpty { setCountLabel }
                Spacer()
                pauseButton
            }
            HStack(spacing: 6) {
                Image(systemName: "clock").font(.caption2).foregroundStyle(Brand.textDim)
                Text("Elapsed").font(.caption2.weight(.semibold)).foregroundStyle(Brand.textDim)
                Text(Self.clock(totalElapsed))
                    .font(.subheadline.weight(.bold).monospacedDigit()).foregroundStyle(Brand.textMuted)
            }
        }
    }

    // MARK: Shared content

    @ViewBuilder
    private var timerHero: some View {
        let big: CGFloat = landscape ? 76 : 72
        if phase == .resting {
            Text("REST").font(.caption.weight(.heavy)).foregroundStyle(Brand.warn)
            Text(Self.clock(restLeft))
                .font(.system(size: big, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Brand.warn)
            if let next = steps[safe: stepIdx + 1] {
                Text("Next: \(next.title)").font(.footnote).foregroundStyle(Brand.textDim).lineLimit(1)
            }
        } else if let step, step.intervalSecs != nil {
            Text(phase == .restManual ? "SET DONE" : "ON \(Self.clock(step.intervalSecs!))")
                .font(.caption.weight(.heavy)).foregroundStyle(Brand.textMuted)
            Text(Self.clock(phase == .restManual ? 0 : secsLeft))
                .font(.system(size: big, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(running ? Brand.text : Brand.textMuted)
        } else {
            Image(systemName: "figure.pool.swim").font(.system(size: 52)).foregroundStyle(Brand.primary)
        }
        if let step, step.reps > 1 && phase != .resting {
            Text("Rep \(min(repIdx + 1, step.reps)) of \(step.reps)")
                .font(.headline).foregroundStyle(Brand.text)
        }
    }

    @ViewBuilder
    private var setDetails: some View {
        VStack(spacing: 10) {
            if let step {
                Text(step.sectionLabel.uppercased())
                    .font(.caption2.weight(.heavy)).foregroundStyle(Brand.textMuted)
                Text(step.title)
                    .font(.title.weight(.bold).monospacedDigit()).foregroundStyle(Brand.text)
                    .minimumScaleFactor(0.5).lineLimit(1)
                if let d = step.detail, !d.isEmpty {
                    Text(d).font(.subheadline).foregroundStyle(Brand.textMuted).multilineTextAlignment(.center)
                }
                if let f = step.focus, !f.isEmpty {
                    Text(f).font(.caption).italic().foregroundStyle(Brand.textDim).multilineTextAlignment(.center)
                }
            }
            if let delta = lastDelta {
                Text(delta == 0 ? "On pace" : (delta < 0 ? "\(delta)s under" : "+\(delta)s over"))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(delta <= 0 ? Brand.positive : Brand.warn)
                    .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private var activeCard: some View {
        VStack(spacing: 14) {
            timerHero
            Divider().overlay(Brand.border).padding(.vertical, 4)
            setDetails
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Brand.border, lineWidth: 1))
    }

    private var finishedCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 56)).foregroundStyle(Brand.positive)
            Text("Workout complete").font(.title2.weight(.bold)).foregroundStyle(Brand.text)
            Text("Total time \(Self.clock(totalElapsed))").font(.headline.monospacedDigit()).foregroundStyle(Brand.textMuted)
        }
        .frame(maxWidth: .infinity).padding(28)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20))
    }

    @ViewBuilder
    private var controls: some View {
        if phase == .finished {
            Button { dismiss() } label: {
                Text("Done").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent).tint(Brand.primary).padding(.top, 8)
        } else {
            HStack(spacing: 10) {
                Button { goPrev() } label: {
                    Image(systemName: "backward.end.fill").frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                .buttonStyle(.bordered).tint(Brand.textMuted).disabled(stepIdx == 0 && repIdx == 0)

                primaryAction

                Button { skipForward() } label: {
                    Image(systemName: "forward.end.fill").frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                .buttonStyle(.bordered).tint(Brand.textMuted)
            }
            .padding(.top, 8)
        }
    }

    @ViewBuilder
    private var primaryAction: some View {
        let timed = step?.intervalSecs != nil
        if phase == .restManual {
            actionButton("Start next", "play.fill") { advanceSet() }
        } else if phase == .resting {
            actionButton("Skip rest", "forward.fill") { endRest() }
        } else if timed && (config?.lapButton ?? true) {
            actionButton("Lap", "stopwatch.fill") { manualLap() }
        } else if !timed {
            actionButton("Next", "checkmark") { finishSet() }
        } else {
            actionButton(running ? "Pause" : "Resume", running ? "pause.fill" : "play.fill") { running.toggle() }
        }
    }

    private func actionButton(_ title: String, _ icon: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Label(title, systemImage: icon).font(.headline).frame(maxWidth: .infinity).frame(width: 160).padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent).tint(Brand.primary)
    }

    // MARK: - Engine

    private func startRun() {
        showOptions = false
        stepIdx = 0; repIdx = 0; totalElapsed = 0; running = true
        beginStep()
    }

    private func beginStep() {
        repIdx = 0
        lastDelta = nil
        secsLeft = step?.intervalSecs ?? 0
        phase = .swimming
    }

    private func tick() {
        guard !showOptions, running else { return }
        if phase != .finished { totalElapsed += 1 }
        switch phase {
        case .swimming:
            guard step?.intervalSecs != nil, secsLeft > 0 else { return }
            secsLeft -= 1
            if secsLeft == 0 { recordSplit(0); advanceRep() }   // auto-advance on the interval
        case .resting:
            restLeft -= 1
            if config?.audioCues == true {
                if restLeft == 0 { audio.go() } else if restLeft <= 3 { audio.beep() }
            }
            if restLeft <= 0 { advanceSet() }
        case .restManual, .finished:
            break
        }
    }

    private func advanceRep() {
        guard let step else { return }
        if repIdx + 1 >= step.reps { finishSet() }
        else { repIdx += 1; secsLeft = step.intervalSecs ?? 0 }
    }

    private func manualLap() {
        guard let step, let total = step.intervalSecs else { return }
        let actual = total - secsLeft
        guard actual > 0 else { return }       // ignore taps before the rep has run
        recordSplit(actual - total)
        advanceRep()
    }

    private func recordSplit(_ delta: Int) {
        withAnimation { lastDelta = delta }
    }

    private func finishSet() {
        lastDelta = nil
        if stepIdx + 1 >= steps.count { phase = .finished; audio.stop(); return }
        switch config?.rest ?? .manual {
        case .manual:
            phase = .restManual
        case .seconds(let s):
            restLeft = max(s, 1)               // 0s → a 1s flash, then auto-advance
            phase = .resting
        }
    }

    private func endRest() { advanceSet() }

    private func advanceSet() {
        guard stepIdx + 1 < steps.count else { phase = .finished; audio.stop(); return }
        stepIdx += 1
        beginStep()
    }

    private func goPrev() {
        if repIdx > 0 && phase == .swimming { repIdx -= 1; secsLeft = step?.intervalSecs ?? 0; return }
        if stepIdx > 0 { stepIdx -= 1; beginStep() } else { beginStep() }
    }

    private func skipForward() { finishSet() }

    private static func clock(_ t: Int) -> String { String(format: "%d:%02d", t / 60, t % 60) }
}

// MARK: - Pre-start options sheet

private struct RunOptionsSheet: View {
    let audio: RunAudio
    let onStart: (RunConfig) -> Void
    let onCancel: () -> Void

    @State private var cfg = RunConfig()

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 2) {
                Text("🏊 Start Workout").font(.title2.weight(.heavy)).foregroundStyle(Brand.text)
                Text("Rest between sets").font(.footnote).foregroundStyle(Brand.textDim)
            }

            HStack(spacing: 8) {
                ForEach(RestOption.all) { opt in
                    let active = cfg.rest == opt
                    Button { cfg.rest = opt } label: {
                        Text(opt.label).font(.caption.weight(.bold))
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .foregroundStyle(active ? Brand.primary : Brand.textMuted)
                            .background(active ? Brand.currentDevice : Brand.bg, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Brand.primary : Brand.border, lineWidth: active ? 2 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            toggleRow(icon: "🔔", title: "Audio cues",
                      on: cfg.audioCues, onLabel: "ON · preview ▶", offLabel: "OFF") {
                if !cfg.audioCues { audio.activate(); audio.beep() }   // prime + preview
                cfg.audioCues.toggle()
            }

            toggleRow(icon: "✋", title: "Lap button",
                      on: cfg.lapButton, onLabel: "ON · per-rep splits", offLabel: "OFF · auto-advance only") {
                cfg.lapButton.toggle()
            }

            HStack(spacing: 10) {
                Button(action: onCancel) {
                    Text("Cancel").font(.callout.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 14)
                }
                .buttonStyle(.bordered).tint(Brand.textMuted)

                Button {
                    if cfg.audioCues { audio.activate() }
                    onStart(cfg)
                } label: {
                    Label("Start", systemImage: "play.fill").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent).tint(Brand.primary)
            }
        }
        .padding(24)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Brand.border, lineWidth: 1))
        .padding(24)
    }

    private func toggleRow(icon: String, title: String, on: Bool, onLabel: String, offLabel: String,
                           _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            HStack {
                Text("\(icon) \(title)").font(.subheadline.weight(.bold))
                Spacer()
                Text(on ? onLabel : offLabel).font(.caption2.weight(.semibold))
            }
            .foregroundStyle(on ? Brand.primary : Brand.textMuted)
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(on ? Brand.currentDevice : Brand.bg, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(on ? Brand.primary : Brand.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Run step

/// One thing to do in run mode — a swim set or a dryland exercise.
struct RunStep: Identifiable {
    let id = UUID()
    let sectionLabel: String
    let title: String
    let detail: String?
    let interval: String?
    let focus: String?
    let reps: Int
    /// Parsed interval in seconds, or nil for "no interval" / dryland.
    let intervalSecs: Int?

    static func build(from workout: Workout) -> [RunStep] {
        var out: [RunStep] = []
        for block in workout.blocks {
            if block.isDryland {
                for ex in block.exercises ?? [] {
                    var parts: [String] = []
                    if let reps = ex.reps, !reps.isEmpty { parts.append(reps) }
                    if let rest = ex.rest, !rest.isEmpty { parts.append("rest \(rest)") }
                    out.append(RunStep(sectionLabel: block.name ?? "Dryland", title: ex.name ?? "Exercise",
                                       detail: parts.isEmpty ? nil : parts.joined(separator: " · "),
                                       interval: nil, focus: nil, reps: ex.sets ?? 1, intervalSecs: nil))
                }
            } else {
                for s in block.sets ?? [] {
                    out.append(RunStep(sectionLabel: block.name ?? sectionDisplayTitle(block.section),
                                       title: s.repsByDist, detail: s.desc, interval: s.interval, focus: s.focus,
                                       reps: s.reps ?? 1, intervalSecs: IntervalFormat.parseSeconds(s.interval)))
                }
            }
        }
        return out
    }
}
