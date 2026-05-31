import Foundation

/// Persists the opaque bearer session token returned by `/api/auth/native`.
///
/// The app target backs this with the iOS Keychain; `SetForgeKit` ships an
/// in-memory implementation so the networking layer is testable without a
/// device. Implementations must be safe to call from any thread.
public protocol TokenStore: AnyObject, Sendable {
    /// The current token, or nil if signed out.
    func token() throws -> String?
    /// Persist a freshly issued token.
    func save(_ token: String) throws
    /// Remove the stored token (sign out).
    func clear() throws
}

/// A simple thread-safe in-memory token store. Suitable for tests and previews;
/// not persistent across launches.
public final class InMemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var value: String?

    public init(token: String? = nil) {
        self.value = token
    }

    public func token() throws -> String? {
        lock.lock(); defer { lock.unlock() }
        return value
    }

    public func save(_ token: String) throws {
        lock.lock(); defer { lock.unlock() }
        value = token
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        value = nil
    }
}
