#!/usr/bin/env python3
"""
bank_review.py — master-swimmer-lens audit of the workout-set bank in
public/index.html. Loads the SCY constants (WARMUP_OPTIONS, DRILL_OPTIONS,
MAIN_OPTIONS, COOLDOWN_OPTIONS) and runs a battery of mechanical checks.

Findings are written to stdout, grouped by check category, sorted by severity.
Re-run after fixes to confirm convergence.

Usage:  python3 tools/bank_review.py [--mode 25y|25m|50m]   default: 25y
        python3 tools/bank_review.py --json                  machine-readable

Spec:   memory/swim_generator_bank_review_todo.md
"""
import json
import re
import sys
import argparse
from pathlib import Path

ROOT = Path(__file__).parent.parent
HTML = (ROOT / "public" / "index.html").read_text()

# ─── bank-constant extraction ────────────────────────────────────────────────
# Each bank is `const NAME = [...];` (flat) or `const NAME = { ... };` (typed).
# We extract the balanced bracket region and convert the JS object literal
# to JSON via a few text fixes. The bank constants don't use JS-only features
# (no comments, no template literals, no functions inside the data).
def extract_bank_text(name):
    pattern = rf"const\s+{re.escape(name)}\s*=\s*"
    m = re.search(pattern, HTML)
    if not m:
        raise RuntimeError(f"bank constant not found: {name}")
    start = m.end()
    # Balanced bracket scan
    open_ch = HTML[start]
    if open_ch not in "[{":
        raise RuntimeError(f"unexpected start char {open_ch!r} for {name}")
    close_ch = "]" if open_ch == "[" else "}"
    depth = 0
    in_str = False
    str_quote = ""
    i = start
    while i < len(HTML):
        c = HTML[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == str_quote:
                in_str = False
        else:
            if c in '"\'':
                in_str = True
                str_quote = c
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return HTML[start : i + 1]
        i += 1
    raise RuntimeError(f"unterminated bracket for {name}")

# Convert a JS object-literal text to JSON-parseable text. String-aware: the
# regex tricks above broke on descs containing tokens like ", on :30" because
# they wrapped "on" as a bare-key. Here we walk the text, accumulate non-string
# regions, transform those, and stitch back together with the original strings
# left untouched.
def js_to_json(text):
    parts = []  # alternating: non-string region, string-with-quotes, ...
    i = 0
    while i < len(text):
        c = text[i]
        if c in '"\'':
            # consume the string literal verbatim
            quote = c
            j = i + 1
            while j < len(text):
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == quote:
                    j += 1
                    break
                j += 1
            parts.append(("str", text[i:j]))
            i = j
        else:
            j = i
            while j < len(text) and text[j] not in '"\'':
                j += 1
            parts.append(("code", text[i:j]))
            i = j

    out = []
    for kind, chunk in parts:
        if kind == "str":
            out.append(chunk)
            continue
        # Apply JS→JSON fixes only on non-string regions.
        chunk = re.sub(r"//[^\n]*", "", chunk)
        chunk = re.sub(r"([\{,]\s*)([A-Za-z_]\w*)(\s*:)", r'\1"\2"\3', chunk)
        chunk = re.sub(r",(\s*[\]\}])", r"\1", chunk)
        out.append(chunk)
    return "".join(out)

def load_bank(name):
    raw = extract_bank_text(name)
    try:
        return json.loads(js_to_json(raw))
    except json.JSONDecodeError as e:
        print(f"FAILED to parse {name}: {e}", file=sys.stderr)
        # Print a window around the error for debugging
        s = max(0, e.pos - 80)
        e_end = min(len(raw), e.pos + 80)
        print(raw[s:e_end], file=sys.stderr)
        raise

# ─── pace + interval helpers ─────────────────────────────────────────────────
INTERVAL_RE = re.compile(r"^On\s+(\d*):(\d{1,2})", re.IGNORECASE)
NO_INTERVAL_RE = re.compile(r"no\s*interval", re.IGNORECASE)

def parse_interval_secs(s):
    if not s or NO_INTERVAL_RE.search(s):
        return None
    m = INTERVAL_RE.match(s)
    if not m:
        return None
    mins = int(m.group(1)) if m.group(1) else 0
    secs = int(m.group(2))
    return mins * 60 + secs

def per100(set_obj):
    secs = parse_interval_secs(set_obj.get("interval", ""))
    dist = set_obj.get("dist", 0)
    if secs is None or not dist:
        return None
    return secs / (dist / 100)

# ─── stroke detection ────────────────────────────────────────────────────────
# Returns one of: free / back / breast / fly / im / kick / choice / unknown
STROKE_PATTERNS = [
    ("breast",  re.compile(r"\bbreast(?:stroke)?", re.IGNORECASE)),
    ("back",    re.compile(r"\bback(?:stroke)?",   re.IGNORECASE)),
    # Dolphin kick is fly-stroke-specific work — count it as fly volume.
    ("fly",     re.compile(r"\b(?:butterfly|fly|dolphin)\b", re.IGNORECASE)),
    ("im",      re.compile(r"\bIM\b",              re.IGNORECASE)),
    ("free",    re.compile(r"\b(?:freestyle|free)\b", re.IGNORECASE)),
    ("choice",  re.compile(r"\bchoice\b",          re.IGNORECASE)),
    ("kick",    re.compile(r"\bkick\b",            re.IGNORECASE)),
]
def primary_stroke(set_obj):
    desc = (set_obj.get("desc") or "") + " " + (set_obj.get("focus") or "")
    for label, pat in STROKE_PATTERNS:
        if pat.search(desc):
            return label
    return "unknown"

# Multi-stroke split — fires ONLY on explicit equal-distribution descriptors:
#   "Back+Breast 200" / "Free+Back" (stroke+stroke connector)
#   "100 back / 100 breast" / "50 back / 50 breast / 50 free" (numbered slash list)
# Generic prose like "fly with free recovery" is NOT split (those are
# fly-themed sets with free as active rest, not 50/50 yardage).
EXPLICIT_SPLIT_RES = [
    re.compile(r"\b(\w+)\s*\+\s*(\w+)\b", re.IGNORECASE),
    re.compile(r"\d+\s+\w+\s*/\s*\d+\s+\w+", re.IGNORECASE),
]
def explicit_multi_stroke(desc):
    return any(pat.search(desc) for pat in EXPLICIT_SPLIT_RES)

# Yardage attribution per stroke for an option's sets.
# IM is split 25% per stroke. Choice is "unknown".
def yardage_by_stroke(option):
    out = {}
    for s in option["sets"]:
        yards = (s.get("reps", 1) * s.get("dist", 0)) * (option.get("rounds", 1) if "rounds" in option else 1)
        desc = (s.get("desc") or "") + " " + (s.get("focus") or "")
        # Only split when the desc explicitly signals equal multi-stroke distribution.
        if explicit_multi_stroke(desc):
            strokes_present = [label for label, pat in STROKE_PATTERNS
                              if label not in ("choice", "kick", "im") and pat.search(desc)]
            if len(strokes_present) > 1:
                per = yards / len(strokes_present)
                for st in strokes_present:
                    out[st] = out.get(st, 0) + per
                continue
        st = primary_stroke(s)
        if st == "im":
            for k in ("fly", "back", "breast", "free"):
                out[k] = out.get(k, 0) + yards / 4
        else:
            out[st] = out.get(st, 0) + yards
    return out

# ─── effort-cue detection ────────────────────────────────────────────────────
# "easy" cue: explicit easy / recovery / loosen / gentle. Excludes "smooth" —
# that's a stroke-quality descriptor (often paired with aerobic-or-harder effort)
# and was producing false positives on "aerobic pace, smooth" sets.
EASY_RE   = re.compile(r"\b(easy|recovery|loosen|gentle)", re.IGNORECASE)

# Recovery-context detector — same family as in fix_recovery_intervals.py.
# Used to suppress B5 / C4 false positives where a recovery rep inside a harder
# workout would otherwise trip the "long sprint rep" or "no-interval effort"
# checks. Note prefix matching (no trailing \b) for "recover", "clos", "cool".
RECOVERY_CTX_RE = re.compile(
    r"\b(recover\w*|cool\w*|reset\w*|clos\w*|active\s+recovery|"
    r"between\s+(\w+\s+)?(blocks?|sets?|events?|rounds?|sprint\s+\w+)|"
    r"recovery\s+cycles?|warm\s+into|finishing\s+swim|finishing\s+set)",
    re.IGNORECASE,
)
def is_recovery_set(s):
    desc = (s.get("desc") or "") + " " + (s.get("focus") or "")
    return bool(EASY_RE.search(desc) and RECOVERY_CTX_RE.search(desc))
SPRINT_RE = re.compile(r"\b(all.?out|sprint|max(?!imum aerobic)|blast|empty the tank|top speed|race pace)", re.IGNORECASE)
MOD_RE    = re.compile(r"\b(moderate|steady|aerobic)", re.IGNORECASE)
THRESH_RE = re.compile(r"\b(threshold|t.?pace|rpe ?[78])", re.IGNORECASE)

def has_easy(s):   return bool(EASY_RE.search(s.get("desc","") + " " + s.get("focus","")))
def has_sprint(s): return bool(SPRINT_RE.search(s.get("desc","") + " " + s.get("focus","")))
def has_mod(s):    return bool(MOD_RE.search(s.get("desc","") + " " + s.get("focus","")))
def has_thresh(s): return bool(THRESH_RE.search(s.get("desc","") + " " + s.get("focus","")))

# ─── canonical SCY pool distances ────────────────────────────────────────────
SCY_DISTS = {25, 50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 750, 800, 1000, 1100, 1200, 1500}
SCM_DISTS = SCY_DISTS  # same per earlier scan
LCM_DISTS = {50, 100, 200, 300, 400, 500, 800}

DIST_SETS = {"25y": SCY_DISTS, "25m": SCM_DISTS, "50m": LCM_DISTS}

# ─── findings collector ─────────────────────────────────────────────────────
findings = []
def add(severity, category, where, msg, set_obj=None, **extras):
    entry = {
        "severity": severity, "category": category,
        "where": where, "msg": msg, **extras,
    }
    if set_obj is not None:
        entry["set_dist"]     = set_obj.get("dist")
        entry["set_reps"]     = set_obj.get("reps")
        entry["set_interval"] = set_obj.get("interval")
        entry["set_desc"]     = set_obj.get("desc")
    findings.append(entry)

# ─── checks ─────────────────────────────────────────────────────────────────
SECTIONS = [
    ("warmup",   "WARMUP_OPTIONS",   False),  # flat array
    ("drill",    "DRILL_OPTIONS",    True),   # typed
    ("main",     "MAIN_OPTIONS",     True),   # typed
    ("cooldown", "COOLDOWN_OPTIONS", False),  # flat
]

def iter_options(bank, kind):
    """Yield (typeId, opt_idx, option) tuples. typeId is None for flat banks
    (warmup/cooldown) or for typed banks where the option carries no type/stroke
    tags. Phase H Stage 2: all banks are flat arrays; for drill/main we derive
    typeId from the option's types[]/strokes[] tags (first tag wins for display).
    """
    if isinstance(bank, list):
        is_typed = (kind in ("drill", "main"))
        for i, opt in enumerate(bank):
            if is_typed:
                types   = opt.get("types")   or []
                strokes = opt.get("strokes") or []
                typeId = (types[0] if types else (strokes[0] if strokes else None))
            else:
                typeId = None
            yield (typeId, i, opt)
    else:
        # Pre-Stage-2 object-keyed shape (kept for compatibility with snapshots
        # taken from older index.html versions).
        for typeId, opts in bank.items():
            for i, opt in enumerate(opts):
                yield (typeId, i, opt)

def opt_label(opt, typeId, idx, kind):
    base = opt.get("label") or f"{kind} #{idx}"
    return f"[{typeId or kind}] {base}"

def run_checks(banks, mode):
    dists = DIST_SETS[mode]

    for kind, name, _typed in SECTIONS:
        bank = banks[name]
        for typeId, idx, opt in iter_options(bank, kind):
            label = opt_label(opt, typeId, idx, kind)
            sets = opt.get("sets", [])

            # ── C2: totalYards arithmetic
            actual = sum(s.get("reps",1) * s.get("dist",0) for s in sets)
            declared = opt.get("totalYards", 0)
            if actual != declared:
                add("error", "C2-totalYards", label,
                    f"Σ reps×dist = {actual} but totalYards = {declared}")

            # ── E2: cooldown too long
            if kind == "cooldown" and declared > 400:
                add("warn", "E2-cooldown-long", label,
                    f"cooldown is {declared} yd (>400 yd suggests this is a workout, not a cooldown)")

            # ── E1: warmup with anaerobic keywords
            if kind == "warmup":
                for si, s in enumerate(sets):
                    if has_sprint(s):
                        add("warn", "E1-warmup-sprint", label,
                            f"set {si} contains sprint/all-out keyword: {s.get('desc','')!r}")

            # ── E3: drill option with no drill/technique cue anywhere.
            # Expanded keyword set: include common drill names (single-arm,
            # catch-up, fingertip drag, dolphin, 3-3-3, streamline, glide) and
            # drill-context modalities (pull, kick, scull). The original "drill"
            # word isn't required if the section is clearly drill-shaped.
            if kind == "drill":
                drill_cue = re.compile(
                    r"drill|technique|catch|stroke\s*count|breath(?:e|ing)|"
                    r"kick|pull|single[-\s]?arm|3[-\s]?3[-\s]?3|"
                    r"fingertip|catch[-\s]?up|streamline|dolphin|"
                    r"glide|scull|elbow|tempo|alignment|rotation|"
                    r"build|ramp|each\s+stroke|underwater|12m|sprint\s+effort",
                    re.IGNORECASE,
                )
                if not any(drill_cue.search(s.get("desc","") + " " + s.get("focus","")) for s in sets):
                    add("warn", "E3-drill-no-cue", label,
                        "no drill/technique/skill keyword in any set")

            # ── per-set checks
            for si, s in enumerate(sets):
                dist = s.get("dist", 0)
                interval = s.get("interval", "")
                p100 = per100(s)

                # C1: dist not in canonical set
                if dist not in dists and dist != 0:
                    add("error", "C1-bad-dist", label,
                        f"set {si} dist={dist} not in canonical {mode} pool distances", set_obj=s)

                # C3: eq tag inconsistent with desc. Look for POSITIVE other-modality
                # cues, not just any mention. "Pull — no kick (just glide)"
                # is a legitimate pull set explicitly noting it's NOT kicking.
                eq = s.get("eq")
                desc = s.get("desc","")
                # Match "X kick" / "kick set" / "with kick" / "kick portion" — but NOT "no kick"
                if eq == "pull" and re.search(r"\b(?<!no\s)(?<!no-)kick(?:ing|s)?\b(?!\s*(?:less|free))", desc, re.IGNORECASE) \
                        and not re.search(r"\bno\s+kick\b", desc, re.IGNORECASE):
                    add("warn", "C3-eq-mismatch", label,
                        f"set {si} eq=pull but desc mentions kicking: {desc!r}")
                if eq == "kick" and re.search(r"\bpull(?:ing|s)?\b", desc, re.IGNORECASE) \
                        and not re.search(r"\bno\s+pull\b", desc, re.IGNORECASE):
                    add("warn", "C3-eq-mismatch", label,
                        f"set {si} eq=kick but desc mentions pulling: {desc!r}")

                # C4: no interval but effort > easy.
                # Skip recovery-context sets — no-interval is correct for those
                # even when the desc has "moderate" / "easy/moderate" wording.
                # Also skip warmups — they conventionally use no-interval and
                # often describe progression like "build from easy to moderate."
                if (kind != "warmup" and parse_interval_secs(interval) is None
                        and not is_recovery_set(s)):
                    if has_sprint(s) or has_thresh(s) or has_mod(s):
                        add("warn", "C4-no-interval-effort", label,
                            f"set {si} has no interval but desc implies effort: {desc!r}")

                # A1: easy + tight interval
                if has_easy(s) and p100 is not None and p100 < 130:
                    add("warn", "A1-easy-too-tight", label,
                        f"set {si} 'easy' cue but per100={p100:.0f}s — tight for easy (<130s)")

                # B5: sprint workout has a rep >100yd. Skip recovery sets
                # (a 200yd "easy choice — full recovery" between sprint blocks
                # is appropriate, not a sprint-length issue).
                if kind == "main" and typeId == "sprint" and dist > 100 and not is_recovery_set(s):
                    add("warn", "B5-sprint-long-rep", label,
                        f"set {si} dist={dist} in a sprint workout — sprints are usually ≤100yd")

                # A3: moderate + too tight
                if has_mod(s) and not has_thresh(s) and p100 is not None and p100 < 105:
                    add("warn", "A3-moderate-too-tight", label,
                        f"set {si} 'moderate'/'aerobic' cue but per100={p100:.0f}s — tighter than masters threshold")

                # A2 — flag sprints with TOO TIGHT intervals (insufficient recovery
                # for true anaerobic work). For dist ≤ 100, masters sprints want
                # ≥ 60s rest after each rep; per100 < 120 means cycle is barely
                # longer than swim time. Exception: explicit "tight rest" / "race
                # cycle" / "lactate" / "test" wording is intentional.
                if (has_sprint(s) and p100 is not None and dist <= 100 and p100 < 120
                        and not re.search(r"tight|race.cycle|lactate|test|cycle", s.get("desc","")+s.get("focus",""), re.IGNORECASE)):
                    add("warn", "A2-sprint-too-tight", label,
                        f"set {si} 'sprint' cue but per100={p100:.0f}s — tight cycle for true anaerobic work")

                # D1: structured desc with sub-distances that don't sum to dist.
                # Skip when desc signals a SUB-PATTERN (e.g., "alternate 25 fly /
                # 75 free for 1000" — the 25/75 is a per-cycle pattern, not a
                # breakdown of the full dist) or the sub-distances clearly tile
                # into dist (sum × k = dist for some integer k).
                if not re.search(r"\b(alternate|every|for\s+\d+|cycle)\b", desc, re.IGNORECASE):
                    num_tokens = re.findall(
                        r"\b(\d+)\s+(?:fly|back|breast|free|drill|swim|kick|pull|IM|stroke|full)\b",
                        desc, re.IGNORECASE,
                    )
                    if len(num_tokens) >= 2:
                        nums = [int(n) for n in num_tokens if int(n) != dist]
                        if (len(nums) >= 2
                                and all(n in dists for n in nums)
                                and sum(nums) != dist
                                and not (dist % sum(nums) == 0)  # tiles cleanly
                                and not any(n > dist for n in nums)):
                            add("info", "D1-desc-sum-mismatch", label,
                                f"set {si} desc has sub-distances {nums} that sum to {sum(nums)} but dist={dist}")

                # D2: empty focus
                if not s.get("focus"):
                    add("info", "D2-empty-focus", label,
                        f"set {si} has empty focus field")

            # ── B1-B4: stroke balance for stroke-specific main types
            if kind == "main" and typeId in ("back", "breast", "fly", "im"):
                stroke_yds = yardage_by_stroke(opt)
                total_y = sum(stroke_yds.values()) or 1
                if typeId == "back":
                    pct = stroke_yds.get("back", 0) / total_y * 100
                    if pct < 50:
                        add("warn", "B1-back-imbalance", label,
                            f"backstroke is only {pct:.0f}% of yardage in a 'back' workout")
                elif typeId == "breast":
                    pct = stroke_yds.get("breast", 0) / total_y * 100
                    if pct < 50:
                        add("warn", "B2-breast-imbalance", label,
                            f"breaststroke is only {pct:.0f}% of yardage in a 'breast' workout")
                elif typeId == "fly":
                    pct = stroke_yds.get("fly", 0) / total_y * 100
                    if pct < 40:
                        add("warn", "B3-fly-imbalance", label,
                            f"butterfly is only {pct:.0f}% of yardage in a 'fly' workout")
                    # B3 cont — flag fly reps > 100yd, but ONLY if the rep is
                    # pure fly (no slash-separated multi-stroke breakdown). A
                    # 200yd "25 fly / 150 free / 25 fly" rep is fly-themed but
                    # the actual fly portion is short.
                    for si, s in enumerate(opt["sets"]):
                        desc_s = s.get("desc","")
                        is_pure_fly = primary_stroke(s) == "fly" and "/" not in desc_s
                        if is_pure_fly and s.get("dist", 0) > 100:
                            add("info", "B3-fly-long-rep", label,
                                f"set {si} fly rep dist={s['dist']} (>100 unusual for masters)")
                elif typeId == "im":
                    # Should touch all four strokes across the option's sets.
                    # Improved detection: scan the FULL desc for stroke
                    # mentions (not just primary_stroke), since IM sets often
                    # have multiple stroke names in one desc (e.g. "fly/back/
                    # breast/free 25s") and primary_stroke returns only one.
                    strokes_text = " ".join(
                        (s.get("desc") or "") + " " + (s.get("focus") or "")
                        for s in opt["sets"]
                    ).lower()
                    has_im_explicit = bool(re.search(r"\bim\b", strokes_text))
                    has_fly   = bool(re.search(r"\b(?:butterfly|fly)\b", strokes_text))
                    has_back  = bool(re.search(r"\bback", strokes_text))
                    has_breast = bool(re.search(r"\bbreast", strokes_text))
                    has_free  = bool(re.search(r"\b(?:freestyle|free)\b", strokes_text))
                    if not (has_im_explicit or (has_fly and has_back and has_breast and has_free)):
                        missing = [n for n,h in (("fly",has_fly),("back",has_back),("breast",has_breast),("free",has_free)) if not h]
                        add("info", "B4-im-incomplete", label,
                            f"IM main doesn't include explicit IM or all-4-stroke coverage; missing={missing}")

            # ── B6: distance type with no long swim
            if kind == "main" and typeId == "distance":
                longest = max((s.get("dist",0) for s in sets), default=0)
                if longest < 200:
                    add("warn", "B6-distance-no-long",  label,
                        f"distance workout's longest rep is only {longest} yd")

    # ── D3: duplicate descs WITHIN a single bank/typeId (potential copy-paste).
    # Cross-bank duplicates are intentional (parallel SCY/SCM/LCM authoring of
    # the same workout family) — skip those. Within-bank duplicates of 4+ uses
    # of the same desc inside the same typeId are suspicious.
    desc_to_locs = {}
    for kind, name, _ in SECTIONS:
        bank = banks[name]
        for typeId, idx, opt in iter_options(bank, kind):
            label = opt_label(opt, typeId, idx, kind)
            scope_key = f"{name}::{typeId or kind}"
            for si, s in enumerate(opt.get("sets", [])):
                d = (s.get("desc") or "").strip()
                if not d: continue
                desc_to_locs.setdefault((scope_key, d), []).append(f"{label} set {si}")
    # Boilerplate cool-down / recovery / generic descs are intentionally reused
    # across many options in the same bank. Only flag duplicates that are NOT
    # in the boilerplate set, OR that exceed a higher threshold (15+ uses
    # suggests excessive copy-paste even for boilerplate).
    BOILERPLATE_DESC_RE = re.compile(
        r"^(easy|easy/moderate|easy choice|easy freestyle|easy backstroke|easy breaststroke|easy butterfly|"
        r"choice|choice stroke|backstroke|breaststroke|butterfly|freestyle)\s*[—-]\s*"
        r"(close|close-out|recovery|all\s*out|fast|strong|between|cool)",
        re.IGNORECASE,
    )
    for (scope, d), locs in desc_to_locs.items():
        is_boilerplate = bool(BOILERPLATE_DESC_RE.match(d))
        # Boilerplate cool-down / ALL-OUT phrases are intentionally reused;
        # only flag when the count is implausibly high (25+).
        threshold = 25 if is_boilerplate else 4
        if len(locs) >= threshold:
            add("info", "D3-desc-duplicated", scope,
                f"desc {d!r} used {len(locs)} times within {scope}")

# ─── output formatting ──────────────────────────────────────────────────────
def emit_text():
    severity_order = {"error": 0, "warn": 1, "info": 2}
    findings.sort(key=lambda f: (severity_order[f["severity"]], f["category"], f["where"]))
    by_cat = {}
    for f in findings:
        by_cat.setdefault(f["category"], []).append(f)

    print(f"# Bank review — {MODE}")
    print(f"\nTotal findings: {len(findings)}")
    counts = {sev: sum(1 for f in findings if f['severity'] == sev) for sev in ('error','warn','info')}
    print(f"  error: {counts['error']}   warn: {counts['warn']}   info: {counts['info']}\n")
    for cat in sorted(by_cat.keys()):
        items = by_cat[cat]
        print(f"\n## {cat}  ({len(items)})")
        for f in items:
            print(f"  [{f['severity'].upper():5}] {f['where']}")
            print(f"          {f['msg']}")

# ─── main ───────────────────────────────────────────────────────────────────
def bankname(base, mode):
    if mode == "25y": return base
    if mode == "25m": return base + "_SCM"
    if mode == "50m": return base + "_50M"

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="25y", choices=["25y","25m","50m"])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    MODE = args.mode

    banks = {
        "WARMUP_OPTIONS":   load_bank(bankname("WARMUP_OPTIONS",   MODE)),
        "DRILL_OPTIONS":    load_bank(bankname("DRILL_OPTIONS",    MODE)),
        "MAIN_OPTIONS":     load_bank(bankname("MAIN_OPTIONS",     MODE)),
        "COOLDOWN_OPTIONS": load_bank(bankname("COOLDOWN_OPTIONS", MODE)),
    }

    run_checks(banks, MODE)

    if args.json:
        print(json.dumps(findings, indent=2))
    else:
        emit_text()
