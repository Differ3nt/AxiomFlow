# AquaTRIZ — Grand Implementation Plan

**Problem:** Problem 6 — Desalination (SDG 6/7). Substantially raise freshwater yield without a proportional rise in energy demand or equipment strain.

**System deliverable:** An inspectable R&D reasoning pipeline (not a single dressed-up prompt) that turns a fuzzy engineering brief into a TRIZ-derived contradiction, generates ≥3 TRIZ candidates + ≥3 candidates via a second method (**Synectics with Force-Fit**), gates them through a **Contradiction Guard**, evaluates them, and produces an auditable reasoning trail.

**Scoring targets (150 pts total):**
- Deliverables 100p: Day 1 (BPMN 20) · Day 2 (Design System 20) · Day 3 (Repo 20) · Day 4 (Eval report 20) · Day 5 (Deployed app 20)
- Pitch 25p
- Judging 50p: Innovation 25 · Usability 10 · Design 10 · Completeness 5

Persona (AQUATRIZ_DESIGN.md): **Piotrek, 45, analytical engineering manager** — signs off on capex-heavy R&D decisions, cannot present a black box.

---

## 1. Two locked decisions

1. **Second concept-generation method = Synectics with Force-Fit.** Distances the model from the problem via biological / personal / fantastical analogies, then force-fits back to engineering. Highest novelty ceiling (backs Innovation 25p) and matches the newest team spec (`system v2`).
2. **Guardrail = Contradiction Guard, not a physics gate.** For every candidate, extract its physical side effects, map them onto the 39 TRIZ parameters, and **reject** any candidate that resolves the original `improve/worsen` pair by degrading a different parameter. TRIZ purity — "nie zgadzamy się na kompromis."

Both drop straight onto the existing scaffold — see §4.

---

## 2. Architecture at a glance

```
┌───────────────────────────────────────────────────────────────────┐
│  ANGULAR 21 SPA — SCADA control panel (sidebar + main + chat)     │
│  design tokens from AQUATRIZ_DESIGN.md · ng-diagram for the graph │
└──────────────┬────────────────────────────────────────────────────┘
               │ HTTPS + SSE (OpenAPI-typed client)
┌──────────────▼────────────────────────────────────────────────────┐
│  NESTJS 11 API (apps/api)                                         │
│  • existing ReasoningPipeline (6 nodes) exposed over HTTP + SSE   │
│  • persists every node I/O to Postgres (that IS the trail)        │
└─────┬────────────┬──────────────┬────────────────┬────────────────┘
      │            │              │                │
┌─────▼───┐  ┌─────▼──────┐  ┌────▼─────────┐  ┌───▼──────────────┐
│ Gemini  │  │ MCP:TRIZ   │  │ Contradiction│  │ WebRAG (on-demand│
│ (LLM,   │  │ apps/mcp   │  │ Guard        │  │  patents / SDG)  │
│  JSON)  │  │ +triz-core │  │ (deterministic│ │                  │
└─────────┘  └────────────┘  └──────────────┘  └──────────────────┘

Postgres (Cloud SQL): runs · nodes · candidates · evaluations · selections
```

The single hardest design constraint from the brief — *"every step must run as a real, inspectable piece of logic, not a single prompt dressed up to look structured"* — is enforced by the pipeline shape below: every LLM call is wrapped in a code-side validator and every ranking/selection decision is deterministic.

---

## 3. Pipeline (state-graph, node-by-node)

Each node reads/writes a shared `RunState` persisted in Postgres. Every input, prompt, raw response, parsed output, validator verdict, tokens, and latency is stored. That row set **is** the reasoning trail — the UI is a viewer over it.

| # | Node | Kind | Purpose | Guardrail |
|---|---|---|---|---|
| 1 | **Gatekeeper** | LLM + code | Score problem clarity 0–10. If <7 → return `needs_clarification` with questions. Extract sticky constraints (cost, energy, wear). | Zod schema; 1 retry then hard fail |
| 2 | **Parameter Extractor** (goal / cost) | LLM (structured) | Two-step chain-of-thought: (a) natural-language `{improve, worsen}`, (b) map to two IDs from the 39-parameter list. | Static context injection of all 39 parameter definitions in system prompt. Cross-validate in code: `1 ≤ id ≤ 39`, `improve ≠ worsen`. Retry loop on fail. |
| 3 | **Matrix Lookup** | **Pure code** — `TrizDataService.lookup(improve, worsen)` | Read `matrix.csv[improve][worsen]` → list of principle IDs. **Zero LLM.** | This is the hackathon-defining "hard lookup" moment. |
| 4 | **TRIZ Generator** | LLM per principle | For each principle ID, generate 1 desalination-targeted candidate. Batch in parallel. | Per-candidate JSON schema: `{title, mechanism, principle_id, expected_effect, side_effects[]}`. |
| 5 | **Synectics Generator** *(second method)* | LLM (multi-shot) | 3 candidates via Force-Fit. Each candidate declares `{analogy_source: "biological"\|"personal"\|"fantastical", analogy, force_fit_translation}`. | Analogy source made explicit in output — enriches the reasoning trail and pitch narrative. |
| 6 | **Contradiction Guard** | LLM classifier + **code veto** | For each candidate: extract side effects → map each to a TRIZ parameter ID → reject if any degraded parameter is worse than the original `worsen`, or if the candidate fails to actually resolve the `improve` axis. | Deterministic reject rules first, LLM classifier as second opinion. Code has final veto. Emits `contradiction_ok: bool` + `rejected_reason` for the trail. |
| 7 | **Fast Internal Score** | Code | Cheap heuristic 0–10 per surviving candidate (schema completeness, principle applicability, constraint-hit count). | Sorts candidates and feeds §8. |
| 8 | **Lazy-RAG Gate** | Code | If any candidate < 7 → run one round of web/patent search, enrich context, loop back to §4+§5. Cap = 1 loop (visible in trail). | Prevents runaway cost. |
| 9 | **Deep Evaluator** | LLM + web search *(always)* | Per surviving candidate, score `{Yield 25%, Energy 30%, Wear 10%, CapEx 20%, SDG 15%}` with cited SOTA references. | Weights fixed in code; LLM only produces the per-axis 0–10 scores plus citations. Weighted sum computed in code. |
| 10 | **Selector** | **Pure code** | Sort by weighted total → winner + rationale + why each loser lost. | Fully deterministic — no LLM tiebreaker. |
| 11 | **Reasoning Trail Compiler** | Code | Assemble the frozen record: problem → contradiction → all 6+ candidates → guard verdicts → RAG decision → SOTA citations → evaluation matrix → choice. Emit Markdown **and** JSON **and** an ng-diagram graph payload. | The final Day-4 evidence + Day-5 demo material. |

**What makes this Innovation-worthy (25p):**
- Node 3 (matrix lookup) is a pure table read in the middle of an LLM pipeline — this is the moment the pitch anchors on.
- Node 6 (Contradiction Guard) enforces TRIZ purity by *rejecting* candidates that trade one degradation for another. This is a differentiator vs. every other team who will just LLM-score.
- Synectics with typed analogy sources makes the "reasoning trail" visibly branching — perfect for the ng-diagram screen.

---

## 4. Two concrete surgeries on the existing scaffold

The `apps/api/src/reasoning/` folder already ships the six-step pipeline (see `AGENTS.md`). Only two files change intent:

### 4a. Rename Biomimicry → Synectics
- `biomimicry-candidate.service.ts` → `synectics-candidate.service.ts`
- Add analogy typing: `type AnalogySource = 'biological' | 'personal' | 'fantastical'`
- Prompt template forces the two-step: (1) produce analogy in `analogy_source` domain, (2) force-fit back to a desalination engineering candidate. Response schema requires both `analogy` and `force_fit_translation` fields so the pitch can show the reasoning gap.
- Update `reasoning.pipeline.ts` wiring and `reasoning.module.ts` provider list.
- Update `AGENTS.md` to swap the term.

### 4b. Replace PhysicalLimit → ContradictionGuard
- `physical-limit-validator.service.ts` → `contradiction-guard.service.ts`
- New responsibility: for each candidate, LLM extracts side-effect list → maps each side effect to a TRIZ parameter ID (bounded by the 39 list). Code then compares against the original `{improve, worsen}` and rejects if any side effect degrades a parameter that isn't already in the accepted-cost list, **or** if the candidate does not resolve the original `improve` parameter.
- Guard emits `{contradiction_ok, rejected_reason, new_contradictions[]}` and this becomes a first-class field in the report.
- Delete perpetuum-mobile / thermodynamic wording from anywhere it appears — that's not what we're gating on.

Both rewrites are one PR each. `libs/triz-core` and `apps/mcp` don't move.

---

## 5. Missing pieces to build (in order)

### 5.1 HTTP + SSE layer on top of the Nest CLI app
Currently `main.ts` runs `NestFactory.createApplicationContext` (headless). Add:
- `apps/api/src/http/main-http.ts` — normal `NestFactory.create` bootstrap on `:3000`
- `apps/api/src/http/runs.controller.ts` — `POST /runs` (create) · `GET /runs/:id` · `GET /runs/:id/stream` (SSE, emits one event per pipeline node)
- Reuse the existing `ReasoningPipeline` service verbatim — HTTP is a thin wrapper. Rule from `AGENTS.md`: do **not** duplicate pipeline logic in the controller.
- `@nestjs/swagger` → OpenAPI at `/api-docs`, JSON at `/api-docs-json` for the frontend codegen.

### 5.2 Postgres persistence
- Add `libs/data-access/db/` with Sequelize models (`Run`, `NodeExecution`, `Candidate`, `Evaluation`, `Selection`).
- Every pipeline node calls `this.trail.record(runId, nodeName, {input, output, raw, tokens, latencyMs})`.
- Local dev via Docker Compose (Postgres 16). Reuse the pattern from `nan-stack-main`.

### 5.3 Angular 21 frontend
- `apps/web` — generated via `nx g @nx/angular:app web` (standalone components, `provideRouter`, `provideHttpClient(withFetch())`).
- **Design tokens** first: `libs/ui/tokens/tokens.ts` generated from the YAML front-matter of `AxiomFlowDrive/AQUATRIZ_DESIGN.md`. Emits CSS custom properties on `:root` + a TS map for JS access. Nothing in components hard-codes hex, spacing, or radius. **This is the Day-2 evidence.**
- **Component library** in `libs/ui/components/`: `KpiCard`, `PipelineStepper`, `CandidateCard`, `ContradictionGuardBadge`, `EvaluationMatrix`, `ConsoleLog`, `ReasoningTrailPanel`, `ChatBubble`, `FileDropzone`, `TemperatureSlider`, `StatusDot`. Standalone components, `ChangeDetectionStrategy.OnPush`, `input()`/`output()` signals.
- **Data access** in `libs/data-access/api/` — `openapi-typescript` generates types from the Nest OpenAPI JSON; a hand-written `RunsClient` wraps `fetch`/`EventSource`. No handwritten DTOs, no drift.
- **Screens** (mirror AQUATRIZ_DESIGN.md §Ekrany):
  1. Mission Control dashboard
  2. New Project wizard (Biały Kapelusz)
  3. Pipeline stepper (6 nodes, SSE-driven live status)
  4. Dual-agent split view (TRIZ ⚙️ vs Synectics 🔬)
  5. Reasoning trail report (collapsible + comparison matrix + **ng-diagram** graph)
  6. Chat panel (slide-in 360px)

### 5.4 ng-diagram reasoning-graph view
Reuses Day-3 material for direct credit. The trail compiler already emits a graph payload; `libs/ui/components/reasoning-graph/` binds it to ng-diagram nodes. Each node is clickable → opens a side panel with the raw prompt + raw response + validator verdict for that step. **This is what the pitch spends 90 seconds on.**

### 5.5 Eval harness (Day 4 = 20p)
- `libs/evals/` — port the deterministic runner pattern from `wcs-edd-main`.
- Fixtures: 8 seed problems (2 well-formed desalination, 2 vague, 2 off-topic, 2 adversarial with obvious contradiction traps).
- Metrics: gatekeeper clarity accuracy · TRIZ classifier agreement with hand-labelled ground truth · Contradiction Guard precision/recall on 20 hand-labelled candidates · candidate diversity (Jaccard on principle IDs, cosine on embeddings) · winner-vs-expert agreement on 3 problems · cost per run · P50/P95 latency per node.
- Output: `docs/evaluation-report.md` — this is submitted verbatim as the Day-4 artifact.

### 5.6 Cloud Run deploy (Day 5 = 20p)
- `Dockerfile.web`, `Dockerfile.api`, existing `apps/mcp/Dockerfile`.
- One Cloud Build trigger → three Cloud Run services.
- Cloud SQL Postgres (smallest tier), Cloud Secret Manager for Gemini key + DB password.
- `min-instances=1` on `api` and `web` to survive the judging panel clicking simultaneously.
- Structured JSON logs (`pipeline_event` line per node) → Cloud Logging queries screenshot goes in the pitch deck.

---

## 6. Design system application (Day 2 = 20p, Design = 10p)

Zero deviation from AQUATRIZ_DESIGN.md. Contract:

- Every colour, font, spacing, radius, elevation, transition comes from `libs/ui/tokens/` — grep for hex values in `apps/web/**/*.{ts,html,scss}` returns nothing.
- Inter for chrome, Roboto Mono for all numeric data. `.data { font-variant-numeric: tabular-nums; }`.
- Sharp corners (2px buttons/badges, 4px cards) — no default Material rounding.
- Flat depth: 1px `border` colour instead of shadows; shadow tokens only on floating elements (tooltip, dropdown).
- Semantic colour signalling: `accent`=SDG/success, `error`=alarm, `warning`=caution, `info`=headers/links, `interactive`=action. No decorative colour.

---

## 7. Accessibility (Usability 10p + Design 10p share this)

Piotrek is 45 and reads dense screens all day — a11y **is** the product.

- **WCAG 2.1 AA contrast:** verified pairs — `text-primary`/`primary` = 15.8:1 · `text-secondary`/`primary-light` = 5.6:1 · `accent`/`primary` = 6.2:1. Add a CI check that runs `pa11y-ci` against `apps/web` on every PR.
- **Landmarks:** `<header>`, `<nav>`, `<main>`, `<aside>` retained from the design mockup — the a11y skeleton is already there.
- **Keyboard:** every action reachable via `Tab`; visible focus ring 2px `interactive`, offset 2px; command palette `⌘K` (matches the mockup's Assistant toggle affordance).
- **Live regions:** SSE pipeline events → `aria-live="polite"` on the console log; validator failures → `aria-live="assertive"`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables pulse/glow/shimmer/scroll animations listed in the design doc.
- **Semantics over icons:** every status dot has an `aria-label` ("connected", "generating", "failed"). KPI numbers get plain-language `aria-label` ("42 cubic metres per hour, up 12 percent").
- **Charts:** every sparkline/matrix has a keyboard-focusable "View data" toggle that reveals a `<table>` fallback with the same numbers.
- **Enforcement:** port the intent of `eslint-plugin-jsx-a11y` (from Day 2 repo) into `@angular-eslint/template/*` rules; wire into `nx affected --target=lint`. A11y regressions block CI.

---

## 8. Clean-code guardrails

- **Nx module boundaries** enforced (`@nx/enforce-module-boundaries`): `ui/*` can't import `data-access/*`, `domain/*` can't import `ui/*`, apps import libs but not each other.
- **OpenAPI-first:** the Nest `@ApiProperty` decorators are the source of truth; frontend types are generated. No hand-authored request/response types.
- **All LLM prompts live in `libs/prompts/`** as tagged template literals with typed variables and are semver-tagged in the response. Reproducible demo.
- **Data over branches:** TRIZ parameters, principles, matrix, and Contradiction Guard rule table are data files, not `if` chains. Editing the matrix does not touch TypeScript.
- **Golden fixtures:** every reasoning-node service has a `.spec.ts` with a golden-input fixture. Those fixtures also seed the Day-4 eval harness — one artifact, two uses.
- **Secret hygiene:** `GOOGLE_GENERATIVE_AI_API_KEY` only in `.env` (already gitignored per `AGENTS.md`); in Cloud, via Secret Manager, never in `env` blocks of `cloudbuild.yaml`.

---

## 9. Execution order (dependency-driven, not calendar-driven)

Reverse-engineered from "the demo has to boot on Day 5 evening":

1. **Surgeries (§4):** Biomimicry → Synectics, PhysicalLimit → ContradictionGuard. One session. Unblocks everything.
2. **HTTP + SSE layer (§5.1):** exposes the existing pipeline to a browser. Half day.
3. **Design tokens + shell + Mission Control screen (§5.3 partial):** Day-2 evidence lands here — you can ship Day 2 even if the pipeline is still hard-coded.
4. **Pipeline stepper + SSE wiring:** live view of node 1→11.
5. **Postgres persistence (§5.2):** now the trail is queryable, past runs are reopenable.
6. **Split view + Reasoning Trail report + ng-diagram (§5.4):** the demo money-shot.
7. **Eval harness + report (§5.5):** Day-4 artifact.
8. **Cloud deploy (§5.6):** Day-5 artifact.
9. **Pitch deck + rehearsal.** Feature freeze the instant Cloud Run is green.

Deferrable / cut-lines if time runs out: Fast Internal Score (§3 node 7), Lazy-RAG Gate (§3 node 8), Chat panel. Pipeline still demoable without them; they are pure Innovation upside.

---

## 10. Pitch (25p) — 5 min hard cut, no Q&A

1. **0:00–0:45** — Piotrek problem. "€50M R&D bet, board hates black boxes."
2. **0:45–1:15** — Live input on a real desalination brief.
3. **1:15–3:30** — Walk the reasoning trail live: contradiction → **matrix lookup (highlight: this is a table read, not an LLM call)** → 6 candidates side by side → **Contradiction Guard rejecting a candidate live** → SOTA-anchored evaluation → deterministic selection.
4. **3:30–4:15** — Reopen the same run tomorrow — reproducible, versioned, PDF-exportable.
5. **4:15–5:00** — Innovation punchline: *"One deterministic ridge inside the LLM pipeline is the difference between an oracle and a review."* SDG 6/7 impact estimate on the last slide.

Slides in English (per the "one English-speaking judge" note in Deliverables).

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Gemini quota / latency during the demo | Persist every past run; add a `?replay=<runId>` mode that renders the trail from Postgres. Judges don't notice, we don't die. |
| LLM misclassifies TRIZ parameter IDs | Static-context injection + code cross-validation + one retry loop + log every mismatch to the eval harness so we can PR-fix prompts. |
| Contradiction Guard false-positives kill all candidates | Guard emits `rejected_reason` — trail shows the rejection, and the UI surfaces "guard hit, retry with adjusted context" instead of empty state. |
| Web-search flakiness on deep evaluator | Cache RAG responses per problem-hash; second demo run is instant. |
| Design-token drift between doc and code | Generate CSS variables from a single source file; add a PR check that greps app code for hex literals (must be empty). |
| A11y regressions | `pa11y-ci` on `apps/web`; ported jsx-a11y rules on Angular templates in CI. |
| Cloud SQL cold start | `min-instances=1`, connector pool warm. |
| Scope creep on the second method | Locked to Synectics; no swap after HTTP layer merges even if someone floats "Morphological just to be safe". |

---

## 12. What lands where in the submission form

| Field | Artifact | Where it lives |
|---|---|---|
| Link to Day 1 artifact | BPMN / Event Storming board (already in `AxiomFlowDrive/Event Storming.docx` — port to a Miro or shared PDF) | Drive link |
| Link to Figma design | AQUATRIZ_DESIGN.md tokens re-expressed as a Figma library (design person, in parallel with §5.3) | Figma link |
| Link to code repository | This repo | GitHub / GitLab |
| Link to Day 4 artifact | `docs/evaluation-report.md` (§5.5) | Repo path or Drive |
| Link to the working app | Cloud Run URL of `apps/web` | Cloud Run |
| Link to pitch presentation | Deck (§10) | Drive |

---

**Next actionable step:** approve this plan and I'll open the two surgery PRs (§4a and §4b) first, since everything downstream depends on the pipeline having the right shape.
