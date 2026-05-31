import SwiftUI
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct SetForgeApp: App {
    @StateObject private var auth = AuthManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .tint(Brand.primary)
                .preferredColorScheme(.dark)
                .task { await auth.bootstrap() }
                #if canImport(GoogleSignIn)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
                #endif
        }
    }
}
