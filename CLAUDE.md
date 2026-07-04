# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both servers (API on :3000, Angular on :4200)
npm run dev

# Type-check without building
npx tsc -p apps/web/tsconfig.app.json --noEmit
npx tsc -p apps/api/tsconfig.app.json --noEmit

# Build individual apps
npx nx run api:build-http
npx nx serve web

# Lint
npx nx run web:lint
npx nx run api:lint

# Run tests (Jest)
npx nx run <lib>:test                  # e.g. nx run triz-core:test
npx nx run <lib>:test --testFile=path  # single file

# CLI solve (no HTTP server, prints full reasoning trail)
npm run solve -- "problem statement text"
npm run solve -- --json
```

Environment: copy `.env.example` → `.env`, set `ANTHROPIC_API_KEY`. Optional: `CLAUDE_MODEL` (default `claude-haiku-4-5`), `DATABASE_URL`.

## Architecture

### Monorepo layout

```
apps/
  api/       NestJS — reasoning pipeline + HTTP API
  web/       Angular 21 — single-page UI
  mcp/       MCP server exposing TRIZ data over Streamable HTTP
libs/
  triz-core/          TRIZ types + hard contradiction-matrix lookup (shared by api + mcp)
  data-access/db/     Sequelize models + TrailService (PostgreSQL reasoning audit trail)
  ui/tokens/          tokens.scss — single source of truth for all CSS custom properties
```

### API pipeline (`apps/api/src/reasoning/`)

The reasoning pipeline is the core product. Each step is a separate NestJS service:

1. **ParameterExtractionService** — LLM maps problem text to 2 of 39 TRIZ engineering parameters (structured JSON, enum-constrained schema).
2. **ContradictionService** — pure code, assembles the technical contradiction from extracted parameter IDs.
3. **TrizDataService.lookup()** — pure code, hard lookup in the 39×39 contradiction matrix → returns 3–4 inventive principles. The LLM cannot choose different principles; the schema enforces the enum.
4. **TrizCandidateService** — LLM translates each matrix-selected principle into a concrete candidate for the specific domain (3 candidates).
5. **PhysicsFirstService** — independent second method; LLM generates 3 candidates grounded in named physical fundamentals (thermodynamics, fluid dynamics, etc.).
6. **ContradictionGuardService** — LLM + logic guardrail; rejects candidates that fail to resolve the improving parameter *before* scoring.
7. **EvaluationService** — LLM scores all surviving candidates on 4 axes (0–100); weighted composite is computed in code with fixed weights (35/30/20/15), not by the model.
8. **ReportService** — async; calls LLM to write a 3-paragraph narrative justification, then assembles the final `ReasoningReport`.

**Critical invariant:** TRIZ principle selection comes from `TrizDataService.lookup()` (plain code), never from LLM free choice. Final ranking is a code sort on composite scores. The LLM scores dimensions and writes prose; it never picks the winner.

### HTTP layer

`apps/api/src/http/` has two controllers:
- **RunsController** — `POST /runs` starts a pipeline run async (returns `{ id }`); `GET /runs/:id/stream` streams SSE events (`step`, `log`, `completed`, `error`); `GET /runs/:id/trail` returns the full audit trail from the DB.
- **ChatController** — `POST /chat` takes `{ message, context? }` and returns `{ reply }` via `ClaudeService.generateText`.

Swagger UI at `http://localhost:3000/api-docs`.

### Angular frontend (`apps/web/src/app/`)

**Screen flow:** `ask` → `process` → `answer`. No Angular Router — `InvestigationStore` holds a `screen` signal and all UI state. There are no routes.

**State management:** `InvestigationStore` (`state/investigation.store.ts`) is a single `@Injectable({ providedIn: 'root' })` service using Angular signals. It owns:
- Screen navigation (`screen`, `goAsk()`, `goAnswer()`)
- Ask form state (`problemDraft`, `temperature`, `attachedFiles`, `selectedSecond`)
- Live pipeline state (`activeStep`, `focusStep`, `consoleLogList`) — fed by SSE from the API
- Answer data (`topCandidates`, `allCandidates`, `kpis`, `sections`, `approved`)
- Chat state (`chatMessages`, `chatLoading`, `chatInput`) — calls `POST /chat`
- Theme persistence (localStorage key `aqt-theme-v2`)

**SSE wiring:** `startInvestigation()` in the store posts to `/runs`, then opens an `EventSource` on `/runs/:id/stream`. `step` events advance `activeStep`; `completed` populates all answer signals. The process screen is driven entirely by these signals.

**Components:** All standalone, `ChangeDetectionStrategy.OnPush`. Three screens (`ask/`, `process/`, `answer/`) plus two shared components (`top-bar/`, `chat-panel/`). `ReasoningGraphComponent` renders the ngx-graph DAG on the answer screen.

### Design tokens

All CSS custom properties are defined in `libs/ui/tokens/tokens.scss` and applied via `[data-theme="light"]` / `[data-theme="dark"]` on `<html>`. The store's `theme` signal drives `document.documentElement.setAttribute('data-theme', ...)` via an `effect()`. **Never use hardcoded color values in component SCSS** — always use a token. **Never pass `var(--token)` strings to ECharts** — ECharts cannot resolve CSS variables; read `store.theme()` and pass resolved hex values instead.

### ClaudeService pattern

`ClaudeService` has two methods:
- `generateJson<T>({ systemInstruction, prompt, schema, temperature? })` — forces a `tool_use` response with the given JSON schema. All pipeline steps that produce structured data use this.
- `generateText({ systemInstruction, prompt, temperature? })` — plain text response. Used for the chat endpoint and the winner justification paragraph.

### MCP server (`apps/mcp/`)

Exposes `libs/triz-core` over Streamable HTTP (`/mcp`) using `@modelcontextprotocol/sdk`. Stateless, permissive CORS. Deploy target is Cloud Run; build with `make build-mcp GCP_PROJECT_ID=<id>`. Do not use `nx run mcp:prune` — it is broken; use plain build + `npm ci --omit=dev`.

### Shared lib path aliases

`tsconfig.base.json` defines:
- `@axiomflow/triz-core` → `libs/triz-core/src/index.ts`
- `@axiomflow/data-access-db` → `libs/data-access/db/src/index.ts`
