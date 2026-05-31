import AuthenticationServices
import SwiftUI

/// Invite-only Sign in with Apple. New accounts require an invite code, which
/// the server consumes on first sign-in; returning users can leave it blank.
struct SignInView: View {
    @EnvironmentObject private var env: AppEnvironment
    @State private var inviteCode: String = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            header

            VStack(alignment: .leading, spacing: 6) {
                Text("Invite code")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Required for new accounts", text: $inviteCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                Text("Returning users can leave this blank.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal)

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                handle(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal)
            .disabled(env.isWorking)

            if env.isWorking {
                ProgressView().padding(.top, 4)
            }

            if let message = env.errorMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Spacer()

            Link("Privacy Policy", destination: URL(string: "https://setforge.io/privacy.html")!)
                .font(.caption)
        }
        .padding()
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.pool.swim")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text("SetForge")
                .font(.largeTitle.bold())
            Text("Sign in to generate and log your swim workouts.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    /// Pull the `identityToken` JWT out of Apple's credential and hand it to the
    /// backend. The server verifies it against Apple's JWKS, so the raw token is
    /// all we need to forward.
    private func handle(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let token = String(data: tokenData, encoding: .utf8)
            else {
                env.reportSignInFailure("Apple didn't return an identity token.")
                return
            }
            Task { await env.completeSignIn(identityToken: token, inviteCode: inviteCode) }

        case .failure(let error):
            // Silently ignore an explicit cancel; surface anything else.
            if let authError = error as? ASAuthorizationError, authError.code == .canceled {
                return
            }
            env.reportSignInFailure(error.localizedDescription)
        }
    }
}
