import SwiftUI

/// Device-management UI. Seeds from the sessions already delivered by
/// `bootstrap` (no fetch on open), with pull-to-refresh hitting
/// `GET /api/auth/sessions` and a "sign out everywhere else" action.
struct SessionsView: View {
    let initial: [AuthSession]

    @Environment(\.dismiss) private var dismiss
    @State private var sessions: [AuthSession]
    @State private var revoking = false
    @State private var message: String?

    init(initial: [AuthSession]) {
        self.initial = initial
        _sessions = State(initialValue: initial)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                List {
                    ForEach(sessions) { session in
                        SessionRow(session: session)
                            .listRowBackground(
                                (session.isCurrent == true ? Brand.currentDevice : Brand.card)
                            )
                    }
                    if sessions.count > 1 {
                        Button(role: .destructive) {
                            Task { await signOutOthers() }
                        } label: {
                            Text(revoking ? "Revoking…" : "Sign out everywhere else")
                        }
                        .disabled(revoking)
                        .listRowBackground(Brand.card)
                    }
                    if let message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(Brand.positive)
                            .listRowBackground(Brand.bg)
                    }
                }
                .scrollContentBackground(.hidden)
                .refreshable { await refresh() }
            }
            .navigationTitle("Devices & sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task { if sessions.isEmpty { await refresh() } }
    }

    private func refresh() async {
        do {
            sessions = try await APIClient.shared.get("auth/sessions", as: [AuthSession].self)
        } catch {
            // Non-fatal; keep whatever we already have.
        }
    }

    private func signOutOthers() async {
        revoking = true
        defer { revoking = false }
        do {
            _ = try await APIClient.shared.post("auth/signout-all-others", as: Empty.self)
            message = "Other devices signed out."
            await refresh()
        } catch {
            message = nil
        }
    }
}

private struct SessionRow: View {
    let session: AuthSession

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(session.userAgent?.prefix(70).description ?? "Unknown device")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.text)
                    .lineLimit(1)
                if session.isCurrent == true {
                    Text("● this device")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Brand.positive)
                }
            }
            HStack {
                Text(session.ip ?? "—")
                if let prefix = session.idPrefix {
                    Text("· \(prefix)")
                }
                if let seen = session.lastSeenAt {
                    Text("· last seen \(seen)")
                }
            }
            .font(.caption2)
            .foregroundStyle(Brand.textDim)
            .lineLimit(1)
        }
        .padding(.vertical, 2)
    }
}
