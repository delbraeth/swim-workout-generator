import XCTest
@testable import SetForgeKit

final class ModelDecodingTests: XCTestCase {
    private let decoder = SetForgeCoders.decoder

    private func fixture(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: name, withExtension: "json") else {
            throw XCTSkip("Missing fixture \(name).json")
        }
        return try Data(contentsOf: url)
    }

    func testDecodeMe() throws {
        let user = try decoder.decode(User.self, from: fixture("me"))
        XCTAssertEqual(user.sub, "001234.abcdef0123456789.0001")
        XCTAssertEqual(user.displayName, "Dana Swift")
        XCTAssertEqual(user.gender, .female)
        XCTAssertEqual(user.classYear, 2027)
        XCTAssertEqual(user.workoutCount, 42)
        XCTAssertEqual(user.statsByPool.count, 2)
        XCTAssertEqual(user.statsByPool.first?.poolMode, .scy)
        XCTAssertEqual(user.providers?.first?.provider, "apple")
        XCTAssertFalse(user.isAdmin)
    }

    func testDecodeWorkouts() throws {
        let workouts = try decoder.decode([Workout].self, from: fixture("workouts"))
        XCTAssertEqual(workouts.count, 2)

        let im = workouts[0]
        XCTAssertEqual(im.id, "w_aaa111")
        XCTAssertEqual(im.type, .im)
        XCTAssertEqual(im.totalYards, 3000)
        XCTAssertEqual(im.poolMode, .scy)
        XCTAssertTrue(im.completed)
        XCTAssertEqual(im.difficulty, 3)
        // Free-form payload survives decode.
        XCTAssertEqual(im.payload?["blocks"]?[0]?["label"]?.stringValue, "warmup")

        let sprint = workouts[1]
        XCTAssertEqual(sprint.type, .sprint)
        XCTAssertNil(sprint.dateCompleted)
        XCTAssertNil(sprint.difficulty)
        XCTAssertNil(sprint.payload)
        XCTAssertNil(sprint.sub)   // sub omitted on this entry
    }

    func testDecodeBootstrap() throws {
        let bootstrap = try decoder.decode(Bootstrap.self, from: fixture("bootstrap"))
        XCTAssertEqual(bootstrap.me?.displayName, "Dana Swift")
        XCTAssertEqual(bootstrap.workouts.count, 1)
        XCTAssertEqual(bootstrap.settings?.phase, .build)
        XCTAssertEqual(bootstrap.settings?.level, .competitive)
        XCTAssertEqual(bootstrap.settings?.nextEvent?.name, "Summer States")
        XCTAssertEqual(bootstrap.settings?.lapButton, true)
        XCTAssertEqual(bootstrap.goals.first?.metric, "workouts_per_week")
        XCTAssertEqual(bootstrap.goals.first?.targetValue, 5)
        XCTAssertTrue(bootstrap.errors.isEmpty)
        // Unmodeled sections are preserved as raw JSON.
        XCTAssertEqual(bootstrap.raw["favorites"]?[0]?.stringValue, "sprint ladder")
        XCTAssertEqual(bootstrap.raw["billing"]?["status"]?["tier"]?.stringValue, "free")
    }

    func testBootstrapToleratesMalformedSection() throws {
        // A goals section of the wrong shape must not sink the whole bootstrap.
        let json = """
        { "me": null, "workouts": [], "goals": "not-an-array", "_errors": ["goals"] }
        """.data(using: .utf8)!
        let bootstrap = try decoder.decode(Bootstrap.self, from: json)
        XCTAssertTrue(bootstrap.goals.isEmpty)
        XCTAssertEqual(bootstrap.errors, ["goals"])
    }

    func testNativeAuthResponse() throws {
        let json = #"{ "ok": true, "token": "sess_abc123" }"#.data(using: .utf8)!
        let resp = try decoder.decode(NativeAuthResponse.self, from: json)
        XCTAssertTrue(resp.ok)
        XCTAssertEqual(resp.token, "sess_abc123")
    }

    func testWorkoutPatchOmitsUnsetFieldsAndEncodesExplicitNull() throws {
        // completed set; notes explicitly cleared; others untouched.
        let patch = WorkoutPatch(notes: .some(nil), completed: true)
        let data = try JSONEncoder().encode(patch)
        let object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(object.keys.sorted(), ["completed", "notes"])
        XCTAssertTrue(object["notes"] is NSNull)
        XCTAssertEqual(object["completed"] as? Bool, true)
    }
}
