import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { bearer, HttpError, sendError, userFromToken, type Context } from "./context";
import { accountRoutes } from "./routes/accounts";
import { crewRoutes } from "./routes/crews";
import { moneyRoutes } from "./routes/money";
import { mutationRoutes } from "./routes/mutations";
import { partyRoutes } from "./routes/parties";
import { photoRoutes } from "./routes/photos";
import { pollRoutes } from "./routes/polls";
import { cardRoutes } from "./routes/cards";
import { chatRoutes } from "./routes/chat";
import { claimRoutes } from "./routes/claims";
import { downloadRoutes } from "./routes/downloads";
import { feedRoutes } from "./routes/feed";
import { aiOrderRoutes } from "./routes/aiOrder";
import { communityRoutes } from "./routes/community";
import { statsRoutes } from "./routes/stats";
import { profileRoutes } from "./routes/profiles";
import { radarRoutes } from "./routes/radar";
import { recapRoutes } from "./routes/recap";
import { leaderboardRoutes } from "./routes/leaderboards";
import { syncRoutes } from "./routes/sync";
import { venueRoutes } from "./routes/venues";

const PUBLIC_ROUTES = new Set(["POST /v1/accounts", "POST /v1/sessions/claim", "POST /v1/sessions/password", "GET /v1/health", "GET /v1/info", "GET /download/android.json", "GET /download/soiree-crew.apk", "GET /v1/invites/:code", "GET /v1/live", "GET /i/:code", "GET /v1/photos/:id"]);

export async function buildApp(ctx: Context, options: { logger?: boolean; trustProxy?: boolean | number } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    // Behind Coolify's proxy every request comes from the proxy: without this, rate limits would
    // count all users as one address. Only set it when the port is reachable through the proxy alone.
    // (Cast: a boolean | number union confuses Fastify's server-type overloads.)
    trustProxy: (options.trustProxy ?? false) as boolean,
    // SEC-01: the live channel carries the token in its query string; logs keep the path only.
    logger: options.logger
      ? { serializers: { req: (req) => ({ method: req.method, url: req.url.split("?")[0] ?? "", remoteAddress: req.ip }) } }
      : false,
    bodyLimit: 512 * 1024,
    forceCloseConnections: true,
  });
  // Tokens travel in the Authorization header, never in cookies, so any origin may call the API.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["authorization", "content-type"] });
  await app.register(websocket);

  app.addHook("preHandler", async (request) => {
    if (request.method === "OPTIONS") return;
    const route = `${request.method} ${request.routeOptions.url ?? ""}`;
    const user = await userFromToken(ctx, bearer(request));
    if (user) request.user = user;
    else if (!PUBLIC_ROUTES.has(route)) throw new HttpError(401, "unauthenticated");
  });

  // SEC-03: once served over HTTPS, browsers must stay on it; nothing is framed or sniffed.
  const https = ctx.publicUrl.startsWith("https://");
  app.addHook("onSend", async (_request, reply) => {
    if (https) reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ error: "invalid" });
    return sendError(reply, error);
  });

  app.get("/v1/health", async () => ({ ok: true }));
  /** What the connect screen shows before signing up: a public server says so, with its name. */
  app.get("/v1/info", async () => ({
    name: ctx.serverInfo?.name || "Soirée Crew",
    description: ctx.serverInfo?.description ?? "",
    public: ctx.serverInfo?.public ?? false,
    openCrews: ((await ctx.db.query<{ n: number }>("select count(*)::int as n from crews where open"))[0]?.n ?? 0),
  }));

  /** One socket per device. The token comes as a query parameter because browsers cannot set socket headers. */
  app.get("/v1/live", { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token;
    const user = await userFromToken(ctx, token);
    if (!user) {
      socket.close(4401, "unauthenticated");
      return;
    }
    const remove = ctx.live.add(user.id, socket);
    socket.on("close", remove);
    socket.send(JSON.stringify({ type: "hello" }));
  });

  accountRoutes(app, ctx);
  mutationRoutes(app, ctx);
  syncRoutes(app, ctx);
  crewRoutes(app, ctx);
  partyRoutes(app, ctx);
  pollRoutes(app, ctx);
  cardRoutes(app, ctx);
  feedRoutes(app, ctx);
  aiOrderRoutes(app, ctx);
  communityRoutes(app, ctx);
  venueRoutes(app, ctx, ctx.hashSecret);
  leaderboardRoutes(app, ctx);
  radarRoutes(app, ctx);
  moneyRoutes(app, ctx);
  recapRoutes(app, ctx);
  chatRoutes(app, ctx);
  claimRoutes(app, ctx);
  downloadRoutes(app, ctx);
  profileRoutes(app, ctx);
  photoRoutes(app, ctx);
  statsRoutes(app, ctx);
  return app;
}
