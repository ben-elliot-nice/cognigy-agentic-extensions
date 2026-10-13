#!/usr/bin/env bash
# Verify a built extension archive contains the files Cognigy's upload validation requires.
# Usage: scripts/verify-archive.sh <package-name>
set -euo pipefail

PKG="${1:?usage: verify-archive.sh <package-name>}"
DIR="packages/$PKG"
VERSION=$(jq -r '.version' "$DIR/package.json")
ARCHIVE="$DIR/${PKG}-${VERSION}.tar.gz"

REQUIRED=(package.json package-lock.json README.md build/module.js)

if [ ! -f "$ARCHIVE" ]; then
  echo "::error::[$PKG] archive not found: $ARCHIVE"
  exit 1
fi

CONTENTS=$(tar tzf "$ARCHIVE")
MISSING=()
for F in "${REQUIRED[@]}"; do
  if ! echo "$CONTENTS" | grep -qx "$F"; then
    MISSING+=("$F")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "::error::[$PKG] $ARCHIVE is missing required files: ${MISSING[*]} (Cognigy rejects the upload)"
  echo "Archive contents:"
  echo "$CONTENTS"
  exit 1
fi

echo "[$PKG] $ARCHIVE contains all required files ✓"
