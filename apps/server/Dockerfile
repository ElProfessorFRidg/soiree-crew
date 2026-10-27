# Build from the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/server ./apps/server
# The workspace lists the mobile app too: only the server and its packages are installed.
RUN pnpm install --frozen-lockfile --filter @crew/server... --prod=false
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
WORKDIR /app/apps/server
CMD ["pnpm", "start"]
