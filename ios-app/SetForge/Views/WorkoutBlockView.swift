import SwiftUI

/// Inline-edit callbacks threaded from `GenerateViewModel` into the result card.
/// Indices are `blockIndex` (into `workout.blocks`) and `setIndex` (into that
/// block's `sets`). All optional — when nil the card renders read-only (history,
/// run mode, recents).
struct WorkoutEditActions {
    var editInterval: (_ blockIndex: Int, _ setIndex: Int, _ value: String) -> Void
    var editDesc: (_ blockIndex: Int, _ setIndex: Int, _ value: String) -> Void
    var editRoundRest: (_ blockIndex: Int, _ value: Int) -> Void
    var swapSet: (_ blockIndex: Int, _ setIndex: Int) -> Void
    var regenerateSection: (_ sectionKey: String) -> Void
    /// True while this sectionKey is regenerating.
    var isRegenerating: (_ sectionKey: String) -> Bool
    var isFavorite: (_ setId: String) -> Bool
    var toggleFavorite: (_ setId: String) -> Void
    /// Remove the block at this index in `workout.blocks`. nil ⇒ no remove
    /// affordance (read-only callers).
    var removeBlock: ((_ blockIndex: Int) -> Void)? = nil
    /// Add a dryland block from a preset (presetId, placement "pre"|"post").
    /// nil ⇒ no add affordance.
    var addDryland: ((_ presetId: String, _ placement: String) -> Void)? = nil
}

/// Renders a workout as a card of section blocks. Dispatches on `block.kind` at
/// the call site (swim vs dryland) — the same discipline the SPA uses to avoid
/// rendering a pace clock for a dryland block.
struct WorkoutCard: View {
    let workout: Workout
    /// When set, shows a "Start" button that launches run mode for this workout.
    var onStart: (() -> Void)? = nil
    /// When set, enables inline editing affordances on swim blocks/sets.
    var edit: WorkoutEditActions? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(workout.title ?? "Workout")
                    .font(.headline)
                    .foregroundStyle(Brand.text)
                Spacer()
                if let yards = workout.totalYards, yards > 0 {
                    Text("\(yards) \(workout.poolType == "25y" || workout.poolType == nil ? "yd" : "m")")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Brand.primary)
                }
            }
            if let pool = workout.poolType {
                Tag(text: PoolMode.label(pool), color: Brand.border)
            }

            ForEach(Array(workout.blocks.enumerated()), id: \.element.id) { index, block in
                if block.isDryland {
                    DrylandBlockView(block: block, onRemove: edit?.removeBlock.map { remove in { remove(index) } })
                } else {
                    SwimBlockView(block: block, blockIndex: index, edit: edit)
                }
            }

            if let onStart, !workout.blocks.isEmpty {
                Button(action: onStart) {
                    Label("Start", systemImage: "play.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent).tint(Brand.primary)
            }
        }
        .padding()
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.border, lineWidth: 1))
    }
}

/// A condensed, single-line workout summary that expands inline to the full
/// block detail. Used for the home "recent" list and history.
struct CollapsibleWorkoutCard: View {
    let workout: Workout
    var subtitle: String? = nil          // e.g. coach / group / date context
    var onStart: (() -> Void)? = nil
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: expanded ? 12 : 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(workout.title ?? "Workout")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.text)
                        Text(summaryLine).font(.caption2).foregroundStyle(Brand.textDim).lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold)).foregroundStyle(Brand.textMuted)
                        .rotationEffect(.degrees(expanded ? 90 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if expanded {
                ForEach(workout.blocks) { block in
                    if block.isDryland { DrylandBlockView(block: block) } else { SwimBlockView(block: block) }
                }
                if let onStart, !workout.blocks.isEmpty {
                    Button(action: onStart) {
                        Label("Start", systemImage: "play.fill")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent).tint(Brand.primary)
                }
            }
        }
        .padding()
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.border, lineWidth: 1))
    }

    private var summaryLine: String {
        var parts: [String] = []
        if let y = workout.totalYards, y > 0 {
            parts.append("\(y) \(workout.poolType == "25m" || workout.poolType == "50m" ? "m" : "yd")")
        }
        let blocks = workout.blocks.count
        if blocks > 0 { parts.append("\(blocks) block\(blocks == 1 ? "" : "s")") }
        if let subtitle { parts.append(subtitle) }
        return parts.isEmpty ? "Tap to view" : parts.joined(separator: " · ")
    }
}

/// A swim block: section header + a list of `sets[]` (reps × dist, interval, focus).
struct SwimBlockView: View {
    let block: WorkoutBlock
    var blockIndex: Int = 0
    var edit: WorkoutEditActions? = nil

    // Active edit sheet state (only used when `edit != nil`).
    @State private var intervalEdit: SetEditTarget?
    @State private var descEdit: SetEditTarget?

    private var sectionKey: String? { block.section }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                BlockHeader(title: block.name ?? sectionDisplayTitle(block.section),
                            trailing: block.totalYards.map { "\($0) yd" })
                if let edit, let key = sectionKey {
                    if edit.isRegenerating(key) {
                        ProgressView().scaleEffect(0.7)
                    } else {
                        Button {
                            edit.regenerateSection(key)
                        } label: {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.caption2)
                        }
                        .tint(Brand.primary)
                    }
                }
            }
            ForEach(Array((block.sets ?? []).enumerated()), id: \.element.id) { setIndex, set in
                setRow(set, setIndex: setIndex)
            }
            if let edit, let rest = block.roundRestSecs {
                roundRestControl(rest, edit: edit)
            }
        }
        .padding(12)
        .background(Brand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
        .sheet(item: $intervalEdit) { target in
            IntervalEditSheet(initial: block.sets?[safe: target.setIndex]?.interval ?? "") { value in
                edit?.editInterval(blockIndex, target.setIndex, value)
            }
        }
        .sheet(item: $descEdit) { target in
            DescEditSheet(initial: block.sets?[safe: target.setIndex]?.desc ?? "") { value in
                edit?.editDesc(blockIndex, target.setIndex, value)
            }
        }
    }

    @ViewBuilder
    private func setRow(_ set: SwimSet, setIndex: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(set.repsByDist)
                    .font(.subheadline.weight(.bold).monospaced())
                    .foregroundStyle(Brand.text)
                if let interval = set.interval, !interval.isEmpty {
                    intervalText(interval, setIndex: setIndex)
                } else if edit != nil {
                    // Allow adding an interval where none exists.
                    Button { intervalEdit = SetEditTarget(setIndex: setIndex) } label: {
                        Text("+ interval").font(.caption2).foregroundStyle(Brand.textMuted)
                    }.buttonStyle(.plain)
                }
                Spacer()
                if let eq = set.eq, !eq.isEmpty {
                    Text(eq.joined(separator: ", "))
                        .font(.caption2)
                        .foregroundStyle(Brand.textDim)
                }
                if let edit {
                    if let sid = set.serverId {
                        Button { edit.toggleFavorite(sid) } label: {
                            Image(systemName: edit.isFavorite(sid) ? "star.fill" : "star")
                                .font(.caption2)
                                .foregroundStyle(edit.isFavorite(sid) ? Brand.primary : Brand.textMuted)
                        }.buttonStyle(.plain)
                    }
                    Button { edit.swapSet(blockIndex, setIndex) } label: {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.caption2).foregroundStyle(Brand.textMuted)
                    }.buttonStyle(.plain)
                }
            }
            descText(set, setIndex: setIndex)
            if let focus = set.focus, !focus.isEmpty {
                Text(focus).font(.caption2).italic().foregroundStyle(Brand.textDim)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func intervalText(_ interval: String, setIndex: Int) -> some View {
        if edit != nil {
            Button { intervalEdit = SetEditTarget(setIndex: setIndex) } label: {
                Text(interval)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.primary)
                    .underline()
            }.buttonStyle(.plain)
        } else {
            Text(interval)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
        }
    }

    @ViewBuilder
    private func descText(_ set: SwimSet, setIndex: Int) -> some View {
        if let desc = set.desc, !desc.isEmpty {
            if edit != nil {
                Button { descEdit = SetEditTarget(setIndex: setIndex) } label: {
                    Text(desc).font(.footnote).foregroundStyle(Brand.textMuted)
                        .multilineTextAlignment(.leading)
                }.buttonStyle(.plain)
            } else {
                Text(desc).font(.footnote).foregroundStyle(Brand.textMuted)
            }
        } else if edit != nil {
            Button { descEdit = SetEditTarget(setIndex: setIndex) } label: {
                Text("+ note").font(.caption2).foregroundStyle(Brand.textMuted)
            }.buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func roundRestControl(_ rest: Int, edit: WorkoutEditActions) -> some View {
        HStack(spacing: 8) {
            Text("Rest between rounds").font(.caption2).foregroundStyle(Brand.textDim)
            Spacer()
            Button { edit.editRoundRest(blockIndex, rest - 5) } label: {
                Image(systemName: "minus.circle").font(.caption)
            }.buttonStyle(.plain).tint(Brand.textMuted)
            Text("\(rest)s").font(.caption.weight(.semibold).monospaced()).foregroundStyle(Brand.text)
            Button { edit.editRoundRest(blockIndex, rest + 5) } label: {
                Image(systemName: "plus.circle").font(.caption)
            }.buttonStyle(.plain).tint(Brand.primary)
        }
        .padding(.top, 4)
    }
}

/// Identifies which set within a block an edit sheet is targeting.
private struct SetEditTarget: Identifiable {
    let setIndex: Int
    var id: Int { setIndex }
}

/// A dryland block: section header + an exercise list (sets × reps, rest). No
/// distances, intervals, or pace clock — `sets` is intentionally absent here.
struct DrylandBlockView: View {
    let block: WorkoutBlock
    /// When set, shows a remove (✕) button in the header that deletes this block.
    var onRemove: (() -> Void)? = nil

    /// Identifiable payload for the explainer sheet.
    struct ExplainerItem: Identifiable {
        let id = UUID()
        let name: String
        let text: String
    }

    @State private var activeExplainer: ExplainerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundStyle(Brand.warn)
                BlockHeader(title: block.name ?? "Dryland",
                            trailing: block.placement.map { $0 == "pre" ? "Pre-pool" : "Post-pool" })
                if let onRemove {
                    Button(action: onRemove) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(Brand.textMuted)
                    }
                    .buttonStyle(.plain)
                }
            }
            ForEach(block.exercises ?? []) { ex in
                let explainer = DrylandGlossary.explainer(for: ex.name)
                HStack(alignment: .firstTextBaseline) {
                    Text(ex.name ?? "Exercise")
                        .font(.subheadline)
                        .foregroundStyle(Brand.text)
                    if explainer != nil {
                        Image(systemName: "info.circle")
                            .font(.caption2)
                            .foregroundStyle(Brand.textDim)
                    }
                    Spacer()
                    Text(drylandDetail(ex))
                        .font(.caption.monospaced())
                        .foregroundStyle(Brand.textMuted)
                }
                .padding(.vertical, 3)
                .contentShape(Rectangle())
                .onTapGesture {
                    if let explainer, let name = ex.name {
                        activeExplainer = ExplainerItem(name: name, text: explainer)
                    }
                }
            }
        }
        .padding(12)
        .background(Brand.warn.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.warn.opacity(0.25), lineWidth: 1))
        .sheet(item: $activeExplainer) { item in
            ExplainerSheet(name: item.name, text: item.text)
        }
    }

    private func drylandDetail(_ ex: DrylandExercise) -> String {
        var parts: [String] = []
        if let sets = ex.sets { parts.append("\(sets) ×") }
        if let reps = ex.reps, !reps.isEmpty { parts.append(reps) }
        if let rest = ex.rest, !rest.isEmpty { parts.append("· rest \(rest)") }
        return parts.joined(separator: " ")
    }
}

private struct BlockHeader: View {
    let title: String
    let trailing: String?
    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.caption.weight(.heavy))
                .foregroundStyle(Brand.textMuted)
            Spacer()
            if let trailing { Text(trailing).font(.caption2).foregroundStyle(Brand.textDim) }
        }
    }
}


// MARK: - Dryland explainer sheet

/// A small sheet describing what a dryland exercise is and how to do it.
struct ExplainerSheet: View {
    let name: String
    let text: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(name)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Brand.text)
                        Text(text)
                            .font(.body)
                            .foregroundStyle(Brand.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .height(260)])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Edit sheets

/// Edit a set's send-off interval (free text, e.g. "On 1:30" or "No interval").
struct IntervalEditSheet: View {
    let initial: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 16) {
                    Text("Set the send-off interval. Leave empty for no interval.")
                        .font(.footnote).foregroundStyle(Brand.textMuted)
                    TextField("On 1:30", text: $text)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Interval")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(text); dismiss() }
                }
            }
        }
        .onAppear { text = initial }
        .presentationDetents([.height(220)])
    }
}

/// Edit a set's description / note.
struct DescEditSheet: View {
    let initial: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Description", text: $text, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(2...5)
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Description")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(text); dismiss() }
                }
            }
        }
        .onAppear { text = initial }
        .presentationDetents([.height(260)])
    }
}

/// Rescale every interval to a new base pace (seconds per 100). Baseline 2:00.
struct PaceRescaleSheet: View {
    let onApply: (_ baseSeconds: Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var minutes: Int = 2
    @State private var seconds: Int = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 16) {
                    Text("Rescale all intervals to a new base pace per 100 (baseline 2:00). Sets with no interval are left as-is.")
                        .font(.footnote).foregroundStyle(Brand.textMuted)
                    HStack(spacing: 0) {
                        Picker("Min", selection: $minutes) {
                            ForEach(0..<6) { Text("\($0)").tag($0) }
                        }.pickerStyle(.wheel).frame(width: 80)
                        Text(":").font(.title2.bold()).foregroundStyle(Brand.text)
                        Picker("Sec", selection: $seconds) {
                            ForEach(0..<60) { Text(String(format: "%02d", $0)).tag($0) }
                        }.pickerStyle(.wheel).frame(width: 80)
                        Spacer()
                    }
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Rescale pace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") { onApply(minutes * 60 + seconds); dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
