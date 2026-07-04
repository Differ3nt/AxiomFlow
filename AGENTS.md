# AxiomFlow Hackathon — AGENTS.md

## Cel projektu

System dla działu R&D (TRIZ + Biomimikry) rozwiązujący Problem 6: poprawa desalinacji
(SDG 6/7) — patrz `README.md`. Wymaganie z briefu: pełny, inspekcjonowalny tok rozumowania
(problem → sprzeczność → kandydaci → ewaluacja → wybór), nie pojedynczy prompt udający proces.

## Tech stack

- **Monorepo:** Nx (`nx.json`, esbuild executor)
- **Backend/logic:** NestJS (`apps/api`), na razie uruchamiany jako aplikacja konsolowa
  (`NestFactory.createApplicationContext`, bez HTTP) — `npm run solve`
- **LLM:** Google Gemini (`@google/generative-ai`), structured JSON output (`responseSchema`)
- **Frontend:** Angular — TODO, dokłada druga osoba w zespole
- **Docelowo:** Nx + Angular + NestJS + SQL + MCP (patrz Drive: `AxiomFlow/Git Repos from all days/README.md`)

## Struktura katalogów

```
apps/api/src/
  main.ts                 # CLI entrypoint (console app, na razie bez HTTP)
  app.module.ts
  triz/
    data/                 # parameters.ts, principles.ts, matrix.ts — statyczne dane TRIZ
    triz-data.service.ts   # hard lookup w macierzy sprzeczności (bez LLM)
    triz.module.ts
  llm/
    gemini.service.ts      # generateJson<T>() — wymusza structured output od Gemini
    llm.module.ts
  reasoning/
    dto/reasoning.types.ts
    parameter-extraction.service.ts   # krok 1 (LLM, ograniczony do 39 parametrów)
    contradiction.service.ts          # krok 2 (kod)
    triz-candidate.service.ts         # krok 3 (LLM, ale zasady wybiera hard lookup)
    biomimicry-candidate.service.ts   # krok 4 — druga metoda (LLM)
    physical-limit-validator.service.ts # krok 5a — guardrail (regex, bez LLM)
    evaluation.service.ts             # krok 5b (LLM scoring + ważona agregacja w kodzie)
    report.service.ts                 # krok 6 — budowa i druk raportu (kod)
    reasoning.pipeline.ts             # orkiestracja całości
    reasoning.module.ts
```

## Zasady dla agentów / zespołu

- Każdy krok pipeline'u to osobny serwis z jedną odpowiedzialnością — nie zlewać kroków w jeden wielki prompt.
- Wybór zasady TRIZ (principle) zawsze pochodzi z twardego lookupu w macierzy (`TrizDataService.lookup`),
  LLM tylko formułuje konkretne zastosowanie danej zasady — nie zgaduje, którą zasadę wybrać.
- Ranking/wybór finalnego kandydata liczy kod (`EvaluationService`/`ReportService`), nie model.
- Guardrail fizyczny (`PhysicalLimitValidatorService`) działa przed jakimkolwiek wywołaniem LLM do oceny.
- Sekret `GOOGLE_GENERATIVE_AI_API_KEY` tylko w `.env` (gitignored) — nigdy w kodzie/commitach.
- Frontend (Angular) będzie później korzystał z tych samych serwisów Nest przez kontroler REST —
  nie przepisywać logiki pipeline'u pod frontend, tylko dodać cienką warstwę HTTP.
