import Foundation

/// The 12-preset dryland bank, mirroring the web's `DRYLAND_OPTIONS` in
/// public/index.html VERBATIM (same ids, names, placements, and exercise
/// sets/reps/rest). Both clients hit the same backend, so a dryland block added
/// on iOS must be byte-identical to one added on web. `reps`/`rest` are
/// free-text ("20 each way", "45s hold", nil). Exercise `name`s are the join key
/// for `DrylandGlossary` explainers — keep the two in sync.
struct DrylandPreset: Identifiable {
    let id: String
    let name: String
    let placement: String          // "pre" | "post" default slot
    let exercises: [DrylandPresetExercise]
}

struct DrylandPresetExercise {
    let name: String
    let sets: Int
    let reps: String
    let rest: String?
}

enum DrylandCatalog {
    static let all: [DrylandPreset] = [
        .init(id: "dl_activation", name: "Pre-Pool Activation", placement: "pre", exercises: [
            .init(name: "Arm circles (fwd/back)", sets: 1, reps: "20 each way", rest: nil),
            .init(name: "Leg swings (front/side)", sets: 1, reps: "10 each leg", rest: nil),
            .init(name: "Band pull-aparts", sets: 2, reps: "15", rest: nil),
            .init(name: "Scapular push-ups", sets: 2, reps: "12", rest: nil),
            .init(name: "Bodyweight squats", sets: 1, reps: "15", rest: nil),
        ]),
        .init(id: "dl_core", name: "Core Circuit", placement: "post", exercises: [
            .init(name: "Front plank", sets: 3, reps: "45s hold", rest: "20s"),
            .init(name: "Dead bug", sets: 3, reps: "10 each side", rest: "20s"),
            .init(name: "Hollow-body hold", sets: 3, reps: "30s hold", rest: "20s"),
            .init(name: "Russian twists", sets: 3, reps: "20", rest: "20s"),
        ]),
        .init(id: "dl_shoulder", name: "Shoulder Prehab", placement: "pre", exercises: [
            .init(name: "Band Y-T-W raises", sets: 2, reps: "10 each", rest: "20s"),
            .init(name: "Band external rotation", sets: 2, reps: "15 each arm", rest: "20s"),
            .init(name: "Scapular retraction holds", sets: 2, reps: "20s hold", rest: "20s"),
        ]),
        .init(id: "dl_strength", name: "Dryland Strength", placement: "post", exercises: [
            .init(name: "Push-ups", sets: 3, reps: "12", rest: "45s"),
            .init(name: "Walking lunges", sets: 3, reps: "10 each leg", rest: "45s"),
            .init(name: "Pull-ups (or rows)", sets: 3, reps: "8", rest: "60s"),
            .init(name: "Glute bridge", sets: 3, reps: "15", rest: "45s"),
        ]),
        .init(id: "dl_stretch", name: "Post-Pool Stretch", placement: "post", exercises: [
            .init(name: "Lat stretch (each side)", sets: 1, reps: "30s hold", rest: nil),
            .init(name: "Pec / doorway stretch", sets: 1, reps: "30s hold", rest: nil),
            .init(name: "Cross-body shoulder", sets: 1, reps: "30s each", rest: nil),
            .init(name: "Hip-flexor lunge stretch", sets: 1, reps: "30s each", rest: nil),
        ]),
        .init(id: "dl_lower", name: "Lower-Body Strength", placement: "post", exercises: [
            .init(name: "Goblet squat", sets: 3, reps: "10", rest: "60s"),
            .init(name: "Romanian deadlift (DB)", sets: 3, reps: "10", rest: "60s"),
            .init(name: "Step-ups (each leg)", sets: 3, reps: "10 each", rest: "45s"),
            .init(name: "Calf raises", sets: 3, reps: "15", rest: "30s"),
        ]),
        .init(id: "dl_power", name: "Power / Plyometrics", placement: "pre", exercises: [
            .init(name: "Box jumps (or squat jumps)", sets: 4, reps: "5", rest: "60s"),
            .init(name: "Broad jumps", sets: 3, reps: "5", rest: "60s"),
            .init(name: "Medicine-ball slams", sets: 3, reps: "8", rest: "45s"),
            .init(name: "Streamline jumps", sets: 3, reps: "6", rest: "45s"),
        ]),
        .init(id: "dl_mobility", name: "Mobility Flow", placement: "pre", exercises: [
            .init(name: "World's greatest stretch (each)", sets: 1, reps: "5 each side", rest: nil),
            .init(name: "Cat-cow", sets: 1, reps: "10", rest: nil),
            .init(name: "Thoracic rotations (each)", sets: 1, reps: "8 each", rest: nil),
            .init(name: "Hip 90/90 switches", sets: 1, reps: "8 each", rest: nil),
            .init(name: "Ankle rocks", sets: 1, reps: "10 each", rest: nil),
        ]),
        .init(id: "dl_swimmer_prehab", name: "Swimmer Prehab (shoulders + core)", placement: "pre", exercises: [
            .init(name: "Band pull-aparts", sets: 2, reps: "15", rest: "20s"),
            .init(name: "Prone Y-T-W (light)", sets: 2, reps: "8 each", rest: "20s"),
            .init(name: "Serratus wall slides", sets: 2, reps: "12", rest: "20s"),
            .init(name: "Side plank (each side)", sets: 2, reps: "30s hold", rest: "20s"),
            .init(name: "Bird dog", sets: 2, reps: "8 each side", rest: "20s"),
        ]),
        .init(id: "dl_band", name: "Band Pull (swim-specific)", placement: "post", exercises: [
            .init(name: "Band freestyle pull (each arm)", sets: 3, reps: "15 each", rest: "30s"),
            .init(name: "Band straight-arm pulldown", sets: 3, reps: "15", rest: "30s"),
            .init(name: "Band catch + finish hold", sets: 3, reps: "20s hold", rest: "30s"),
        ]),
        .init(id: "dl_recovery", name: "Recovery / Foam Roll", placement: "post", exercises: [
            .init(name: "Foam roll lats (each)", sets: 1, reps: "45s each", rest: nil),
            .init(name: "Foam roll quads / IT band", sets: 1, reps: "45s each", rest: nil),
            .init(name: "Foam roll upper back", sets: 1, reps: "45s", rest: nil),
            .init(name: "Child's pose + side reach", sets: 1, reps: "45s", rest: nil),
        ]),
        .init(id: "dl_core_strong", name: "Core — Advanced", placement: "post", exercises: [
            .init(name: "Hanging knee raises", sets: 3, reps: "12", rest: "30s"),
            .init(name: "V-ups", sets: 3, reps: "12", rest: "30s"),
            .init(name: "Plank shoulder taps", sets: 3, reps: "20", rest: "30s"),
            .init(name: "Flutter kicks", sets: 3, reps: "30s", rest: "30s"),
            .init(name: "Superman holds", sets: 3, reps: "20s hold", rest: "30s"),
        ]),
    ]
}
