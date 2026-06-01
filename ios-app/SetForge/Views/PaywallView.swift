import SwiftUI
import StoreKit

/// Subscription paywall (SCAFFOLD). Renders the configured IAP products and
/// drives StoreKitManager. Until products exist in App Store Connect
/// (`AppConfig.iapConfigured == false`), it shows a neutral "not available
/// here" state instead — so it's safe to ship and link to before go-live.
///
/// NOTE (App Review): when this is live on iOS it must NOT link to or mention
/// Stripe / external web checkout for the purchase. iOS purchases go through
/// IAP only; the web app keeps Stripe. See IAP_PLAN.md.
struct PaywallView: View {
    @StateObject private var store = StoreKitManager()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("Upgrade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.tint(Brand.primary)
                }
                if AppConfig.iapConfigured {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Restore") { Task { await store.restorePurchases() } }
                            .tint(Brand.textMuted).font(.caption)
                    }
                }
            }
            .task { await store.loadProducts() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if !AppConfig.iapConfigured {
            // Inert state — no products configured yet.
            VStack(spacing: 12) {
                Image(systemName: "star.circle").font(.largeTitle).foregroundStyle(Brand.textDim)
                Text("Subscriptions aren't available here yet")
                    .font(.headline).foregroundStyle(Brand.text)
                Text("You can manage your plan on the web at setforge.io.")
                    .font(.footnote).foregroundStyle(Brand.textDim)
                    .multilineTextAlignment(.center)
            }
            .padding()
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Unlock coach tools")
                        .font(.title2.weight(.bold)).foregroundStyle(Brand.text)
                    switch store.phase {
                    case .loading, .idle:
                        ProgressView().tint(Brand.textMuted).frame(maxWidth: .infinity)
                    case .failed(let msg):
                        Text(msg).font(.footnote).foregroundStyle(Brand.warn)
                    case .loaded, .purchasing:
                        ForEach(store.products, id: \.id) { product in
                            productCard(product)
                        }
                        if store.products.isEmpty {
                            Text("No plans available right now.")
                                .font(.footnote).foregroundStyle(Brand.textDim)
                        }
                    }
                    if let err = store.lastError {
                        Text(err).font(.caption).foregroundStyle(Brand.textDim)
                    }
                }
                .padding()
                .readableWidth()
            }
        }
    }

    private func productCard(_ product: Product) -> some View {
        Button {
            Task { await store.purchase(product) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.displayName).font(.subheadline.weight(.semibold)).foregroundStyle(Brand.text)
                    Text(product.description).font(.caption2).foregroundStyle(Brand.textDim)
                }
                Spacer()
                Text(product.displayPrice).font(.headline).foregroundStyle(Brand.primary)
            }
            .padding()
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(store.phase == .purchasing)
    }
}
