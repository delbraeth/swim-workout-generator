import SwiftUI

/// Full workout history — every workout from bootstrap as a collapsible row.
struct HistoryView: View {
    let workouts: [Workout]
    /// B14b — the swimmer's pool unit, used to convert imported Watch swims.
    var poolMode: String? = nil
    /// B14b — called after a successful import so the caller can refresh history.
    var onImported: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var running: Workout?
    @State private var importing = false
    @State private var importMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                if workouts.isEmpty {
                    VStack(spacing: 16) {
                        Text("No workouts yet.").foregroundStyle(Brand.textMuted)
                        if HealthKitManager.shared.isAvailable { importButton }
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            if HealthKitManager.shared.isAvailable { importButton }
                            ForEach(workouts) { w in
                                CollapsibleWorkoutCard(workout: w) { running = w }
                            }
                        }
                        .padding()
                        .readableWidth()
                    }
                }
            }
            .navigationTitle("All workouts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.tint(Brand.primary)
                }
            }
            .fullScreenCover(item: $running) { RunWorkoutView(workout: $0) }
            .alert("Apple Health", isPresented: Binding(get: { importMessage != nil }, set: { if !$0 { importMessage = nil } })) {
                Button("OK", role: .cancel) { importMessage = nil }
            } message: {
                Text(importMessage ?? "")
            }
        }
    }

    /// B14b — pull Apple-Watch-tracked pool swims into SetForge history.
    private var importButton: some View {
        Button {
            Task { await runImport() }
        } label: {
            HStack {
                if importing { ProgressView().tint(Brand.textMuted) }
                Label(importing ? "Importing…" : "Import Apple Watch swims", systemImage: "heart.text.square")
                    .font(.subheadline.weight(.semibold))
            }
            .frame(maxWidth: .infinity).padding(.vertical, 6)
        }
        .buttonStyle(.bordered).tint(Brand.primary)
        .disabled(importing)
    }

    private func runImport() async {
        importing = true
        let result = await HealthKitManager.shared.importRecentSwims(poolMode: poolMode ?? "25y")
        importing = false
        importMessage = result.summary
        if result.imported > 0 { onImported?() }
    }
}
