import Foundation
@testable import SetForgeKit

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Intercepts URLSession traffic so the networking layer can be exercised
/// without a live server. Install via a custom `URLSessionConfiguration`.
final class MockURLProtocol: URLProtocol {
    /// Set per-test: given the outgoing request, return status + body (+ headers).
    static var handler: ((URLRequest) throws -> (Int, Data, [String: String]))?

    /// Captures the most recent request the client built, for assertions.
    static var lastRequest: URLRequest?

    static func reset() {
        handler = nil
        lastRequest = nil
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        MockURLProtocol.lastRequest = request
        guard let handler = MockURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: APIError.invalidResponse)
            return
        }
        do {
            let (status, body, headers) = try handler(request)
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: headers
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    /// A URLSession wired to use this protocol.
    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }
}
