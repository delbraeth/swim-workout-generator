import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking   // URLSession async lives here on Linux
#endif

/// The low-level HTTP engine. Knows how to turn an `Endpoint` into a request,
/// attach the bearer token, execute it, and map the response (or failure) into
/// a typed value or `APIError`. It has no opinion about *which* endpoints
/// exist — that lives in `SetForgeClient`.
public final class APIClient: @unchecked Sendable {
    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenStore: TokenStore
    private let decoder: JSONDecoder

    public init(
        configuration: APIConfiguration,
        tokenStore: TokenStore,
        session: URLSession = .shared,
        decoder: JSONDecoder = SetForgeCoders.decoder
    ) {
        self.configuration = configuration
        self.tokenStore = tokenStore
        self.session = session
        self.decoder = decoder
    }

    /// Execute an endpoint and decode its JSON body into `T`.
    public func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type = T.self) async throws -> T {
        let data = try await sendForData(endpoint)
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    /// Execute an endpoint and hand back the raw 2xx body (used for endpoints
    /// whose response we don't decode, e.g. plain `{ ok: true }`).
    @discardableResult
    public func sendRaw(_ endpoint: Endpoint) async throws -> Data {
        try await sendForData(endpoint)
    }

    // MARK: - Core

    private func sendForData(_ endpoint: Endpoint) async throws -> Data {
        let request = try makeRequest(endpoint)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch http.statusCode {
        case 200...299:
            return data
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden(code: parseError(data)?.error)
        case 429:
            throw APIError.rateLimited
        default:
            let parsed = parseError(data)
            throw APIError.server(status: http.statusCode, code: parsed?.error, message: parsed?.message ?? parsed?.error)
        }
    }

    /// Build the URLRequest, attaching auth + standard headers.
    func makeRequest(_ endpoint: Endpoint) throws -> URLRequest {
        guard var components = URLComponents(
            url: configuration.baseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidRequest
        }
        if !endpoint.queryItems.isEmpty {
            components.queryItems = endpoint.queryItems
        }
        guard let url = components.url else { throw APIError.invalidRequest }

        var request = URLRequest(url: url, timeoutInterval: configuration.timeout)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if endpoint.requiresAuth {
            guard let token = try tokenStore.token(), !token.isEmpty else {
                throw APIError.unauthorized
            }
            // Bearer auth is CSRF-exempt and Origin-exempt on the server (see
            // server.js checkOrigin / requireCsrf), so no extra headers needed.
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func parseError(_ data: Data) -> ServerError? {
        try? decoder.decode(ServerError.self, from: data)
    }
}

/// Sentinel for endpoints whose 2xx body we don't care about.
public struct EmptyResponse: Decodable, Sendable {
    public init() {}
}
