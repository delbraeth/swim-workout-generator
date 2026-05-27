#!/usr/bin/env bash
# Vendor paper kit — Markdown -> PDF builder.
# Renders every .md in this directory to build/<name>.pdf via pandoc.
# Per VENDOR_PAPER_KIT_SCOPE.md section 3.1.
#
# Requires: pandoc + a LaTeX engine that pandoc can drive (texlive-xetex
# or basictex on macOS). The pandoc default LaTeX template is used; if
# you want SetForge wordmark in the header, build a custom template
# referencing latex-template.tex and pass --template here.
#
# Run from anywhere; the script cd's to its own directory.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

OUT_DIR="build"
mkdir -p "$OUT_DIR"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "error: pandoc not found. Install pandoc + a LaTeX engine first." >&2
  echo "  macOS:  brew install pandoc basictex" >&2
  echo "  Debian: apt install pandoc texlive-xetex" >&2
  exit 1
fi

# Render each .md to a same-named .pdf in build/.
# README.md is excluded (it's for the operator, not the recipient).
COUNT=0
for src in *.md; do
  case "$src" in
    README.md) continue ;;
  esac
  out="$OUT_DIR/${src%.md}.pdf"
  echo "  -> $src"
  pandoc "$src" \
    --pdf-engine=xelatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    -V documentclass=article \
    -V colorlinks=true \
    -V linkcolor=black \
    -V urlcolor=blue \
    -o "$out"
  COUNT=$((COUNT + 1))
done

echo ""
echo "Built $COUNT PDF(s) -> $OUT_DIR/"
echo ""
echo "Don't commit build/ — it's git-ignored. PDFs regenerate from .md sources."
echo "The static w-9.pdf is the only PDF that lives in version control."
