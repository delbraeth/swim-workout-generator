import SwiftUI

/// A coach-assigned workout (`GET /api/me/assignments`).
struct Assignment: Decodable, Identifiable {
    let id: Int
    let groupName: String?
    let coachName: String?
    let assignedAt: String?
    let completionState: String?
    let workout: Workout?

    enum CodingKeys: String, CodingKey {
        case id, workout
        case groupName = "group_name"
        case coachName = "coach_name"
        case assignedAt = "assigned_at"
        case completionState = "completion_state"
    }

    var subtitle: String? {
        var parts: [String] = []
        if let g = groupName, !g.isEmpty { parts.append(g) }
        if let c = coachName, c != "(unknown)", !c.isEmpty { parts.append("Coach \(c)") }
        if completionState == "completed" || completionState == "done" { parts.append("✓ done") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

@MainActor
final class AssignedViewModel: ObservableObject {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    @Published var phase: Phase = .loading
    @Published var items: [Assignment] = []

    func load() async {
        phase = .loading
        do {
            items = try await APIClient.shared.get("me/assignments", as: [Assignment].self)
            phase = .loaded
        } catch let e as APIError {
            phase = .failed(e.errorDescription ?? "Couldn't load assignments.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Workouts a coach assigned to this swimmer.
struct AssignedView: View {
    @StateObject private var model = AssignedViewModel()
    @Environment(\.dismiss) private var dismiss
    @State private var running: Workout?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("Assigned to me")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.tint(Brand.primary)
                }
            }
            .task { await model.load() }
            .fullScreenCover(item: $running) { RunWorkoutView(workout: $0) }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(Brand.textMuted)
        case .failed(let message):
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(Brand.warn)
                Text(message).foregroundStyle(Brand.textMuted).multilineTextAlignment(.center)
                Button("Try again") { Task { await model.load() } }.tint(Brand.primary)
            }.padding()
        case .loaded:
            if model.items.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tray").font(.largeTitle).foregroundStyle(Brand.textDim)
                    Text("Nothing assigned").font(.headline).foregroundStyle(Brand.text)
                    Text("Workouts your coach assigns show up here.")
                        .font(.footnote).foregroundStyle(Brand.textDim).multilineTextAlignment(.center)
                }.padding()
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(model.items) { a in
                            if let w = a.workout {
                                CollapsibleWorkoutCard(workout: w, subtitle: a.subtitle) { running = w }
                            }
                        }
                    }
                    .padding()
                    .readableWidth()
                }
            }
        }
    }
}
