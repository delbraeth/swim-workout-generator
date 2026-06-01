import Foundation

/// Thin async wrapper around the SetForge JSON API.
///
/// Contract (API_INTEGRATION.md):
/// - Bearer auth: send `Authorization: Bearer <token>` on every request once
///   signed in. Native requests skip CSRF/origin checks by design, so we never
///   touch `/api/auth/csrf` or send `X-CSRF-Token`.
/// - Rate limit: the host caps at 30 req/min across all tiers. We retry 429s
///   with exponential backoff (honoring `Retry-After` when present) rather than
///   hammering, and callers prefer the composite endpoints over fan-out.
/// - On 401 we surface `.unauthorized` and notify the auth layer so it can wipe
///   the dead token and bounce the user to sign-in.
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    /// Current Bearer token, guarded by a lock so it can be read safely from
    /// URLSession's background threads while AuthManager updates it on the main
    /// actor. `nil` when signed out.
    private let tokenLock = NSLock()
    private var bearer: String?

    /// Set/clear the Bearer token. Safe to call from any thread.
    func setBearer(_ token: String?) {
        tokenLock.lock(); defer { tokenLock.unlock() }
        bearer = token
    }
    private func currentBearer() -> String? {
        tokenLock.lock(); defer { tokenLock.unlock() }
        return bearer
    }

    /// Invoked when the server reports the token is dead (401). The handler is
    /// responsible for hopping to the main actor. Marked `@Sendable` because it
    /// fires from a background request.
    var onUnauthorized: @Sendable () -> Void = {}

    /// Max attempts when a request keeps coming back 429.
    private let maxRetries = 5

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
    }

    // MARK: - Public verbs

    func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try await request(path, method: "GET", body: Optional<Empty>.none, as: type)
    }

    @discardableResult
    func post<Body: Encodable, T: Decodable>(_ path: String, body: Body, as type: T.Type) async throws -> T {
        try await request(path, method: "POST", body: body, as: type)
    }

    @discardableResult
    func post<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try await request(path, method: "POST", body: Optional<Empty>.none, as: type)
    }

    @discardableResult
    func patch<Body: Encodable, T: Decodable>(_ path: String, body: Body, as type: T.Type) async throws -> T {
        try await request(path, method: "PATCH", body: body, as: type)
    }

    @discardableResult
    func delete<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try await request(path, method: "DELETE", body: Optional<Empty>.none, as: type)
    }

    // MARK: - Core request

    private func request<Body: Encodable, T: Decodable>(
        _ path: String,
        method: String,
        body: Body?,
        as type: T.Type
    ) async throws -> T {
        let slash = CharacterSet(charactersIn: "/")
        let url = AppConfig.baseURL
            .appendingPathComponent(AppConfig.apiPath.trimmingCharacters(in: slash))
            .appendingPathComponent(path.trimmingCharacters(in: slash))

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.cachePolicy = .reloadIgnoringLocalCacheData

        if let token = currentBearer() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        var attempt = 0
        while true {
            let (data, response): (Data, URLResponse)
            do {
                (data, response) = try await session.data(for: req)
            } catch {
                throw APIError.transport(error.localizedDescription)
            }

            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("No HTTP response")
            }

            switch http.statusCode {
            case 200...299:
                if T.self == Empty.self, let empty = Empty() as? T { return empty }
                do {
                    return try decoder.decode(T.self, from: data)
                } catch {
                    throw APIError.decoding(String(describing: error))
                }

            case 401:
                onUnauthorized()
                throw APIError.unauthorized

            case 403:
                let msg = Self.errorMessage(from: data)
                if msg.hasPrefix("invite_") { throw APIError.invite(reason: msg) }
                throw APIError.server(status: 403, message: msg)

            case 429:
                attempt += 1
                if attempt > maxRetries { throw APIError.rateLimited }
                let delay = Self.backoffDelay(attempt: attempt, response: http)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                continue

            default:
                throw APIError.server(status: http.statusCode,
                                      message: Self.errorMessage(from: data))
            }
        }
    }

    // MARK: - Helpers

    /// Exponential backoff with jitter, honoring `Retry-After` when the server
    /// supplies it. Sequence (no header): ~0.5, 1, 2, 4, 8s.
    private static func backoffDelay(attempt: Int, response: HTTPURLResponse) -> Double {
        if let retryAfter = response.value(forHTTPHeaderField: "Retry-After"),
           let secs = Double(retryAfter) {
            return secs
        }
        let base = pow(2.0, Double(attempt - 1)) * 0.5
        let jitter = Double.random(in: 0...0.3)
        return min(base + jitter, 10.0)
    }

    /// Backend errors are `{ "error": "..." }`; extract that string.
    private static func errorMessage(from data: Data) -> String {
        struct ErrEnvelope: Decodable { let error: String? }
        if let env = try? JSONDecoder().decode(ErrEnvelope.self, from: data),
           let e = env.error {
            return e
        }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

/// Placeholder for empty request bodies / empty responses.
struct Empty: Codable {}
