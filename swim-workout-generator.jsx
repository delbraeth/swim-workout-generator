import { useState, useCallback } from "react";

// ─── Workout Types ────────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  {
    id: "im",
    label: "IM Focus",
    emoji: "🦋",
    description: "All four strokes — fly, back, breast, free",
    border: "border-purple-300",
    selBg: "bg-purple-600",
    selBorder: "border-purple-600",
    badge: "bg-purple-100 text-purple-800",
    pill: "bg-purple-600",
    headerBg: "bg-purple-700",
  },
  {
    id: "distance",
    label: "Distance",
    emoji: "🏊",
    description: "Longer swims, building aerobic base",
    border: "border-blue-300",
    selBg: "bg-blue-600",
    selBorder: "border-blue-600",
    badge: "bg-blue-100 text-blue-800",
    pill: "bg-blue-600",
    headerBg: "bg-blue-700",
  },
  {
    id: "sprint",
    label: "Sprint",
    emoji: "⚡",
    description: "Short, fast swims with full recovery",
    border: "border-red-300",
    selBg: "bg-red-600",
    selBorder: "border-red-600",
    badge: "bg-red-100 text-red-800",
    pill: "bg-red-600",
    headerBg: "bg-red-700",
  },
  {
    id: "endurance",
    label: "Endurance",
    emoji: "💪",
    description: "Steady-state, long continuous swims",
    border: "border-green-300",
    selBg: "bg-green-600",
    selBorder: "border-green-600",
    badge: "bg-green-100 text-green-800",
    pill: "bg-green-600",
    headerBg: "bg-green-700",
  },
  {
    id: "technique",
    label: "Technique",
    emoji: "🎯",
    description: "Drills, kick sets, and stroke refinement",
    border: "border-teal-300",
    selBg: "bg-teal-600",
    selBorder: "border-teal-600",
    badge: "bg-teal-100 text-teal-800",
    pill: "bg-teal-600",
    headerBg: "bg-teal-700",
  },
  {
    id: "mixed",
    label: "Mixed",
    emoji: "🔀",
    description: "Sprints, distance, and drills combined",
    border: "border-orange-300",
    selBg: "bg-orange-600",
    selBorder: "border-orange-600",
    badge: "bg-orange-100 text-orange-800",
    pill: "bg-orange-600",
    headerBg: "bg-orange-700",
  },
];

// ─── Section style map ────────────────────────────────────────────────────────

const SECTION_STYLES = {
  warmup:   { bg: "bg-sky-50",    border: "border-sky-200",   header: "bg-sky-100 text-sky-800",   dot: "bg-sky-500" },
  drill:    { bg: "bg-teal-50",   border: "border-teal-200",  header: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
  main:     { bg: "bg-slate-50",  border: "border-slate-200", header: "bg-slate-700 text-white",   dot: "bg-slate-600" },
  cooldown: { bg: "bg-gray-50",   border: "border-gray-200",  header: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
};

// ─── Random helpers ───────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Warmup generator ─────────────────────────────────────────────────────────
// All options produce exactly the yards listed — verified by reps × dist

function generateWarmup() {
  const options = [
    // 400 yards
    {
      sets: [
        { reps: 1, dist: 400, desc: "Easy Freestyle", interval: "No interval — swim at a comfortable pace", focus: "Loosen up, steady breathing", totalYards: 400 },
      ],
      totalYards: 400,
    },
    // 500 yards: 200 + 4×50
    {
      sets: [
        { reps: 1,  dist: 200, desc: "Easy Freestyle",                          interval: "No interval",  focus: "Settle into rhythm",             totalYards: 200 },
        { reps: 4,  dist:  50, desc: "25 Drill / 25 Easy Swim (stroke choice)", interval: "On :60",       focus: "Feel for the water, relaxed",     totalYards: 200 },
      ],
      totalYards: 400,
    },
    // 400 yards: 300 + 4×25
    {
      sets: [
        { reps: 1,  dist: 300, desc: "Freestyle — build from easy to moderate", interval: "No interval",  focus: "Gradually wake up",              totalYards: 300 },
        { reps: 4,  dist:  25, desc: "Kick (no board, streamlined)",            interval: "On :40",       focus: "Loosen hips and ankles",         totalYards: 100 },
      ],
      totalYards: 400,
    },
    // 500 yards: 400 + 4×25
    {
      sets: [
        { reps: 1,  dist: 400, desc: "Freestyle — easy, focus on long stroke",  interval: "No interval",  focus: "Prime the aerobic engine",       totalYards: 400 },
        { reps: 4,  dist:  25, desc: "Backstroke — easy, open the shoulders",   interval: "On :45",       focus: "Counter the freestyle pull",     totalYards: 100 },
      ],
      totalYards: 500,
    },
  ];
  const o = pick(options);
  return { name: "Warm-Up", section: "warmup", sets: o.sets, totalYards: o.totalYards };
}

// ─── Drill / Pre-main set generator ──────────────────────────────────────────

function generateDrillSet(type) {
  const byType = {
    im: [
      // 300 yards: 4×75
      {
        sets: [
          { reps: 4, dist: 75, desc: "25 Fly Drill / 25 Back Drill / 25 Breast Drill", interval: "On 1:45", focus: "Feel each IM stroke before the main set", totalYards: 300 },
        ],
        totalYards: 300,
      },
      // 400 yards: 8×25 + 4×50
      {
        sets: [
          { reps: 8, dist: 25, desc: "Stroke drills — 2 each: fly, back, breast, free", interval: "On :40",  focus: "Isolate technique per stroke",      totalYards: 200 },
          { reps: 4, dist: 50, desc: "IM order kick — 12.5 yards each stroke",           interval: "On 1:10", focus: "Kick rhythm specific to each stroke", totalYards: 200 },
        ],
        totalYards: 400,
      },
    ],
    distance: [
      // 400 yards: 4×100 pull
      {
        sets: [
          { reps: 4, dist: 100, desc: "Pull (buoy) — moderate pace, high elbow catch", interval: "On 1:50", focus: "Upper body endurance, long stroke", totalYards: 400 },
        ],
        totalYards: 400,
      },
      // 400 yards: 6×50 kick + 2×50 swim
      {
        sets: [
          { reps: 6, dist: 50, desc: "Kick — moderate effort (board optional)", interval: "On 1:10", focus: "Leg conditioning and body position", totalYards: 300 },
          { reps: 2, dist: 50, desc: "Freestyle — build from easy to moderate",  interval: "On 1:00", focus: "Prime aerobic engine for main set",  totalYards: 100 },
        ],
        totalYards: 400,
      },
    ],
    sprint: [
      // 300 yards: 6×50
      {
        sets: [
          { reps: 6, dist: 50, desc: "25 Easy / 25 Build (NOT all-out yet)", interval: "On 1:15", focus: "Activate fast-twitch, save energy for main set", totalYards: 300 },
        ],
        totalYards: 300,
      },
      // 300 yards: 4×50 + 4×25
      {
        sets: [
          { reps: 4, dist: 50, desc: "Underwater kick off wall (10m), easy swim out", interval: "On 1:00", focus: "Streamline and underwaters",       totalYards: 200 },
          { reps: 4, dist: 25, desc: "Tempo build — easy to fast (not all out)",       interval: "On :45",  focus: "Turnover prep, no sprinting yet",  totalYards: 100 },
        ],
        totalYards: 300,
      },
    ],
    endurance: [
      // 400 yards: 4×100 pull
      {
        sets: [
          { reps: 4, dist: 100, desc: "Pull (buoy) — easy/moderate, relaxed stroke", interval: "On 1:55", focus: "Aerobic priming, conserve energy", totalYards: 400 },
        ],
        totalYards: 400,
      },
      // 300 yards: 1×300 kick
      {
        sets: [
          { reps: 1, dist: 300, desc: "Kick — choice of stroke, easy pace (board optional)", interval: "No interval", focus: "Leg warm-up, build base endurance", totalYards: 300 },
        ],
        totalYards: 300,
      },
    ],
    technique: [
      // 400 yards: 8×50
      {
        sets: [
          { reps: 8, dist: 50, desc: "25 Drill / 25 Easy Swim — same stroke each rep (your choice)", interval: "On 1:05", focus: "Feel the drill translate into the swim", totalYards: 400 },
        ],
        totalYards: 400,
      },
      // 300 yards: 4×75
      {
        sets: [
          { reps: 4, dist: 75, desc: "Kick 25 / Drill 25 / Swim 25 (same stroke)", interval: "On 1:40", focus: "Layered skill building — kick → drill → apply", totalYards: 300 },
        ],
        totalYards: 300,
      },
    ],
    mixed: [
      // 300 yards: 4×75
      {
        sets: [
          { reps: 4, dist: 75, desc: "Kick 25 / Drill 25 / Swim 25 — stroke choice", interval: "On 1:40", focus: "All-around activation before varied main set", totalYards: 300 },
        ],
        totalYards: 300,
      },
      // 400 yards: 6×50 + 4×25
      {
        sets: [
          { reps: 6, dist: 50, desc: "Drill/Swim by 25 — your stroke choice",   interval: "On 1:00", focus: "Skill warm-up",              totalYards: 300 },
          { reps: 4, dist: 25, desc: "Fast tempo (not all out) — choice stroke", interval: "On :45",  focus: "Activate speed system",     totalYards: 100 },
        ],
        totalYards: 400,
      },
    ],
  };

  const options = byType[type] || byType.mixed;
  const o = pick(options);
  return { name: "Drill / Pre-Main Set", section: "drill", sets: o.sets, totalYards: o.totalYards };
}

// ─── Main set generator ───────────────────────────────────────────────────────

function generateMainSet(type) {
  const byType = {
    im: [
      // IM Descend — 1000 yards
      {
        label: "IM Descend",
        sets: [
          { reps: 2, dist: 200, desc: "IM — easy effort, focus on stroke order",       interval: "On 4:00",  focus: "Smooth fly→back→breast→free transitions", totalYards: 400 },
          { reps: 4, dist: 100, desc: "IM — moderate to strong, descend 1→4",          interval: "On 2:10",  focus: "Each rep a little faster",                totalYards: 400 },
          { reps: 4, dist:  50, desc: "IM — fast effort, hold technique under fatigue", interval: "On 1:15",  focus: "Power through each stroke",               totalYards: 200 },
        ],
        totalYards: 1000,
      },
      // Stroke Work + IM — 1100 yards
      {
        label: "Stroke Focus + IM",
        sets: [
          { reps: 4, dist: 100, desc: "IM — moderate, smooth transitions",                        interval: "On 2:15",  focus: "Establish stroke order under load", totalYards: 400 },
          { reps: 8, dist:  50, desc: "2 each stroke — fly / back / breast / free, descend each pair", interval: "On 1:10",  focus: "Individual stroke speed",         totalYards: 400 },
          { reps: 4, dist:  75, desc: "50 IM + 25 Free strong",                                   interval: "On 1:40",  focus: "Combine strokes, finish fast",      totalYards: 300 },
        ],
        totalYards: 1100,
      },
      // IM Pyramid — 1000 yards
      {
        label: "IM Pyramid",
        sets: [
          { reps: 1, dist: 100, desc: "IM — easy",              interval: "On 2:30",  focus: "Set your baseline",          totalYards: 100 },
          { reps: 1, dist: 200, desc: "IM — moderate",          interval: "On 4:30",  focus: "Build into it",              totalYards: 200 },
          { reps: 1, dist: 400, desc: "IM — strong, sustained", interval: "On 8:30",  focus: "Test your aerobic fitness",  totalYards: 400 },
          { reps: 1, dist: 200, desc: "IM — moderate",          interval: "On 4:30",  focus: "Hang on — tired strokes",    totalYards: 200 },
          { reps: 1, dist: 100, desc: "IM — ALL OUT finish",    interval: "On 3:00",  focus: "Empty the tank",             totalYards: 100 },
        ],
        totalYards: 1000,
      },
    ],

    distance: [
      // Distance Descend — 1200 yards
      {
        label: "400s Descend",
        sets: [
          { reps: 3, dist: 400, desc: "Freestyle — descend 1→3 (each one faster than the last)", interval: "On 7:30", focus: "Negative split within each, fastest on #3", totalYards: 1200 },
        ],
        totalYards: 1200,
      },
      // Broken Distance — 1200 yards
      {
        label: "200s + 100s",
        sets: [
          { reps: 4, dist: 200, desc: "Freestyle — moderate to strong, descend 1→4", interval: "On 3:30", focus: "Hold form as pace increases",     totalYards: 800 },
          { reps: 4, dist: 100, desc: "Freestyle — fast (near threshold)",            interval: "On 1:50", focus: "Maintain stroke length at speed", totalYards: 400 },
        ],
        totalYards: 1200,
      },
      // 1-2-3 Distance — 1100 yards
      {
        label: "Distance Ladder",
        sets: [
          { reps: 1, dist: 400, desc: "Freestyle — aerobic/moderate",         interval: "On 8:00", focus: "Long steady effort, build pace",       totalYards: 400 },
          { reps: 2, dist: 200, desc: "Freestyle — moderate/fast, descend",   interval: "On 3:45", focus: "Find race pace, each one faster",      totalYards: 400 },
          { reps: 3, dist: 100, desc: "Freestyle — fast, under threshold",    interval: "On 1:55", focus: "Sustain speed under accumulated load", totalYards: 300 },
        ],
        totalYards: 1100,
      },
    ],

    sprint: [
      // Sprint Ladder — 1000 yards
      {
        label: "Sprint Ladder",
        sets: [
          { reps: 4, dist: 100, desc: "Freestyle — 75 easy + last 25 ALL OUT",  interval: "On 2:30", focus: "Save energy, then unleash on last length",        totalYards: 400 },
          { reps: 8, dist:  50, desc: "Choice of stroke — 25 easy + 25 ALL OUT", interval: "On 1:45", focus: "Maximum speed on second 25",                      totalYards: 400 },
          { reps: 8, dist:  25, desc: "Freestyle — ALL OUT sprint",              interval: "On 1:00", focus: "Top-end speed — best times of the workout",        totalYards: 200 },
        ],
        totalYards: 1000,
      },
      // Pure Speed — 1050 yards
      {
        label: "Pure Speed",
        sets: [
          { reps: 10, dist: 50,  desc: "Choice of stroke — ALL OUT every rep",           interval: "On 2:00", focus: "Full effort every time — if it isn't hard, go harder", totalYards: 500 },
          { reps:  4, dist: 100, desc: "Freestyle — easy/moderate (active recovery)",     interval: "On 2:00", focus: "Keep moving, clear the lactic acid",                   totalYards: 400 },
          { reps:  6, dist:  25, desc: "Choice of stroke — sprint to the wall",           interval: "On :55",  focus: "Hold top-end speed even as fatigue builds",            totalYards: 150 },
        ],
        totalYards: 1050,
      },
      // Race Pace Blocks — 1000 yards
      {
        label: "Race Pace Blocks",
        sets: [
          { reps: 6, dist:  50, desc: "Choice — build to ALL OUT by final 25",   interval: "On 2:00", focus: "Race simulation — controlled start, explosive finish", totalYards: 300 },
          { reps: 1, dist: 200, desc: "Easy recovery freestyle",                  interval: "4:00 rest before next block", focus: "Full recovery",                    totalYards: 200 },
          { reps: 8, dist:  50, desc: "Choice — ALL OUT (full recovery between)", interval: "On 2:30", focus: "Max velocity — no holding back",                    totalYards: 400 },
          { reps: 4, dist:  25, desc: "Choice — absolute sprint to finish",       interval: "On 1:00", focus: "End on pure speed",                                  totalYards: 100 },
        ],
        totalYards: 1000,
      },
    ],

    endurance: [
      // Long Steady — 1200 yards
      {
        label: "Long Steady State",
        sets: [
          { reps: 2, dist: 600, desc: "Freestyle — steady aerobic pace (RPE 6/10), no intervals", interval: "On 11:30", focus: "Comfortable effort you can sustain 20+ min — breathe easy", totalYards: 1200 },
        ],
        totalYards: 1200,
      },
      // Endurance Build — 1200 yards
      {
        label: "Progressive Build",
        sets: [
          { reps: 1, dist: 400, desc: "Freestyle — easy (RPE 5/10)",         interval: "On 8:00", focus: "Aerobic base — controlled breathing",         totalYards: 400 },
          { reps: 1, dist: 400, desc: "Freestyle — moderate (RPE 6-7/10)",   interval: "On 7:45", focus: "Find your tempo",                             totalYards: 400 },
          { reps: 1, dist: 400, desc: "Freestyle — strong (RPE 7-8/10)",     interval: "On 7:30", focus: "Push lactate threshold — hold stroke form",   totalYards: 400 },
        ],
        totalYards: 1200,
      },
      // Tempo Intervals — 1200 yards
      {
        label: "Threshold Tempo",
        sets: [
          { reps: 4, dist: 300, desc: "Freestyle — threshold pace (RPE 7-8/10). Hold SAME pace all 4 reps.", interval: "On 5:30", focus: "Aerobic ceiling — maintain form under sustained effort", totalYards: 1200 },
        ],
        totalYards: 1200,
      },
    ],

    technique: [
      // Stroke + Kick — 1000 yards
      {
        label: "Kick + Drill + Swim",
        sets: [
          { reps: 8, dist:  75, desc: "25 Kick / 25 Drill / 25 Swim — same stroke each rep (your choice)", interval: "On 1:45", focus: "Apply the drill directly into the swim",            totalYards: 600 },
          { reps: 4, dist: 100, desc: "Pull (buoy) — focus on high-elbow catch, long stroke",              interval: "On 1:55", focus: "Sculpt the perfect pull pattern",                   totalYards: 400 },
        ],
        totalYards: 1000,
      },
      // Drill Progression — 1000 yards
      {
        label: "Freestyle Drill Progression",
        sets: [
          { reps: 4, dist:  50, desc: "Kick only — no board, streamlined off wall",        interval: "On 1:15", focus: "Core rotation, balanced two-beat kick",         totalYards: 200 },
          { reps: 4, dist:  50, desc: "Single-arm drill (alternate arms by 25)",            interval: "On 1:10", focus: "Lead arm extension, shoulder-driven rotation",  totalYards: 200 },
          { reps: 4, dist:  50, desc: "Catch-up drill — touch hands at extension",          interval: "On 1:05", focus: "Full extension before pulling",                 totalYards: 200 },
          { reps: 4, dist: 100, desc: "Freestyle swim — integrate all drilled elements",    interval: "On 1:50", focus: "Swim as slowly as you drilled, feel everything", totalYards: 400 },
        ],
        totalYards: 1000,
      },
      // All-Stroke Technique — 1100 yards
      {
        label: "All-Stroke Technique",
        sets: [
          { reps: 4, dist: 100, desc: "Choice of stroke — SLOW, prioritize perfect form over speed", interval: "On 2:30", focus: "No rushing — technique over pace",            totalYards: 400 },
          { reps: 8, dist:  50, desc: "2 each: fly drill / back drill / breast drill / free drill",  interval: "On 1:10", focus: "The key isolation drill for each stroke",     totalYards: 400 },
          { reps: 4, dist:  75, desc: "25 Drill + 50 Swim (same stroke — apply what you just drilled)", interval: "On 1:40", focus: "Bridge drill into real swimming",          totalYards: 300 },
        ],
        totalYards: 1100,
      },
    ],

    mixed: [
      // Speed + Endurance Mix — 1400 yards
      {
        label: "Speed + Distance Mix",
        sets: [
          { reps: 4, dist: 200, desc: "Freestyle — moderate to strong, descend 1→4",        interval: "On 3:45", focus: "Distance base — stay aerobic",              totalYards: 800 },
          { reps: 1, dist: 200, desc: "Easy backstroke — active recovery",                   interval: "4:00 before next block", focus: "Recover while moving",        totalYards: 200 },
          { reps: 8, dist:  50, desc: "Choice of stroke — ALL OUT sprint",                   interval: "On 1:45", focus: "Speed work after accumulated fatigue",       totalYards: 400 },
        ],
        totalYards: 1400,
      },
      // 3-Part Mix — 1200 yards
      {
        label: "3-Part Mix",
        sets: [
          { reps: 3, dist: 200, desc: "Freestyle — strong aerobic",                                  interval: "On 3:30", focus: "Build aerobic capacity",               totalYards: 600 },
          { reps: 6, dist:  50, desc: "25 Drill / 25 Swim — stroke choice",                          interval: "On 1:05", focus: "Technique reset mid-workout",           totalYards: 300 },
          { reps: 3, dist: 100, desc: "IM or stroke choice — moderate to fast, descend 1→3",         interval: "On 2:00", focus: "Finish strong on the last one",          totalYards: 300 },
        ],
        totalYards: 1200,
      },
      // Pyramid Mix — 1400 yards
      {
        label: "Mixed Pyramid",
        sets: [
          { reps: 1, dist: 400, desc: "Freestyle — aerobic, controlled effort",  interval: "On 7:30", focus: "Establish aerobic base",         totalYards: 400 },
          { reps: 2, dist: 200, desc: "Choice of stroke — moderate to fast",     interval: "On 3:30", focus: "Pick up the pace, find threshold", totalYards: 400 },
          { reps: 4, dist: 100, desc: "IM or choice — hard effort",              interval: "On 2:00", focus: "Push lactate threshold",           totalYards: 400 },
          { reps: 4, dist:  50, desc: "Sprint — choice stroke, ALL OUT",         interval: "On 1:30", focus: "Top-end speed",                   totalYards: 200 },
        ],
        totalYards: 1400,
      },
    ],
  };

  const options = byType[type] || byType.mixed;
  const o = pick(options);
  return { name: `Main Set — ${o.label}`, section: "main", sets: o.sets, totalYards: o.totalYards };
}

// ─── Cool-down generator ──────────────────────────────────────────────────────

function generateCooldown() {
  const options = [
    // 200 yards
    {
      sets: [
        { reps: 1, dist: 200, desc: "Easy Freestyle — long, relaxed stroke", interval: "No interval", focus: "Bring heart rate down, flush the muscles", totalYards: 200 },
      ],
      totalYards: 200,
    },
    // 250 yards: 150 + 100
    {
      sets: [
        { reps: 1, dist: 150, desc: "Easy Backstroke or choice", interval: "No interval", focus: "Let lactic acid clear, open the chest",      totalYards: 150 },
        { reps: 1, dist: 100, desc: "Easy Freestyle — progressively slower",  interval: "No interval", focus: "Full cool-down — slowest laps of the day", totalYards: 100 },
      ],
      totalYards: 250,
    },
    // 200 yards: 4×50
    {
      sets: [
        { reps: 4, dist: 50, desc: "Easy alternating: Freestyle / Backstroke (swap each length)", interval: "On 1:20", focus: "Gentle recovery — no effort, just move", totalYards: 200 },
      ],
      totalYards: 200,
    },
  ];
  const o = pick(options);
  return { name: "Cool-Down", section: "cooldown", sets: o.sets, totalYards: o.totalYards };
}

// ─── Full workout generator ───────────────────────────────────────────────────

function generateWorkout(typeId) {
  const warmup   = generateWarmup();
  const drillSet = generateDrillSet(typeId);
  const mainSet  = generateMainSet(typeId);
  const cooldown = generateCooldown();
  const blocks   = [warmup, drillSet, mainSet, cooldown];
  const totalYards = blocks.reduce((acc, b) => acc + b.totalYards, 0);

  // Estimate time: warmup/cooldown ~35 yd/min, drill ~32 yd/min, main set depends on type
  const mainYdPerMin = { sprint: 28, im: 32, distance: 36, endurance: 36, technique: 30, mixed: 33 };
  const ydPerMin = mainYdPerMin[typeId] || 33;
  const estimatedMin =
    Math.round(warmup.totalYards / 35) +
    Math.round(drillSet.totalYards / 32) +
    Math.round(mainSet.totalYards / ydPerMin) +
    Math.round(cooldown.totalYards / 35);

  return { blocks, totalYards, estimatedMin, typeId };
}

// ─── Components ───────────────────────────────────────────────────────────────

function SetRow({ set, idx }) {
  const isOdd = idx % 2 === 0;
  return (
    <tr className={isOdd ? "bg-white" : "bg-slate-50"}>
      <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
        {set.reps > 1 ? `${set.reps} × ${set.dist}` : `${set.dist}`}
      </td>
      <td className="px-4 py-3 text-sm font-bold text-slate-800 whitespace-nowrap">
        {(set.reps * set.dist).toLocaleString()} yds
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{set.desc}</td>
      <td className="px-4 py-3 text-sm text-slate-500 font-mono">{set.interval}</td>
      <td className="px-4 py-3 text-sm text-slate-500 italic">{set.focus}</td>
    </tr>
  );
}

function WorkoutBlock({ block }) {
  const style = SECTION_STYLES[block.section];
  return (
    <div className={`rounded-xl border ${style.border} overflow-hidden mb-4`}>
      <div className={`${style.header} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${style.dot} inline-block`} />
          <span className="font-bold text-sm tracking-wide uppercase">{block.name}</span>
        </div>
        <span className="font-semibold text-sm opacity-90">{block.totalYards.toLocaleString()} yds</span>
      </div>
      <div className={`${style.bg} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reps × Dist</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Interval</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Focus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {block.sets.map((set, i) => <SetRow key={i} set={set} idx={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SwimWorkoutGenerator() {
  const [selectedType, setSelectedType] = useState(null);
  const [workout, setWorkout] = useState(null);

  const handleGenerate = useCallback(() => {
    if (!selectedType) return;
    setWorkout(generateWorkout(selectedType));
  }, [selectedType]);

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setWorkout(null);
  };

  const selectedMeta = WORKOUT_TYPES.find((t) => t.id === selectedType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900 border-b border-blue-800 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <span className="text-3xl">🏊‍♂️</span>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Swim Workout Generator</h1>
            <p className="text-blue-300 text-sm">~60 min · ~1,900–2,500 yards · Masters / Competitive Swimmer</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Type Selector */}
        <div className="mb-6">
          <h2 className="text-blue-200 font-semibold text-sm uppercase tracking-widest mb-3">Select Workout Type</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WORKOUT_TYPES.map((t) => {
              const isSelected = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTypeSelect(t.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer
                    ${isSelected
                      ? `${t.selBg} ${t.selBorder} text-white shadow-lg scale-[1.02]`
                      : `bg-slate-800 ${t.border} text-slate-200 hover:bg-slate-700 hover:scale-[1.01]`
                    }`}
                >
                  <div className="text-2xl mb-1">{t.emoji}</div>
                  <div className="font-bold text-sm">{t.label}</div>
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                    {t.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate / Regenerate Button */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleGenerate}
            disabled={!selectedType}
            className={`flex-1 py-3.5 rounded-xl font-bold text-base transition-all duration-150 cursor-pointer
              ${selectedType
                ? `${selectedMeta?.selBg || "bg-blue-600"} text-white hover:opacity-90 shadow-lg hover:shadow-xl active:scale-[0.99]`
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
          >
            {workout ? "🔄 Generate New Workout" : "🏊 Generate Workout"}
          </button>
        </div>

        {/* Workout Display */}
        {workout && (
          <div>
            {/* Summary Bar */}
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${selectedMeta?.badge}`}>
                  {selectedMeta?.emoji} {selectedMeta?.label}
                </span>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Total Yardage</div>
                  <div className="text-2xl font-black text-white">{workout.totalYards.toLocaleString()} <span className="text-sm font-normal text-slate-400">yards</span></div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Est. Duration</div>
                  <div className="text-2xl font-black text-white">~{workout.estimatedMin} <span className="text-sm font-normal text-slate-400">min</span></div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Sections</div>
                  <div className="text-2xl font-black text-white">{workout.blocks.length} <span className="text-sm font-normal text-slate-400">blocks</span></div>
                </div>
              </div>
            </div>

            {/* Yardage Breakdown Mini-Bar */}
            <div className="mb-5 flex gap-1 h-3 rounded-full overflow-hidden">
              {workout.blocks.map((b, i) => {
                const pct = ((b.totalYards / workout.totalYards) * 100).toFixed(1);
                const colors = ["bg-sky-400", "bg-teal-400", "bg-blue-500", "bg-gray-400"];
                return <div key={i} style={{ width: `${pct}%` }} className={`${colors[i]} transition-all`} title={`${b.name}: ${b.totalYards} yds`} />;
              })}
            </div>
            <div className="flex gap-4 mb-6 flex-wrap">
              {workout.blocks.map((b, i) => {
                const colors = ["text-sky-400", "text-teal-400", "text-blue-400", "text-gray-400"];
                const dots = ["bg-sky-400", "bg-teal-400", "bg-blue-400", "bg-gray-400"];
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${dots[i]}`} />
                    <span className={colors[i]}>{b.name}</span>
                    <span>({b.totalYards} yds)</span>
                  </div>
                );
              })}
            </div>

            {/* Workout Blocks */}
            {workout.blocks.map((block, i) => (
              <WorkoutBlock key={i} block={block} />
            ))}

            {/* Footer Note */}
            <div className="mt-6 bg-slate-800/60 rounded-xl p-4 border border-slate-700 text-slate-400 text-sm">
              <span className="font-semibold text-slate-300">📋 Coach's Note: </span>
              Intervals assume a moderate masters pace (~1:35–1:45/100 yds). Adjust your intervals up or down by 10–15 sec to match your actual pace.
              Always prioritize stroke mechanics over hitting a split — especially on drill and technique sets.
            </div>
          </div>
        )}

        {/* Empty state */}
        {!workout && (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4">🌊</div>
            <p className="text-lg font-medium text-slate-400">Pick a workout type and hit Generate</p>
            <p className="text-sm mt-1 text-slate-500">Each press produces a fresh, unique workout</p>
          </div>
        )}
      </div>
    </div>
  );
}
