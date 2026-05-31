import SwiftUI

/// Full workout history — every workout from bootstrap as a collapsible row.
struct HistoryView: View {
    let workouts: [Workout]
    @Environment(\.dismiss) private var dismiss
    @State private var running: Workout?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                if workouts.isEmpty {
                    Text("No workouts yet.").foregroundStyle(Brand.textMuted)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
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
        }
    }
}
