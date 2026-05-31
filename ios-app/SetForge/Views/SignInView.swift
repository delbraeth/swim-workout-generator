import SwiftUI
import AuthenticationServices

/// Sign in with Apple + optional invite code. The invite code is required only
/// when creating a brand-new account (the app is invite-only); returning users
/// leave it blank.
struct SignInView: View {
    @EnvironmentObject private var auth: AuthManager
    @Environment(\.colorScheme) private var colorScheme
    @State private var inviteCode = ""

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            VStack(spacing: 14) {
                SetForgeMark(size: 72)
                Text("SetForge")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(Brand.text)
                Text("Swim workouts in seconds.\nFor coaches and their swimmers.")
                    .multilineTextAlignment(.center)
                    .font(.subheadline)
                    .foregroundStyle(Brand.textMuted)
            }

            Spacer()

            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("INVITE CODE")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Brand.textDim)
                    TextField("Required for new accounts", text: $inviteCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Brand.border, lineWidth: 1)
                        )
                        .foregroundStyle(Brand.text)
                    Text("Returning user? Leave this blank.")
                        .font(.caption2)
                        .foregroundStyle(Brand.textDim)
                }

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    handle(result)
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(auth.isExchanging)
                .opacity(auth.isExchanging ? 0.6 : 1)

                if auth.isExchanging {
                    ProgressView().tint(Brand.textMuted)
                }

                if let err = auth.lastError {
                    Text(err)
                        .font(.footnote)
                        .foregroundStyle(Brand.destructive)
                        .multilineTextAlignment(.center)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 28)

            Spacer()
        }
        .animation(.easeInOut, value: auth.lastError)
        .animation(.easeInOut, value: auth.isExchanging)
    }

    private func handle(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                auth.reportAppleFailure("Apple didn't return an identity token. Try again.")
                return
            }
            Task {
                await auth.signInWithApple(identityToken: identityToken,
                                           inviteCode: inviteCode)
            }
        case .failure(let error):
            // User-cancelled is silent; surface anything else.
            if (error as? ASAuthorizationError)?.code != .canceled {
                auth.reportAppleFailure(error.localizedDescription)
            }
        }
    }
}
