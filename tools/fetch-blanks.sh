#!/usr/bin/env bash
# Downloads the full-resolution blank product photos listed in blanks.tsv into ./blanks.
# The Figma links expire 7 days after the photos were generated (generated 12 Oct 2026).
set -euo pipefail
cd "$(dirname "$0")"
[ -L blanks ] && rm blanks
mkdir -p blanks
while IFS=$'\t' read -r name url; do
  echo "Downloading $name"
  curl -fsSL --retry 3 -o "blanks/$name.png" "$url"
done < blanks.tsv
echo "Done. Now run: npm install && npm run build-images && node build-meta.cjs"
