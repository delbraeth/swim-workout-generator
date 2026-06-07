import Foundation
#if canImport(HealthKit)
import HealthKit
#endif

/// Writes completed swims to Apple Health (B14, build 12 — write-only).
///
/// Best-effort and fully guarded: no-ops when HealthKit is unavailable (iPad
/// without Health, Simulator) or the user declines authorization. Closes the
/// Activity-rings loop for self-coached + Masters-fitness swimmers.
///
/// REQUIRES (set in Xcode, can't be done from source):
///   1. HealthKit capability on the SetForge target (Signing & Capabilities).
///   2. Info.plist `NSHealthUpdateUsageDescription` (e.g. "SetForge saves your
///      completed swims to Apple Health.").
/// Without these, authorization silently fails and saves no-op — safe.
@MainActor
final class HealthKitManager {
    static let shared = HealthKitManager()
    private init() {}

#if canImport(HealthKit)
    private let store = HKHealthStore()
#endif

    /// True only where Health data can be written (real device with Health).
    var isAvailable: Bool {
#if canImport(HealthKit)
        HKHealthStore.isHealthDataAvailable()
#else
        false
#endif
    }

    /// Request write access to workouts + swimming distance. Returns true if the
    /// authorization request completed without error (the user may still have
    /// declined a specific type — saves then silently no-op, which is fine).
    func requestAuth() async -> Bool {
#if canImport(HealthKit)
        guard isAvailable,
              let dist = HKQuantityType.quantityType(forIdentifier: .distanceSwimming) else { return false }
        let share: Set<HKSampleType> = [HKObjectType.workoutType(), dist]
        return await withCheckedContinuation { cont in
            store.requestAuthorization(toShare: share, read: []) { ok, _ in cont.resume(returning: ok) }
        }
#else
        return false
#endif
    }

    /// Save a pool swim: a swimming HKWorkout with `distanceMeters` over
    /// `durationSecs` ending at `end`. `poolLengthMeters` (lap length) is added
    /// as metadata when known. Returns true on a successful save.
    func saveSwim(distanceMeters: Double, durationSecs: Int, end: Date = Date(), poolLengthMeters: Double? = nil) async -> Bool {
#if canImport(HealthKit)
        guard isAvailable, durationSecs > 0, distanceMeters > 0 else { return false }
        let start = end.addingTimeInterval(-Double(durationSecs))
        var metadata: [String: Any] = [HKMetadataKeyIndoorWorkout: true]
        if let lap = poolLengthMeters {
            metadata[HKMetadataKeyLapLength] = HKQuantity(unit: .meter(), doubleValue: lap)
        }
        // Simple, broadly-compatible path (HKWorkout initializer). Deprecated on
        // iOS 17+ in favor of HKWorkoutBuilder — fine for a write-only MVP;
        // migrate to the builder if we ever add per-lap samples.
        let workout = HKWorkout(
            activityType: .swimming,
            start: start,
            end: end,
            duration: Double(durationSecs),
            totalEnergyBurned: nil,
            totalDistance: HKQuantity(unit: .meter(), doubleValue: distanceMeters),
            metadata: metadata
        )
        return await withCheckedContinuation { cont in
            store.save(workout) { ok, _ in cont.resume(returning: ok) }
        }
#else
        return false
#endif
    }

    // MARK: - B14b — read / import Apple-Watch-tracked pool swims

    /// Request READ access to swimming workouts + distance. As with all HealthKit
    /// reads, the OS never tells us whether the user actually granted it (privacy)
    /// — a denied read just yields no samples, which surfaces as "0 imported".
    /// Requires `NSHealthShareUsageDescription` (already in source since build 12).
    func requestReadAuth() async -> Bool {
#if canImport(HealthKit)
        guard isAvailable,
              let dist = HKQuantityType.quantityType(forIdentifier: .distanceSwimming) else { return false }
        let read: Set<HKObjectType> = [HKObjectType.workoutType(), dist]
        return await withCheckedContinuation { cont in
            store.requestAuthorization(toShare: [], read: read) { ok, _ in cont.resume(returning: ok) }
        }
#else
        return false
#endif
    }

    /// The most recent swimming workouts (last `days` days, newest first). Pure
    /// read — mapping to SetForge history is done by `importRecentSwims`.
    func readRecentSwims(days: Int = 60, limit: Int = 50) async -> [ImportedSwim] {
#if canImport(HealthKit)
        guard isAvailable else { return [] }
        let cutoff = Date().addingTimeInterval(-Double(days) * 86_400)
        let typePred = HKQuery.predicateForWorkouts(with: .swimming)
        let datePred = HKQuery.predicateForSamples(withStart: cutoff, end: nil, options: .strictStartDate)
        let pred = NSCompoundPredicate(andPredicateWithSubpredicates: [typePred, datePred])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: pred,
                                  limit: limit, sortDescriptors: [sort]) { _, samples, _ in
                let swims = (samples as? [HKWorkout] ?? []).compactMap { w -> ImportedSwim? in
                    let meters = w.totalDistance?.doubleValue(for: .meter()) ?? 0
                    let secs = Int(w.duration)
                    guard meters > 0, secs > 0 else { return nil }
                    let lap = (w.metadata?[HKMetadataKeyLapLength] as? HKQuantity)?.doubleValue(for: .meter())
                    return ImportedSwim(uuid: w.uuid, distanceMeters: meters, durationSecs: secs,
                                        end: w.endDate, lapLengthMeters: lap)
                }
                cont.resume(returning: swims)
            }
            store.execute(q)
        }
#else
        return []
#endif
    }

    /// Import recent Watch-tracked pool swims into SetForge history via
    /// `/api/log-workout`. Dedup is server-side: each swim's id is its HealthKit
    /// UUID (hyphens stripped → 32 hex chars, within the id column), so a
    /// re-import returns 409 and is counted as "skipped" rather than duplicated.
    func importRecentSwims(poolMode: String, api: APIClient = .shared) async -> ImportResult {
        guard isAvailable else { return ImportResult(authDenied: true) }
        guard await requestReadAuth() else { return ImportResult(authDenied: true) }
        let swims = await readRecentSwims()
        var result = ImportResult()
        for swim in swims {
            let entry = Self.logEntry(for: swim, poolMode: poolMode)
            do {
                try await api.post("log-workout", body: entry, as: Empty.self)
                result.imported += 1
            } catch APIError.server(let status, _) where status == 409 {
                result.skipped += 1
            } catch {
                result.failed += 1
            }
        }
        return result
    }

    /// Map an `ImportedSwim` to a minimal valid `/api/log-workout` entry: one
    /// "main" swim block of 1×distance. Distance is converted into the user's
    /// pool unit (yards for SCY, meters otherwise).
    private static func logEntry(for swim: ImportedSwim, poolMode: String) -> ImportedSwimEntry {
        let isYards = poolMode == "25y"
        let dist = Int((isYards ? swim.distanceMeters * 1.0936133 : swim.distanceMeters).rounded())
        let mins = swim.durationSecs / 60, secs = swim.durationSecs % 60
        let timeStr = String(format: "%d:%02d", mins, secs)
        let id = swim.uuid.uuidString.replacingOccurrences(of: "-", with: "")  // 32 hex chars
        let set = ImportedSwimEntry.Set(reps: 1, dist: max(1, dist), desc: "Apple Watch swim · \(timeStr)")
        return ImportedSwimEntry(
            id: id,
            title: "Apple Watch Swim",
            type: "endurance",
            totalYards: max(1, dist),
            poolMode: poolMode,
            created_at: ISO8601DateFormatter().string(from: swim.end),
            source: "apple_health",
            blocks: [ImportedSwimEntry.Block(name: "Swim", section: "main", sets: [set])]
        )
    }
}

/// A swimming workout read out of HealthKit (subset we need to import).
struct ImportedSwim {
    let uuid: UUID
    let distanceMeters: Double
    let durationSecs: Int
    let end: Date
    let lapLengthMeters: Double?
}

/// Outcome of an import pass, surfaced to the UI as a one-line summary.
struct ImportResult {
    var imported = 0
    var skipped = 0
    var failed = 0
    var authDenied = false

    var summary: String {
        if authDenied { return "Apple Health isn't available or access was declined." }
        if imported == 0 && skipped == 0 && failed == 0 { return "No Apple Watch pool swims found." }
        var parts = ["Imported \(imported)"]
        if skipped > 0 { parts.append("\(skipped) already in history") }
        if failed > 0 { parts.append("\(failed) failed") }
        return parts.joined(separator: " · ")
    }
}

/// Encodable `/api/log-workout` body for an imported swim. `source` is an extra
/// field the server stashes in the payload JSON (allowed by the validator).
private struct ImportedSwimEntry: Encodable {
    let id: String
    let title: String
    let type: String
    let totalYards: Int
    let poolMode: String
    let created_at: String
    let source: String
    let blocks: [Block]

    struct Block: Encodable {
        let name: String
        let section: String
        let sets: [Set]
    }
    struct Set: Encodable {
        let reps: Int
        let dist: Int
        let desc: String
    }
}
