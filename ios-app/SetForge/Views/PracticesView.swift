import SwiftUI

/// COACH ROLL-CALL entry point: the user's scheduled practices for the current
/// week, with a tap-through to take attendance.
@MainActor
final class PracticesViewModel: ObservableObject {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    @Published var phase: Phase = .loading
    @Published var practices: [ScheduledWorkoutSummary] = []

    /// "yyyy-MM-dd" in the user's local timezone (POSIX locale for stability).
    private static let ymd: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    func load() async {
        phase = .loading
        let (start, end) = Self.currentWeekRange()
        do {
            practices = try await APIClient.shared.get(
                "scheduled-workouts",
                query: [
                    URLQueryItem(name: "start", value: start),
                    URLQueryItem(name: "end", value: end),
                ],
                as: [ScheduledWorkoutSummary].self
            )
            // Earliest first within the week.
            practices.sort { $0.scheduledDate < $1.scheduledDate }
            phase = .loaded
        } catch let e as APIError {
            phase = .failed(e.errorDescription ?? "Couldn't load practices.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Current week, Monday→Sunday, in the local timezone.
    static func currentWeekRange(now: Date = Date()) -> (String, String) {
        var cal = Calendar.current
        cal.firstWeekday = 2 // Monday
        let interval = cal.dateInterval(of: .weekOfYear, for: now)
        let start = interval?.start ?? now
        // dateInterval.end is the start of the NEXT week; back off one day for Sunday.
        let end = interval.map { cal.date(byAdding: .day, value: -1, to: $0.end) ?? $0.end } ?? now
        return (ymd.string(from: start), ymd.string(from: end))
    }
}

struct PracticesView: View {
    /// Phase 6: whether the team shows the coach-notes affordance (`coach_notes`
    /// bundle). Threaded down to the attendance roster. Defaults on.
    var showNotes: Bool = true

    @StateObject private var model = PracticesViewModel()
    @Environment(\.dismiss) private var dismiss
    @State private var selected: ScheduledWorkoutSummary?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("Practices")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.tint(Brand.primary)
                }
            }
            .task { await model.load() }
            .sheet(item: $selected) { practice in
                PracticeAttendanceSheet(practice: practice, showNotes: showNotes) {
                    Task { await model.load() }
                }
            }
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
                Button("Try again") { Task { await model.load() } }
                    .buttonStyle(.borderedProminent).tint(Brand.primary)
            }.padding()
        case .loaded:
            if model.practices.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar").font(.largeTitle).foregroundStyle(Brand.textDim)
                    Text("No practices scheduled this week")
                        .font(.headline).foregroundStyle(Brand.text)
                        .multilineTextAlignment(.center)
                    Text("Scheduled practices for the current week show up here.")
                        .font(.footnote).foregroundStyle(Brand.textDim)
                        .multilineTextAlignment(.center)
                }.padding()
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(model.practices) { p in
                            Button { selected = p } label: {
                                PracticeRow(practice: p)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                    .readableWidth()
                }
                .refreshable { await model.load() }
            }
        }
    }
}

private struct PracticeRow: View {
    let practice: ScheduledWorkoutSummary

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(PracticeDateFormat.pretty(practice.scheduledDate))
                    .font(.headline).foregroundStyle(Brand.text)
                if let facility = practice.facilityName, !facility.isEmpty {
                    Text(facility).font(.caption).foregroundStyle(Brand.textMuted)
                }
            }
            Spacer()
            statusChip
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold)).foregroundStyle(Brand.textDim)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.border, lineWidth: 1))
    }

    private var statusChip: some View {
        let done = practice.isCompleted
        return Text(done ? "Done" : "Mark attendance")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Brand.text)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((done ? Brand.positive : Brand.primary).opacity(0.25), in: Capsule())
            .overlay(Capsule().stroke((done ? Brand.positive : Brand.primary).opacity(0.5), lineWidth: 1))
    }
}

/// Shared date formatting for the practices surface.
enum PracticeDateFormat {
    private static let parse: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let display: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.timeZone = .current
        f.dateFormat = "EEE, MMM d"
        return f
    }()

    /// "yyyy-MM-dd" → "Mon, Jun 2" (falls back to the raw string).
    static func pretty(_ ymd: String) -> String {
        guard let d = parse.date(from: ymd) else { return ymd }
        return display.string(from: d)
    }
}
