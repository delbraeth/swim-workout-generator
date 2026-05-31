import SwiftUI

/// The workout generator. Loads the type catalog, collects form inputs, calls
/// `POST /api/generate` (the engine runs server-side — same `generateWorkout` as
/// the web SPA), and renders the result with the shared `WorkoutCard`. Curation
/// (favorites/constraints) is applied server-side from the signed-in user.
@MainActor
final class GenerateViewModel: ObservableObject {
    @Published var types: [WorkoutType] = []
    @Published var typesError: String?
    @Published var loadingTypes = false

    @Published var selectedTypeId: String?
    @Published var maxYards: Double = 3000
    @Published var pool: PoolCourse = .scy
    @Published var bias: SectionBias = .balanced
    @Published var phase: TrainingPhase = .none
    @Published var recoveryMode = false
    /// Sections to include; `main` is always present and not removable.
    @Published var includedSections: Set<String> = Set(WorkoutSectionKind.allCases.map(\.rawValue))
    @Published var equipmentOn: Set<String> = []

    @Published var generating = false
    @Published var genError: String?
    @Published var result: Workout?
    /// Bumped on each successful generate so the view can scroll to the result.
    @Published var resultID = UUID()
    /// The raw engine payload, kept losslessly so Save can re-send every field.
    private var rawWorkout: AnyCodable?

    @Published var saving = false
    @Published var saved = false
    @Published var saveError: String?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func loadTypes() async {
        guard types.isEmpty else { return }
        loadingTypes = true; typesError = nil
        do {
            let resp = try await api.get("workout-types", as: WorkoutTypesResponse.self)
            types = resp.types
            if selectedTypeId == nil { selectedTypeId = types.first?.id }
        } catch let err as APIError {
            typesError = err.errorDescription ?? "Couldn't load workout types."
        } catch {
            typesError = error.localizedDescription
        }
        loadingTypes = false
    }

    func generate() async {
        guard let typeId = selectedTypeId else { return }
        generating = true; genError = nil; result = nil; rawWorkout = nil
        saved = false; saveError = nil
        let equipment = Dictionary(uniqueKeysWithValues: EquipmentItem.all.map { ($0.id, equipmentOn.contains($0.id)) })
        // Ordered, always-includes-main section list.
        let sections = WorkoutSectionKind.allCases
            .map(\.rawValue)
            .filter { includedSections.contains($0) || $0 == WorkoutSectionKind.main.rawValue }
        let req = GenerateRequest(
            typeId: typeId,
            maxYards: Int(maxYards),
            poolMode: pool.rawValue,
            equipment: equipment,
            sectionBias: bias.rawValue,
            recoveryMode: recoveryMode,
            phase: phase == .none ? nil : phase.rawValue,
            includedSections: sections
        )
        do {
            let resp = try await api.post("generate", body: req, as: GenerateResponse.self)
            guard let workout = resp.renderableWorkout() else {
                genError = "The server returned a workout we couldn't read."
                generating = false; return
            }
            result = workout
            rawWorkout = resp.workout
            resultID = UUID()
        } catch let err as APIError {
            genError = err.errorDescription ?? "Generation failed."
        } catch {
            genError = error.localizedDescription
        }
        generating = false
    }

    /// Save the generated workout to history (`POST /api/log-workout`). Re-sends
    /// the raw engine payload (lossless) with the fields the server validator
    /// requires: a fresh unique `id`, `type` (the generation type), and `poolMode`.
    /// Mirrors the web SPA's `makeEntryId()` — short enough for the `workouts.id`
    /// column (a full UUID overflows it). "w" + base36 ms timestamp + 6 random.
    static func makeEntryId() -> String {
        let ts = String(Int(Date().timeIntervalSince1970 * 1000), radix: 36)
        let alphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        let rand = String((0..<6).map { _ in alphabet.randomElement()! })
        return "w" + ts + rand
    }

    func save() async {
        guard case .object(var dict)? = rawWorkout, let typeId = selectedTypeId else { return }
        saving = true; saveError = nil
        dict["id"]       = .string(Self.makeEntryId())
        dict["type"]     = .string(typeId)
        dict["poolMode"] = .string(pool.rawValue)
        // Save as a generated workout, NOT a completed one. The server defaults
        // `completed` to 1 unless the entry explicitly sends false (db.js
        // entryToWorkoutRow). dateCompleted stays null.
        dict["completed"] = .bool(false)
        // `blocks` and `totalYards` already come from the engine payload.
        do {
            _ = try await api.post("log-workout", body: AnyCodable.object(dict), as: LogWorkoutResponse.self)
            saved = true
        } catch let err as APIError {
            saveError = err.errorDescription ?? "Couldn't save the workout."
        } catch {
            saveError = error.localizedDescription
        }
        saving = false
    }
}

struct GenerateView: View {
    @StateObject private var model = GenerateViewModel()
    @State private var runningWorkout: Workout?

    var body: some View {
        ZStack {
            Brand.bg.ignoresSafeArea()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        if model.loadingTypes {
                            ProgressView().tint(Brand.textMuted).frame(maxWidth: .infinity)
                        } else if let err = model.typesError {
                            InlineError(message: err) { Task { await model.loadTypes() } }
                        } else {
                            typePicker
                            yardageControl
                            coursePicker
                            biasPicker
                            phasePicker
                            recoveryToggle
                            sectionsPicker
                            equipmentPicker
                            generateButton
                            if let err = model.genError { InlineError(message: err, retry: nil) }
                            if let workout = model.result {
                                resultSection(workout).id("generated-result")
                            }
                        }
                    }
                    .padding()
                }
                .onChange(of: model.resultID) {
                    withAnimation(.easeInOut) { proxy.scrollTo("generated-result", anchor: .top) }
                }
            }
        }
        .navigationTitle("Generate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Brand.bg, for: .navigationBar)
        .task { await model.loadTypes() }
        .fullScreenCover(item: $runningWorkout) { RunWorkoutView(workout: $0) }
    }

    // MARK: - Sections

    private var typePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Workout type")
            ForEach(model.types) { type in
                Button { model.selectedTypeId = type.id } label: {
                    HStack(spacing: 10) {
                        Text(type.emoji ?? "🏊").font(.title3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(type.label ?? type.id)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Brand.text)
                            if let blurb = type.blurb {
                                Text(blurb).font(.caption2).foregroundStyle(Brand.textDim)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        Spacer()
                        if model.selectedTypeId == type.id {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Brand.primary)
                        }
                    }
                    .padding(12)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12)
                        .stroke(model.selectedTypeId == type.id ? Brand.primary : Brand.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var yardageControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionLabel("Target")
                Spacer()
                Text("\(Int(model.maxYards)) \(model.pool == .scy ? "yd" : "m")")
                    .font(.subheadline.weight(.bold).monospaced())
                    .foregroundStyle(Brand.primary)
            }
            Slider(value: $model.maxYards, in: 1000...6000, step: 100)
                .tint(Brand.primary)
        }
    }

    private var coursePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Pool")
            Picker("Pool", selection: $model.pool) {
                ForEach(PoolCourse.allCases) { c in Text(c.short).tag(c) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var biasPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Emphasis")
            Picker("Emphasis", selection: $model.bias) {
                ForEach(SectionBias.allCases) { b in Text(b.label).tag(b) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var phasePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Training phase")
            Picker("Phase", selection: $model.phase) {
                ForEach(TrainingPhase.allCases) { p in Text(p.label).tag(p) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var recoveryToggle: some View {
        Toggle(isOn: $model.recoveryMode) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Recovery day").font(.subheadline.weight(.semibold)).foregroundStyle(Brand.text)
                Text("Easier aerobic focus, lower intensity").font(.caption2).foregroundStyle(Brand.textDim)
            }
        }
        .tint(Brand.primary)
        .padding(12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
    }

    private var sectionsPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Sections")
            HStack(spacing: 8) {
                ForEach(WorkoutSectionKind.allCases) { section in
                    let on = model.includedSections.contains(section.rawValue)
                    Button {
                        guard !section.isRequired else { return }   // main is locked on
                        if on { model.includedSections.remove(section.rawValue) }
                        else  { model.includedSections.insert(section.rawValue) }
                    } label: {
                        VStack(spacing: 3) {
                            Text(section.label).font(.caption.weight(.semibold))
                            if section.isRequired {
                                Image(systemName: "lock.fill").font(.system(size: 8))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(on ? Brand.text : Brand.textMuted)
                        .padding(.vertical, 10)
                        .background(on ? Brand.primary.opacity(0.2) : Brand.card,
                                    in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10)
                            .stroke(on ? Brand.primary : Brand.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(section.isRequired)
                }
            }
        }
    }

    private var equipmentPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Equipment")
            FlowChips(items: EquipmentItem.all, isOn: { model.equipmentOn.contains($0.id) }) { item in
                if model.equipmentOn.contains(item.id) { model.equipmentOn.remove(item.id) }
                else { model.equipmentOn.insert(item.id) }
            }
        }
    }

    private var generateButton: some View {
        Button {
            Task { await model.generate() }
        } label: {
            HStack {
                if model.generating { ProgressView().tint(.white) }
                Text(model.generating ? "Generating…" : "Generate")
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .tint(Brand.primary)
        .disabled(model.generating || model.selectedTypeId == nil)
        .padding(.top, 4)
    }

    private func resultSection(_ workout: Workout) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider().overlay(Brand.border)
            HStack {
                Text("Your workout").font(.headline).foregroundStyle(Brand.text)
                Spacer()
                Button {
                    Task { await model.generate() }
                } label: {
                    Label("Regenerate", systemImage: "arrow.clockwise")
                        .font(.caption.weight(.semibold))
                }
                .tint(Brand.primary)
                .disabled(model.generating)
            }
            WorkoutCard(workout: workout)

            Button {
                runningWorkout = workout
            } label: {
                Label("Start workout", systemImage: "play.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.primary)

            if model.saved {
                Label("Saved to history", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.positive)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            } else {
                Button {
                    Task { await model.save() }
                } label: {
                    HStack {
                        if model.saving { ProgressView().tint(.white) }
                        Text(model.saving ? "Saving…" : "Save to history")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.positive)
                .disabled(model.saving)
            }
            if let err = model.saveError { InlineError(message: err, retry: nil) }
        }
    }
}

// MARK: - Small shared pieces

private struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.heavy))
            .foregroundStyle(Brand.textMuted)
    }
}

private struct InlineError: View {
    let message: String
    var retry: (() -> Void)? = nil
    var body: some View {
        VStack(spacing: 8) {
            Text(message).font(.footnote).foregroundStyle(Brand.warn)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Try again", action: retry).font(.caption.weight(.semibold)).tint(Brand.primary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Brand.warn.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.warn.opacity(0.25), lineWidth: 1))
    }
}

/// A simple wrapping row of toggle chips.
private struct FlowChips: View {
    let items: [EquipmentItem]
    let isOn: (EquipmentItem) -> Bool
    let toggle: (EquipmentItem) -> Void

    var body: some View {
        // Two-column grid wraps predictably without a custom Layout.
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(items) { item in
                Button { toggle(item) } label: {
                    HStack(spacing: 6) {
                        Text(item.icon)
                        Text(item.label).font(.caption.weight(.semibold))
                        Spacer()
                        if isOn(item) { Image(systemName: "checkmark").font(.caption2) }
                    }
                    .foregroundStyle(isOn(item) ? Brand.text : Brand.textMuted)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(isOn(item) ? Brand.primary.opacity(0.2) : Brand.card,
                                in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10)
                        .stroke(isOn(item) ? Brand.primary : Brand.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
