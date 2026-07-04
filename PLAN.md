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

### 5.3 Angular 21 frontend — port of `AquaTRIZ.html`

The interactive mockup at `/AquaTRIZ.html` is the single source of truth for the frontend. It's a self-contained `dc-runtime` React component with all layout, state, animations, and even seed data baked in. The Angular build is a **1:1 port**, not a reinterpretation.

**Overall UX model** (differs from `AQUATRIZ_DESIGN.md`'s 6-screen SCADA layout — the mockup is a much cleaner 3-state investigation flow):

```
   Ask  ──startInvestigation──▶  Process  ──processDone──▶  Answer
    ▲                                                          │
    └─────────────── goAsk (Add context and re-run) ──────────┘

   Chat panel is orthogonal to all three (chatOpen boolean).
   Theme (light/dark) persists in localStorage under 'aqt-theme-v2'.
```

Route strategy: single-page with `?screen=ask|process|answer&run=<id>` query params. `screen` drives `<router-outlet>`; `run` drives the store hydration. This keeps deep-links and browser-back working without proliferating routes.

**Angular scaffold**
- `apps/web` — generated via `nx g @nx/angular:app web` (standalone components, `provideRouter`, `provideHttpClient(withFetch())`, `provideExperimentalZonelessChangeDetection()`).
- State: **NgRx Signals Store** (single `InvestigationStore`) — the mockup's state slice ports 1:1 (see §5.3.3 below).
- **Design tokens** first: `libs/ui/tokens/tokens.scss` emits CSS custom properties on `:root` and `[data-theme="dark"]`. The mockup already references the whole set — every value that follows must exist as a token:

  | Category | Tokens present in mockup |
  |---|---|
  | Surfaces | `--bg`, `--bg-elevated`, `--card`, `--card-hover`, `--overlay` |
  | Text | `--text`, `--text-muted`, `--text-dim`, `--text-faint` |
  | Borders | `--border`, `--border-strong`, `--focus-ring` |
  | Accent (green) | `--accent`, `--accent-hover`, `--accent-strong`, `--accent-text`, `--accent-soft-bg`, `--accent-soft-border` |
  | Info (blue) | `--info`, `--info-soft-bg` |
  | Warning (amber) | `--warning`, `--warning-strong`, `--warning-soft-bg`, `--warning-soft-border` |
  | Semantic extras | `--violet` (SCORE/RANK log levels), `--shadow-md` |

  Both light and dark palettes must define every one of them. Grep `apps/web/**/*.{ts,html,scss}` for hex literals — result must be empty (CI rule).

- **Data access** in `libs/data-access/api/` — `openapi-typescript` generates types from Nest's OpenAPI JSON; a hand-written `InvestigationsClient` wraps `fetch` + `EventSource` for SSE. No handwritten DTOs, no drift.

### 5.3.1 Screens (verbatim from the mockup)

| # | Screen | State flag | What it shows | Key mockup lines |
|---|---|---|---|---|
| 1 | **Ask** | `screen === 'ask'` | Hero prompt · problem `<textarea>` · 4 chip toggles (Docs / SDG / Method / Advanced) · CTA "Start investigation" · client-side validation (min 12 words → shake + missing-ingredients banner) · suggested problems row · recent investigations list | 660–842 |
| 2 | **Process** | `screen === 'process'` | Sticky left aside with 6 step chips (done/active/pending) · main focus card for `focusStep` with subtasks and result summary · collapsible **Compare candidates** panel (white = TRIZ, green = second method) · collapsible **Console log** panel with levels (READ / INDEX / FETCH / TRIZ / PHYS / DRAFT / SCORE / RANK / SIGN) · `processDone` → CTA "View the answer" | 847–999 |
| 3 | **Answer** | `screen === 'answer'` | Winner banner (gradient, checkmark, Confidence + Payback) · action strip (Approve & sign · Download PDF · Share · Rate) · **Three-answer grid** (rank badges, method label, confidence bar, payback, SDG score) · KPI grid (label + monospace value + delta + plain-language explanation) · "More detail" collapsibles · "Not satisfied?" re-run CTA back to Ask | 1004–1121 |
| — | **Chat panel** | `chatOpen === true` | Modal `<aside role="dialog">` 420px from right, overlay backdrop, message thread, suggested prompts, input + send button | 1126–1170 |
| — | **Top bar** | always | Home logo (goAsk) · breadcrumb (when applicable) · **step chips duplicated in header during Process** · theme toggle · assistant toggle (`⌘K`) | 614–654 |

### 5.3.2 Component decomposition (Angular)

Each component below maps to a marked-up region in the mockup. All standalone, `ChangeDetectionStrategy.OnPush`, signal inputs/outputs.

`libs/ui/components/`:
- `AppShellComponent` — top bar + `<main>` + optional chat aside slot
- `ThemeToggleButtonComponent` — persists to `localStorage['aqt-theme-v2']`
- `StepChipComponent` — the 26×26 numbered chip; inputs: `n`, `status`, `active`, `pulse`; `aria-label` derived
- `AskScreenComponent` — hero heading + textarea + chip row + validation + suggestions
  - subcomponents: `ChipToggleComponent`, `DocumentsCollapsibleComponent`, `SdgCollapsibleComponent`, `MethodCollapsibleComponent`, `AdvancedCollapsibleComponent`, `AskErrorBannerComponent`, `SuggestedProblemsRowComponent`, `RecentInvestigationsListComponent`
- `ProcessScreenComponent` — split layout with sticky aside
  - `StepListComponent` (aside) + `FocusStepCardComponent` (main) + `SubtaskListComponent` + `CompareCandidatesPanelComponent` + `ConsoleLogPanelComponent`
- `AnswerScreenComponent` — winner banner + actions + three-answer grid + KPI grid + detail sections + re-run CTA
  - `WinnerBannerComponent`, `AnswerActionStripComponent`, `AnswerCardComponent`, `KpiCardComponent`, `AnswerSectionComponent`
- `ChatPanelComponent` — modal aside with focus-trap directive
- Support: `ConfidenceBarComponent`, `StatusDotComponent`, `LogLineComponent`, `FileDropzoneComponent`, `SdgChipComponent`, `FocusTrapDirective`, `LiveAnnouncerService`

### 5.3.3 State shape (ports the mockup's `state` block exactly)

```ts
type Screen = 'ask' | 'process' | 'answer';
type Theme  = 'light' | 'dark';
type StepStatus = 'done' | 'active' | 'pending';

interface InvestigationState {
  theme: Theme;                          // persisted
  screen: Screen;
  chatOpen: boolean;

  // Ask
  problemDraft: string;
  askDocsOpen: boolean;
  askSdgOpen: boolean;
  askMethodOpen: boolean;
  askAdvOpen: boolean;
  askError: boolean;
  askShake: boolean;
  uploadedFiles: FileRef[];
  selectedSdgs: number[];
  method: MethodChoice;                  // 'triz+synectics' (default) | 'triz+physics' | ...

  // Process
  activeStep: 0|1|2|3|4|5;                // driven by SSE
  focusStep:  0|1|2|3|4|5;                // driven by user click on step chip
  compareOpen: boolean;
  logOpen: boolean;
  consoleLog: LogLine[];                  // append via SSE
  whiteCandidates: Candidate[];           // TRIZ path (populated at step 5)
  greenCandidates: Candidate[];           // Synectics path
  guardVerdicts: GuardVerdict[];          // NEW — see §5.3.5

  // Answer
  answerSections: Record<string, boolean>;
  winner: Candidate | null;
  topThree: RankedAnswer[];
  kpis: Kpi[];
}
```

The mockup drives all of this locally with `setInterval` timers (`startDemo()`, `activeStep++` every 1.6s, `consoleVisible++` every 550ms). In Angular, those timers are replaced by an SSE subscription that dispatches `nodeStarted`, `nodeCompleted`, `logAppended`, `investigationCompleted` actions. **Store shape stays identical** — only the driver changes. This means the mockup can be plugged into the real backend by swapping one adapter file.

Client-side validation from `attemptStart()` (line 1233) ports to a pure function in `libs/domain/validation/` and is also called server-side by the Gatekeeper node — one implementation, no drift.

### 5.3.4 ng-diagram — where it lives

The mockup does not include a graph view. Add it as a **collapsible "Full reasoning graph"** section inside the Answer screen (`answerSections.s6`), rendered via `libs/ui/components/reasoning-graph/` bound to the `/runs/:id/trail` graph payload. This preserves the mockup's uncluttered narrative for the pitch (winner + three answers up top) while still delivering the Day-3 ngDiagram material for judging credit.

### 5.3.5 Two gaps in the mockup we must close

The mockup pre-dates two of the plan's locked decisions and does **not** surface them. Both need small additions during the port:

1. **Contradiction Guard verdicts.** The Compare panel currently shows 3 white + 3 green candidates only. Add a fourth accordion row **"Rejected by contradiction guard"** that lists any candidate the guard vetoed, with the `rejected_reason` and the parameter ID that would degrade. This is the moment the pitch stops on — do not lose it.
2. **Second-method label mismatch.** The mockup's Method chip reads **"TRIZ + Physics"** (line 684) and the console log uses `PHYS` levels (lines 1354, 1358–1360). We locked **Synectics with Force-Fit** in §1. **Decide once, then propagate:**
   - Option A — keep Synectics: rename chip to "TRIZ + Synectics", swap console level to `SYNECT`, replace the "Physics decomposition" subtask copy (lines 1300, 1306) with "Analogy source: biological / personal / fantastical" copy, and change the green candidates' subtitles from `principle: 'Charge separation before RO'` to `analogy: 'Force-fit from …'`.
   - Option B — accept the mockup: switch the second method to **First Principles / Physics decomposition** (also valid per the Event Storming doc), and rename the service `synectics-candidate.service.ts` → `physics-first.service.ts` in §4a.

   The mockup's copy reads more naturally to Piotrek ("physics decomposition" > "force-fit analogy from a beehive"), and Physics matches the actual candidates (Capacitive deionization, Solar-thermal HDH, Nano-bubble feed — all physics-derived). **Recommendation: Option B.** Confirm before merging the surgery PRs.

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

Piotrek is 45 and reads dense screens all day — a11y **is** the product. Good news: the mockup already ships most of the required semantics; the port must **preserve them exactly**, not decorate around them.

**Already present in `AquaTRIZ.html` — do not lose during Angular port:**
- Semantic landmarks: `<header>`, `<main>`, `<aside role="dialog" aria-label="R&D assistant">` on chat panel, sticky `<aside>` for step navigation on Process.
- `aria-label` on every icon-only button: Home, Toggle color theme, Dismiss, Remove file, Close, Send, Message the assistant, step chips ("Step 3 — Name the tradeoff (active)").
- `aria-expanded` on every disclosure control: `askDocsOpen`, `askSdgOpen`, `askMethodOpen`, `askAdvOpen`, `compareOpen`, `logOpen`, `r.open` (answer sections).
- Modal overlay pattern with focus-blocking backdrop + `role="dialog"`.
- Focus-ring colour token (`--focus-ring`) already threaded through every interactive element's hover state.
- Minimum 40px hit target on primary buttons, 32px on chip toggles.
- Theme toggle (light/dark persisted) — respects users who need a light background.

**Must add during port:**
- **WCAG 2.1 AA contrast audit:** verify every `--text*` / `--card|bg*` pair in both themes. Automate with an `axe-core` snapshot per screen in `apps/web/e2e/`.
- **Focus management:** on `screen` change, move focus to the new screen's `<h1>`. On chat open, trap focus inside the dialog (`FocusTrapDirective`); on close, restore to the assistant toggle button.
- **Live regions:** wrap the console log in `aria-live="polite" aria-atomic="false"`. Validator failures + guard rejections → `aria-live="assertive"`. Announce step transitions ("Step 4 of 6 — Draft ideas — in progress") via a shared `LiveAnnouncerService`.
- **Reduced motion:** the mockup has `aq-pulse-dot`, `aq-glow-ring`, `aq-bar-fill`, `aq-fade-in-up`, `aq-slide-in-right`, `aq-shimmer` animations. `@media (prefers-reduced-motion: reduce)` gates them off with `animation: none !important` and `transform: none !important` where transforms are decorative.
- **Keyboard command palette:** the `⌘K` label on the Assistant button is not currently a real shortcut. Bind `⌘K` / `Ctrl+K` to `toggleChat` via a global keydown handler.
- **KPI + confidence bars:** every numeric widget gets a plain-language `aria-label` derived from `k.plain` (already in the mockup data — line 1081). Confidence bars get `role="progressbar" aria-valuenow aria-valuemin=0 aria-valuemax=100`.
- **Step chips:** already `aria-label`-ed. Also add `aria-current="step"` on the active one so screen readers announce position without hunting.
- **Reasoning-graph fallback:** when the ng-diagram section is opened, a keyboard-focusable "View as table" toggle reveals a `<table>` listing every node with headers "Node · Kind · Input · Output · Latency · Validator verdict".
- **Enforcement:** port the intent of `eslint-plugin-jsx-a11y` (Day 2 repo) into `@angular-eslint/template/*` rules; `pa11y-ci` on `apps/web` in CI; `axe-core` in `apps/web/e2e/` with three screen fixtures. Any regression blocks CI.

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
| **Method mismatch: `AquaTRIZ.html` says "TRIZ + Physics", §1 locked Synectics.** | Decide once (see §5.3.5) before any surgery PR — swapping later means editing 6+ mockup regions plus prompt files. Recommendation: switch second method to **Physics / First Principles** to match the mockup's polished narrative. |
| Contradiction Guard has no UI slot in the mockup | Add a "Rejected by guard" accordion inside the Compare panel (§5.3.5) — one component, one SSE event, no layout rework. |
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

**Next actionable step:** resolve the second-method reconciliation in §5.3.5 (Synectics vs Physics), then I'll open the two surgery PRs (§4a and §4b) since everything downstream — including the frontend port — depends on the pipeline having the right shape and the mockup's copy being consistent with it.
