import Foundation

/// The typed, high-level entry point to the SetForge backend.
///
/// `SetForgeClient` owns the token lifecycle (it writes the token on successful
/// native sign-in and clears it on sign-out) and exposes one method per
/// milestone-1 endpoint. UI layers talk to this, never to `APIClient` directly.
public final class SetForgeClient: @unchecked Sendable {
    private let api: APIClient
    private let tokenStore: TokenStore

    public init(configuration: APIConfiguration = .production,
                tokenStore: TokenStore,
                session: URLSession = .shared) {
        self.tokenStore = tokenStore
        self.api = APIClient(configuration: configuration, tokenStore: tokenStore, session: session)
    }

    /// Designated initializer for tests that want to inject a prebuilt client.
    init(api: APIClient, tokenStore: TokenStore) {
        self.api = api
        self.tokenStore = tokenStore
    }

    // MARK: - Auth

    /// Whether a session token is currently stored. Note this only reflects
    /// local state; the token may have expired server-side (validate via `me()`).
    public var hasStoredSession: Bool {
        (try? tokenStore.token()).flatMap { $0 } != nil
    }

    /// Exchange an Apple `identityToken` for a SetForge session token and store
    /// it. `inviteCode` is only consulted by the server on first sign-in.
    @discardableResult
    public func signInWithApple(identityToken: String, inviteCode: String? = nil) async throws -> NativeAuthResponse {
        let endpoint = try Endpoint.json(
            .post, "/api/auth/native",
            body: NativeAuthRequest(identityToken: identityToken, inviteCode: inviteCode),
            requiresAuth: false
        )
        let response: NativeAuthResponse = try await api.send(endpoint)
        try tokenStore.save(response.token)
        return response
    }

    /// Discard the local session token. (Server-side revocation for the web
    /// flow is a cookie endpoint; native sessions simply stop being presented.)
    public func signOut() throws {
        try tokenStore.clear()
    }

    // MARK: - Data spine

    /// The authenticated user's profile + rollups. Also doubles as a session
    /// validity probe: a thrown `.unauthorized` means re-auth is required.
    public func me() async throws -> User {
        try await api.send(Endpoint(method: .get, path: "/api/me"))
    }

    /// One-shot launch payload: profile, workouts, settings, goals, and more.
    public func bootstrap() async throws -> Bootstrap {
        try await api.send(Endpoint(method: .get, path: "/api/me/bootstrap"))
    }

    /// All workouts visible to the user, newest first (server-ordered).
    public func workouts() async throws -> [Workout] {
        try await api.send(Endpoint(method: .get, path: "/api/workouts"))
    }

    /// List active sessions for the account (for a future "devices" screen).
    public func sessions() async throws -> [SessionInfo] {
        try await api.send(Endpoint(method: .get, path: "/api/auth/sessions"))
    }
}
