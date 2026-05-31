// swift-tools-version:5.9
import PackageDescription

// SetForgeKit — the data spine for the SetForge iOS client.
//
// Foundation-only on purpose: it carries the networking layer, the Codable
// models that mirror the SetForge server contract, and the auth/session
// abstractions. UIKit / AuthenticationServices / Security framework code lives
// in the app target (iOS-only), so this package builds and tests on any
// platform with a Swift toolchain (including Linux CI).
let package = Package(
    name: "SetForgeKit",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "SetForgeKit", targets: ["SetForgeKit"]),
    ],
    targets: [
        .target(
            name: "SetForgeKit",
            path: "Sources/SetForgeKit"
        ),
        .testTarget(
            name: "SetForgeKitTests",
            dependencies: ["SetForgeKit"],
            path: "Tests/SetForgeKitTests",
            resources: [.copy("Fixtures")]
        ),
    ]
)
