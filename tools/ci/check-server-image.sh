#!/usr/bin/env bash
# Builds the server image on a throwaway BuildKit builder and checks the claims the Dockerfile makes:
#   1. a cold build works and the API answers /v1/ready as the unprivileged user;
#   2. a code-only change reuses the dependency install (same install timestamp inside the image);
#   3. a change to the dependency inputs does NOT reuse it (the cache cannot go stale);
#   4. the dependencies the server needs at run time are really there.
# The checks look at the built images, never at the text of the build log, so they do not depend on Docker's output format.
set -euo pipefail
id="${GITHUB_RUN_ID:-local$$}-${GITHUB_RUN_ATTEMPT:-1}"
builder="crew-smoke-$id"
name="crew-server-smoke-$id"
images=("crew-server-smoke:$id-cold" "crew-server-smoke:$id-code" "crew-server-smoke:$id-deps")
src=apps/server/src/main.ts
lock=pnpm-workspace.yaml
tmp=$(mktemp -d)
cp "$src" "$tmp/main.ts"
cp "$lock" "$tmp/workspace.yaml"
cleanup() {
  cp "$tmp/main.ts" "$src"
  cp "$tmp/workspace.yaml" "$lock"
  docker rm -fv "$name" >/dev/null 2>&1 || true
  docker rmi -f "${images[@]}" >/dev/null 2>&1 || true
  docker buildx rm -f "$builder" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

build() { docker buildx build --builder "$builder" --load --progress=quiet -t "$1" -f apps/server/Dockerfile . >/dev/null; }
# When pnpm wrote node_modules: it changes only when the install layer was rebuilt.
installed_at() { docker run --rm --entrypoint stat "$1" -c %Y /app/node_modules/.modules.yaml; }

docker buildx create --name "$builder" --driver docker-container >/dev/null
docker buildx inspect "$builder" --bootstrap >/dev/null

echo "1. cold build"
build "${images[0]}"
cold=$(installed_at "${images[0]}")

echo "2. code-only change"
printf '\n// CI cache check: code only\n' >> "$src"
build "${images[1]}"
[ "$(installed_at "${images[1]}")" = "$cold" ] || { echo "::error::A code-only change rebuilt the dependency install"; exit 1; }
cp "$tmp/main.ts" "$src"

echo "3. change to the dependency inputs"
printf '\n# CI cache check: dependency inputs\n' >> "$lock"
sleep 1 # the install timestamp has one-second resolution
build "${images[2]}"
[ "$(installed_at "${images[2]}")" != "$cold" ] || { echo "::error::A change to the dependency inputs reused a stale install"; exit 1; }
cp "$tmp/workspace.yaml" "$lock"

echo "4. run time"
docker run --rm --entrypoint sh "${images[1]}" -c 'cd /app/apps/server && node --input-type=module -e "for (const m of [\"fastify\", \"pg\", \"zod\", \"tsx\"]) await import(m)"'
docker run -d --name "$name" -e DATA_KEY="$(openssl rand -base64 32)" "${images[1]}" >/dev/null
for _ in $(seq 1 60); do
  if docker exec "$name" wget -qO- http://127.0.0.1:8787/v1/ready >/dev/null 2>&1; then
    [ "$(docker exec "$name" id -u)" != 0 ] || { echo "::error::The server runs as root"; exit 1; }
    echo "Cold build, warm install reused, stale install refused, server ready as an unprivileged user."
    exit 0
  fi
  sleep 2
done
docker logs "$name" || true
echo "::error::The server did not become ready"
exit 1
