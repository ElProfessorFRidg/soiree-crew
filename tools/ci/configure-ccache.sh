#!/usr/bin/env bash
set -euo pipefail
fallback() { echo "::warning::Remote ccache disabled: $1"; exit 0; }
[ -n "$CACHE_PASSWORD" ] || fallback "no credential for this mode"
helper=$(command -v ccache-storage-https || true)
if [ -z "$helper" ]; then
  helper=$(find "$(brew --prefix ccache)/" -name ccache-storage-https -type f -perm -111 -print -quit 2>/dev/null || true)
fi
[ -n "$helper" ] && [ -x "$helper" ] || fallback "HTTPS helper not installed"
url=$(node -e 'const u=new URL(process.env.CACHE_URL); if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash) process.exit(1); u.username=process.env.CACHE_USER; u.password=process.env.CACHE_PASSWORD; process.stdout.write(u.href)' 2>/dev/null) || fallback "invalid HTTPS URL"
echo "::add-mask::$url"
remote="$url helper=$helper @layout=bazel request-timeout=5s data-timeout=3s"
[ "$MODE" != read-only ] || remote="$remote read-only=true"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'int crew_cache_probe(void) { return %s; }\n' "$GITHUB_RUN_NUMBER" > "$tmp/probe.c"
if ! CCACHE_DIR="$tmp/cache" CCACHE_REMOTE_STORAGE="$remote" ccache clang -c "$tmp/probe.c" -o "$tmp/probe.o" >/dev/null 2>&1; then
  fallback "helper or compile probe failed"
fi
stats=$(CCACHE_DIR="$tmp/cache" ccache --print-stats)
if ! printf '%s\n' "$stats" | awk -F '\t' '$1 ~ /^remote_storage_(hit|miss)$/ {n+=$2} $1 ~ /^remote_storage_(error|timeout)$/ {e+=$2} END {exit !(n>0 && e==0)}'; then
  fallback "remote probe did not complete cleanly"
fi
if [ "$MODE" = read-write ]; then
  if ! CCACHE_DIR="$tmp/verify" CCACHE_REMOTE_STORAGE="$remote" ccache clang -c "$tmp/probe.c" -o "$tmp/probe.o" >/dev/null 2>&1 ||
     ! CCACHE_DIR="$tmp/verify" ccache --print-stats | awk -F '\t' '$1=="remote_storage_hit" {n+=$2} $1 ~ /^remote_storage_(error|timeout)$/ {e+=$2} END {exit !(n>0 && e==0)}'; then
    fallback "remote round-trip did not produce a hit"
  fi
fi
printf 'CCACHE_REMOTE_STORAGE=%s\n' "$remote" >> "$GITHUB_ENV"
echo "Remote ccache probe passed ($MODE)"
