import Foundation

/// B7 — offline cache of the last successful `me/bootstrap` payload. We persist
/// the raw response bytes (not a re-encoded model) to Application Support, so a
/// later launch with no connectivity can still show the home screen, recent /
/// assigned workouts, and history — all of which run locally.
///
/// Application Support is app-sandboxed and covered by iOS data protection; the
/// cache is cleared on sign-out so a signed-out device holds no user history.
enum BootstrapCache {
    private static var fileURL: URL? {
        FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("bootstrap-cache.json")
    }

    static func save(_ data: Data) {
        guard let url = fileURL else { return }
        try? FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        // .completeFileProtection: unreadable while the device is locked.
        try? data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    static func load() -> Data? {
        guard let url = fileURL else { return nil }
        return try? Data(contentsOf: url)
    }

    static func clear() {
        guard let url = fileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }
}
