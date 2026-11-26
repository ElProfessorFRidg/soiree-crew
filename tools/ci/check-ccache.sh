#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'int crew_local_cache_probe(void) { return 42; }\n' > "$tmp/probe.c"
(
  unset CCACHE_REMOTE_STORAGE
  export CCACHE_DIR="$tmp/cache"
  ccache clang -c "$tmp/probe.c" -o "$tmp/probe.o"
  rm "$tmp/probe.o"
  ccache clang -c "$tmp/probe.c" -o "$tmp/probe.o"
  ccache --print-stats | awk -F '\t' '$1 ~ /^(direct_cache_hit|preprocessed_cache_hit)$/ {n+=$2} END {exit !(n>0)}'
)
ccache --zero-stats
echo "Local ccache smoke test passed"
