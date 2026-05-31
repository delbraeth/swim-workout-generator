import Foundation

/// Errors surfaced by `APIClient`. The backend returns `{ "error": "..." }`
/// with a 4xx/5xx status on failure (per API_INTEGRATION.md).
enum APIError: LocalizedError, Equatable {
    /// 401 — the Bearer token is dead. Callers re-run the sign-in flow.
    case unauthorized
    /// 403 with an `invite_*` reason during native sign-in.
    case invite(reason: String)
    /// Non-2xx with the server-provided `error` string (and status code).
    case server(status: Int, message: String)
    /// 429 persisted past our retry budget.
    case rateLimited
    /// Transport / URLSession failure.
    case transport(String)
    /// Response body could not be decoded into the expected type.
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session expired. Please sign in again."
        case .invite(let reason):
            switch reason {
            case "invite_required": return "An invite code is required to create an account."
            case "invite_invalid":  return "That invite code isn't valid."
            case "invite_expired":  return "That invite code has expired."
            case "invite_used":     return "That invite code has already been used."
            default:                return "Invite problem: \(reason)."
            }
        case .server(let status, let message):
            return message.isEmpty ? "Server error (\(status))." : message
        case .rateLimited:
            return "We're being rate-limited. Try again in a moment."
        case .transport(let m):
            return "Network problem: \(m)"
        case .decoding(let m):
            return "Couldn't read the server response: \(m)"
        }
    }
}
