import SwiftUI

private enum FeedbackCategory: String, CaseIterable, Identifiable {
    case bug, feature, praise, question
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct FeedbackRequest: Encodable {
    let category: String
    let subject: String?
    let body: String
    let page: String?
}

private struct FeedbackResponse: Decodable { let ok: Bool?; let id: String? }

/// Submit feedback (`POST /api/feedback`).
struct FeedbackView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var category: FeedbackCategory = .bug
    @State private var subject = ""
    @State private var message = ""
    @State private var sending = false
    @State private var sent = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Picker("Category", selection: $category) {
                            ForEach(FeedbackCategory.allCases) { c in Text(c.label).tag(c) }
                        }
                        .pickerStyle(.segmented)

                        TextField("Subject (optional)", text: $subject)
                            .textInputAutocapitalization(.sentences)
                            .padding(12).foregroundStyle(Brand.text)
                            .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))

                        ZStack(alignment: .topLeading) {
                            if message.isEmpty {
                                Text("What's on your mind?").foregroundStyle(Brand.textDim).padding(16)
                            }
                            TextEditor(text: $message)
                                .scrollContentBackground(.hidden)
                                .foregroundStyle(Brand.text)
                                .frame(minHeight: 160)
                                .padding(8)
                        }
                        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))

                        if sent {
                            Label("Thanks — feedback sent", systemImage: "checkmark.circle.fill")
                                .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.positive)
                        }
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(Brand.destructive)
                        }
                    }
                    .padding()
                    .readableWidth(480)
                }
            }
            .navigationTitle("Send feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.tint(Brand.textMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { await send() } }
                        .disabled(sending || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .tint(Brand.primary)
                }
            }
        }
    }

    private func send() async {
        sending = true; error = nil
        let trimmedSubject = subject.trimmingCharacters(in: .whitespaces)
        let body = FeedbackRequest(
            category: category.rawValue,
            subject: trimmedSubject.isEmpty ? nil : trimmedSubject,
            body: message.trimmingCharacters(in: .whitespacesAndNewlines),
            page: "ios"
        )
        do {
            _ = try await APIClient.shared.post("feedback", body: body, as: FeedbackResponse.self)
            sent = true
            try? await Task.sleep(nanoseconds: 700_000_000)
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        sending = false
    }
}
