import Foundation
import SetForgeKit

/// The app's single source of truth for auth + the bootstrapped data spine.
///
/// Owns the `SetForgeClient`, decides whether to show the sign-in or signed-in
/// UI, and centralizes the re-auth-on-401 rule: any data call that throws
/// `.unauthorized` drops the session and returns the user to sign-in.
@MainActor
final class AppEnvironment: ObservableObject {
    enum Phase: Equatable {
        case launching      // checking for a stored session
        case signedOut
        case signedIn
    }

    @Published private(set) var phase: Phase = .launching
    @Published private(set) var user: User?
    @Published private(set) var workouts: [Workout] = []
    @Published private(set) var settings: AppSettings?
    @Published private(set) var goals: [Goal] = []
    @Published var errorMessage: String?
    @Published private(set) var isWorking = false

    private let client: SetForgeClient

    init(configuration: APIConfiguration = .production,
         tokenStore: TokenStore = KeychainTokenStore()) {
        self.client = SetForgeClient(configuration: configuration, tokenStore: tokenStore)
    }

    /// On launch: if a token exists, validate it by loading the bootstrap.
    /// Otherwise go straight to sign-in.
    func start() async {
        guard client.hasStoredSession else {
            phase = .signedOut
            return
        }
        await loadBootstrap(initial: true)
    }

    /// Exchange an Apple identity token (from `SignInWithAppleButton`) for a
    /// SetForge session, then load the data spine. Called by `SignInView` once
    /// Apple returns a credential.
    func completeSignIn(identityToken: String, inviteCode: String?) async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let trimmedInvite = inviteCode?.trimmingCharacters(in: .whitespacesAndNewlines)
            try await client.signInWithApple(
                identityToken: identityToken,
                inviteCode: (trimmedInvite?.isEmpty == false) ? trimmedInvite : nil
            )
            await loadBootstrap(initial: false)
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Surface a sign-in failure that happened before we reached the server
    /// (e.g. Apple returned no identity token). Cancellation is handled by the
    /// caller and never reaches here.
    func reportSignInFailure(_ message: String) {
        errorMessage = message
    }

    /// Load (or reload) the data spine. On `.unauthorized`, sign out.
    func loadBootstrap(initial: Bool) async {
        // The launch path keeps the splash up instead of the spinner, so only
        // toggle the working flag for explicit reloads / post-sign-in loads.
        if !initial { isWorking = true }
        defer { if !initial { isWorking = false } }
        do {
            let bootstrap = try await client.bootstrap()
            apply(bootstrap)
            phase = .signedIn
        } catch APIError.unauthorized {
            await forceSignOut()
        } catch let error as APIError {
            errorMessage = error.userMessage
            // On initial launch a transient failure shouldn't trap the user on a
            // blank launching screen; fall back to sign-in.
            if initial { phase = .signedOut }
        } catch {
            errorMessage = error.localizedDescription
            if initial { phase = .signedOut }
        }
    }

    func signOut() {
        try? clientSignOut()
        resetState()
        phase = .signedOut
    }

    // MARK: - Private

    private func apply(_ bootstrap: Bootstrap) {
        user = bootstrap.me
        workouts = bootstrap.workouts
        settings = bootstrap.settings
        goals = bootstrap.goals
    }

    private func forceSignOut() async {
        try? clientSignOut()
        resetState()
        errorMessage = APIError.unauthorized.userMessage
        phase = .signedOut
    }

    private func clientSignOut() throws { try client.signOut() }

    private func resetState() {
        user = nil
        workouts = []
        settings = nil
        goals = []
    }
}
