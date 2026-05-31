import SwiftUI

/// Routes between the launch spinner, the sign-in screen, and the signed-in
/// experience based on `AuthManager.state`.
struct RootView: View {
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        ZStack {
            Brand.bg.ignoresSafeArea()

            switch auth.state {
            case .loading:
                LaunchView()
            case .signedOut:
                SignInView()
            case .signedIn:
                HomeView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.state)
    }
}

/// Brand splash shown while we check for a stored token.
private struct LaunchView: View {
    var body: some View {
        VStack(spacing: 16) {
            SetForgeMark(size: 64)
            ProgressView()
                .tint(Brand.textMuted)
        }
    }
}

/// The SetForge "target reticle" mark, drawn in code so it scales crisply and
/// needs no bundled art for the milestone build.
struct SetForgeMark: View {
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Circle()
                .stroke(Brand.text, lineWidth: size * 0.09)
                .frame(width: size * 0.78, height: size * 0.78)
            // crosshair ticks
            ForEach(0..<4) { i in
                Capsule()
                    .fill(i == 0 ? Brand.primary : Brand.text)
                    .frame(width: size * 0.09, height: size * 0.18)
                    .offset(y: -size * 0.45)
                    .rotationEffect(.degrees(Double(i) * 90))
            }
        }
        .frame(width: size, height: size)
    }
}
