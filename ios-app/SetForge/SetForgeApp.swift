import SwiftUI

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
        }
    }
}
