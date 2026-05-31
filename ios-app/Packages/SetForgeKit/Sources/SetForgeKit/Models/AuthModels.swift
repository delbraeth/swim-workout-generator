import Foundation

/// Request body for `POST /api/auth/native`.
public struct NativeAuthRequest: Codable, Sendable {
    public let identityToken: String
    public let inviteCode: String?

    public init(identityToken: String, inviteCode: String? = nil) {
        self.identityToken = identityToken
        self.inviteCode = inviteCode
    }
}

/// Success response for `POST /api/auth/native` → `{ ok: true, token }`.
public struct NativeAuthResponse: Codable, Sendable {
    public let ok: Bool
    public let token: String
}

/// One active session (`GET /api/auth/sessions`). The server only ever exposes
/// an 8-char `id_prefix`, never the full token of another session.
public struct SessionInfo: Codable, Identifiable, Sendable {
    public var id: String { idPrefix }

    public let idPrefix: String
    public let createdAt: String?
    public let expiresAt: String?
    public let lastSeenAt: String?
    public let ip: String?
    public let userAgent: String?
    public let isCurrent: Bool?

    enum CodingKeys: String, CodingKey {
        case idPrefix = "id_prefix"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case lastSeenAt = "last_seen_at"
        case ip
        case userAgent = "user_agent"
        case isCurrent = "is_current"
    }
}
