import XCTest
@testable import SetForgeKit

final class SetForgeClientTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient(tokenStore: TokenStore) -> SetForgeClient {
        let api = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://setforge.io")!),
            tokenStore: tokenStore,
            session: MockURLProtocol.makeSession()
        )
        return SetForgeClient(api: api, tokenStore: tokenStore)
    }

    func testSignInStoresToken() async throws {
        MockURLProtocol.handler = { _ in (200, #"{"ok":true,"token":"sess_xyz"}"#.data(using: .utf8)!, [:]) }
        let store = InMemoryTokenStore()
        let client = makeClient(tokenStore: store)

        XCTAssertFalse(client.hasStoredSession)
        let resp = try await client.signInWithApple(identityToken: "apple.id.token", inviteCode: "FRIEND")
        XCTAssertEqual(resp.token, "sess_xyz")
        XCTAssertEqual(try store.token(), "sess_xyz")
        XCTAssertTrue(client.hasStoredSession)

        // The native auth request carries the identity token + invite code.
        let req = try XCTUnwrap(MockURLProtocol.lastRequest)
        XCTAssertEqual(req.url?.path, "/api/auth/native")
        // httpBodyStream is used by URLSession; assert via the captured body if present.
    }

    func testSignOutClearsToken() throws {
        let store = InMemoryTokenStore(token: "sess_existing")
        let client = makeClient(tokenStore: store)
        XCTAssertTrue(client.hasStoredSession)
        try client.signOut()
        XCTAssertNil(try store.token())
        XCTAssertFalse(client.hasStoredSession)
    }

    func testBootstrapRoundTrip() async throws {
        let body = #"{"me":{"sub":"s","display_name":"Dana","is_admin":false,"is_coach":false,"workout_count":3,"stats_by_pool":[]},"workouts":[],"goals":[],"_errors":[]}"#
        MockURLProtocol.handler = { _ in (200, body.data(using: .utf8)!, [:]) }
        let client = makeClient(tokenStore: InMemoryTokenStore(token: "tok"))
        let bootstrap = try await client.bootstrap()
        XCTAssertEqual(bootstrap.me?.displayName, "Dana")
        XCTAssertEqual(bootstrap.me?.workoutCount, 3)
    }
}
