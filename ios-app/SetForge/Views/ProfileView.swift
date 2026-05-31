import SwiftUI

private enum GenderOption: String, CaseIterable, Identifiable {
    case male = "M", female = "F", other = "X", na = "prefer_not_to_say"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .male:   return "Male"
        case .female: return "Female"
        case .other:  return "Other"
        case .na:     return "Prefer not to say"
        }
    }
}

struct ProfileUpdate: Encodable {
    let display_name: String?
    let gender: String?
    let class_year: Int?
    let usa_swimming_id: String?
}

/// Edit profile fields the server allows on `PATCH /api/me`
/// (display_name, gender, class_year, usa_swimming_id).
struct ProfileView: View {
    let me: Me
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var gender: GenderOption?
    @State private var classYear: String
    @State private var usaId: String
    @State private var saving = false
    @State private var error: String?

    init(me: Me, onSaved: @escaping () -> Void) {
        self.me = me
        self.onSaved = onSaved
        _name = State(initialValue: me.displayName ?? "")
        _gender = State(initialValue: me.gender.flatMap(GenderOption.init(rawValue:)))
        _classYear = State(initialValue: me.classYear.map(String.init) ?? "")
        _usaId = State(initialValue: me.usaSwimmingId ?? "")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        field("Display name") {
                            TextField("Name", text: $name).textInputAutocapitalization(.words)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            label("Gender")
                            Picker("Gender", selection: $gender) {
                                Text("—").tag(GenderOption?.none)
                                ForEach(GenderOption.allCases) { g in Text(g.label).tag(GenderOption?.some(g)) }
                            }
                            .pickerStyle(.menu).tint(Brand.text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12).background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
                        }
                        field("Graduation year") {
                            TextField("e.g. 2027", text: $classYear).keyboardType(.numberPad)
                        }
                        field("USA Swimming ID") {
                            TextField("Optional", text: $usaId).autocorrectionDisabled().textInputAutocapitalization(.characters)
                        }
                        if let error { InlineProfileError(error) }
                    }
                    .padding()
                    .readableWidth(480)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.tint(Brand.textMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }.disabled(saving).tint(Brand.primary)
                }
            }
        }
    }

    private func label(_ t: String) -> some View {
        Text(t.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(Brand.textDim)
    }

    private func field<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            label(title)
            content()
                .foregroundStyle(Brand.text)
                .padding(12).background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
        }
    }

    private func save() async {
        saving = true; error = nil
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedId = usaId.trimmingCharacters(in: .whitespaces)
        let body = ProfileUpdate(
            display_name: trimmedName.isEmpty ? nil : trimmedName,
            gender: gender?.rawValue,
            class_year: Int(classYear),
            usa_swimming_id: trimmedId.isEmpty ? nil : trimmedId
        )
        do {
            _ = try await APIClient.shared.patch("me", body: body, as: AnyCodable.self)
            onSaved()
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

private struct InlineProfileError: View {
    let message: String
    init(_ m: String) { message = m }
    var body: some View {
        Text(message).font(.footnote).foregroundStyle(Brand.destructive)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}
