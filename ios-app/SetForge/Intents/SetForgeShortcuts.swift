import AppIntents

/// B9 — registers the voice phrases so "Hey Siri, generate a SetForge workout"
/// works with zero setup, and the action appears in the Shortcuts app. Phrases
/// must include `\(.applicationName)` per App Intents requirements.
struct SetForgeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GenerateWorkoutIntent(),
            phrases: [
                "Generate a \(.applicationName) workout",
                "Build a workout with \(.applicationName)",
                "New set in \(.applicationName)",
            ],
            shortTitle: "Generate Workout",
            systemImageName: "wand.and.stars"
        )
    }
}
