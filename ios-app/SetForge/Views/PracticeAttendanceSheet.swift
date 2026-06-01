import SwiftUI

/// Take attendance for a scheduled practice. Everyone defaults to PRESENT; we
/// track who's marked ABSENT (mirrors the web behaviour), then POST /complete.
@MainActor
final class AttendanceViewModel: ObservableObject {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    @Published var phase: Phase = .loading
    @Published var ctx: AttendanceContext?
    @Published var absentKeys: Set<String> = []
    @Published var saving = false
    @Published var saveError: String?
    @Published var saved = false

    func load(id: Int) async {
        phase = .loading
        do {
            let context = try await APIClient.shared.get(
                "scheduled-workouts/\(id)/attendance-context",
                as: AttendanceContext.self
            )
            ctx = context
            // Seed the absent set from existing attendance rows marked not-present.
            absentKeys = Set(
                context.attendance
                    .filter { !$0.present && !$0.key.isEmpty }
                    .map { $0.key }
            )
            phase = .loaded
        } catch let e as APIError {
            if case .server(let status, _) = e, status == 403 {
                phase = .failed("You don't coach this practice's group, so you can't take attendance.")
            } else {
                phase = .failed(e.errorDescription ?? "Couldn't load attendance.")
            }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func toggle(_ key: String) {
        if absentKeys.contains(key) { absentKeys.remove(key) }
        else { absentKeys.insert(key) }
    }

    func isPresent(_ key: String) -> Bool { !absentKeys.contains(key) }

    var presentCount: Int {
        guard let roster = ctx?.roster else { return 0 }
        return roster.filter { isPresent($0.key) }.count
    }

    var hasRoster: Bool { !(ctx?.roster.isEmpty ?? true) }

    func save(id: Int, onSaved: @escaping () -> Void, dismiss: @escaping () -> Void) async {
        guard let roster = ctx?.roster, !roster.isEmpty else { return }
        saving = true
        saveError = nil
        let marks: [AttendanceMark] = roster.map { m in
            AttendanceMark(
                swimmerSub: m.memberSwimmerSub,
                managedId: m.memberSwimmerSub == nil ? m.memberManagedId : nil,
                present: isPresent(m.key)
            )
        }
        let body = CompleteRequest(completedAt: nil, attendance: marks)
        do {
            _ = try await APIClient.shared.post(
                "scheduled-workouts/\(id)/complete",
                body: body,
                as: CompleteResponse.self
            )
            saved = true
            saving = false
            onSaved()
            dismiss()
        } catch let e as APIError {
            saving = false
            saveError = e.errorDescription ?? "Couldn't save attendance."
        } catch {
            saving = false
            saveError = error.localizedDescription
        }
    }
}

struct PracticeAttendanceSheet: View {
    let practice: ScheduledWorkoutSummary
    let onSaved: () -> Void

    @StateObject private var model = AttendanceViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("Attendance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }.tint(Brand.textMuted)
                }
            }
            .task { await model.load(id: practice.serverId) }
            .presentationDetents([.large])
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(Brand.textMuted)
        case .failed(let message):
            VStack(spacing: 12) {
                Image(systemName: "lock.slash").font(.largeTitle).foregroundStyle(Brand.warn)
                Text(message).foregroundStyle(Brand.textMuted).multilineTextAlignment(.center)
                Button("Try again") { Task { await model.load(id: practice.serverId) } }
                    .buttonStyle(.borderedProminent).tint(Brand.primary)
            }.padding()
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    if model.hasRoster {
                        ForEach(model.ctx?.roster ?? []) { member in
                            memberRow(member)
                        }
                    } else {
                        noGroupState
                    }
                }
                .padding()
                .readableWidth()
            }
            if model.hasRoster {
                footer
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(PracticeDateFormat.pretty(practice.scheduledDate))
                .font(.title3.weight(.bold)).foregroundStyle(Brand.text)
            if model.hasRoster {
                Text("\(model.presentCount) of \(model.ctx?.roster.count ?? 0) present")
                    .font(.subheadline).foregroundStyle(Brand.textMuted)
            }
            if practice.isCompleted || (model.ctx?.completedAt != nil) {
                Text("Already marked done — re-submitting will update attendance.")
                    .font(.caption).foregroundStyle(Brand.positive)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var noGroupState: some View {
        VStack(spacing: 8) {
            Image(systemName: "person.2.slash").font(.largeTitle).foregroundStyle(Brand.textDim)
            Text("No roster to take").font(.headline).foregroundStyle(Brand.text)
            Text("This practice isn't tied to a group, so there's no roster to take.")
                .font(.footnote).foregroundStyle(Brand.textDim)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }

    private func memberRow(_ member: RosterMember) -> some View {
        let present = model.isPresent(member.key)
        let name = displayName(for: member)
        return Button {
            model.toggle(member.key)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: present ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(present ? Brand.positive : Brand.textDim)
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.body)
                        .foregroundStyle(present ? Brand.text : Brand.warn)
                        .strikethrough(!present, color: Brand.warn)
                    if let role = member.role, !role.isEmpty {
                        Text(role.capitalized).font(.caption2).foregroundStyle(Brand.textDim)
                    }
                }
                Spacer()
                if !present {
                    Text("Absent")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Brand.warn)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(present ? Brand.border : Brand.warn.opacity(0.5), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func displayName(for member: RosterMember) -> String {
        if let n = member.displayName, !n.isEmpty { return n }
        if let i = member.initials, !i.isEmpty { return i }
        return "(no name)"
    }

    private var footer: some View {
        VStack(spacing: 8) {
            if let err = model.saveError {
                Text(err).font(.caption).foregroundStyle(Brand.warn)
                    .multilineTextAlignment(.center)
            }
            Button {
                Task {
                    await model.save(
                        id: practice.serverId,
                        onSaved: onSaved,
                        dismiss: { dismiss() }
                    )
                }
            } label: {
                HStack {
                    if model.saving { ProgressView().tint(.white) }
                    Text(model.saving ? "Saving…" : "Mark done")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.primary)
            .disabled(model.saving || !model.hasRoster)
        }
        .padding()
        .background(Brand.bg)
    }
}
