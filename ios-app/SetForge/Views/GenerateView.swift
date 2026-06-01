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
    /// Sections to include; `main` is always present and not removable. `kick`
    /// is opt-in (defaults OFF) — every other section defaults ON, mirroring the
    /// web SPA where kick is absent from the default includedSections.
    @Published var includedSections: Set<String> = Set(
        WorkoutSectionKind.allCases.map(\.rawValue).filter { $0 != WorkoutSectionKind.kick.rawValue }
    )
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

    // MARK: - Inline editing state
    /// Section currently being regenerated (sectionKey), for spinner/disable.
    @Published var regeneratingSection: String?
    /// Transient error from a section regenerate (422 "only one option fits", …).
    @Published var sectionError: String?
    /// Favorited / disfavored set ids (server set ids), for the star affordance.
    @Published var favoriteSetIds: Set<String> = []
    @Published var disfavorSetIds: Set<String> = []

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

    // MARK: - Inline editing (rawWorkout is the single source of truth)

    /// Re-decode `rawWorkout` into the typed `result` after any mutation.
    private func rederive() {
        guard let raw = rawWorkout,
              let data = try? JSONEncoder().encode(raw),
              let w = try? JSONDecoder().decode(Workout.self, from: data) else { return }
        result = w
    }

    /// Destructure `rawWorkout` into its `blocks` array, run `f`, write back,
    /// and rederive. No-op if `rawWorkout` isn't an object with an array `blocks`.
    private func mutateBlocks(_ f: (inout [AnyCodable]) -> Void) {
        guard case .object(var dict)? = rawWorkout,
              case .array(var blocks)? = dict["blocks"] else { return }
        f(&blocks)
        dict["blocks"] = .array(blocks)
        rawWorkout = .object(dict)
        rederive()
    }

    /// Mutate the set at `blocks[bi].sets[si]` via `f`.
    private func mutateSet(blockIndex bi: Int, setIndex si: Int, _ f: (inout AnyCodable) -> Void) {
        mutateBlocks { blocks in
            guard blocks.indices.contains(bi),
                  case .object(var block) = blocks[bi],
                  case .array(var sets)? = block["sets"],
                  sets.indices.contains(si) else { return }
            f(&sets[si])
            block["sets"] = .array(sets)
            blocks[bi] = .object(block)
        }
    }

    func editInterval(blockIndex bi: Int, setIndex si: Int, to raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        mutateSet(blockIndex: bi, setIndex: si) { set in
            set["interval"] = trimmed.isEmpty ? .null : .string(trimmed)
        }
    }

    func editDesc(blockIndex bi: Int, setIndex si: Int, to raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        mutateSet(blockIndex: bi, setIndex: si) { set in
            set["desc"] = trimmed.isEmpty ? .null : .string(trimmed)
        }
    }

    func editRoundRest(blockIndex bi: Int, to secs: Int) {
        let clamped = min(max(secs, 0), 300)
        mutateBlocks { blocks in
            guard blocks.indices.contains(bi), case .object(var block) = blocks[bi] else { return }
            block["roundRestSecs"] = .int(clamped)
            blocks[bi] = .object(block)
        }
    }

    /// Equivalent total-preserving (reps × dist) splits, ordered. The first entry
    /// is the original; cycling `swapSet` advances through the rest.
    func equivalents(reps: Int, dist: Int) -> [(reps: Int, dist: Int)] {
        let total = reps * dist
        let dists = [25, 50, 75, 100, 200]
        var out: [(reps: Int, dist: Int)] = [(reps, dist)]
        for d in dists where d != dist && total % d == 0 {
            let r = total / d
            if r >= 1 { out.append((r, d)) }
        }
        return out
    }

    func swapSet(blockIndex bi: Int, setIndex si: Int) {
        // Read current reps/dist from the typed result (already derived).
        guard let block = result?.blocks[safe: bi],
              let set = block.sets?[safe: si],
              let reps = set.reps, let dist = set.dist, reps > 0, dist > 0 else { return }
        let opts = equivalents(reps: reps, dist: dist)
        guard opts.count > 1 else { return }
        // Find current index, advance to next.
        let curIdx = opts.firstIndex(where: { $0.reps == reps && $0.dist == dist }) ?? 0
        let next = opts[(curIdx + 1) % opts.count]
        mutateSet(blockIndex: bi, setIndex: si) { s in
            s["reps"] = .int(next.reps)
            s["dist"] = .int(next.dist)
        }
    }

    /// Parse "On M:SS" / "M:SS" / "1:30" into total seconds. Returns nil for
    /// "No interval" / empty / unparseable.
    func parseInterval(_ s: String) -> Int? {
        let cleaned = s.replacingOccurrences(of: "On", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard !cleaned.isEmpty else { return nil }
        let parts = cleaned.split(separator: ":")
        if parts.count == 2, let m = Int(parts[0]), let sec = Int(parts[1]) {
            return m * 60 + sec
        }
        if parts.count == 1, let sec = Int(parts[0]) { return sec }
        return nil
    }

    /// Format seconds as "On M:SS".
    func formatInterval(_ secs: Int) -> String {
        let m = secs / 60, s = secs % 60
        return String(format: "On %d:%02d", m, s)
    }

    /// Rescale every parseable interval across all blocks by `newBase / 120`
    /// (baseline 2:00 per 100). Leaves "No interval"/empty untouched.
    func rescalePace(toBaseSeconds newBase: Int) {
        guard newBase > 0 else { return }
        let ratio = Double(newBase) / 120.0
        mutateBlocks { blocks in
            for bi in blocks.indices {
                guard case .object(var block) = blocks[bi],
                      case .array(var sets)? = block["sets"] else { continue }
                for si in sets.indices {
                    guard case .object(var set) = sets[si],
                          let cur = set["interval"]?.stringValue,
                          let secs = self.parseInterval(cur) else { continue }
                    let scaled = Int((Double(secs) * ratio).rounded())
                    set["interval"] = .string(self.formatInterval(scaled))
                    sets[si] = .object(set)
                }
                block["sets"] = .array(sets)
                blocks[bi] = .object(block)
            }
        }
    }

    // MARK: - Add / remove dryland blocks (client-side)

    /// Build and insert a dryland block from a preset. `pre` blocks go to the
    /// front of the workout, `post` blocks to the end — mirroring the web's
    /// `makeDrylandBlock` placement. The block shape matches the engine exactly:
    /// `{ kind:"dryland", section:"dryland", name, placement, exercises:[…] }`.
    func addDryland(presetId: String, placement: String) {
        let preset = DrylandCatalog.all.first { $0.id == presetId } ?? DrylandCatalog.all[0]
        let exercises: [AnyCodable] = preset.exercises.map { ex in
            .object([
                "name": .string(ex.name),
                "sets": .int(ex.sets),
                "reps": .string(ex.reps),
                "rest": ex.rest.map { AnyCodable.string($0) } ?? .null,
            ])
        }
        let newBlock = AnyCodable.object([
            "kind": .string("dryland"),
            "section": .string("dryland"),
            "name": .string(preset.name),
            "placement": .string(placement),
            "exercises": .array(exercises),
        ])
        mutateBlocks { blocks in
            if placement == "pre" { blocks.insert(newBlock, at: 0) }
            else { blocks.append(newBlock) }
        }
    }

    /// Remove the block at `index` in the workout's blocks array. `result.blocks`
    /// is decoded 1:1 from rawWorkout, so the rendered index matches.
    func removeBlock(at index: Int) {
        mutateBlocks { blocks in
            guard blocks.indices.contains(index) else { return }
            blocks.remove(at: index)
        }
    }

    /// Regenerate a single section via `POST /api/regenerate-section`. On success
    /// the server returns a full workout, which becomes the new `rawWorkout`.
    func regenerateSection(sectionKey: String) async {
        guard let raw = rawWorkout, let typeId = selectedTypeId else { return }
        regeneratingSection = sectionKey; sectionError = nil
        let equipment = Dictionary(uniqueKeysWithValues: EquipmentItem.all.map { ($0.id, equipmentOn.contains($0.id)) })
        var body: [String: AnyCodable] = [
            "workout": raw,
            "typeId": .string(typeId),
            "sectionKey": .string(sectionKey),
            "maxYards": .int(Int(maxYards)),
            "poolMode": .string(pool.rawValue),
            "equipment": .object(equipment.mapValues { .bool($0) }),
            "recoveryMode": .bool(recoveryMode),
        ]
        if phase != .none { body["phase"] = .string(phase.rawValue) }
        do {
            let resp = try await api.post("regenerate-section", body: AnyCodable.object(body), as: GenerateResponse.self)
            guard let workout = resp.workout, resp.renderableWorkout() != nil else {
                sectionError = "The server returned a workout we couldn't read."
                regeneratingSection = nil; return
            }
            rawWorkout = workout
            rederive()
        } catch let err as APIError {
            sectionError = err.errorDescription ?? "Couldn't regenerate that section."
        } catch {
            sectionError = error.localizedDescription
        }
        regeneratingSection = nil
    }

    // MARK: - Favorite / disfavor sets (optimistic, revert on failure)

    func toggleFavoriteSet(_ setId: String) async {
        let wasFav = favoriteSetIds.contains(setId)
        if wasFav { favoriteSetIds.remove(setId) }
        else { favoriteSetIds.insert(setId); disfavorSetIds.remove(setId) }
        do {
            if wasFav {
                let enc = setId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? setId
                _ = try await api.delete("favorite-sets/\(enc)", as: OkResponse.self)
            } else {
                _ = try await api.post("favorite-sets", body: ["setId": setId], as: OkResponse.self)
            }
        } catch {
            // Revert.
            if wasFav { favoriteSetIds.insert(setId) } else { favoriteSetIds.remove(setId) }
        }
    }

    func toggleDisfavorSet(_ setId: String) async {
        let wasDis = disfavorSetIds.contains(setId)
        if wasDis { disfavorSetIds.remove(setId) }
        else { disfavorSetIds.insert(setId); favoriteSetIds.remove(setId) }
        do {
            if wasDis {
                let enc = setId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? setId
                _ = try await api.delete("disfavor-sets/\(enc)", as: OkResponse.self)
            } else {
                _ = try await api.post("disfavor-sets", body: ["setId": setId], as: OkResponse.self)
            }
        } catch {
            if wasDis { disfavorSetIds.insert(setId) } else { disfavorSetIds.remove(setId) }
        }
    }
}

/// `{ ok: true }` response for favorite/set mutations.
struct OkResponse: Decodable { let ok: Bool? }

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

struct GenerateView: View {
    @StateObject private var model = GenerateViewModel()
    @State private var runningWorkout: Workout?
    @State private var showPaceRescale = false

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
                    .readableWidth()
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
        .sheet(isPresented: $showPaceRescale) {
            PaceRescaleSheet { base in model.rescalePace(toBaseSeconds: base) }
        }
    }

    /// Editing callbacks bridged from the view model into the result card.
    private var editActions: WorkoutEditActions {
        WorkoutEditActions(
            editInterval: { bi, si, v in model.editInterval(blockIndex: bi, setIndex: si, to: v) },
            editDesc: { bi, si, v in model.editDesc(blockIndex: bi, setIndex: si, to: v) },
            editRoundRest: { bi, v in model.editRoundRest(blockIndex: bi, to: v) },
            swapSet: { bi, si in model.swapSet(blockIndex: bi, setIndex: si) },
            regenerateSection: { key in Task { await model.regenerateSection(sectionKey: key) } },
            isRegenerating: { key in model.regeneratingSection == key },
            isFavorite: { id in model.favoriteSetIds.contains(id) },
            toggleFavorite: { id in Task { await model.toggleFavoriteSet(id) } },
            removeBlock: { model.removeBlock(at: $0) },
            addDryland: { model.addDryland(presetId: $0, placement: $1) }
        )
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
                Menu {
                    Button {
                        Task { await model.generate() }
                    } label: { Label("Regenerate all", systemImage: "arrow.clockwise") }
                    Button {
                        showPaceRescale = true
                    } label: { Label("Rescale pace…", systemImage: "speedometer") }
                } label: {
                    Image(systemName: "ellipsis.circle").font(.title3)
                }
                .tint(Brand.primary)
                .disabled(model.generating)
            }
            if let err = model.sectionError {
                InlineError(message: err, retry: nil)
            }
            WorkoutCard(workout: workout, edit: editActions)

            AddDrylandControl { presetId, placement in
                model.addDryland(presetId: presetId, placement: placement)
            }

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

// MARK: - Add dryland

/// A collapsible control to append a dryland block to the generated workout.
/// Tapping "Add dryland" reveals a preset menu + a Before/After-pool selector
/// and an Add button. Placement defaults to the chosen preset's own slot.
private struct AddDrylandControl: View {
    let onAdd: (_ presetId: String, _ placement: String) -> Void

    @State private var expanded = false
    @State private var selectedId: String = DrylandCatalog.all.first?.id ?? ""
    @State private var placement: String = DrylandCatalog.all.first?.placement ?? "post"

    private var selectedPreset: DrylandPreset? {
        DrylandCatalog.all.first { $0.id == selectedId }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: expanded ? "minus.circle" : "plus.circle")
                    Text("Add dryland").font(.subheadline.weight(.semibold))
                    Spacer()
                }
                .foregroundStyle(Brand.primary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if expanded {
                Menu {
                    ForEach(DrylandCatalog.all) { preset in
                        Button {
                            selectedId = preset.id
                            placement = preset.placement
                        } label: {
                            if preset.id == selectedId {
                                Label(preset.name, systemImage: "checkmark")
                            } else {
                                Text(preset.name)
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text(selectedPreset?.name ?? "Choose a routine")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Brand.text)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption2).foregroundStyle(Brand.textMuted)
                    }
                    .padding(10)
                    .background(Brand.bg, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.border, lineWidth: 1))
                }

                Picker("Placement", selection: $placement) {
                    Text("Before pool").tag("pre")
                    Text("After pool").tag("post")
                }
                .pickerStyle(.segmented)

                Button {
                    onAdd(selectedId, placement)
                    withAnimation(.easeInOut(duration: 0.2)) { expanded = false }
                } label: {
                    Label("Add", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.primary)
                .disabled(selectedPreset == nil)
            }
        }
        .padding(12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
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
