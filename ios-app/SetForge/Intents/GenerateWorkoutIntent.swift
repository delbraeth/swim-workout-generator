import AppIntents

/// B9 — "Hey Siri, generate a SetForge workout." A voice/Shortcuts entry point
/// that opens the app and kicks off a quick generate at the requested length.
///
/// We open the app (`openAppWhenRun`) rather than generating headlessly: the
/// generate call needs the signed-in session + server, and the swimmer wants to
/// see/run the result. The optional `length` parameter is Siri's natural-language
/// slot — "a long workout" resolves to `.long` with no extra taps.
struct GenerateWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Generate Swim Workout"
    static var description = IntentDescription("Open SetForge and build a quick swim workout.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Length")
    var length: WorkoutLength?

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let yards = (length ?? .medium).yards
        QuickGenerate.shared.request(yards: yards)
        return .result(dialog: "Opening SetForge to build a \(yards)-yard set.")
    }
}

/// Natural-language workout length → target yardage. Siri maps spoken phrases
/// ("short", "medium", "long") onto these cases.
enum WorkoutLength: String, AppEnum {
    case short
    case medium
    case long

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Workout Length"
    static var caseDisplayRepresentations: [WorkoutLength: DisplayRepresentation] = [
        .short: "Short (~1500)",
        .medium: "Medium (~3000)",
        .long: "Long (~4500)",
    ]

    var yards: Int {
        switch self {
        case .short:  return 1500
        case .medium: return 3000
        case .long:   return 4500
        }
    }
}
