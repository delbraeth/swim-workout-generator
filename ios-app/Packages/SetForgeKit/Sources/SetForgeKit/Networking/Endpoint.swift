import Foundation

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// A description of a single API call: where, how, and what to send.
///
/// `requiresAuth` drives whether the `APIClient` attaches the bearer token.
/// Endpoints are kept declarative so they can be unit-tested for correct path /
/// method / header construction without a live server.
public struct Endpoint: Sendable {
    public let method: HTTPMethod
    public let path: String
    public let queryItems: [URLQueryItem]
    public let body: Data?
    public let requiresAuth: Bool

    public init(
        method: HTTPMethod,
        path: String,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        requiresAuth: Bool = true
    ) {
        self.method = method
        self.path = path
        self.queryItems = queryItems
        self.body = body
        self.requiresAuth = requiresAuth
    }

    /// Build a JSON-body endpoint from an `Encodable` payload.
    public static func json<Body: Encodable>(
        _ method: HTTPMethod,
        _ path: String,
        body: Body,
        requiresAuth: Bool = true,
        encoder: JSONEncoder = SetForgeCoders.encoder
    ) throws -> Endpoint {
        let data = try encoder.encode(body)
        return Endpoint(method: method, path: path, body: data, requiresAuth: requiresAuth)
    }
}

/// Shared JSON coders. The server mixes snake_case and camelCase per-endpoint,
/// so models declare their own `CodingKeys`; we deliberately do *not* set a
/// global key strategy here.
public enum SetForgeCoders {
    public static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        return e
    }()

    public static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()
}
