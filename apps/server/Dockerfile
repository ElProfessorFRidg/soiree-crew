# Build from the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

# 1. Packages. Only the lockfile and the package.json files go in, so these layers are rebuilt when the
#    dependencies change and never for a code change. The pnpm store is a BuildKit cache shared by server-image
#    builds on the same BuildKit worker: a package one build downloaded is not fetched again.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY packages/bac/package.json ./packages/bac/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/fuzzy/package.json ./packages/fuzzy/
COPY packages/games/package.json ./packages/games/
COPY packages/mls/package.json ./packages/mls/
COPY packages/money/package.json ./packages/money/
COPY packages/territory/package.json ./packages/territory/
COPY packages/units/package.json ./packages/units/
COPY apps/server/package.json ./apps/server/
RUN --mount=type=cache,id=crew-pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm fetch --store-dir /pnpm-store --config.strict-dep-builds=false
# The workspace lists the mobile app too: only the server and its packages are installed.
RUN --mount=type=cache,id=crew-pnpm-store,target=/pnpm-store,sharing=locked \
    CI=true pnpm install --prefer-offline --frozen-lockfile --store-dir /pnpm-store --filter @crew/server... --prod=false

# 2. Code.
COPY packages ./packages
COPY apps/server ./apps/server
# Push text comes from the app's catalogues (O-38): the server writes no copy of its own.
COPY apps/mobile/src/i18n ./apps/mobile/src/i18n

# Photos, chat files and backups live on a volume mounted at /data, writable by the app user.
RUN mkdir -p /data/uploads && chown -R node:node /data /app/apps/server
ENV NODE_ENV=production PORT=8787 UPLOAD_DIR=/data/uploads
EXPOSE 8787
VOLUME ["/data"]
USER node
WORKDIR /app/apps/server
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD wget -qO- http://127.0.0.1:8787/v1/ready > /dev/null || exit 1
CMD ["pnpm", "start"]
