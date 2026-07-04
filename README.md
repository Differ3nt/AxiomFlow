# Build a system for an R&D department (acting as your client/investor) that takes the assigned inventive problem, reformulates it as a technical contradiction, and generates at least 3 candidate solutions using TRIZ via the contradiction matrix and at least 3 using a second method of your choosing; the system must evaluate all candidates against the original problem, select one, and present the full reasoning trail: 
1. problem, 
2. contradiction, 
3. all candidates, 
4. evaluation, and 
5. choice
Every step must run as a real, inspectable piece of logic, not a single prompt dressed up to look structured. 
Hints & tips
Use of available LLM tools, including web-search & retrieval is very appreciated
You can build additional context with available documents (for example SDG reps)
Inventive challenges
All seven described problems are meant to help in achieving one or more Sustainable Development Goals as defined by the UN. During the Hackathon, as part of the live demo, the teams should clearly demonstrate potential solutions, how one of the problems could be tackled. Remember to use at least two concept generation methods (one of them MUST be TRIZ Technical Contradiction Solving), and evaluate concepts. 


## Our problem
Problem 6: Improving desalination (SDG 6 / 7)
Desalination, which is turning seawater into drinking water, is one of the most promising responses to global water scarcity, particularly in regions with limited freshwater sources. Producing freshwater this way requires significant energy input, and the equipment involved experiences wear from the pressures and temperatures used in the process. Many of the regions most in need of desalinated water also face limited or expensive energy access. Your task: propose a way to substantially increase freshwater output from desalination without a proportional increase in energy demand or equipment strain. The ultimate question is, how to drink undrinkable water from the ultimate source of water on Earth 🌊?

---

## MVP: TRIZ + Biomimicry reasoning engine (console app)

An Nx monorepo (`apps/api`, NestJS on esbuild) implementing the full reasoning trail as a
console app, so the logic exists and is testable before the frontend is wired up.

### Pipeline

```
problem text
  -> 1. ParameterExtractionService   (Gemini, structured output)   -> maps to 2 of the 39 TRIZ engineering parameters
  -> 2. ContradictionService         (plain code)                  -> builds the technical contradiction
  -> 3. TrizDataService.lookup()     (plain code, hard matrix lookup) -> recommended TRIZ principles
     TrizCandidateService            (Gemini, structured output)   -> 3 TRIZ candidates
  -> 4. BiomimicryCandidateService   (Gemini, structured output)   -> 3 biomimicry candidates (2nd method)
  -> 5. PhysicalLimitValidatorService (plain code, regex guardrail) -> rejects perpetual-motion/free-energy claims
     EvaluationService               (Gemini scoring + weighted code aggregation) -> ranks all 6 candidates
  -> 6. ReportService                (plain code)                  -> prints problem/contradiction/candidates/evaluation/choice
```

TRIZ data (`apps/api/src/triz/data`): the 39 Engineering Parameters and a 109-row subset of
the Contradiction Matrix are sourced from the open-source
[Heinrich](https://github.com/NickScherbakov/Heinrich-The-Inventing-Machine) TRIZ knowledge
base; the 40 Inventive Principles are the standard published list. Parameter pairs missing
from the matrix fall back to a fixed, documented set of generic principles — the report
always states whether a pair was matched or fell back.

### Setup

```bash
npm install
cp .env.example .env   # add your Gemini key: https://aistudio.google.com/apikey
```

### Run

```bash
npm run solve -- "your own problem statement"
npm run solve -- --file problem.txt    # read the problem statement from a file
npm run solve -- --json                # print the raw ReasoningReport as JSON
npm run solve -- --help                # usage
```

A problem statement is required — either a positional argument or `--file`.

This builds `apps/api` with Nx/esbuild and runs it as a plain Node console app — no server,
no frontend required yet. The same Nest modules/providers are ready to be exposed behind a
REST controller later for the Angular frontend without rewriting the pipeline.

---

## MCP server (`apps/mcp`)

The TRIZ engineering parameters, inventive principles, and contradiction-matrix lookup
(`libs/triz-core`, shared with `apps/api`) are also exposed as an MCP server over Streamable
HTTP, so any MCP-compatible client/agent can query them directly: `lookup_contradiction_matrix`,
`get_parameter_by_id`, `get_principle_by_id`, `list_parameters`, `list_principles`.

### Run locally

```bash
npx nx run mcp:build
node dist/apps/mcp/main.cjs        # listens on http://0.0.0.0:8080/mcp
```

Set `MCP_HOST`/`MCP_PORT` in `.env` to override the bind address/port (Cloud Run injects `PORT`
automatically). The server is stateless (no session tracking) and permissive-CORS, matching the
`simpleStatelessStreamableHttp` pattern from the MCP TypeScript SDK.

### Deploying to Cloud Run

Artifacts are prepared but nothing is deployed automatically — you run these yourself against
your own GCP project once `gcloud` is authenticated:

```bash
make gcp-enable-apis    GCP_PROJECT_ID=<your-project-id>
make gcp-create-registry GCP_PROJECT_ID=<your-project-id>
make build-mcp          GCP_PROJECT_ID=<your-project-id>   # Cloud Build: apps/mcp/build-mcp.yaml
make show-urls          GCP_PROJECT_ID=<your-project-id>
```

`apps/mcp/Dockerfile` is a two-stage build (Nx build in a `node:20-alpine` builder, then a slim
runtime image with only the bundled `main.cjs` + its two runtime deps installed via `npm ci`).
Build context is the repo root: `docker build -f apps/mcp/Dockerfile .`
