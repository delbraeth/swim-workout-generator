import SwiftUI
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct SetForgeApp: App {
    @StateObject private var auth = AuthManager()
    // Long-lived so the StoreKit transaction listener survives the app session.
    @StateObject private var store = StoreKitManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .tint(Brand.primary)
                .preferredColorScheme(.dark)
                .task { await auth.bootstrap() }
                // Background StoreKit updates (renewals, refunds, family sharing)
                // push to the server so entitlement stays correct without a
                // relaunch. Inert when IAP isn't configured.
                .task { store.listenForTransactions() }
                #if canImport(GoogleSignIn)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
                #endif
        }
    }
}
