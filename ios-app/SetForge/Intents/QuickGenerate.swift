import Foundation
import Combine

/// B9 — bridge between the Siri/Shortcuts App Intent and the SwiftUI UI. The
/// intent runs in the app process (it sets `openAppWhenRun`), stamps a pending
/// request here, and `HomeView` observes it to push Generate prefilled + auto-run.
///
/// A singleton so the intent and the views share one instance; `@MainActor`
/// because it mutates `@Published` state that drives navigation.
@MainActor
final class QuickGenerate: ObservableObject {
    static let shared = QuickGenerate()
    private init() {}

    /// Set by the intent; consumed (cleared) by HomeView once routed. nil = idle.
    @Published var pendingYards: Int?

    func request(yards: Int) { pendingYards = yards }
}
