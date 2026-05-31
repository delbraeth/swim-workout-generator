import Foundation

/// Connection settings for the SetForge backend.
public struct APIConfiguration: Sendable {
    /// Base URL of the API host. Defaults to production.
    public let baseURL: URL

    /// Request timeout in seconds.
    public let timeout: TimeInterval

    public init(baseURL: URL, timeout: TimeInterval = 30) {
        self.baseURL = baseURL
        self.timeout = timeout
    }

    /// Production: https://setforge.io (matches the server's default `APP_URL`).
    public static let production = APIConfiguration(
        baseURL: URL(string: "https://setforge.io")!
    )
}
