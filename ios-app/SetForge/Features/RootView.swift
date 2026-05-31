import SwiftUI

/// Switches between the launch splash, sign-in, and the signed-in home shell
/// based on `AppEnvironment.phase`.
struct RootView: View {
    @EnvironmentObject private var env: AppEnvironment

    var body: some View {
        switch env.phase {
        case .launching:
            LaunchView()
        case .signedOut:
            SignInView()
        case .signedIn:
            HomeView()
        }
    }
}

private struct LaunchView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "figure.pool.swim")
                .font(.system(size: 48))
                .foregroundStyle(.tint)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}
