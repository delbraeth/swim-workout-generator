import Foundation
import AuthenticationServices

/// Owns the session token and the signed-in/out state machine.
///
/// Flow (API_INTEGRATION.md):
/// 1. Sign in with Apple on-device → `identityToken` (a JWT string).
/// 2. `POST /api/auth/native { identityToken, inviteCode? }` → `{ ok, token }`.
///    `inviteCode` is required only for a brand-new account (invite-only app).
/// 3. Store `token` in the Keychain and send it as a Bearer header thereafter.
@MainActor
final class AuthManager: ObservableObject {

    enum State: Equatable {
        case loading      // checking for a stored token on launch
        case signedOut
        case signedIn
    }

    @Published private(set) var state: State = .loading
    @Published var lastError: String?
    @Published var isExchanging = false

    private(set) var token: String?
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
        // The client owns a thread-safe copy of the Bearer token; we just feed
        // it. On a 401 the client fires this @Sendable callback, which hops to
        // the main actor to flip our state and wipe the dead token.
        api.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.handleUnauthorized() }
        }
    }

    /// Called once at launch. Loads any stored token and validates it cheaply.
    func bootstrap() async {
        guard let stored = KeychainStore.load() else {
            state = .signedOut
            return
        }
        token = stored
        api.setBearer(stored)
        // Cheap validity check; on 401 the client calls handleUnauthorized().
        do {
            let status = try await api.get("auth/status", as: AuthStatus.self)
            state = status.authenticated == false ? .signedOut : .signedIn
            if state == .signedOut { clearToken() }
        } catch APIError.unauthorized {
            state = .signedOut
        } catch {
            // Network hiccup — assume the stored token is still good; the next
            // real call will re-check. Better than bouncing a user offline.
            state = .signedIn
        }
    }

    /// Exchange an Apple identity token for a SetForge session token.
    func signInWithApple(identityToken: String, inviteCode: String?) async {
        isExchanging = true
        lastError = nil
        defer { isExchanging = false }

        let trimmedInvite = inviteCode?.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = NativeAuthRequest(
            identityToken: identityToken,
            inviteCode: (trimmedInvite?.isEmpty == false) ? trimmedInvite : nil
        )
        do {
            let resp = try await api.post("auth/native", body: body, as: NativeAuthResponse.self)
            guard resp.ok, let newToken = resp.token else {
                lastError = "Sign-in failed. Please try again."
                return
            }
            setToken(newToken)
            state = .signedIn
        } catch let err as APIError {
            lastError = err.errorDescription
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Surface an Apple sign-in failure (cancel is handled silently by the view).
    func reportAppleFailure(_ message: String) {
        lastError = message
    }

    /// Revoke the current session server-side, then drop local state.
    func signOut() async {
        // Best-effort server revoke; we sign out locally regardless.
        _ = try? await api.get("auth/signout", as: Empty.self)
        clearToken()
        state = .signedOut
    }

    // MARK: - Token plumbing

    private func setToken(_ t: String) {
        token = t
        api.setBearer(t)
        KeychainStore.save(t)
    }

    private func clearToken() {
        token = nil
        api.setBearer(nil)
        KeychainStore.delete()
    }

    /// Invoked by APIClient on any 401 — the token is dead.
    private func handleUnauthorized() {
        clearToken()
        state = .signedOut
        lastError = "Your session expired. Please sign in again."
    }
}

// MARK: - Auth wire types

struct NativeAuthRequest: Encodable {
    let identityToken: String
    let inviteCode: String?
}

struct NativeAuthResponse: Decodable {
    let ok: Bool
    let token: String?
    let error: String?
}

struct AuthStatus: Decodable {
    let authenticated: Bool?
}
