import SwiftUI

/// Loads the single composite `bootstrap` payload and renders the signed-in
/// dashboard: a greeting, account/curation summary, and recent workouts (with
/// the section-aware block renderer). Deliberately ONE network call on appear —
/// no fan-out — per the rate-limit guardrail.
@MainActor
final class HomeViewModel: ObservableObject {
    enum Phase: Equatable {
        case idle, loading, loaded, failed(String)
    }

    @Published var phase: Phase = .idle
    @Published var bootstrap: Bootstrap?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load(force: Bool = false) async {
        if case .loaded = phase, !force { return }
        phase = .loading
        do {
            let data = try await api.get("me/bootstrap", as: Bootstrap.self)
            bootstrap = data
            phase = .loaded
        } catch let err as APIError {
            // 401 is handled by AuthManager (it bounces to sign-in); show the rest.
            phase = .failed(err.errorDescription ?? "Something went wrong.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var auth: AuthManager
    @StateObject private var model = HomeViewModel()
    @State private var showSessions = false
    @State private var profileTarget: ProfileTarget?
    @State private var showFeedback = false
    @State private var showHistory = false
    @State private var showAssigned = false
    @State private var showPractices = false
    @State private var showPaywall = false
    @State private var runningWorkout: Workout?
    // B9 — Siri/Shortcuts quick-generate routing.
    @ObservedObject private var quick = QuickGenerate.shared
    @State private var showQuickGenerate = false
    @State private var quickYards: Int?

    // Wrapper so the profile sheet is driven by data, never presented empty.
    struct ProfileTarget: Identifiable {
        let id = UUID()
        let me: Me
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("SetForge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarMenu }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .sheet(isPresented: $showSessions) {
                SessionsView(initial: model.bootstrap?.sessions ?? [])
            }
            .sheet(item: $profileTarget) { target in
                ProfileView(me: target.me) { Task { await model.load(force: true) } }
            }
            .sheet(isPresented: $showFeedback) { FeedbackView() }
            .sheet(isPresented: $showHistory) {
                HistoryView(workouts: model.bootstrap?.workouts ?? [],
                            poolMode: model.bootstrap?.poolMode,
                            onImported: { Task { await model.load(force: true) } })
            }
            .sheet(isPresented: $showAssigned) { AssignedView() }
            .sheet(isPresented: $showPractices) { PracticesView(showNotes: model.bootstrap?.flag("coach_notes") ?? true) }
            .sheet(isPresented: $showPaywall) { PaywallView() }
            .fullScreenCover(item: $runningWorkout) { RunWorkoutView(workout: $0) }
            // B9 — push Generate prefilled + auto-run when Siri/Shortcuts fires.
            .navigationDestination(isPresented: $showQuickGenerate) {
                GenerateView(autoYards: quickYards.map { Double($0) })
            }
            .onChange(of: quick.pendingYards) {
                if let y = quick.pendingYards {
                    quickYards = y
                    showQuickGenerate = true
                    quick.pendingYards = nil
                }
            }
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .idle, .loading:
            ProgressView().tint(Brand.textMuted)
        case .failed(let message):
            ErrorState(message: message) { Task { await model.load(force: true) } }
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                GreetingCard(me: model.bootstrap?.me,
                             poolMode: model.bootstrap?.poolMode,
                             nextEvent: model.bootstrap?.nextEvent,
                             anchors: model.bootstrap?.upcomingAnchors ?? [])

                NavigationLink {
                    GenerateView()
                } label: {
                    Label("Generate workout", systemImage: "wand.and.stars")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.primary)

                SummaryRow(bootstrap: model.bootstrap)

                let workouts = model.bootstrap?.workouts ?? []
                if workouts.isEmpty {
                    EmptyWorkouts()
                } else {
                    HStack {
                        Text("Recent workouts").font(.headline).foregroundStyle(Brand.text)
                        Spacer()
                        if workouts.count > 3 {
                            Button("See all (\(workouts.count))") { showHistory = true }
                                .font(.caption.weight(.semibold)).tint(Brand.primary)
                        }
                    }
                    ForEach(workouts.prefix(3)) { workout in
                        CollapsibleWorkoutCard(workout: workout) { runningWorkout = workout }
                    }
                }
            }
            .padding()
            .readableWidth()
        }
        .refreshable { await model.load(force: true) }
    }

    @ToolbarContentBuilder
    private var toolbarMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                // Grouped into labelled sections so the menu reads cleanly and the
                // destructive Sign out sits in its own divider-separated section at
                // the bottom (instead of being one more anonymous row that scrolls
                // out of view at large Dynamic Type sizes).
                Section("Workouts") {
                    Button {
                        showAssigned = true
                    } label: {
                        Label("Assigned to me", systemImage: "tray.and.arrow.down")
                    }
                    // Practices = roll-call/attendance. Phase 6: hidden when a team
                    // turns the `attendance` bundle off (generate-for stays CORE).
                    if model.bootstrap?.me?.coaches == true && (model.bootstrap?.flag("attendance") ?? true) {
                        Button {
                            showPractices = true
                        } label: {
                            Label("Practices", systemImage: "calendar.badge.checkmark")
                        }
                    }
                    Button {
                        showHistory = true
                    } label: {
                        Label("All workouts", systemImage: "list.bullet.rectangle")
                    }
                }
                Section("Account") {
                    // Upgrade — only when IAP is configured and the user is still on
                    // the free tier (no point showing it to active subscribers).
                    if AppConfig.iapConfigured && (model.bootstrap?.billing?.status ?? "free") == "free" {
                        Button {
                            showPaywall = true
                        } label: {
                            Label("Upgrade to Coach", systemImage: "star.circle")
                        }
                    }
                    Button {
                        if let me = model.bootstrap?.me { profileTarget = ProfileTarget(me: me) }
                    } label: {
                        Label("Edit profile", systemImage: "person.text.rectangle")
                    }
                    .disabled(model.bootstrap?.me == nil)
                    Button {
                        showSessions = true
                    } label: {
                        Label("Devices & sessions", systemImage: "laptopcomputer.and.iphone")
                    }
                    Button {
                        showFeedback = true
                    } label: {
                        Label("Send feedback", systemImage: "bubble.left.and.text.bubble.right")
                    }
                }
                Section {
                    Button(role: .destructive) {
                        Task { await auth.signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            } label: {
                Image(systemName: "person.crop.circle")
                    .foregroundStyle(Brand.text)
            }
        }
    }
}

// MARK: - Pieces

private struct GreetingCard: View {
    let me: Me?
    let poolMode: String?
    var nextEvent: NextEvent? = nil
    var anchors: [GroupAnchor] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Welcome back\(me?.firstName.map { ", \($0)" } ?? "")")
                .font(.title2.weight(.bold))
                .foregroundStyle(Brand.text)
            HStack(spacing: 10) {
                if let pool = poolMode {
                    Tag(text: PoolMode.label(pool), color: Brand.primary)
                }
                if let count = me?.workoutCount {
                    Tag(text: "\(count) workouts", color: Brand.border)
                }
                if me?.isAdmin == true {
                    Tag(text: "Admin", color: Brand.warn)
                }
            }
            if nextEvent != nil || !anchors.isEmpty {
                eventPills
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.border, lineWidth: 1))
    }

    /// Individual "Next event" + team/meet countdown anchors, as pills.
    private var eventPills: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Team/meet anchors (🎯 "N wks to <event>"). Nearest first.
            ForEach(anchors) { a in
                EventPill(icon: "🎯", text: anchorText(a), color: Brand.warn)
            }
            // Individual next event (🏁 name · date).
            if let ev = nextEvent {
                EventPill(icon: "🏁",
                          text: ev.date.map { "\(ev.name) · \($0)" } ?? ev.name,
                          color: Brand.primary)
            }
        }
        .padding(.top, 2)
    }

    private func anchorText(_ a: GroupAnchor) -> String {
        let name = a.eventName ?? "event"
        let when: String
        switch a.weeksOut ?? -1 {
        case 0:  when = "This week"
        case 1:  when = "1 wk to"
        case let w where w > 1: when = "\(w) wks to"
        default: when = "Upcoming"
        }
        return "\(when) \(name)"
    }
}

/// A small event pill (emoji + text), matching the greeting-card tag style.
private struct EventPill: View {
    let icon: String
    let text: String
    let color: Color
    var body: some View {
        HStack(spacing: 5) {
            Text(icon).font(.caption2)
            Text(text).font(.caption.weight(.semibold)).foregroundStyle(Brand.text)
                .lineLimit(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }
}

private struct SummaryRow: View {
    let bootstrap: Bootstrap?

    var body: some View {
        HStack(spacing: 12) {
            Stat(value: "\(bootstrap?.favoriteSetCount ?? 0)", label: "Favorite sets")
            Stat(value: "\(bootstrap?.effectiveFavoriteCount ?? 0)", label: "Effective")
            Stat(value: "\(bootstrap?.sessions?.count ?? 0)", label: "Devices")
        }
    }
}

private struct Stat: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.weight(.bold)).foregroundStyle(Brand.text)
            Text(label).font(.caption2).foregroundStyle(Brand.textDim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
    }
}

struct Tag: View {
    let text: String
    let color: Color
    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Brand.text)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.25), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.5), lineWidth: 1))
    }
}

private struct EmptyWorkouts: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.pool.swim").font(.largeTitle).foregroundStyle(Brand.textDim)
            Text("No workouts yet").font(.headline).foregroundStyle(Brand.text)
            Text("Generated and assigned workouts will appear here.")
                .font(.footnote).foregroundStyle(Brand.textDim)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }
}

private struct ErrorState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(Brand.warn)
            Text(message).foregroundStyle(Brand.textMuted).multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
