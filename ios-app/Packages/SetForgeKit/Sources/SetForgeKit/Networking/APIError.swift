import Foundation

/// The server's structured error body: `{ "error": "code", "message"?: "..." }`.
public struct ServerError: Codable, Sendable {
    public let error: String?
    public let message: String?
}

/// Everything that can go wrong talking to the SetForge API.
public enum APIError: Error, Equatable, Sendable {
    /// Could not build a valid URLRequest (bad path/query).
    case invalidRequest
    /// Transport failed (no connectivity, timeout, TLS, …).
    case transport(String)
    /// Response was not an HTTPURLResponse.
    case invalidResponse
    /// 401 — session missing/expired/invalid. The client should re-authenticate.
    case unauthorized
    /// 403 — forbidden. For native sign-up this is usually an invite problem;
    /// `code` carries the server's `invite_*` reason when present.
    case forbidden(code: String?)
    /// 429 — rate limited.
    case rateLimited
    /// Any other non-2xx status, with the server's error code/message if parsed.
    case server(status: Int, code: String?, message: String?)
    /// 2xx body did not match the expected shape.
    case decoding(String)

    /// A human-readable description suitable for surfacing in the UI.
    public var userMessage: String {
        switch self {
        case .invalidRequest:
            return "Couldn't build the request."
        case .transport(let detail):
            return "Network error: \(detail)"
        case .invalidResponse:
            return "Unexpected response from the server."
        case .unauthorized:
            return "Your session expired. Please sign in again."
        case .forbidden(let code):
            return Self.inviteMessage(for: code) ?? "You don't have access to that."
        case .rateLimited:
            return "Too many requests. Please slow down and try again."
        case .server(let status, _, let message):
            return message ?? "Server error (\(status))."
        case .decoding(let detail):
            return "Couldn't read the server's response: \(detail)"
        }
    }

    private static func inviteMessage(for code: String?) -> String? {
        guard let code, code.hasPrefix("invite_") else { return nil }
        switch code {
        case "invite_required":
            return "An invite code is required to create an account."
        case "invite_invalid":
            return "That invite code isn't valid."
        case "invite_consumed", "invite_used":
            return "That invite code has already been used."
        case "invite_expired":
            return "That invite code has expired."
        default:
            return "There's a problem with that invite code."
        }
    }
}
