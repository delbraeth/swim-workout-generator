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
    subscript(_ key: String) -> AnyCodable? {
        if case .object(let dict) = self { return dict[key] }
        return nil
    }
}
