import XCTest
@testable import SetForgeKit

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

final class APIClientTests: XCTestCase {
    private let config = APIConfiguration(baseURL: URL(string: "https://setforge.io")!)

    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient(token: String?) -> APIClient {
        APIClient(
            configuration: config,
            tokenStore: InMemoryTokenStore(token: token),
            session: MockURLProtocol.makeSession()
        )
    }

    func testAuthedRequestAttachesBearerAndPath() async throws {
        MockURLProtocol.handler = { _ in (200, #"{"workout_count":0,"display_name":"x","sub":"s","is_admin":false,"is_coach":false,"stats_by_pool":[]}"#.data(using: .utf8)!, [:]) }
        let client = makeClient(token: "tok_123")
        _ = try await client.send(Endpoint(method: .get, path: "/api/me"), as: User.self)

        let req = try XCTUnwrap(MockURLProtocol.lastRequest)
        XCTAssertEqual(req.url?.path, "/api/me")
        XCTAssertEqual(req.httpMethod, "GET")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer tok_123")
    }

    func testMissingTokenOnAuthedEndpointThrowsUnauthorized() async {
        let client = makeClient(token: nil)
        await XCTAssertThrowsErrorAsync(try await client.send(Endpoint(method: .get, path: "/api/me"), as: User.self)) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func testUnauthedEndpointOmitsAuthorizationHeader() async throws {
        MockURLProtocol.handler = { _ in (200, #"{"ok":true,"token":"new"}"#.data(using: .utf8)!, [:]) }
        let client = makeClient(token: nil)
        let body = try Endpoint.json(.post, "/api/auth/native",
                                     body: NativeAuthRequest(identityToken: "idtok"),
                                     requiresAuth: false)
        _ = try await client.send(body, as: NativeAuthResponse.self)

        let req = try XCTUnwrap(MockURLProtocol.lastRequest)
        XCTAssertEqual(req.httpMethod, "POST")
        XCTAssertNil(req.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func test401MapsToUnauthorized() async {
        MockURLProtocol.handler = { _ in (401, Data(), [:]) }
        let client = makeClient(token: "tok")
        await XCTAssertThrowsErrorAsync(try await client.send(Endpoint(method: .get, path: "/api/me"), as: User.self)) { error in
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func test403ParsesInviteCode() async {
        MockURLProtocol.handler = { _ in (403, #"{"error":"invite_consumed"}"#.data(using: .utf8)!, [:]) }
        let client = makeClient(token: nil)
        let endpoint = try! Endpoint.json(.post, "/api/auth/native",
                                          body: NativeAuthRequest(identityToken: "idtok"),
                                          requiresAuth: false)
        await XCTAssertThrowsErrorAsync(try await client.send(endpoint, as: NativeAuthResponse.self)) { error in
            XCTAssertEqual(error as? APIError, .forbidden(code: "invite_consumed"))
        }
    }

    func test429MapsToRateLimited() async {
        MockURLProtocol.handler = { _ in (429, Data(), [:]) }
        let client = makeClient(token: "tok")
        await XCTAssertThrowsErrorAsync(try await client.send(Endpoint(method: .get, path: "/api/workouts"), as: [Workout].self)) { error in
            XCTAssertEqual(error as? APIError, .rateLimited)
        }
    }

    func test500CarriesServerMessage() async {
        MockURLProtocol.handler = { _ in (500, #"{"error":"db_down","message":"database unavailable"}"#.data(using: .utf8)!, [:]) }
        let client = makeClient(token: "tok")
        await XCTAssertThrowsErrorAsync(try await client.send(Endpoint(method: .get, path: "/api/me"), as: User.self)) { error in
            XCTAssertEqual(error as? APIError, .server(status: 500, code: "db_down", message: "database unavailable"))
        }
    }
}

// MARK: - Async throwing assertion helper

func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ message: String = "Expected an error to be thrown",
    file: StaticString = #filePath,
    line: UInt = #line,
    _ errorHandler: (Error) -> Void = { _ in }
) async {
    do {
        _ = try await expression()
        XCTFail(message, file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
