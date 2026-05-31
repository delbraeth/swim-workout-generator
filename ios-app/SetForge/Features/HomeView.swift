import SwiftUI
import SetForgeKit

/// The signed-in shell for milestone 1: shows the bootstrapped profile, the
/// per-pool rollups, and the workout history. It's intentionally read-only —
/// generation/logging arrive in later milestones — but it proves the full
/// auth + data-spine round-trip end to end.
struct HomeView: View {
    @EnvironmentObject private var env: AppEnvironment

    var body: some View {
        NavigationStack {
            List {
                if let user = env.user {
                    profileSection(user)
                    statsSection(user)
                }
                if let next = env.settings?.nextEvent {
                    Section("Next event") {
                        LabeledContent(next.name, value: next.date)
                    }
                }
                workoutsSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("SetForge")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign out", role: .destructive) { env.signOut() }
                }
            }
            .refreshable { await env.loadBootstrap(initial: false) }
            .overlay { if env.isWorking && env.workouts.isEmpty { ProgressView() } }
        }
    }

    private func profileSection(_ user: User) -> some View {
        Section {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(.tint.opacity(0.15))
                    Text(user.initials ?? String(user.displayName.prefix(2)).uppercased())
                        .font(.headline)
                        .foregroundStyle(.tint)
                }
                .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 2) {
                    Text(user.displayName).font(.headline)
                    if let email = user.email {
                        Text(email).font(.caption).foregroundStyle(.secondary)
                    }
                    if user.isCoach {
                        Text("Coach").font(.caption2).foregroundStyle(.tint)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func statsSection(_ user: User) -> some View {
        Section("Totals") {
            LabeledContent("Workouts logged", value: "\(user.workoutCount)")
            ForEach(user.statsByPool, id: \.poolMode) { stat in
                LabeledContent(stat.poolMode.displayCode) {
                    Text("\(stat.count) · \(stat.total.formatted()) \(stat.poolMode == .scy ? "yd" : "m")")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var workoutsSection: some View {
        Section("History") {
            if env.workouts.isEmpty {
                Text("No workouts yet.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(env.workouts) { workout in
                    WorkoutRow(workout: workout)
                }
            }
        }
    }
}

/// One row in the workout history list.
struct WorkoutRow: View {
    let workout: Workout

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(workout.type.rawValue.capitalized)
                    .font(.body.weight(.medium))
                HStack(spacing: 6) {
                    Text("\(workout.totalYards.formatted()) \(workout.poolMode == .scy ? "yd" : "m")")
                    Text("·")
                    Text(workout.poolMode.displayCode)
                    if let date = workout.dateCompleted {
                        Text("·")
                        Text(date)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            if workout.completed {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
        }
        .padding(.vertical, 2)
    }
}
