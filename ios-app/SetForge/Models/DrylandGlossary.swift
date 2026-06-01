import Foundation

/// Plain-language explainers for dryland exercises, keyed by exact exercise name.
/// Keys match DrylandCatalog names and the web app's DRYLAND_EXPLAINERS verbatim.
enum DrylandGlossary {
    static let explainers: [String: String] = [
        "Arm circles (fwd/back)": "Big, controlled circles of the arms forward then backward to warm up the shoulder joint and rotator cuff before swimming.",
        "Leg swings (front/side)": "Stand tall and swing one leg front-to-back, then side-to-side; loosens the hips and hamstrings for kicking.",
        "Band pull-aparts": "Hold a resistance band at shoulder height with straight arms and pull it apart, squeezing the shoulder blades together; strengthens the upper back.",
        "Scapular push-ups": "In a straight-arm push-up plank, pinch the shoulder blades together then push them apart — only the blades move. Builds scapular control.",
        "Bodyweight squats": "Feet shoulder-width, sit the hips back and down until the thighs are near parallel, then stand; warms up the legs and hips.",
        "Front plank": "Hold a straight line on forearms and toes, bracing the core — don't let the hips sag or pike. Builds the core stability behind good body position.",
        "Dead bug": "Lie on your back, arms up and knees bent; slowly extend opposite arm and leg while pressing the low back into the floor. Trains anti-extension core control.",
        "Hollow-body hold": "Lie on your back, press the low back down, and lift the shoulders and legs into a shallow banana shape — the streamline core position.",
        "Russian twists": "Sit leaning back with feet up and rotate the torso side to side, tapping the floor each side; works the obliques for stroke rotation.",
        "Band Y-T-W raises": "With a light band, raise the arms into a Y, then T, then W shape, squeezing the shoulder blades each time; rotator-cuff and posture work.",
        "Band external rotation": "Elbow tucked at your side and bent 90°, rotate the forearm outward against a band; strengthens the rotator cuff to protect the shoulder.",
        "Scapular retraction holds": "Pull the shoulder blades down and back and hold; reinforces good posture and a strong catch position.",
        "Push-ups": "Lower the chest to the floor and press back up in a rigid plank; builds the pressing strength used in the pull.",
        "Walking lunges": "Step forward into a lunge, dropping the back knee toward the floor, then step through; builds single-leg strength and balance.",
        "Pull-ups (or rows)": "Hang from a bar and pull the chin over it (or row a band/weight if no bar); the primary back and lat builder, mirroring the swim pull.",
        "Glute bridge": "Lie on your back with knees bent and drive the hips up, squeezing the glutes; strengthens the posterior chain for a stable body line.",
        "Lat stretch (each side)": "Reach one arm overhead and lean away to lengthen the lat down the side of the torso; opens the shoulders for streamline.",
        "Pec / doorway stretch": "Place a forearm on a doorframe and lean through to stretch the chest; counteracts the rounded posture swimming builds.",
        "Cross-body shoulder": "Pull one arm across the chest with the other to stretch the back of the shoulder; relieves shoulder tightness.",
        "Hip-flexor lunge stretch": "In a low lunge, tuck the hips and press forward to stretch the front of the back hip; loosens hip flexors tightened by kicking.",
        "Goblet squat": "Hold a weight at the chest and squat deep, keeping the chest tall; builds leg strength with good posture.",
        "Romanian deadlift (DB)": "Holding dumbbells, hinge at the hips with a flat back, lowering the weights down the legs, then stand; targets hamstrings and glutes.",
        "Step-ups (each leg)": "Step up onto a box with one leg, driving through the heel, then control back down; single-leg power for starts and turns.",
        "Calf raises": "Rise onto the balls of the feet and lower slowly; strengthens the calves and ankles for kicking and push-offs.",
        "Box jumps (or squat jumps)": "Explosively jump onto a box (or straight up); develops the leg power used off the blocks and walls.",
        "Broad jumps": "Jump forward as far as possible from a standing start, landing softly; builds the horizontal explosive power of the start.",
        "Medicine-ball slams": "Lift a medicine ball overhead and slam it down hard, hinging at the hips; full-body power and core drive.",
        "Streamline jumps": "Jump straight up holding a tight streamline with arms locked overhead; links explosive legs to the streamline position off walls.",
        "World's greatest stretch (each)": "From a lunge, drop the elbow inside the front foot, then rotate that same arm to the sky; a full-body mobility opener.",
        "Cat-cow": "On all fours, alternately round and arch the spine; warms up and mobilizes the whole back.",
        "Thoracic rotations (each)": "On all fours or side-lying, rotate the upper back to open the chest; improves the trunk rotation used in freestyle and backstroke.",
        "Hip 90/90 switches": "Sit with both knees bent at 90° to one side, then rotate them to the other side; opens the hips internally and externally.",
        "Ankle rocks": "In a half-kneel, rock the front knee forward over the toes to mobilize the ankle; improves push-off and streamline flexibility.",
        "Prone Y-T-W (light)": "Lie face-down and lift the arms into Y, T, and W shapes off the floor; strengthens the mid-back and rotator cuff.",
        "Serratus wall slides": "Press the forearms on a wall and slide them up while pushing into the wall; activates the serratus for healthy shoulder mechanics.",
        "Side plank (each side)": "Hold a straight line on one forearm and the side of the feet; builds the lateral core stability behind body roll.",
        "Bird dog": "On all fours, extend opposite arm and leg level with the body and hold; trains balanced core stability.",
        "Band freestyle pull (each arm)": "Anchor a band and mimic the freestyle pull stroke against resistance; strengthens the exact catch-and-pull pattern.",
        "Band straight-arm pulldown": "With straight arms, pull a high band down to the thighs; builds the lat engagement that starts the catch.",
        "Band catch + finish hold": "Hold the early-catch position against a band, then the finish position; grooves the strong points of the stroke.",
        "Foam roll lats (each)": "Lie on your side with a foam roller under the lat and roll slowly; releases tightness through the side of the back.",
        "Foam roll quads / IT band": "Roll the front and outside of the thigh on a foam roller to release the quads and IT band after kicking.",
        "Foam roll upper back": "Lie back on a roller under the upper back and roll along the spine; loosens the mid-back for better posture.",
        "Child's pose + side reach": "Kneel and sit back with the arms stretched forward, then walk the hands to each side; a gentle back and lat stretch to finish.",
        "Hanging knee raises": "Hang from a bar and raise the knees toward the chest with control; builds lower-ab strength without straining the back.",
        "V-ups": "Lie flat and simultaneously lift the legs and torso to meet over the hips in a V; strong full-core flexion.",
        "Plank shoulder taps": "In a plank, tap each hand to the opposite shoulder without letting the hips rock; anti-rotation core stability.",
        "Flutter kicks": "Lie on your back, low back pressed down, and make small fast scissoring kicks; mirrors and strengthens the freestyle kick.",
        "Superman holds": "Lie face-down and lift the arms, chest, and legs off the floor and hold; strengthens the lower back and posterior chain.",
    ]

    /// Returns the plain-language explainer for an exercise name, if one exists.
    static func explainer(for name: String?) -> String? {
        guard let name else { return nil }
        return explainers[name]
    }
}
