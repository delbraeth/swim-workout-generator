// src/lib/constants.js — split from src/lib/shared.js (SPA-split follow-up #1).

import { COOLDOWN_OPTIONS, COOLDOWN_OPTIONS_50M, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS, DRILL_OPTIONS_50M, DRILL_OPTIONS_SCM, KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM, MAIN_OPTIONS, MAIN_OPTIONS_50M, MAIN_OPTIONS_SCM, WARMUP_OPTIONS, WARMUP_OPTIONS_50M, WARMUP_OPTIONS_SCM } from "./engine.js";

export const SECTION_STYLES = {
      warmup:   { bg: "#f0f9ff", border: "#bae6fd", headerBg: "#e0f2fe", headerText: "#075985", dot: "#0ea5e9" },
      drill:    { bg: "#f0fdfa", border: "#99f6e4", headerBg: "#ccfbf1", headerText: "#134e4a", dot: "var(--color-primary)" },
      kick:     { bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7", headerText: "#92400e", dot: "#f59e0b" },
      main:     { bg: "#f8fafc", border: "var(--color-text)", headerBg: "var(--color-border)", headerText: "#ffffff", dot: "var(--color-text-dim)" },
      cooldown: { bg: "#f9fafb", border: "#e5e7eb", headerBg: "#f3f4f6", headerText: "#374151", dot: "#9ca3af" },
    };

export const ZONE_ORDER = ["easy", "aerobic", "threshold", "vo2", "anaerobic"];

export const LEVEL_PRESETS = {
      recreational: { id: "recreational", label: "Recreational", emoji: "🏖️", pace: "2:30", description: "Fitness swimmer — long, easy intervals" },
      masters:      { id: "masters",      label: "Masters",      emoji: "🏊", pace: "2:00", description: "Adult masters / triathlete — moderate intervals" },
      competitive:  { id: "competitive",  label: "Competitive",  emoji: "🏁", pace: "1:30", description: "Trained competitive swimmer — tight intervals" },
    };

export const SET_ID_NAME_MAP = (() => {
      const m = new Map();
      // Phase H Stage 2: all 12 bank constants are flat arrays now.
      const walkArray = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const opt of arr) {
          if (!opt || !Array.isArray(opt.sets)) continue;
          for (const s of opt.sets) {
            if (s && s.id) m.set(s.id, `${s.reps || 1}×${s.dist} – ${opt.label}`);
          }
        }
      };
      for (const bank of [
        WARMUP_OPTIONS, COOLDOWN_OPTIONS, DRILL_OPTIONS, MAIN_OPTIONS,
        WARMUP_OPTIONS_50M, COOLDOWN_OPTIONS_50M, DRILL_OPTIONS_50M, MAIN_OPTIONS_50M,
        WARMUP_OPTIONS_SCM, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS_SCM, MAIN_OPTIONS_SCM,
        KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM,
      ]) walkArray(bank);
      return m;
    })();

export const EQUIPMENT_LIST = [
      { id: "kickboard", label: "Kickboard", icon: "🟦", description: "Use a board for kick sets" },
      { id: "fins",      label: "Fins",      icon: "🐬", description: "Add fins to kick & underwater sets" },
      { id: "paddles",   label: "Paddles",   icon: "🤚", description: "Add paddles to pull sets" },
      { id: "pullBuoy",  label: "Pull Buoy", icon: "🛟", description: "Confirms buoy use on pull sets" },
      { id: "snorkel",   label: "Snorkel",   icon: "🤿", description: "Adds snorkel cue to freestyle drill and technique sets" },
    ];

export const RIEGEL_EXP = 1.06;

export const STRUCTURED_DESC_RE = /\d+[a-z\s]+\/\s*\d+/i;

export const DRYLAND_OPTIONS = [
      { id: "dl_activation", name: "Pre-Pool Activation", placement: "pre", exercises: [
        { name: "Arm circles (fwd/back)", sets: 1, reps: "20 each way", rest: null },
        { name: "Leg swings (front/side)", sets: 1, reps: "10 each leg", rest: null },
        { name: "Band pull-aparts", sets: 2, reps: "15", rest: null },
        { name: "Scapular push-ups", sets: 2, reps: "12", rest: null },
        { name: "Bodyweight squats", sets: 1, reps: "15", rest: null },
      ]},
      { id: "dl_core", name: "Core Circuit", placement: "post", exercises: [
        { name: "Front plank", sets: 3, reps: "45s hold", rest: "20s" },
        { name: "Dead bug", sets: 3, reps: "10 each side", rest: "20s" },
        { name: "Hollow-body hold", sets: 3, reps: "30s hold", rest: "20s" },
        { name: "Russian twists", sets: 3, reps: "20", rest: "20s" },
      ]},
      { id: "dl_shoulder", name: "Shoulder Prehab", placement: "pre", exercises: [
        { name: "Band Y-T-W raises", sets: 2, reps: "10 each", rest: "20s" },
        { name: "Band external rotation", sets: 2, reps: "15 each arm", rest: "20s" },
        { name: "Scapular retraction holds", sets: 2, reps: "20s hold", rest: "20s" },
      ]},
      { id: "dl_strength", name: "Dryland Strength", placement: "post", exercises: [
        { name: "Push-ups", sets: 3, reps: "12", rest: "45s" },
        { name: "Walking lunges", sets: 3, reps: "10 each leg", rest: "45s" },
        { name: "Pull-ups (or rows)", sets: 3, reps: "8", rest: "60s" },
        { name: "Glute bridge", sets: 3, reps: "15", rest: "45s" },
      ]},
      { id: "dl_stretch", name: "Post-Pool Stretch", placement: "post", exercises: [
        { name: "Lat stretch (each side)", sets: 1, reps: "30s hold", rest: null },
        { name: "Pec / doorway stretch", sets: 1, reps: "30s hold", rest: null },
        { name: "Cross-body shoulder", sets: 1, reps: "30s each", rest: null },
        { name: "Hip-flexor lunge stretch", sets: 1, reps: "30s each", rest: null },
      ]},
      { id: "dl_lower", name: "Lower-Body Strength", placement: "post", exercises: [
        { name: "Goblet squat", sets: 3, reps: "10", rest: "60s" },
        { name: "Romanian deadlift (DB)", sets: 3, reps: "10", rest: "60s" },
        { name: "Step-ups (each leg)", sets: 3, reps: "10 each", rest: "45s" },
        { name: "Calf raises", sets: 3, reps: "15", rest: "30s" },
      ]},
      { id: "dl_power", name: "Power / Plyometrics", placement: "pre", exercises: [
        { name: "Box jumps (or squat jumps)", sets: 4, reps: "5", rest: "60s" },
        { name: "Broad jumps", sets: 3, reps: "5", rest: "60s" },
        { name: "Medicine-ball slams", sets: 3, reps: "8", rest: "45s" },
        { name: "Streamline jumps", sets: 3, reps: "6", rest: "45s" },
      ]},
      { id: "dl_mobility", name: "Mobility Flow", placement: "pre", exercises: [
        { name: "World's greatest stretch (each)", sets: 1, reps: "5 each side", rest: null },
        { name: "Cat-cow", sets: 1, reps: "10", rest: null },
        { name: "Thoracic rotations (each)", sets: 1, reps: "8 each", rest: null },
        { name: "Hip 90/90 switches", sets: 1, reps: "8 each", rest: null },
        { name: "Ankle rocks", sets: 1, reps: "10 each", rest: null },
      ]},
      { id: "dl_swimmer_prehab", name: "Swimmer Prehab (shoulders + core)", placement: "pre", exercises: [
        { name: "Band pull-aparts", sets: 2, reps: "15", rest: "20s" },
        { name: "Prone Y-T-W (light)", sets: 2, reps: "8 each", rest: "20s" },
        { name: "Serratus wall slides", sets: 2, reps: "12", rest: "20s" },
        { name: "Side plank (each side)", sets: 2, reps: "30s hold", rest: "20s" },
        { name: "Bird dog", sets: 2, reps: "8 each side", rest: "20s" },
      ]},
      { id: "dl_band", name: "Band Pull (swim-specific)", placement: "post", exercises: [
        { name: "Band freestyle pull (each arm)", sets: 3, reps: "15 each", rest: "30s" },
        { name: "Band straight-arm pulldown", sets: 3, reps: "15", rest: "30s" },
        { name: "Band catch + finish hold", sets: 3, reps: "20s hold", rest: "30s" },
      ]},
      { id: "dl_recovery", name: "Recovery / Foam Roll", placement: "post", exercises: [
        { name: "Foam roll lats (each)", sets: 1, reps: "45s each", rest: null },
        { name: "Foam roll quads / IT band", sets: 1, reps: "45s each", rest: null },
        { name: "Foam roll upper back", sets: 1, reps: "45s", rest: null },
        { name: "Child's pose + side reach", sets: 1, reps: "45s", rest: null },
      ]},
      { id: "dl_core_strong", name: "Core — Advanced", placement: "post", exercises: [
        { name: "Hanging knee raises", sets: 3, reps: "12", rest: "30s" },
        { name: "V-ups", sets: 3, reps: "12", rest: "30s" },
        { name: "Plank shoulder taps", sets: 3, reps: "20", rest: "30s" },
        { name: "Flutter kicks", sets: 3, reps: "30s", rest: "30s" },
        { name: "Superman holds", sets: 3, reps: "20s hold", rest: "30s" },
      ]},
      { id: "dl_ankle", name: "Ankle & Kick Mobility", placement: "pre", exercises: [
        { name: "Kneeling ankle sit", sets: 2, reps: "45s hold", rest: "15s" },
        { name: "Ankle circles (each way)", sets: 1, reps: "10 each way", rest: null },
        { name: "Toe + heel walks", sets: 2, reps: "15m each", rest: null },
        { name: "Ankle rocks", sets: 1, reps: "10 each", rest: null },
        { name: "Seated dorsiflexion lifts", sets: 2, reps: "12", rest: "15s" },
      ]},
      { id: "dl_balance", name: "Stability & Balance", placement: "pre", exercises: [
        { name: "Single-leg balance (eyes closed)", sets: 2, reps: "30s each leg", rest: "15s" },
        { name: "Single-leg RDL reach", sets: 2, reps: "8 each leg", rest: "20s" },
        { name: "Bird dog", sets: 2, reps: "8 each side", rest: "20s" },
        { name: "Side plank (each side)", sets: 2, reps: "30s hold", rest: "20s" },
        { name: "Single-leg glute bridge", sets: 2, reps: "8 each leg", rest: "20s" },
      ]},
      { id: "dl_starts", name: "Starts & Turns (legs)", placement: "pre", exercises: [
        { name: "Streamline jumps", sets: 3, reps: "6", rest: "45s" },
        { name: "Tuck jumps", sets: 3, reps: "6", rest: "45s" },
        { name: "Lateral bounds", sets: 3, reps: "6 each side", rest: "45s" },
        { name: "Wall sit", sets: 2, reps: "40s hold", rest: "30s" },
        { name: "Broad jumps", sets: 2, reps: "5", rest: "60s" },
      ]},
      { id: "dl_posture", name: "Posture Reset", placement: "pre", exercises: [
        { name: "Wall angels", sets: 2, reps: "10", rest: "20s" },
        { name: "Chin tucks", sets: 2, reps: "10", rest: null },
        { name: "Thoracic extensions (roller or chair)", sets: 2, reps: "8", rest: "20s" },
        { name: "Cat-cow", sets: 1, reps: "10", rest: null },
        { name: "Pec / doorway stretch", sets: 1, reps: "30s hold", rest: null },
      ]},
      { id: "dl_hips", name: "Hip Strength & Rotation", placement: "post", exercises: [
        { name: "Clamshells", sets: 2, reps: "15 each side", rest: "20s" },
        { name: "Fire hydrants", sets: 2, reps: "12 each side", rest: "20s" },
        { name: "Glute bridge march", sets: 2, reps: "10 each leg", rest: "30s" },
        { name: "Hip 90/90 switches", sets: 1, reps: "8 each", rest: null },
        { name: "Side-lying leg raises", sets: 2, reps: "12 each side", rest: "20s" },
      ]},
    ];

export const DRYLAND_EXPLAINERS = {
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
      "Kneeling ankle sit": "Kneel and sit back on your heels with the tops of the feet flat on the floor; stretches the ankles into the pointed-toe position a good kick needs.",
      "Ankle circles (each way)": "Seated or standing on one leg, draw slow circles with the foot in both directions; loosens the ankle for a supple, whippy kick.",
      "Toe + heel walks": "Walk on tiptoes, then on your heels; wakes up the calves and shins and builds ankle control at both ends of its range.",
      "Seated dorsiflexion lifts": "Seated with heels planted, lift the toes and forefoot as high as you can and lower slowly; strengthens the shin muscles that balance a big kick.",
      "Single-leg balance (eyes closed)": "Stand on one leg, find your balance, then close your eyes and hold; sharpens the body awareness behind streamlines, starts, and turns.",
      "Single-leg RDL reach": "Standing on one leg, hinge at the hip and reach toward the floor while the back leg lifts behind you, then stand tall; balance plus hamstring and glute strength.",
      "Single-leg glute bridge": "Lie on your back, one foot planted and the other leg extended; drive the hips up through the planted heel. Builds one-sided glute power for kicks and push-offs.",
      "Tuck jumps": "Jump straight up and pull both knees toward the chest, landing softly; explosive leg power for starts.",
      "Lateral bounds": "Bound sideways from one leg to the other, sticking each landing; builds the lateral leg power and control used driving off the blocks and walls.",
      "Wall sit": "Slide your back down a wall until the thighs are parallel and hold; isometric leg strength that mirrors the loaded position of a start or turn push-off.",
      "Wall angels": "Stand with back, head, and arms against a wall and slide the arms up and down like a snow angel without losing contact; opens the chest and trains overhead posture.",
      "Chin tucks": "Draw the chin straight back (making a 'double chin') without tilting the head, hold a beat, release; resets head position for a neutral, low-drag bodyline.",
      "Thoracic extensions (roller or chair)": "With a foam roller (or chair back) across the upper back, hands behind head, arch the upper spine over it; restores the upper-back extension a long streamline needs.",
      "Clamshells": "Lie on your side with knees bent and stacked; keeping the feet together, open the top knee like a clamshell. Strengthens the hip rotators that stabilize the kick.",
      "Fire hydrants": "On all fours, lift one bent knee out to the side without rotating the torso; hip strength and control through rotation.",
      "Glute bridge march": "Hold the top of a glute bridge and march, lifting one foot at a time without letting the hips drop; anti-rotation hip and core stability.",
      "Side-lying leg raises": "Lie on your side and lift the top leg up and slightly back, slow and controlled; strengthens the outer hip for a stable, even kick.",
    };

export const REST_OPTIONS = [
      { label: "Manual", value: null },
      { label: "0s",     value: 0 },
      { label: "30s",    value: 30 },
      { label: "45s",    value: 45 },
      { label: "60s",    value: 60 },
    ];

export const GOAL_METRICS = [
      { id: "workouts_per_week", label: "Workouts / week", unit: "workouts", period: "week",  defaultTarget: 3 },
      { id: "yards_per_week",    label: "Yards / week",    unit: "yds",      period: "week",  defaultTarget: 8000 },
      { id: "yards_per_month",   label: "Yards / month",   unit: "yds",      period: "month", defaultTarget: 32000 },
    ];

export const CATALOG_SECTIONS = ["warmup", "drill", "kick", "main", "cooldown"];

export const CATALOG_TYPES    = ["all", "im", "distance", "sprint", "endurance", "technique", "mixed", "back", "breast", "fly"];

export const CATALOG_ALL_EQUIP = { kickboard: "preferred", fins: "preferred", paddles: "preferred", pullBuoy: "preferred", snorkel: "preferred" };

export const COMPLETION_LABELS = {
      not_started: { label: "Not started", color: "var(--color-text-dim)" },
      partial:     { label: "Partial",     color: "var(--color-warn)" },
      complete:    { label: "Complete",    color: "var(--color-positive)" },
      missed:      { label: "Missed",      color: "var(--color-destructive)" },
    };

export const REPORT_RANGES = [
      { id: "week",            label: "Last 7 days" },
      { id: "month",           label: "Last 30 days" },
      { id: "quarter",         label: "Last 90 days" },
      { id: "season-to-date",  label: "Season-to-date" },
    ];

export const PHASE_OPTIONS = [
      { v: "",         label: "—", color: "var(--color-text-dim)" },
      { v: "base",     label: "Base 🌱",     color: "var(--color-positive)" },
      { v: "build",    label: "Build 🔨",    color: "var(--color-primary)" },
      { v: "peak",     label: "Peak ⛰️",     color: "var(--color-warn)" },
      { v: "taper",    label: "Taper 📉",    color: "var(--color-warn)" },
      { v: "recovery", label: "Recovery 🌿", color: "var(--color-primary)" },
    ];

export const DOB_MIN = "1900-01-01";

export const DOB_MAX_TODAY = () => new Date().toISOString().slice(0, 10);

export const PSC_TYPE_GROUPS = [
      {
        label: "Stroke (no fly / breast / back / free)",
        opts: [
          { v: "stroke_no_fly",    label: "No fly" },
          { v: "stroke_no_breast", label: "No breaststroke" },
          { v: "stroke_no_back",   label: "No backstroke" },
          { v: "stroke_no_free",   label: "No freestyle" },
        ],
      },
      {
        label: "Equipment (no paddles / fins / etc.)",
        opts: [
          { v: "equip_no_paddles",   label: "No paddles" },
          { v: "equip_no_fins",      label: "No fins" },
          { v: "equip_no_snorkel",   label: "No snorkel" },
          { v: "equip_no_kickboard", label: "No kickboard" },
          { v: "equip_no_buoy",      label: "No pull-buoy" },
        ],
      },
      {
        label: "Section (skip main / kick / drill)",
        opts: [
          { v: "section_no_main",  label: "Skip main set"  },
          { v: "section_no_kick",  label: "Skip kick section"  },
          { v: "section_no_drill", label: "Skip drill section" },
        ],
      },
      {
        label: "Caps (yardage / intensity)",
        opts: [
          { v: "cap_yardage",   label: "Yardage cap" },
          { v: "cap_intensity", label: "Intensity cap (easy-only)" },
        ],
      },
    ];

export const PSC_LABEL_MAP = (() => {
      const m = {};
      for (const g of PSC_TYPE_GROUPS) for (const o of g.opts) m[o.v] = o.label;
      return m;
    })();

export const GENDER_OPTIONS = [
      { v: "",                  label: "—" },
      { v: "M",                 label: "Male" },
      { v: "F",                 label: "Female" },
      { v: "X",                 label: "Non-binary / other" },
      { v: "prefer_not_to_say", label: "Prefer not to say" },
    ];

export const IMPORT_NEW_HEADERS = ["first_name", "last_name", "preferred_name", "dob", "gender", "initials", "pace_scy_100", "pace_scm_100", "pace_lcm_100", "parental_contact"];

export const IMPORT_RECOGNIZED = ["name", "first_name", "last_name", "preferred_name", "dob", "initials", "gender", "pace_scy_100", "pace_scm_100", "pace_lcm_100", "parental_contact"];

export const GENDER_CSV_MAP = {
      "m": "M", "male": "M", "boy": "M",
      "f": "F", "female": "F", "girl": "F",
      "x": "X", "nb": "X", "non-binary": "X", "nonbinary": "X", "other": "X",
      "pnts": "prefer_not_to_say", "prefer not to say": "prefer_not_to_say", "decline": "prefer_not_to_say",
    };

export const SECTION_EMOJIS = { warmup: "🌊", drill: "🎯", kick: "🦵", main: "💪", cooldown: "🧊" };
