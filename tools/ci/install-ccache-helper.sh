#!/usr/bin/env bash
# Installs the official ccache HTTP(S) storage helper (github.com/ccache/ccache-storage-http-go) on a macOS runner.
# Homebrew's ccache does not ship one. The release is pinned and its SHA-256 is checked before anything is unpacked
# or run; a failure only disables the remote cache (configure-ccache.sh then finds no helper and falls back).
set -euo pipefail
version=0.10.1
case "$(uname -m)" in
  arm64) platform=darwin-arm64; sha256=a802d9e4e48fc90e8b133c8df115d858599a52bc0b0246881d7fb531baabdf3b ;;
  x86_64) platform=darwin-amd64; sha256=489ccdb1f1bd7e24ff1cce121821888c6e4117eeed8d05517e69f483cc2050eb ;;
  *) echo "::warning::No ccache HTTPS helper for $(uname -m); the remote cache stays off"; exit 0 ;;
esac
name="ccache-storage-http-go-$version-$platform"
dir="${RUNNER_TEMP:?}/ccache-helper"
mkdir -p "$dir"
if ! curl -fsSL --retry 3 --max-time 60 -o "$dir/$name.tar.gz" "https://github.com/ccache/ccache-storage-http-go/releases/download/v$version/$name.tar.gz"; then
  echo "::warning::Could not download the ccache HTTPS helper; the remote cache stays off"
  exit 0
fi
if ! echo "$sha256  $dir/$name.tar.gz" | shasum -a 256 -c - >/dev/null 2>&1; then
  echo "::warning::ccache HTTPS helper checksum mismatch; the remote cache stays off"
  exit 0
fi
# The same program serves both schemes; ccache picks the helper by URL scheme.
if ! { tar -xzf "$dir/$name.tar.gz" -C "$dir" &&
       install -m 755 "$dir/$name/ccache-storage-http" "$dir/ccache-storage-http" &&
       install -m 755 "$dir/$name/ccache-storage-http" "$dir/ccache-storage-https"; }; then
  echo "::warning::Unexpected ccache HTTPS helper archive layout; the remote cache stays off"
  exit 0
fi
echo "$dir" >> "$GITHUB_PATH"
echo "ccache HTTPS helper $version installed ($platform)"
