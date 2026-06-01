import Foundation
import StoreKit

/// StoreKit 2 purchase manager for subscription tiers (SCAFFOLD).
///
/// INERT until `AppConfig.iapProductIDs` is populated (i.e. products exist in
/// App Store Connect). With an empty map, `loadProducts()` returns nothing and
/// the paywall hides itself — so this ships safely with no live products.
///
/// Flow when live:
///   1. `loadProducts()` — fetch Product metadata for the configured IDs.
///   2. `purchase(_:)` — StoreKit purchase → on success, hand the signed
///      transaction JWS to the server (`POST /api/billing/apple/verify`), which
///      validates with Apple and grants the tier. The server is the source of
///      truth for entitlement; we never unlock locally off StoreKit alone.
///   3. `restorePurchases()` — re-sync current entitlements to the server.
///   4. `listenForTransactions()` — background updates (renewals/refunds) also
///      get posted to the server so tier stays correct without a relaunch.
///
/// Entitlement itself is read from `bootstrap.me`/`billing` (server `tier`), NOT
/// from StoreKit — this manager only drives PURCHASE + push-to-server, matching
/// how Stripe entitlement flows through `users.tier` on the web.
@MainActor
final class StoreKitManager: ObservableObject {
    enum Phase: Equatable { case idle, loading, loaded, purchasing, failed(String) }

    @Published var phase: Phase = .idle
    @Published var products: [Product] = []
    @Published var lastError: String?

    private let api: APIClient
    private var txListener: Task<Void, Never>?

    init(api: APIClient = .shared) { self.api = api }

    /// Whether IAP is configured at all (products exist). The paywall checks
    /// this to decide whether to render.
    var isConfigured: Bool { AppConfig.iapConfigured }

    /// Tier for a purchased product id, via the AppConfig map.
    func tier(for productID: String) -> String? { AppConfig.iapProductIDs[productID] }

    func loadProducts() async {
        guard isConfigured else { phase = .idle; return }   // inert with no products
        phase = .loading
        do {
            let ids = Set(AppConfig.iapProductIDs.keys)
            let fetched = try await Product.products(for: ids)
            products = fetched.sorted { $0.price < $1.price }
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
            lastError = error.localizedDescription
        }
    }

    /// Purchase a product, then push the signed transaction to the server for
    /// verification + tier grant. Returns true on a verified purchase.
    @discardableResult
    func purchase(_ product: Product) async -> Bool {
        guard isConfigured else { return false }
        phase = .purchasing; lastError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await pushTransactionToServer(jwsString(from: verification))
                // Finish the transaction so StoreKit stops re-delivering it.
                if case .verified(let txn) = verification { await txn.finish() }
                phase = .loaded
                return true
            case .userCancelled:
                phase = .loaded
                return false
            case .pending:
                phase = .loaded   // ask-to-buy / SCA — server notification will finalize
                return false
            @unknown default:
                phase = .loaded
                return false
            }
        } catch {
            phase = .failed(error.localizedDescription)
            lastError = error.localizedDescription
            return false
        }
    }

    /// Re-sync the user's current entitlements to the server (Restore button).
    func restorePurchases() async {
        guard isConfigured else { return }
        for await result in Transaction.currentEntitlements {
            await pushTransactionToServer(jwsString(from: result))
        }
    }

    /// Background transaction updates (renewals, refunds, family sharing). Start
    /// once at app launch when IAP is configured; pushes each to the server.
    func listenForTransactions() {
        guard isConfigured, txListener == nil else { return }
        txListener = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard let self else { continue }
                await self.pushTransactionToServer(self.jwsString(from: update))
                if case .verified(let txn) = update { await txn.finish() }
            }
        }
    }

    deinit { txListener?.cancel() }

    // MARK: - Server round-trip

    /// POST the signed transaction JWS to the server, which verifies it with
    /// Apple and grants/revokes the tier. Server is authoritative.
    private func pushTransactionToServer(_ jws: String) async {
        struct VerifyBody: Encodable { let signedTransaction: String }
        struct VerifyResp: Decodable { let ok: Bool? }
        do {
            _ = try await api.post("billing/apple/verify",
                                   body: VerifyBody(signedTransaction: jws),
                                   as: VerifyResp.self)
        } catch {
            // Non-fatal: the App Store Server Notification webhook is the
            // backstop — Apple will notify the server of the same transaction
            // server-to-server, so entitlement still resolves on next bootstrap.
            lastError = "Purchase recorded; syncing entitlement may take a moment."
        }
    }

    /// Raw JWS string from a StoreKit transaction verification result.
    /// `VerificationResult<Transaction>.jwsRepresentation` carries the signed
    /// payload (verified or not); the SERVER re-verifies it with Apple's
    /// library, so we forward the JWS regardless and never trust the client's
    /// local verification.
    private func jwsString(from result: VerificationResult<Transaction>) -> String {
        result.jwsRepresentation
    }
}
