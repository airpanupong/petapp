#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -d "$ROOT_DIR/android" || -d "$ROOT_DIR/ios" ]]; then
  echo "android/ or ios/ already exists. Remove them first if you intentionally want to regenerate."
  exit 1
fi

cd "$TMP_DIR"
echo "Generating official React Native CLI 0.87.1 native shell..."
npx --yes @react-native-community/cli@latest init PetAppMobile --version 0.87.1 --skip-install

cp -R "$TMP_DIR/PetAppMobile/android" "$ROOT_DIR/android"
cp -R "$TMP_DIR/PetAppMobile/ios" "$ROOT_DIR/ios"
[[ -f "$TMP_DIR/PetAppMobile/Gemfile" ]] && cp "$TMP_DIR/PetAppMobile/Gemfile" "$ROOT_DIR/Gemfile"
[[ -f "$TMP_DIR/PetAppMobile/.watchmanconfig" ]] && cp "$TMP_DIR/PetAppMobile/.watchmanconfig" "$ROOT_DIR/.watchmanconfig"

echo "Native shell generated."
echo "Next: npm install"
echo "Then follow NATIVE_SETUP.md before building camera/maps/location features."
