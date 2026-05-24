#!/usr/bin/env python3
"""
bank_audit.py — structural-family audit of the SetForge bank.

Loads MAIN_OPTIONS + DRILL_OPTIONS from public/index.html, infers a
structural family for each option via layered heuristics (geometric shape,
effort progression, alternation pattern, equipment cues, stroke-mechanical
signals), and writes tools/bank_audit.json with per-option family +
aggregates.

Family taxonomy is informed by standard masters-swim coaching vocabulary
(USMS, MySwimPro, SwimSwam) — pyramid/ladder/broken/sandwich/descend/build/
alternation/hot-cold/pace-ladder/race-pace etc.

Acceptance per TEMPLATE_ENGINE_SCOPE.md §4: ≥80% of bank options fit into
≤20 template families. The earlier acceptance was satisfied trivially (20
exact families); the real signal is the share of options in NAMED families
(not generic multi_block / misc_* fallback buckets).

Usage:  python3 tools/bank_audit.py
Spec:   TEMPLATE_ENGINE_SCOPE.md §4
"""
import json
import re
import sys
from pathlib import Path
from collections import defaultdict, Counter

sys.path.insert(0, str(Path(__file__).parent))
from bank_review import (  # noqa: E402
    load_bank,
    primary_stroke,
    EASY_RE,
    SPRINT_RE,
    MOD_RE,
    THRESH_RE,
)

ROOT = Path(__file__).parent.parent
OUT = ROOT / "tools" / "bank_audit.json"

# ─── desc-cue regexes ───────────────────────────────────────────────────────
# Effort / pacing cues
BROKEN_RE = re.compile(r"\bbroken\b", re.IGNORECASE)
DESCEND_RE = re.compile(r"\bdescend(ing)?\b", re.IGNORECASE)
ASCEND_RE = re.compile(r"\bascend(ing)?\b", re.IGNORECASE)
BUILD_RE = re.compile(
    r"\b(?:build(?:ing)?(?:\s+(?:into|to|each|by|throughout))?|locomotive|"
    r"increase\s+pace\s+each|progressive(?:ly)?|negative\s+split)\b",
    re.IGNORECASE,
)
# "Strong" / "fast" / "hard" — softer hard-effort cues that aren't sprints
# but still describe the working portion of a set. Excludes "fast enough"
# (qualifier, not effort).
STRONG_RE = re.compile(r"\b(?:strong(?:er|ly)?|fast(?!\s+enough)|hard(?!\s+enough)|push|hammer|sub[-\s]?threshold)\b", re.IGNORECASE)
RACE_PACE_RE = re.compile(r"\brace[-\s]*pace\b", re.IGNORECASE)
THRESHOLD_EXTRA_RE = re.compile(r"\b(CSS|critical\s+swim\s+speed|T[-\s]?pace)\b", re.IGNORECASE)

# Alternation cues
ALT_30_30_RE = re.compile(
    r"\b(?:30[\s/-]?30|alternat\w+\s+(?:odd|even|easy|fast|sprint|hard))\b",
    re.IGNORECASE,
)
# Within-rep alternation: "25 fast / 25 easy", "75 strong / 75 easy",
# "X yards STROKE / X yards STROKE", "fly / free", etc. We match a
# distance+effort token followed by a slash and a contrasting effort token.
# The simpler, more-permissive form: any "X stuff / X stuff" pattern with a
# numeric portion on each side of the slash.
WITHIN_REP_ALT_RE = re.compile(
    r"\b(\d+)\s+\w+(?:\s+\w+)?\s*/\s*(\d+)\s+\w+",
    re.IGNORECASE,
)
HOT_COLD_RE = re.compile(
    r"\b(?:hot[-\s/]cold|sprint.{0,20}recovery|all[-\s]?out.{0,30}easy)\b",
    re.IGNORECASE,
)

# Stroke / equipment cues
DPS_RE = re.compile(r"\b(?:DPS|distance\s+per\s+stroke|stroke[-\s]*count)\b", re.IGNORECASE)
UNDERWATER_RE = re.compile(
    r"\b(?:underwater|UW|dolphin\s+kick(?:s)?\s+off|\d+\s+(?:UW|underwaters?))\b",
    re.IGNORECASE,
)
PULLOUT_RE = re.compile(r"\bpullout(s)?\b", re.IGNORECASE)
STROKE_ROTATION_RE = re.compile(
    r"\b(?:rotate\s+stroke|alternat\w+\s+stroke|stroke\s+rotation|"
    r"each\s+stroke|all\s+four\s+strokes|IM\s+order)\b",
    re.IGNORECASE,
)
DRILL_CUE_RE = re.compile(
    r"\b(?:drill|catch[-\s]?up|fingertip|single[-\s]?arm|3[-\s]?3[-\s]?3|"
    r"scull|streamline|glide|hypoxic)\b",
    re.IGNORECASE,
)
RACE_SIM_RE = re.compile(
    r"\b(?:race[-\s]+day|race\s+sim(?:ulation)?|event\s+\d|"
    r"race[-\s]*pace\s+(?:test|sim)|simulation)\b",
    re.IGNORECASE,
)


def row_features(s):
    """Tag a single set-row with shape + effort + keyword features."""
    desc_raw = s.get("desc") or ""
    focus_raw = s.get("focus") or ""
    desc = desc_raw + " " + focus_raw
    return {
        "reps": s.get("reps", 1),
        "dist": s.get("dist", 0),
        "yards": s.get("reps", 1) * s.get("dist", 0),
        "stroke": primary_stroke(s),
        "eq": s.get("eq"),
        # effort / pacing
        "is_broken": bool(BROKEN_RE.search(desc)),
        "is_descend": bool(DESCEND_RE.search(desc)),
        "is_ascend": bool(ASCEND_RE.search(desc)),
        "is_build": bool(BUILD_RE.search(desc)),
        "is_easy": bool(EASY_RE.search(desc)),
        "is_sprint": bool(SPRINT_RE.search(desc)),
        "is_threshold": bool(THRESH_RE.search(desc)) or bool(THRESHOLD_EXTRA_RE.search(desc)),
        "is_aerobic": bool(MOD_RE.search(desc)),
        "is_strong": bool(STRONG_RE.search(desc)),
        "is_race_pace": bool(RACE_PACE_RE.search(desc)),
        # alternation
        "is_30_30": bool(ALT_30_30_RE.search(desc)),
        "is_within_rep_alt": bool(WITHIN_REP_ALT_RE.search(desc_raw)),
        "is_hot_cold": bool(HOT_COLD_RE.search(desc)),
        # stroke / equipment
        "is_dps": bool(DPS_RE.search(desc)),
        "is_underwater": bool(UNDERWATER_RE.search(desc)),
        "is_pullout": bool(PULLOUT_RE.search(desc)),
        "is_stroke_rotation": bool(STROKE_ROTATION_RE.search(desc)),
        "is_drill": bool(DRILL_CUE_RE.search(desc)),
        "is_race_sim": bool(RACE_SIM_RE.search(desc)),
    }


def is_recovery_row(r):
    """A row that's clearly a recovery/flush — easy cue, not also sprint."""
    return r["is_easy"] and not (r["is_sprint"] or r["is_race_pace"] or r["is_threshold"])


def is_hard_row(r):
    """A row carrying the hard work — sprint/threshold/race-pace/build/descend/strong."""
    return (
        r["is_sprint"]
        or r["is_threshold"]
        or r["is_race_pace"]
        or r["is_descend"]
        or r["is_build"]
        or r["is_strong"]
    )


def detect_pyramid(dists, strict=False):
    """
    Return 'pyramid_up' | 'pyramid_down' | 'pyramid_up_down' | None.
    strict=False allows a small tail irregularity at the end.
    """
    if len(dists) < 2 or len(set(dists)) < 2:
        return None
    if dists == sorted(dists):
        return "pyramid_up"
    if dists == sorted(dists, reverse=True):
        return "pyramid_down"
    if len(dists) < 3:
        return None
    peak = max(dists)
    peak_idx = dists.index(peak)
    asc = dists[: peak_idx + 1]
    desc = dists[peak_idx:]
    if asc == sorted(asc) and desc == sorted(desc, reverse=True):
        return "pyramid_up_down"
    if not strict:
        # Allow a single trailing row that breaks the descent — common pattern
        # ("Breast Pyramid Up & Down" has a 150 cool-down tail after the 100).
        if len(desc) >= 2 and desc[:-1] == sorted(desc[:-1], reverse=True) and asc == sorted(asc):
            return "pyramid_up_down"
    return None


def detect_hot_cold(rows):
    """
    Hot/cold ladder: alternating sprint and recovery rows in a single-rep
    multi-row option. Pattern is sprint, easy, sprint, easy, ... — at least
    3 alternations.
    """
    if len(rows) < 4 or not all(r["reps"] == 1 for r in rows):
        return False
    # Tag each row as 'H' (hard), 'E' (easy), or 'O' (other)
    tags = []
    for r in rows:
        if r["is_sprint"] or r["is_race_pace"]:
            tags.append("H")
        elif r["is_easy"]:
            tags.append("E")
        else:
            tags.append("O")
    # Look for ≥3 H↔E alternations (HEH, EHE)
    alternations = sum(
        1 for i in range(len(tags) - 1)
        if {tags[i], tags[i + 1]} == {"H", "E"}
    )
    return alternations >= 3


def detect_sandwich(rows):
    """
    Sandwich/bookend: easy/recovery row at start AND at end (or near-end),
    with hard rows in the middle. Requires ≥3 rows.
    """
    if len(rows) < 3:
        return False
    starts_easy = is_recovery_row(rows[0])
    ends_easy = is_recovery_row(rows[-1]) or (len(rows) >= 4 and is_recovery_row(rows[-2]))
    middle_hard = any(is_hard_row(r) for r in rows[1:-1])
    return starts_easy and ends_easy and middle_hard


def detect_stroke_rotation(rows):
    """
    Multi-row where each row swims a different distinct stroke (back, breast,
    fly, free, IM, choice). At least 3 distinct non-unknown strokes across
    rows.
    """
    if len(rows) < 3:
        return False
    strokes = [r["stroke"] for r in rows]
    distinct_swim_strokes = {s for s in strokes if s in ("back", "breast", "fly", "free", "im", "choice")}
    if len(distinct_swim_strokes) < 3:
        return False
    # Most rows should be one distinct stroke each — not all "free" with one
    # row being something else.
    distinct_count = len(set(strokes))
    return distinct_count >= 3


def detect_main_plus_finisher(rows):
    """
    Multi-row option that's a primary block + a smaller closing block.
    Pattern: N rows of larger yardage + 1 row of smaller yardage at the end,
    with no clear recovery cue on the closing row. Typical: 8x100 | 4x50,
    1x800 | 4x100, 3x400 | 3x100.
    """
    if len(rows) < 2:
        return False
    last = rows[-1]
    # Closing row should NOT be a recovery row (those are block_with_recovery)
    if is_recovery_row(last):
        return False
    # Closing row yards should be meaningfully smaller than the largest
    # preceding block
    prev_max_yards = max(r["yards"] for r in rows[:-1])
    if last["yards"] >= prev_max_yards * 0.75:
        return False
    # Closing row dist should be ≤ largest preceding dist (a finisher is
    # typically same-or-shorter pieces)
    prev_max_dist = max(r["dist"] for r in rows[:-1])
    if last["dist"] > prev_max_dist:
        return False
    return True


def detect_pace_ladder(rows):
    """
    Same distance across all rows, single-rep each, with descend/build/
    progressive effort cues — "200 Pace Pyramid" / "Progressive Build" type.
    """
    if len(rows) < 3:
        return False
    if not all(r["reps"] == 1 for r in rows):
        return False
    if len(set(r["dist"] for r in rows)) != 1:
        return False
    progression_cues = sum(
        1 for r in rows if r["is_build"] or r["is_descend"] or r["is_race_pace"]
    )
    # Plus check: easy at start, hard at end (progression by effort tag)
    starts_easy = rows[0]["is_easy"]
    ends_hard = rows[-1]["is_sprint"] or rows[-1]["is_race_pace"]
    return progression_cues >= 1 or (starts_easy and ends_hard)


def classify_option(opt):
    """
    Return (family_id, confidence, notes) for a bank option.

    Order matters: stronger / more-specific signals come first so they're
    not overridden by generic structural matches.
    """
    rows = [row_features(s) for s in opt.get("sets", [])]
    if not rows:
        return ("empty", "high", "no sets")
    n = len(rows)
    label = (opt.get("label") or "").lower()
    label_has = lambda kw: kw in label  # noqa: E731

    # ── stroke-mechanical signals (override structure) ──
    if any(r["is_dps"] for r in rows):
        return ("dps_hold", "high", "DPS / stroke-count cue")
    if any(r["is_underwater"] for r in rows):
        return ("underwater_chain", "high", "underwater cue")
    if any(r["is_pullout"] for r in rows):
        return ("pullout_discipline", "high", "pullout cue")

    # ── broken race-pace (any-row signal) ──
    if any(r["is_broken"] for r in rows):
        return ("broken_race_pace", "high", "broken cue")

    # ── race-day simulation (label or desc) ──
    if any(r["is_race_sim"] for r in rows) or "race day" in label or "race sim" in label:
        return ("race_day_simulation", "high", "race-day / event simulation cue")

    # ── 30/30 alternating ──
    if any(r["is_30_30"] for r in rows):
        return ("alt_30_30", "high", "30/30 alternating cue")

    # ── hot/cold ladder (single-rep multi-row with alternating sprint/easy) ──
    if detect_hot_cold(rows) or label_has("hot/cold") or label_has("hot-cold"):
        return ("hot_cold_ladder", "high", "alternating sprint/easy rows")

    # ── pyramid family (all reps=1, multi-row) ──
    if n >= 2 and all(r["reps"] == 1 for r in rows):
        py = detect_pyramid([r["dist"] for r in rows])
        if py:
            return (py, "high", f"all reps=1, {n} rows, pyramid shape")

    # ── pace ladder (same dist, progressive effort) ──
    if detect_pace_ladder(rows):
        return ("pace_ladder", "high", "same dist, progressive effort")

    # ── sandwich / bookend (easy → hard → easy) ──
    if detect_sandwich(rows):
        return ("sandwich", "high", "easy bookends with hard middle")

    # ── within-rep alternation (single-row) ──
    # "X strong / X easy" or "25 fast / 25 easy" type — distinguishes from
    # cross-rep descend. Drill+swim variants get their own family.
    if n == 1 and rows[0]["is_within_rep_alt"]:
        r = rows[0]
        if r["is_drill"] and r["reps"] >= 4:
            return ("drill_swim_unit", "high", f"single row, drill/swim within-rep, {r['reps']} reps")
        if not r["is_drill"]:
            if r["is_sprint"] or r["is_race_pace"]:
                return ("within_rep_hot_easy", "high", "single row, within-rep sprint/easy alternation")
            if r["reps"] >= 4:
                return ("within_rep_alt", "med", f"single row, within-rep alternation, {r['reps']} reps")

    # ── repeating (reps, dist) shape across multi-row ──
    shapes = [(r["reps"], r["dist"]) for r in rows]
    if n >= 2 and len(set(shapes)) == 1:
        return ("repeat_unit", "high", f"{n} identical (reps, dist) rows")

    # ── stroke rotation (multi-row, distinct strokes per row) ──
    if detect_stroke_rotation(rows):
        return ("stroke_rotation", "high", "distinct stroke per row across ≥3 rows")

    # ── drill progression (multi-row drill across strokes or progressions) ──
    if n >= 2:
        drill_rows = sum(1 for r in rows if r["is_drill"])
        if drill_rows >= 2 or (drill_rows >= 1 and any(r["is_stroke_rotation"] for r in rows)):
            return ("drill_progression", "high", f"{drill_rows}/{n} drill rows")

    # ── single-row options ──
    if n == 1:
        r = rows[0]
        if r["is_descend"] and r["reps"] >= 3:
            return ("descend_ladder", "high", f"single row, descend cue, {r['reps']} reps")
        if r["is_build"] and r["reps"] >= 2:
            return ("build_within_rep", "high", f"single row, build cue, {r['reps']} reps")
        if r["is_race_pace"]:
            return ("race_pace_steady", "high", "single row, race-pace cue")
        if r["is_sprint"] and r["reps"] >= 4:
            return ("sprint_block", "high", f"single row, sprint cue, {r['reps']} reps")
        if r["is_threshold"]:
            return ("threshold_steady", "high", f"single row, threshold cue, {r['reps']} reps")
        if r["is_aerobic"] and r["reps"] >= 6:
            return ("aerobic_volume", "high", f"single row, aerobic cue, {r['reps']} reps")
        if r["reps"] == 3 and r["dist"] >= 300:
            return ("endurance_triple", "med", f"3×{r['dist']} endurance pattern")
        if r["reps"] == 1 and r["dist"] >= 800:
            return ("continuous_long_swim", "med", f"single continuous {r['dist']}yd swim")
        if r["reps"] >= 4:
            return ("steady_block", "med", f"single row, {r['reps']} reps, no strong effort cue")
        return ("misc_single_row", "low", f"single row, {r['reps']} reps")

    # ── multi-row, all reps=1, irregular dist (not pyramid) ──
    if all(r["reps"] == 1 for r in rows):
        # Effort progression across rows (build/descend cues by row position)?
        if any(r["is_build"] or r["is_descend"] for r in rows) and is_recovery_row(rows[0]):
            return ("progressive_build", "med", "single-rep rows with progressive effort")
        return ("misc_single_rep_multi_row", "low", "all reps=1, irregular dist progression")

    # ── multi-row with embedded recovery row + hard rows ──
    has_recovery_row = any(is_recovery_row(r) for r in rows)
    has_hard_section = any(is_hard_row(r) for r in rows)
    if has_recovery_row and has_hard_section and n >= 2:
        return ("block_with_recovery", "high", "recovery row inside hard structure")

    # ── main block + finisher (smaller closing row, no recovery) ──
    if detect_main_plus_finisher(rows):
        return ("main_plus_finisher", "high", "primary block + smaller closing block")

    # ── multi-row with descend cue (no recovery row) ──
    if any(r["is_descend"] for r in rows):
        return ("multi_block_descend", "med", "descend cue, multi-row, no recovery")

    # ── multi-row aerobic-heavy ──
    aerobic_rows = sum(1 for r in rows if r["is_aerobic"])
    if aerobic_rows >= 2 and aerobic_rows / n >= 0.5:
        return ("aerobic_multi_block", "med", f"{aerobic_rows}/{n} rows aerobic")

    # ── fallback ──
    return ("multi_block", "low", f"multi-row, {n} rows, no strong signal")


def main():
    sections = {
        "main": load_bank("MAIN_OPTIONS"),
        "drill": load_bank("DRILL_OPTIONS"),
    }

    per_option = []
    family_counts = Counter()
    family_examples = defaultdict(list)
    type_x_family = defaultdict(lambda: defaultdict(int))

    # Phase H Stage 2: banks are flat arrays with types[]/strokes[] tags on
    # each option. For audit grouping we use the first type tag (or first
    # stroke tag if no type) as the "type_key" — keeps the per-type
    # distribution roughly stable across the conversion. Falls back to
    # object-keyed iteration if a pre-Stage-2 snapshot is loaded.
    def iter_typed(bank):
        if isinstance(bank, list):
            for opt in bank:
                types   = opt.get("types")   or []
                strokes = opt.get("strokes") or []
                yield ((types[0] if types else (strokes[0] if strokes else "untagged")), opt)
        else:
            for type_key, options in bank.items():
                for opt in options:
                    yield (type_key, opt)

    for section, bank in sections.items():
        for type_key, opt in iter_typed(bank):
            family, confidence, notes = classify_option(opt)
            entry = {
                "section": section,
                "type": type_key,
                "label": opt.get("label"),
                "totalYards": opt.get("totalYards"),
                "rows": len(opt.get("sets", [])),
                "family": family,
                "confidence": confidence,
                "notes": notes,
            }
            per_option.append(entry)
            family_counts[family] += 1
            family_examples[family].append(
                {
                    "section": section,
                    "type": type_key,
                    "label": opt.get("label"),
                    "totalYards": opt.get("totalYards"),
                }
            )
            type_x_family[f"{section}:{type_key}"][family] += 1

    total = len(per_option)

    # Named-family coverage: share of options NOT in fallback buckets.
    fallback_families = {
        "multi_block",
        "misc_single_row",
        "misc_single_rep_multi_row",
        "steady_block",  # generic enough to count as semi-fallback
        "aerobic_multi_block",  # broad; not a single template
        "multi_block_descend",  # broad; "complex" rather than template
    }
    named_coverage = sum(c for f, c in family_counts.items() if f not in fallback_families) / total

    # High-confidence coverage
    high_conf = sum(1 for e in per_option if e["confidence"] == "high")
    high_conf_pct = high_conf / total

    confidence_dist = Counter(e["confidence"] for e in per_option)

    # Coverage gaps: (type, family) cells with <3 examples for strong families
    expected_strong_families = {
        "pyramid_up",
        "pyramid_up_down",
        "descend_ladder",
        "repeat_unit",
        "broken_race_pace",
        "sprint_block",
        "threshold_steady",
        "race_pace_steady",
        "aerobic_volume",
        "block_with_recovery",
        "hot_cold_ladder",
        "sandwich",
        "pace_ladder",
        "build_within_rep",
    }
    coverage_gaps = []
    for cell in sorted(type_x_family.keys()):
        for fam in expected_strong_families:
            cnt = type_x_family[cell].get(fam, 0)
            if cnt < 3:
                coverage_gaps.append({"type_cell": cell, "family": fam, "count": cnt})

    out = {
        "summary": {
            "total_options": total,
            "unique_families": len(family_counts),
            "named_family_coverage_pct": round(named_coverage * 100, 1),
            "high_confidence_pct": round(high_conf_pct * 100, 1),
            "confidence_distribution": dict(confidence_dist),
            "fallback_families": sorted(fallback_families),
        },
        "family_counts": dict(family_counts.most_common()),
        "family_examples": {
            f: family_examples[f][:5] for f in family_counts
        },
        "type_x_family_matrix": {k: dict(v) for k, v in type_x_family.items()},
        "coverage_gaps_lt3": coverage_gaps,
        "per_option": per_option,
    }

    OUT.write_text(json.dumps(out, indent=2))
    rel = OUT.relative_to(ROOT)
    print(
        f"wrote {rel} — {total} options, {len(family_counts)} families\n"
        f"  named-family coverage: {named_coverage*100:.1f}% (excludes generic fallback buckets)\n"
        f"  high-confidence rate:  {high_conf_pct*100:.1f}%"
    )
    print()
    print("All families:")
    for fam, cnt in family_counts.most_common():
        pct = cnt / total * 100
        tag = "  " if fam not in fallback_families else " *"
        print(f" {tag} {cnt:4d} ({pct:5.1f}%)  {fam}")
    print()
    print(f"  * = generic fallback bucket (not implementable as a single template)")
    print()
    print(f"Confidence: {dict(confidence_dist)}")


if __name__ == "__main__":
    main()
