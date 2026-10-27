# ADR 0004: AI provider

Status: accepted, 2026-10-27.

## Context

`<ai_features>` asks for a swappable provider, opt-in per crew, minimal data, controlled cost and nothing saved without a person's confirmation. The app must keep working with no AI at all: offline, on a server without a key, or in a crew that said no.

## Decision

- One server module, `apps/server/src/ai.ts`, exposes `AiProvider.complete(system, user, maxTokens)`. The provider is chosen by environment: `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`, model from `AI_MODEL` (default `claude-haiku-5-5`, the cheapest current model; a short story needs no more). No SDK: one `fetch` to the Messages API, a 20 s timeout. Another provider is one more function behind the same interface.
- Off by default twice: no provider unless the server is configured, and `crews.ai_enabled` is false until the crew admin turns it on in Settings, which says what leaves the server.
- The phone never talks to the provider. It sends the server the facts it already shows (first names, bars, times, the top quote, never drinks or BAC), the server validates their size and forwards them.
- Cost: a 400-token answer, 10 drafts per person per hour, nothing cached on the provider side by us.
- Nothing is published by the model: a draft comes back to the person who asked, who reads it, may ask again, and publishes it themself. The house rules (no dashes) are applied to the output as well.
- Without AI, the same screen writes the story from templates on the phone (`apps/mobile/src/recap/nightStory.ts`), in three tones, French and English.

## Consequences

- AI-02 works for everyone, better with AI where the crew wants it.
- AI-01 (structured free text) and AI-03 (card generator) will reuse the same module and the same switch; until then the local fuzzy parser covers AI-01's offline fallback.
- Chat content is never sent (MSG-09): the module has no access to it.
