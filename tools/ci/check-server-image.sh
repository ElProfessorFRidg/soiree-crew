#!/usr/bin/env bash
set -euo pipefail
builder="crew-smoke-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
image="crew-server-smoke:$GITHUB_RUN_ID"
warm="crew-server-warm:$GITHUB_RUN_ID"
name="crew-server-smoke-$GITHUB_RUN_ID"
src=apps/server/src/main.ts
tmp=$(mktemp -d)
cp "$src" "$tmp/main.ts"
cleanup() {
  cp "$tmp/main.ts" "$src"
  docker rm -fv "$name" >/dev/null 2>&1 || true
  docker buildx rm "$builder" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
docker buildx create --name "$builder" --driver docker-container >/dev/null
docker buildx inspect "$builder" --bootstrap
docker buildx build --builder "$builder" --no-cache --progress=plain --load -t "$image" -f apps/server/Dockerfile . 2>&1 | tee "$tmp/cold.log"
printf '\n// CI cache-only source change\n' >> "$src"
docker buildx build --builder "$builder" --progress=plain --load -t "$warm" -f apps/server/Dockerfile . 2>&1 | tee "$tmp/warm.log"
# Assert that the install layer, not merely the base image, was reused.
awk '/^#[0-9]+ .*RUN .*pnpm install/{id=$1} id && $1==id && /CACHED/{hit=1} END{exit !hit}' "$tmp/warm.log"
docker run -d --name "$name" -e DATA_KEY="$(openssl rand -base64 32)" "$warm" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name" wget -qO- http://127.0.0.1:8787/v1/ready >/dev/null 2>&1; then
    test "$(docker exec "$name" id -u)" != 0
    echo "Cold image built, warm dependency layer reused, non-root server ready."
    exit 0
  fi
  sleep 2
done
docker logs "$name"
exit 1
