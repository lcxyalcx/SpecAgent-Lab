# 🧪 SpecAgent Lab

A product-grade lab for benchmarking multi-turn AI agents—compare latency, cost, rubric-aligned quality, and tool reliability across workflow modes, with persisted runs and portfolio-ready dashboards.

---

## 2. 🚀 Live demo

> **Placeholder:** [Add your deployed URL here](https://example.com)  
> Deploy on Vercel (or similar), set `DATABASE_URL` and `OPENAI_API_KEY` in project settings, run migrations, then link the production URL in your portfolio and resume.

---

## 3. 🎯 Product motivation

Teams ship agents faster than they can **measure** them. SpecAgent Lab treats evaluation as a first-class product surface: benchmark tasks carry explicit rubrics; agents run under realistic tool constraints; traces persist; aggregates answer “Are we faster *and* still correct?” without ad-hoc spreadsheets. The lab is opinionated about **workflow comparison** (baseline vs draft-verifier) so PM and engineering conversations stay comparable, not one-off demos.

---

## 4. 👥 Target users

| **EN** |
|--------|
| **AI / technical PMs** — Frame metrics, compare modes, narrate tradeoffs for stakeholders and interviews. |
| **Full-stack / applied ML engineers** — Wire agents, extend rubrics, inspect run JSON and traces. |
| **Interviewers & reviewers** — Clone, run locally, validate product metrics *and* implementation depth. |

---

## 5. ✨ Key features

| **EN** |
|--------|
| **Benchmark pack** — Curated multi-turn-style tasks with rubrics; run via `/benchmark`. |
| **Dual workflow** — Baseline (single agent) vs Draft + Verifier (orchestrated; see §8). |
| **Evaluation module** — Default heuristic scoring; optional LLM-as-judge with `OPENAI_API_KEY`. |
| **Persistence** — Prisma: `AgentConfig`, `BenchmarkTask`, `Run`, `ToolCall`; links to `/runs/[id]`. |
| **Dashboard** — `/dashboard` aggregates Postgres runs; mock fallback when DB is empty. |
| **Playground** — `/playground` for interactive exploration alongside benchmarks. |

---

## 6. 🧭 Architecture (text diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js App Router                             │
├──────────────┬────────────────────┬──────────────────┬──────────────────┤
│   /          │   /playground      │   /benchmark     │   /dashboard     │
│   Overview   │   Agent UI         │   Task + modes   │   Aggregates +   │
│              │                    │                  │   Recharts         │
└──────┬───────┴─────────┬──────────┴────────┬─────────┴────────┬─────────┘
       │                 │         POST /api/benchmark/run       │
       │                 │                   ▼                  │
       │                 │         ┌─────────────────┐          │
       │                 │         │ Benchmark runner│          │
       │                 │         └────────┬────────┘          │
       │                 │     ┌────────────┼────────────┐     │
       │                 │     ▼            ▼            ▼     │
       │                 │ baseline   draft-verifier   evaluator│
       │                 │ (AI SDK)   (draft+verify)   (heuristic│
       │                 │                             / judge) │
       │                 │                 └───────────┬────────┘
       │                 │                           ▼          │
       │                 │                 ┌─────────────────┐  │
       │                 │                 │ Prisma → Postgres│
       │                 │                 │ Run, ToolCall    │
       │                 │                 └─────────────────┘
       └──────────────────┴──► /runs/[id] — timeline + product insight
```

**EN (one-liner):** UI → API → agents + evaluator → Prisma → dashboards and run detail.

---

## 7. 📊 Metrics framework

| **Metric** | **Product question** |
|-----------------|---------------------------|
| Task success score | Did output satisfy the rubric? |
| Latency | Fast enough for the use case? |
| Estimated cost | Affordable at target volume? |
| Tool error rate | Are tools helping or hurting? |
| Draft acceptance rate | How often does verifier accept the draft? |
| Subscores (when present) | Where to invest—prompting, tools, or verification? |

---

## 8. 🔀 Baseline vs Draft–Verifier workflow

**Baseline:** One agent loop: plan, optional tool calls, final answer. Easiest to reason about; latency and cost follow a single path.

**Draft + Verifier:** A **draft** model proposes an answer (and plan); a **verifier** model reviews and may accept, revise, or reject before the user-facing output is finalized. Metrics include verifier confidence and draft acceptance.

**Critical clarification:** This pattern is **inspired by the *idea* of speculative execution** (propose cheaply, verify selectively) but it is **not token-level speculative decoding**. There is no parallel draft-token stream inside the inference engine; it is **application-level orchestration** for benchmarking and product experiments.

---

## 9. 🧰 Tech stack

| **EN** |
|--------|
| Next.js (App Router), React 19, TypeScript |
| Tailwind CSS, shadcn/ui, Recharts |
| Vercel AI SDK, `@ai-sdk/openai` |
| Prisma 6, PostgreSQL |
| Zod (API validation) |

---

## 10. 🛠️ Local setup

Requires Node 20+, **pnpm** (see `packageManager` in `package.json`), and PostgreSQL for full persistence.

```bash
git clone <your-fork-url>
cd SpecAgent-Lab
pnpm install
cp .env.example .env
# Edit .env — set DATABASE_URL (and OPENAI_API_KEY for live agents / LLM judge)
pnpm run prisma:generate
pnpm run db:migrate   # or: pnpm run db:push
pnpm run db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If installs fail with npm-style peer conflicts, prefer **pnpm** or use `npm install --legacy-peer-deps` only if necessary.

**Build note:** `pnpm install` runs **`postinstall` → `prisma generate`**. `pnpm build` runs **`prisma generate && next build`** so the Prisma Client is always present on Vercel and in CI.

---

## 10.1 Vercel deployment

1. Push the repo to GitHub and **Import** the project in [Vercel](https://vercel.com). Framework preset: **Next.js**.  
2. **Environment variables** (Project → Settings → Environment Variables), for **Production** (and Preview if you want):  
   - `DATABASE_URL` — PostgreSQL connection string ([Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), [Neon](https://neon.tech), etc.).  
   - `OPENAI_API_KEY` — Required for **`/benchmark`** and **`/playground`** agent calls (OpenAI API).  
   - `NEXT_PUBLIC_APP_URL` — Optional but recommended: your production URL, e.g. `https://your-project.vercel.app` (used for `metadataBase` and canonical links). If omitted, the app falls back to `VERCEL_URL` when present.  
3. **Database schema:** from your machine (or Vercel CLI), run migrations or push against the **same** `DATABASE_URL`:  
   `pnpm run db:push` or `pnpm run db:migrate`  
   Optionally: `pnpm run db:seed` for sample rows.  
4. **Deploy:** Vercel runs `pnpm install` (which runs `prisma generate`) then `pnpm build`. No extra Vercel build command override is required.  
5. **Without `DATABASE_URL`:** the app **still builds and runs**; `/dashboard` shows **demo / sample** charts; `/benchmark` and `/playground` APIs return **503** with a clear JSON `code` until the database and OpenAI are configured.

---

## 11. 🔐 Environment variables

| **Variable** | **EN** |
|---------------------|--------|
| `DATABASE_URL` | Required for real runs, live dashboard data, and `/runs/[id]`. |
| `OPENAI_API_KEY` | Required for **benchmark** and **playground** agent runs; optional LLM-as-judge when enabled. |
| `NEXT_PUBLIC_APP_URL` | Recommended in production for metadata and absolute URLs; falls back to `VERCEL_URL`. |

Copy from `.env.example`. Never commit secrets.

---

## 12. 🧪 How to run benchmark

1. Migrate DB (and optionally seed).  
2. Open **`/benchmark`**.  
3. Select tasks and modes (**Baseline**, **Draft + Verifier**, or both).  
4. Optionally enable **LLM-as-judge** (extra API calls; needs `OPENAI_API_KEY`).  
5. Click **Run Benchmark** — persists `Run` rows and `ToolCall` traces.  
6. Open a row → **`/runs/[id]`**; review aggregates on **`/dashboard`**.

**API:** `POST /api/benchmark/run` with body `{ "taskIds": ["..."], "modes": ["baseline","draft_verifier"], "useLlmJudge": false }`.

---

## 13. 🧾 Example experiment result

**Illustrative — your numbers will vary:**

| Mode | Runs | Avg latency | Avg cost (USD) | Avg task success |
|------|------|-------------|----------------|------------------|
| Baseline | 3 | ~9.2 s | ~0.034 | ~82% |
| Draft + Verifier | 3 | ~7.5 s | ~0.028 | ~79% |

**Takeaway:** Draft-verifier may improve wall-clock and cost while verifier guardrails bound risk; the UI makes the tradeoff explicit.

---

## 14. 🖼️ Screenshots placeholders

Add images under `docs/screenshots/` (or your path) and embed below for your portfolio README.

| **Placeholder** |
|----------------------|
| `docs/screenshots/overview.png` |
| `docs/screenshots/benchmark.png` |
| `docs/screenshots/dashboard.png` |
| `docs/screenshots/run-detail.png` |

```markdown
<!-- When files exist:
![Dashboard](docs/screenshots/dashboard.png)
-->
```

---

## 15. 🧭 Future work

| **EN** |
|--------|
| Auth & multi-tenant workspaces |
| Scheduled regression benchmarks + diff alerts |
| Human-in-the-loop labels merged with auto rubrics |
| Export CSV / Parquet |
| No-code rubric editor for PMs |

---

## 16. 📝 Resume bullet examples

**Copy/adapt with your deployment numbers:**

- Defined a **multi-metric evaluation framework** (success, latency, cost, tool errors, draft acceptance) for multi-turn agent benchmarks; shipped aggregated dashboards in Next.js + Recharts.  
- Implemented **baseline vs draft-verifier** comparison; documented that the pattern is **speculative-style orchestration**, not **token-level speculative decoding**.  
- Delivered **persisted traces** (Prisma + PostgreSQL) with `/runs/[id]` timeline and auto-generated **product interpretation** for stakeholder-ready narratives.  
- Built a **pluggable evaluator** (heuristic default + optional LLM-as-judge) balancing demo stability and deeper scoring when API keys are available.

---

## 📜 License

Private / portfolio unless you add an explicit open-source license.

---

<p align="center">
   <b>SpecAgent Lab</b> — ship agents with measurable quality, latency, and cost.
</p>
