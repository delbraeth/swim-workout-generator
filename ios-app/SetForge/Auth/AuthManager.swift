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
        // Optimistically signed-in — no separate auth/status probe. The very next
        // call (HomeView's me/bootstrap) is behind requireAuth and 401s on a dead
        // token, firing api.onUnauthorized → clearToken() → signed out. Drops a
        // redundant cold-start round-trip (429-avoidance). A revoked token returning
        // a non-401 falls through to the offline-cache path until it 401s, same as
        // any mid-session revocation.
        state = .signedIn
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
        BootstrapCache.clear()   // B7 — no user history left on a signed-out device
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

struct GoogleAuthRequest: Encodable {
    let idToken: String
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

// MARK: - Google Sign-In (gated on the GoogleSignIn SDK being linked)
//
// All SDK-touching code lives behind `#if canImport(GoogleSignIn)` so the app
// builds and runs WITHOUT the package; add `google/GoogleSignIn-iOS` to the
// target and `AuthManager.googleAvailable` flips true, lighting up the button.

#if canImport(GoogleSignIn)
import GoogleSignIn
import UIKit

extension AuthManager {
    static var googleAvailable: Bool { true }

    /// Present Google Sign-In, exchange the id_token at `/api/auth/google-native`.
    func signInWithGoogle(inviteCode: String?, presenting: UIViewController) async {
        isExchanging = true
        lastError = nil
        defer { isExchanging = false }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: AppConfig.googleIOSClientID)
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
            guard let idToken = result.user.idToken?.tokenString else {
                lastError = "Google didn't return an identity token. Try again."
                return
            }
            let trimmed = inviteCode?.trimmingCharacters(in: .whitespacesAndNewlines)
            let body = GoogleAuthRequest(idToken: idToken,
                                         inviteCode: (trimmed?.isEmpty == false) ? trimmed : nil)
            let resp = try await api.post("auth/google-native", body: body, as: NativeAuthResponse.self)
            guard resp.ok, let newToken = resp.token else {
                lastError = "Sign-in failed. Please try again."
                return
            }
            setToken(newToken)
            state = .signedIn
        } catch let err as APIError {
            lastError = err.errorDescription
        } catch {
            // User-cancel is silent; surface anything else.
            if (error as NSError).code == GIDSignInError.canceled.rawValue { return }
            lastError = error.localizedDescription
        }
    }
}

extension UIApplication {
    /// The frontmost view controller, for presenting the Google sign-in sheet.
    var activeRootViewController: UIViewController? {
        let scene = connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        var vc = scene?.keyWindow?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}
#else
extension AuthManager {
    static var googleAvailable: Bool { false }
}
#endif
