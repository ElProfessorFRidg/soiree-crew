// <ai_features>: one place that talks to a language model, swappable by configuration (ADR 0004).
// Nothing here runs unless AI_PROVIDER and its key are set on the server and the crew opted in.

export interface AiProvider {
  name: string;
  complete(system: string, user: string, maxTokens: number): Promise<string>;
}

/** Anthropic's Messages API over plain fetch: no SDK, nothing stored by us. */
function anthropic(apiKey: string, model: string): AiProvider {
  return {
    name: "anthropic",
    async complete(system, user, maxTokens) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`ai ${res.status}`);
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    },
  };
}

/** The configured provider, or null when the server runs without AI (the default). */
export function aiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) return anthropic(env.ANTHROPIC_API_KEY, env.AI_MODEL ?? "claude-haiku-5-5");
  return null;
}
