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
}
