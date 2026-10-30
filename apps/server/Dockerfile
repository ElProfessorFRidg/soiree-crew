# Build from the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/server ./apps/server
# Push text comes from the app's catalogues (O-38): the server writes no copy of its own.
COPY apps/mobile/src/i18n ./apps/mobile/src/i18n
# The workspace lists the mobile app too: only the server and its packages are installed.
RUN pnpm install --frozen-lockfile --filter @crew/server... --prod=false
# Photos, chat files and backups live on a volume mounted at /data, writable by the app user.
RUN mkdir -p /data/uploads && chown -R node:node /data /app/apps/server
ENV NODE_ENV=production PORT=8787 UPLOAD_DIR=/data/uploads
EXPOSE 8787
VOLUME ["/data"]
USER node
WORKDIR /app/apps/server
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD wget -qO- http://127.0.0.1:8787/v1/health > /dev/null || exit 1
CMD ["pnpm", "start"]
