import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { bearer, HttpError, sendError, userFromToken, type Context } from "./context";
import { accountRoutes } from "./routes/accounts";
import { crewRoutes } from "./routes/crews";
import { mutationRoutes } from "./routes/mutations";
import { partyRoutes } from "./routes/parties";
import { syncRoutes } from "./routes/sync";

const PUBLIC_ROUTES = new Set(["POST /v1/accounts", "POST /v1/sessions/claim", "GET /v1/health", "GET /v1/invites/:code", "GET /v1/live"]);

export async function buildApp(ctx: Context, options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 512 * 1024 });
  // Tokens travel in the Authorization header, never in cookies, so any origin may call the API.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["authorization", "content-type"] });
  await app.register(websocket);

  app.addHook("preHandler", async (request) => {
    if (request.method === "OPTIONS") return;
    const route = `${request.method} ${request.routeOptions.url ?? ""}`;
    const user = await userFromToken(ctx, bearer(request));
    if (user) request.user = user;
    else if (!PUBLIC_ROUTES.has(route)) throw new HttpError(401, "unauthenticated");
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ error: "invalid" });
    return sendError(reply, error);
  });

  app.get("/v1/health", async () => ({ ok: true }));

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
  return app;
}
