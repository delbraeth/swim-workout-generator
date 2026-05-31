import SwiftUI

@main
struct SetForgeApp: App {
    @StateObject private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(environment)
                .task { await environment.start() }
        }
    }
}
