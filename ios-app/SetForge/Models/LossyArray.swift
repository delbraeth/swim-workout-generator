import Foundation

/// Decodes an array element-by-element, **skipping** any element that fails to
/// decode instead of throwing the whole array away. Use for server lists whose
/// individual items might drift in shape — one malformed set shouldn't blank an
/// entire workout (the failure mode that hid the `eq`-type bug).
///
/// Implementation note: each element is first consumed as `AnyCodable` (which
/// decodes any JSON, reliably advancing the unkeyed container's cursor), then
/// re-decoded into `T`. This avoids the infinite-loop hazard of a thrown
/// `decode` not advancing the index.
struct LossyArray<T: Decodable>: Decodable {
    let elements: [T]

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var result: [T] = []
        let encoder = JSONEncoder()
        let dec = JSONDecoder()
        while !container.isAtEnd {
            let raw = try container.decode(AnyCodable.self)
            if let data = try? encoder.encode(raw),
               let value = try? dec.decode(T.self, from: data) {
                result.append(value)
            }
            // else: drop this element silently and continue.
        }
        elements = result
    }
}

extension KeyedDecodingContainer {
    /// Lossy decode of an array under `key` — missing key ⇒ `nil`, malformed
    /// elements are skipped. Never throws on element shape mismatch.
    func decodeLossyArray<T: Decodable>(_ type: T.Type, forKey key: Key) -> [T]? {
        guard let lossy = try? decodeIfPresent(LossyArray<T>.self, forKey: key) else { return nil }
        return lossy.elements
    }
}
