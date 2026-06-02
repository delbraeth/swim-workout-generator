import SwiftUI

/// Coach notes for one swimmer. Lists existing notes (those the caller can see)
/// and lets the coach add a new one with a visibility scope. Opened from a
/// roster member. Identity is exactly one of swimmerSub / managedId.
@MainActor
final class CoachNotesViewModel: ObservableObject {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    @Published var phase: Phase = .loading
    @Published var notes: [CoachNote] = []
    @Published var draft = ""
    @Published var visibility: NoteVisibility = .private
    @Published var saving = false
    @Published var saveError: String?

    let swimmerSub: String?
    let managedId: String?   // "ms_xxxxxx" string

    init(swimmerSub: String?, managedId: String?) {
        self.swimmerSub = swimmerSub
        self.managedId = managedId
    }

    private var query: [URLQueryItem] {
        if let s = swimmerSub { return [URLQueryItem(name: "swimmer_sub", value: s)] }
        if let m = managedId { return [URLQueryItem(name: "managed_id", value: m)] }
        return []
    }

    func load() async {
        phase = .loading
        do {
            let list = try await APIClient.shared.get("coach-notes", query: query, as: [CoachNote].self)
            notes = list
            phase = .loaded
        } catch let e as APIError {
            phase = .failed(e.errorDescription ?? "Couldn't load notes.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func save() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        saving = true; saveError = nil
        let body = CoachNoteCreate(swimmerSub: swimmerSub, managedId: managedId,
                                   visibility: visibility.rawValue, body: text)
        do {
            _ = try await APIClient.shared.post("coach-notes", body: body, as: OkResponse.self)
            draft = ""
            await load()                 // refresh to show the new note
        } catch let e as APIError {
            saveError = e.errorDescription ?? "Couldn't save the note."
        } catch {
            saveError = error.localizedDescription
        }
        saving = false
    }
}

struct CoachNotesSheet: View {
    let title: String
    @StateObject private var model: CoachNotesViewModel
    @Environment(\.dismiss) private var dismiss

    init(title: String, swimmerSub: String?, managedId: String?) {
        self.title = title
        _model = StateObject(wrappedValue: CoachNotesViewModel(swimmerSub: swimmerSub, managedId: managedId))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        composer
                        Divider().overlay(Brand.border)
                        notesList
                    }
                    .padding()
                    .readableWidth()
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.tint(Brand.primary)
                }
            }
            .task { await model.load() }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ADD A NOTE")
                .font(.caption.weight(.heavy)).foregroundStyle(Brand.textMuted)
            TextField("What should the coaching staff know?", text: $model.draft, axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
                .foregroundStyle(Brand.text)
            Picker("Visibility", selection: $model.visibility) {
                ForEach(NoteVisibility.allCases) { v in Text(v.label).tag(v) }
            }
            .pickerStyle(.segmented)
            if let err = model.saveError {
                Text(err).font(.caption).foregroundStyle(Brand.warn)
            }
            Button {
                Task { await model.save() }
            } label: {
                HStack {
                    if model.saving { ProgressView().tint(.white) }
                    Text(model.saving ? "Saving…" : "Add note").font(.headline)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent).tint(Brand.primary)
            .disabled(model.saving || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    @ViewBuilder
    private var notesList: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(Brand.textMuted).frame(maxWidth: .infinity)
        case .failed(let msg):
            Text(msg).font(.footnote).foregroundStyle(Brand.warn)
        case .loaded:
            if model.notes.isEmpty {
                Text("No notes yet.").font(.footnote).foregroundStyle(Brand.textDim)
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
            } else {
                ForEach(model.notes) { note in noteCard(note) }
            }
        }
    }

    private func noteCard(_ note: CoachNote) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(note.body ?? "").font(.body).foregroundStyle(Brand.text)
            HStack(spacing: 8) {
                if let author = note.authorName {
                    Text(author).font(.caption2.weight(.semibold)).foregroundStyle(Brand.textMuted)
                }
                if let vis = note.visibility.flatMap({ NoteVisibility(rawValue: $0) }) {
                    Text(vis.label).font(.caption2).foregroundStyle(Brand.textDim)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Brand.card, in: Capsule())
                }
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
    }
}
