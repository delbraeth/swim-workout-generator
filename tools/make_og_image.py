#!/usr/bin/env python3
"""Generate the 1200x630 social-card PNG for SetForge.

Output: public/og-image.png

Design lives here so it's reproducible (next time we update the tagline,
re-run this script). Mirrors the brand palette + the pace-clock icon
from public/icons/icon-512.svg.

Usage:
    python3 tools/make_og_image.py
"""
from PIL import Image, ImageDraw, ImageFont
import os
import sys

# ── Brand tokens (mirror public/index.html :root) ──────────────────────────
COLOR_BG          = "#0f172a"   # slate-900 — page background
COLOR_TEXT        = "#e2e8f0"   # slate-200 — main body text
COLOR_TEXT_MUTED  = "#94a3b8"   # slate-400 — secondary text
COLOR_PRIMARY     = "#3b82f6"   # blue — primary action
COLOR_CARD        = "#1e293b"   # slate-800 — card surface (subtle bg block)

# ── Canvas ────────────────────────────────────────────────────────────────
W, H = 1200, 630

# ── Layout ────────────────────────────────────────────────────────────────
# Left third: pace-clock icon centered in a 460-wide column.
# Right two-thirds: wordmark + tagline + URL, left-aligned.
ICON_BOX_W = 460
ICON_SIZE  = 360  # outer diameter of the pace clock
ICON_CX    = ICON_BOX_W // 2
ICON_CY    = H // 2

TEXT_LEFT  = ICON_BOX_W + 40    # x-anchor for all right-side text
TEXT_TOP   = 180                # y-anchor for wordmark baseline area

# ── Find a usable font ────────────────────────────────────────────────────
FONT_CANDIDATES_BOLD = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
FONT_CANDIDATES_REG = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

def first_existing(paths):
    for p in paths:
        if os.path.exists(p):
            return p
    return None

FONT_BOLD_PATH = first_existing(FONT_CANDIDATES_BOLD)
FONT_REG_PATH  = first_existing(FONT_CANDIDATES_REG)
if not FONT_BOLD_PATH or not FONT_REG_PATH:
    sys.exit("Could not find a usable system font. Install liberation-sans or dejavu-sans.")

font_wordmark = ImageFont.truetype(FONT_BOLD_PATH, 140)
font_tagline  = ImageFont.truetype(FONT_REG_PATH, 44)
font_url      = ImageFont.truetype(FONT_BOLD_PATH, 28)

# ── Build the image ───────────────────────────────────────────────────────
img = Image.new("RGB", (W, H), COLOR_BG)
draw = ImageDraw.Draw(img)

# ── Pace clock icon (mirror icon-512.svg semantics, scaled) ───────────────
# icon-512.svg has: outer rounded rect (bg), circle ring (light, stroke 35),
# 4 tick marks (top one blue, others light), centered in 512.
# We're skipping the rounded-rect background since the whole image is dark
# already — letting the clock float.
r = ICON_SIZE // 2  # outer radius
ring_stroke = int(ICON_SIZE * (35 / 512))  # scale stroke proportionally
# Circle ring
draw.ellipse(
    (ICON_CX - r, ICON_CY - r, ICON_CX + r, ICON_CY + r),
    outline=COLOR_TEXT,
    width=ring_stroke,
)
# Tick marks — at 12, 3, 6, 9. Each is a small rectangle outside-ish the ring.
TICK_OUTER = int(ICON_SIZE * (59 / 512))   # length along radial axis
TICK_INNER = int(ICON_SIZE * (35 / 512))   # thickness perpendicular
# top (blue)
draw.rectangle(
    (ICON_CX - TICK_INNER // 2, ICON_CY - r - TICK_OUTER + ring_stroke // 2,
     ICON_CX + TICK_INNER // 2, ICON_CY - r + ring_stroke // 2),
    fill=COLOR_PRIMARY,
)
# bottom
draw.rectangle(
    (ICON_CX - TICK_INNER // 2, ICON_CY + r - ring_stroke // 2,
     ICON_CX + TICK_INNER // 2, ICON_CY + r + TICK_OUTER - ring_stroke // 2),
    fill=COLOR_TEXT,
)
# right
draw.rectangle(
    (ICON_CX + r - ring_stroke // 2, ICON_CY - TICK_INNER // 2,
     ICON_CX + r + TICK_OUTER - ring_stroke // 2, ICON_CY + TICK_INNER // 2),
    fill=COLOR_TEXT,
)
# left
draw.rectangle(
    (ICON_CX - r - TICK_OUTER + ring_stroke // 2, ICON_CY - TICK_INNER // 2,
     ICON_CX - r + ring_stroke // 2, ICON_CY + TICK_INNER // 2),
    fill=COLOR_TEXT,
)

# ── Wordmark + tagline ────────────────────────────────────────────────────
draw.text((TEXT_LEFT, TEXT_TOP), "SetForge", font=font_wordmark, fill=COLOR_TEXT)

# Tagline — keep tight; per Marketing's locked one-liner distilled.
tagline_line1 = "Swim workouts in seconds."
tagline_line2 = "For coaches and their swimmers."
draw.text((TEXT_LEFT, TEXT_TOP + 170), tagline_line1, font=font_tagline, fill=COLOR_TEXT)
draw.text((TEXT_LEFT, TEXT_TOP + 230), tagline_line2, font=font_tagline, fill=COLOR_TEXT_MUTED)

# URL hint, small, near bottom
draw.text((TEXT_LEFT, H - 75), "setforge.io", font=font_url, fill=COLOR_PRIMARY)

# ── Save ──────────────────────────────────────────────────────────────────
out_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "og-image.png",
)
img.save(out_path, "PNG", optimize=True)
print(f"Wrote {out_path}  ({W}×{H}, {os.path.getsize(out_path) // 1024} KB)")
