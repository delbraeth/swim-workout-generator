#!/usr/bin/env bash
# Vendor paper kit — Markdown -> PDF builder.
# Renders every .md in this directory to build/<name>.pdf via pandoc.
# Per VENDOR_PAPER_KIT_SCOPE.md section 3.1.
#
# PDF engine: prefers xelatex (the canonical styling), and FALLS BACK to
# typst when no LaTeX engine is installed. Both produce clean PDFs; xelatex
# matches the documented look, typst is the no-LaTeX-install path.
#   - xelatex: brew install --cask basictex   (needs admin; ~hundreds of MB)
#   - typst:   brew install typst             (no admin; single binary)
# Force one with:  PDF_ENGINE=xelatex ./build.sh   (or PDF_ENGINE=typst)
#
# Run from anywhere; the script cd's to its own directory.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

OUT_DIR="build"
mkdir -p "$OUT_DIR"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "error: pandoc not found. Install pandoc + a PDF engine first." >&2
  echo "  macOS:  brew install pandoc typst             # no-admin path" >&2
  echo "  macOS:  brew install pandoc && brew install --cask basictex   # canonical xelatex" >&2
  echo "  Debian: apt install pandoc texlive-xetex" >&2
  exit 1
fi

# Pick the PDF engine: explicit override, else xelatex if present, else typst.
ENGINE="${PDF_ENGINE:-}"
if [ -z "$ENGINE" ]; then
  if command -v xelatex >/dev/null 2>&1; then
    ENGINE="xelatex"
  elif command -v typst >/dev/null 2>&1; then
    ENGINE="typst"
  else
    echo "error: no PDF engine found (need xelatex or typst)." >&2
    echo "  brew install typst              # quickest, no admin" >&2
    echo "  brew install --cask basictex    # canonical xelatex styling" >&2
    exit 1
  fi
fi

# Engine-specific pandoc options.
case "$ENGINE" in
  xelatex)
    ENGINE_OPTS=(--pdf-engine=xelatex
      -V geometry:margin=1in -V fontsize=11pt -V documentclass=article
      -V colorlinks=true -V linkcolor=black -V urlcolor=blue) ;;
  typst)
    # typst template uses different variables (no geometry/documentclass).
    ENGINE_OPTS=(--pdf-engine=typst -V margin-x=1in -V margin-y=1in) ;;
  *)
    echo "error: unknown PDF_ENGINE='$ENGINE' (use xelatex or typst)." >&2
    exit 1 ;;
esac

echo "Rendering with PDF engine: $ENGINE"

# Render each .md to a same-named .pdf in build/.
# README.md is excluded (it's for the operator, not the recipient).
COUNT=0
for src in *.md; do
  case "$src" in
    README.md) continue ;;
  esac
  out="$OUT_DIR/${src%.md}.pdf"
  echo "  -> $src"
  pandoc "$src" "${ENGINE_OPTS[@]}" -o "$out"
  COUNT=$((COUNT + 1))
done

echo ""
echo "Built $COUNT PDF(s) -> $OUT_DIR/ (engine: $ENGINE)"
echo ""
echo "Don't commit build/ — it's git-ignored. PDFs regenerate from .md sources."
echo "The static w-9.pdf is the only PDF that lives in version control."
echo "Tip: force an engine with  PDF_ENGINE=xelatex ./build.sh"
