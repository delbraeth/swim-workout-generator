import Foundation

/// A type-erased `Codable` value. The SetForge `settings` blob and various
/// flag/overlay payloads are open-ended maps (`settings.extra` is spread into
/// the top-level response server-side), so we decode the parts we model
/// explicitly and keep the rest as `AnyCodable` rather than failing.
enum AnyCodable: Codable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodable])
    case object([String: AnyCodable])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Int.self) {
            self = .int(v)
        } else if let v = try? c.decode(Double.self) {
            self = .double(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([AnyCodable].self) {
            self = .array(v)
        } else if let v = try? c.decode([String: AnyCodable].self) {
            self = .object(v)
        } else {
            throw DecodingError.dataCorruptedError(
                in: c, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .int(let v):    try c.encode(v)
        case .double(let v): try c.encode(v)
        case .bool(let v):   try c.encode(v)
        case .array(let v):  try c.encode(v)
        case .object(let v): try c.encode(v)
        case .null:          try c.encodeNil()
        }
    }

    // Convenience accessors.
    var stringValue: String? { if case .string(let v) = self { return v }; return nil }
    var intValue: Int? {
        switch self {
        case .int(let v): return v
        case .double(let v): return Int(v)
        default: return nil
        }
    }
    var boolValue: Bool? { if case .bool(let v) = self { return v }; return nil }
    var doubleValue: Double? {
        switch self {
        case .double(let v): return v
        case .int(let v): return Double(v)
        default: return nil
        }
    }
    var arrayValue: [AnyCodable]? { if case .array(let v) = self { return v }; return nil }
    var objectValue: [String: AnyCodable]? { if case .object(let v) = self { return v }; return nil }

    /// Keyed get/set for `.object`. The setter is a no-op on non-objects; it
    /// preserves all other keys and supports removal via `nil`.
    subscript(_ key: String) -> AnyCodable? {
        get {
            if case .object(let dict) = self { return dict[key] }
            return nil
        }
        set {
            guard case .object(var dict) = self else { return }
            dict[key] = newValue
            self = .object(dict)
        }
    }

    /// Indexed get/set for `.array`. Out-of-range access returns nil / no-ops.
    subscript(_ index: Int) -> AnyCodable? {
        get {
            if case .array(let arr) = self, arr.indices.contains(index) { return arr[index] }
            return nil
        }
        set {
            guard case .array(var arr) = self, arr.indices.contains(index) else { return }
            if let newValue { arr[index] = newValue } else { arr.remove(at: index) }
            self = .array(arr)
        }
    }
}
