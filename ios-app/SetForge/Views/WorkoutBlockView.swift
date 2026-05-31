import SwiftUI

/// Renders a workout as a card of section blocks. Dispatches on `block.kind` at
/// the call site (swim vs dryland) — the same discipline the SPA uses to avoid
/// rendering a pace clock for a dryland block.
struct WorkoutCard: View {
    let workout: Workout
    /// When set, shows a "Start" button that launches run mode for this workout.
    var onStart: (() -> Void)? = nil

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

            ForEach(workout.blocks) { block in
                if block.isDryland {
                    DrylandBlockView(block: block)
                } else {
                    SwimBlockView(block: block)
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

/// A swim block: section header + a list of `sets[]` (reps × dist, interval, focus).
struct SwimBlockView: View {
    let block: WorkoutBlock

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            BlockHeader(title: block.name ?? sectionTitle(block.section),
                        trailing: block.totalYards.map { "\($0) yd" })
            ForEach(block.sets ?? []) { set in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(set.repsByDist)
                            .font(.subheadline.weight(.bold).monospaced())
                            .foregroundStyle(Brand.text)
                        if let interval = set.interval, !interval.isEmpty {
                            Text(interval)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Brand.primary)
                        }
                        Spacer()
                        if let eq = set.eq, !eq.isEmpty {
                            Text(eq.joined(separator: ", "))
                                .font(.caption2)
                                .foregroundStyle(Brand.textDim)
                        }
                    }
                    if let desc = set.desc, !desc.isEmpty {
                        Text(desc).font(.footnote).foregroundStyle(Brand.textMuted)
                    }
                    if let focus = set.focus, !focus.isEmpty {
                        Text(focus).font(.caption2).italic().foregroundStyle(Brand.textDim)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding(12)
        .background(Brand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// A dryland block: section header + an exercise list (sets × reps, rest). No
/// distances, intervals, or pace clock — `sets` is intentionally absent here.
struct DrylandBlockView: View {
    let block: WorkoutBlock

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundStyle(Brand.warn)
                BlockHeader(title: block.name ?? "Dryland",
                            trailing: block.placement.map { $0 == "pre" ? "Pre-pool" : "Post-pool" })
            }
            ForEach(block.exercises ?? []) { ex in
                HStack(alignment: .firstTextBaseline) {
                    Text(ex.name ?? "Exercise")
                        .font(.subheadline)
                        .foregroundStyle(Brand.text)
                    Spacer()
                    Text(drylandDetail(ex))
                        .font(.caption.monospaced())
                        .foregroundStyle(Brand.textMuted)
                }
                .padding(.vertical, 3)
            }
        }
        .padding(12)
        .background(Brand.warn.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.warn.opacity(0.25), lineWidth: 1))
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

private func sectionTitle(_ section: String?) -> String {
    switch section {
    case "warmup":   return "Warm-Up"
    case "drill":    return "Drill / Pre-Main"
    case "main":     return "Main Set"
    case "cooldown": return "Cool-Down"
    case "dryland":  return "Dryland"
    default:         return section?.capitalized ?? "Set"
    }
}
