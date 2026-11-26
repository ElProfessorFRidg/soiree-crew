#!/usr/bin/env bash
# Integration test of the shared compile cache, with the real programs: ccache >= 4.13, the official HTTPS storage
# helper, clang, node, and the live server. It runs configure-ccache.sh exactly as the workflow does and checks that
# every way the cache can be wrong falls back to the local cache instead of failing a build.
#
#   CACHE_URL=https://cache.example READ_PASSWORD=... WRITE_PASSWORD=... bash tools/ci/test-remote-cache.sh
#
# Needs ccache-storage-https on PATH (docs/CACHE.md). It stores two tiny objects on the server; nothing else changes.
set -uo pipefail
: "${CACHE_URL:?}" "${READ_PASSWORD:?}" "${WRITE_PASSWORD:?}"
here=$(cd "$(dirname "$0")" && pwd)
failures=0
env_file=$(mktemp)
trap 'rm -f "$env_file"' EXIT

# expect <name> <yes|no: should the remote cache be switched on> <variable assignments...>
expect() {
  local name=$1 want=$2; shift 2
  : > "$env_file"
  local started=$SECONDS
  env "$@" GITHUB_RUN_NUMBER="$RANDOM$RANDOM" GITHUB_ENV="$env_file" bash "$here/configure-ccache.sh" >/dev/null 2>&1
  local got=no; [ -s "$env_file" ] && got=yes
  if [ "$got" = "$want" ]; then echo "ok   $name ($((SECONDS - started))s)"; else echo "FAIL $name: remote cache $got, expected $want"; failures=$((failures + 1)); fi
}

expect "read account, read-only"            yes CACHE_URL="$CACHE_URL" CACHE_USER=ci-read CACHE_PASSWORD="$READ_PASSWORD" MODE=read-only
expect "write account, read-write"          yes CACHE_URL="$CACHE_URL" CACHE_USER=ci CACHE_PASSWORD="$WRITE_PASSWORD" MODE=read-write
expect "wrong password"                     no  CACHE_URL="$CACHE_URL" CACHE_USER=ci-read CACHE_PASSWORD=wrong MODE=read-only
expect "read account asking to write"       no  CACHE_URL="$CACHE_URL" CACHE_USER=ci-read CACHE_PASSWORD="$READ_PASSWORD" MODE=read-write
expect "no credential at all"               no  CACHE_URL="$CACHE_URL" CACHE_USER=ci CACHE_PASSWORD= MODE=read-only
expect "server refuses connections"         no  CACHE_URL=https://localhost:9 CACHE_USER=ci CACHE_PASSWORD="$WRITE_PASSWORD" MODE=read-write
expect "certificate does not match"         no  CACHE_URL="https://$(echo "$CACHE_URL" | sed -E 's#https://([^/:]+).*#\1#' | xargs getent hosts | awk '{print $1; exit}')" CACHE_USER=ci CACHE_PASSWORD="$WRITE_PASSWORD" MODE=read-write
expect "plain http is refused"              no  CACHE_URL="${CACHE_URL/https:/http:}" CACHE_USER=ci CACHE_PASSWORD="$WRITE_PASSWORD" MODE=read-write
expect "black hole (timeouts bound the wait)" no CACHE_URL=https://203.0.113.1 CACHE_USER=ci CACHE_PASSWORD="$WRITE_PASSWORD" MODE=read-write

# A real compile: the first run is a miss that gets stored, the second one starts with an empty local cache
# and must be served by the server.
work=$(mktemp -d)
printf 'int crew_remote_cache_test(void) { return %s; }\n' "$RANDOM$RANDOM" > "$work/t.c"
helper=$(command -v ccache-storage-https)
host=${CACHE_URL#https://}
remote="https://ci:$WRITE_PASSWORD@$host helper=$helper @layout=bazel request-timeout=5s data-timeout=3s"
stat() { CCACHE_DIR="$work/lc" ccache --print-stats | awk -F '\t' -v k="$1" '$1==k {print $2}'; }
CCACHE_DIR="$work/lc" CCACHE_REMOTE_STORAGE="$remote" ccache clang -c "$work/t.c" -o "$work/t.o" || failures=$((failures + 1))
[ "$(stat remote_storage_write)" -gt 0 ] && echo "ok   cold compile stored on the server" || { echo "FAIL cold compile stored nothing"; failures=$((failures + 1)); }
rm -rf "$work/lc"
CCACHE_DIR="$work/lc" CCACHE_REMOTE_STORAGE="$remote" ccache clang -c "$work/t.c" -o "$work/t.o" || failures=$((failures + 1))
[ "$(stat remote_storage_hit)" -gt 0 ] && echo "ok   empty local cache served by the server" || { echo "FAIL no remote hit"; failures=$((failures + 1)); }
rm -rf "$work"

[ "$failures" -eq 0 ] && echo "All remote cache checks passed" || { echo "$failures check(s) failed"; exit 1; }
