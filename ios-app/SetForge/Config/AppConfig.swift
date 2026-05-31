import SwiftUI

/// App-wide configuration. Values mirror the SetForge backend contract
/// described in API_INTEGRATION.md.
enum AppConfig {
    /// Base URL of the SetForge backend. The same Node/Express server that
    /// powers the web app. All `/api/*` calls hang off this host.
    ///
    /// Defaults to production for every build, so the app works out of the box
    /// against the real backend + DB + Apple auth.
    ///
    /// To run against a **local** `node server.js` later, set a `SETFORGE_BASE_URL`
    /// scheme environment variable (Product → Scheme → Edit Scheme → Run →
    /// Arguments → Environment Variables) — no recompile needed:
    ///   • Simulator: `http://localhost:8080` (the Debug Info.plist whitelists
    ///     insecure HTTP to localhost; Release builds have no such exception).
    ///   • Physical device: your Mac's LAN IP, e.g. `http://192.168.1.42:8080`
    ///     (localhost on a device is the device itself).
    static let baseURL: URL = {
        if let override = ProcessInfo.processInfo.environment["SETFORGE_BASE_URL"],
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://setforge.io")!
    }()

    /// API prefix (the SPA uses a same-origin `/api`).
    static let apiPath = "/api"

    /// Google Sign-In iOS OAuth client ID. Its reversed form is the URL scheme
    /// registered in the app's Info (CFBundleURLTypes). The backend must accept
    /// this as a token audience via `GOOGLE_NATIVE_CLIENT_ID`.
    static let googleIOSClientID = "954573648973-po6gk9nrdoarq8s7ncev7cmet5dmnkoc.apps.googleusercontent.com"

    /// Platform rate limit (Hyperlift): 30 requests per minute, identical on
    /// every tier and not raisable. We never fan out parallel `/api/*` calls;
    /// we lean on the composite endpoints and retry 429s with backoff.
    static let rateLimitPerMinute = 30
}

/// Brand palette lifted verbatim from the web SPA's CSS custom properties so
/// the native client matches setforge.io.
enum Brand {
    static let bg            = Color(hex: 0x0F172A) // --color-bg
    static let card          = Color(hex: 0x1E293B) // --color-card
    static let border        = Color(hex: 0x334155) // --color-border
    static let borderStrong  = Color(hex: 0x475569) // --color-border-strong
    static let text          = Color(hex: 0xE2E8F0) // --color-text
    static let textMuted     = Color(hex: 0x94A3B8) // --color-text-muted
    static let textDim       = Color(hex: 0x8B95A6) // --color-text-dim
    static let primary       = Color(hex: 0x3B82F6) // --color-primary
    static let warn          = Color(hex: 0xF59E0B) // --color-warn
    static let positive      = Color(hex: 0x22C55E) // --color-positive
    static let destructive   = Color(hex: 0xEF4444) // --color-destructive
    static let currentDevice = Color(hex: 0x1E3A5F) // highlighted "this device" row
}

extension Color {
    /// Convenience initializer from a 0xRRGGBB integer.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

extension View {
    /// Caps content to a comfortable reading width and centers it — keeps the
    /// iPhone-designed screens from stretching edge-to-edge on iPad.
    func readableWidth(_ maxWidth: CGFloat = 640) -> some View {
        frame(maxWidth: maxWidth).frame(maxWidth: .infinity)
    }
}
