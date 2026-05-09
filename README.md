# 🧪 SpecAgent Lab / SpecAgent 实验室

**EN:** A product-grade lab for benchmarking multi-turn AI agents—compare latency, cost, rubric-aligned quality, and tool reliability across workflow modes, with persisted runs and portfolio-ready dashboards.

**中文：** 面向多轮 AI Agent benchmark 的产品级实验台——对比不同工作流下的延迟、成本、与 rubric 对齐的质量及工具可靠性，持久化运行轨迹，并配套可直接用于作品集的仪表盘与详情页。

---

## 2. 🚀 Live demo / 在线演示

**EN:**  
> **Placeholder:** [Add your deployed URL here](https://example.com)  
> Deploy on Vercel (or similar), set `DATABASE_URL` and `OPENAI_API_KEY` in project settings, run migrations, then link the production URL in your portfolio and resume.

**中文：**  
> **占位：** [在此填写部署地址](https://example.com)  
> 建议部署在 Vercel 等平台，在环境变量中配置 `DATABASE_URL` 与 `OPENAI_API_KEY`，完成迁移后把生产环境链接写进作品集与简历。

---

## 3. 🎯 Product motivation / 产品动机

**EN:** Teams ship agents faster than they can **measure** them. SpecAgent Lab treats evaluation as a first-class product surface: benchmark tasks carry explicit rubrics; agents run under realistic tool constraints; traces persist; aggregates answer “Are we faster *and* still correct?” without ad-hoc spreadsheets. The lab is opinionated about **workflow comparison** (baseline vs draft-verifier) so PM and engineering conversations stay comparable, not one-off demos.

**中文：** 团队上线 Agent 的速度往往快于**度量**能力。SpecAgent Lab 把评估当作一等产品能力：任务带明确 rubric、在真实工具约束下跑 Agent、持久化 trace、用聚合指标回答「更快是否仍正确」，避免临时表格。产品设计上强调**工作流对比**（baseline vs draft-verifier），让 PM 与工程讨论始终基于可比运行，而非单次演示。

---

## 4. 👥 Target users / 目标用户

| **EN** | **中文** |
|--------|----------|
| **AI / technical PMs** — Frame metrics, compare modes, narrate tradeoffs for stakeholders and interviews. | **AI / 技术向 PM** — 定义指标、对比模式、向业务方与面试官讲清取舍。 |
| **Full-stack / applied ML engineers** — Wire agents, extend rubrics, inspect run JSON and traces. | **全栈 / 应用 ML 工程师** — 接入 Agent、扩展 rubric、查看运行与工具 JSON。 |
| **Interviewers & reviewers** — Clone, run locally, validate product metrics *and* implementation depth. | **面试官 / 代码审阅者** — 克隆仓库本地运行，验证产品指标理解与实现深度。 |

---

## 5. ✨ Key features / 核心功能

| **EN** | **中文** |
|--------|----------|
| **Benchmark pack** — Curated multi-turn-style tasks with rubrics; run via `/benchmark`. | **Benchmark 任务包** — 多轮风格任务与评估 rubric；在 `/benchmark` 发起运行。 |
| **Dual workflow** — Baseline (single agent) vs Draft + Verifier (orchestrated; see §8). | **双工作流** — Baseline（单智能体）vs Draft + Verifier（编排式；见 §8）。 |
| **Evaluation module** — Default heuristic scoring; optional LLM-as-judge with `OPENAI_API_KEY`. | **评估模块** — 默认启发式打分；配置 `OPENAI_API_KEY` 可选用 LLM 裁判。 |
| **Persistence** — Prisma: `AgentConfig`, `BenchmarkTask`, `Run`, `ToolCall`; links to `/runs/[id]`. | **持久化** — Prisma 模型；benchmark 结果可进入 **`/runs/[id]`** 详情。 |
| **Dashboard** — `/dashboard` aggregates Postgres runs; mock fallback when DB is empty. | **仪表盘** — `/dashboard` 聚合数据库运行；无数据时用确定性 mock 保证展示。 |
| **Playground** — `/playground` for interactive exploration alongside benchmarks. | **Playground** — `/playground` 用于与 benchmark 并行的交互探索。 |

---

## 6. 🧭 Architecture (text diagram) / 架构（文本示意图）

**EN:**

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

**中文：**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js App Router                             │
├──────────────┬────────────────────┬──────────────────┬──────────────────┤
│   /          │   /playground      │   /benchmark     │   /dashboard     │
│   总览       │   Agent 交互界面    │   选题 + 模式对比  │   聚合 + Recharts │
└──────┬───────┴─────────┬──────────┴────────┬─────────┴────────┬─────────┘
       │                 │         POST /api/benchmark/run       │
       │                 │                   ▼                  │
       │                 │         ┌─────────────────┐          │
       │                 │         │ Benchmark 编排   │          │
       │                 │         └────────┬────────┘          │
       │                 │     ┌────────────┼────────────┐     │
       │                 │     ▼            ▼            ▼     │
       │                 │ baseline   draft-verifier   评估模块│
       │                 │ (AI SDK)   (草稿+验证)      (启发式/裁判)│
       │                 │                 └───────────┬────────┘
       │                 │                           ▼          │
       │                 │                 ┌─────────────────┐  │
       │                 │                 │ Prisma → Postgres│
       │                 │                 │ Run, ToolCall    │
       │                 │                 └─────────────────┘
       └──────────────────┴──► /runs/[id] — 时间线 + 产品解读
```

**EN (one-liner):** UI → API → agents + evaluator → Prisma → dashboards and run detail.

**中文（一句话）：** 界面 → API → Agent 与评估器 → Prisma → 仪表盘与运行详情。

---

## 7. 📊 Metrics framework / 指标体系

| **EN — Metric** | **EN — Product question** | **中文 — 指标** | **中文 — 对应产品问题** |
|-----------------|---------------------------|----------------|-------------------------|
| Task success score | Did output satisfy the rubric? | 任务成功分 | 输出是否满足 rubric？ |
| Latency | Fast enough for the use case? | 延迟 | 体验是否足够快？ |
| Estimated cost | Affordable at target volume? | 估算成本 | 在目标量级下是否可承受？ |
| Tool error rate | Are tools helping or hurting? | 工具错误率 | 工具链在帮忙还是拖后腿？ |
| Draft acceptance rate | How often does verifier accept the draft? | 草稿接受率 | 验证器多大程度上「一次过」草稿？ |
| Subscores (when present) | Where to invest—prompting, tools, or verification? | 分项分（若有） | 应优先投在提示、工具还是验证？ |

---

## 8. 🔀 Baseline vs Draft–Verifier workflow / 两种工作流对比

**EN — Baseline:** One agent loop: plan, optional tool calls, final answer. Easiest to reason about; latency and cost follow a single path.

**中文 — Baseline：** 单智能体闭环：规划、可选工具调用、最终回答；最易解释；延迟与成本沿单一路径统计。

**EN — Draft + Verifier:** A **draft** model proposes an answer (and plan); a **verifier** model reviews and may accept, revise, or reject before the user-facing output is finalized. Metrics include verifier confidence and draft acceptance.

**中文 — Draft + Verifier：** **草稿**模型产出答案（及计划）；**验证**模型审核后，可接受、修订或拒绝，再定稿用户可见输出；指标含验证器置信度与草稿接受情况。

**EN — Critical clarification:** This pattern is **inspired by the *idea* of speculative execution** (propose cheaply, verify selectively) but it is **not token-level speculative decoding**. There is no parallel draft-token stream inside the inference engine; it is **application-level orchestration** for benchmarking and product experiments.

**中文 — 重要澄清：** 该模式**借鉴「推测式执行」的思路**（先低成本提案、再选择性验证），但**不是 token 级的 speculative decoding（推测解码）**。推理引擎内并不存在与主模型并行的 draft token 流；这是面向 benchmark 与产品实验的**应用层编排**，与底层推测解码是不同层次的概念。

---

## 9. 🧰 Tech stack / 技术栈

| **EN** | **中文** |
|--------|----------|
| Next.js (App Router), React 19, TypeScript | Next.js（App Router）、React 19、TypeScript |
| Tailwind CSS, shadcn/ui, Recharts | Tailwind、shadcn/ui、Recharts |
| Vercel AI SDK, `@ai-sdk/openai` | Vercel AI SDK、OpenAI 接入 |
| Prisma 6, PostgreSQL | Prisma 6、PostgreSQL |
| Zod (API validation) | Zod（API 校验） |

---

## 10. 🛠️ Local setup / 本地运行

**EN:** Requires Node 20+, **pnpm** (see `packageManager` in `package.json`), and PostgreSQL for full persistence.

**中文：** 需要 Node 20+、**pnpm**（见 `package.json` 的 `packageManager`），完整持久化需要 PostgreSQL。

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

**EN:** If installs fail with npm-style peer conflicts, prefer **pnpm** or use `npm install --legacy-peer-deps` only if necessary.

**中文：** 若安装出现 npm 式 peer 冲突，**优先使用 pnpm**；仅在必要时再考虑 `npm install --legacy-peer-deps`。

**Build note / 构建说明:** `pnpm install` runs **`postinstall` → `prisma generate`**. `pnpm build` runs **`prisma generate && next build`** so the Prisma Client is always present on Vercel and in CI.

---

## 10.1 Vercel deployment / Vercel 部署

**EN:**

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

**中文：**

1. 将仓库推送到 GitHub，在 [Vercel](https://vercel.com) **导入**项目，框架选 **Next.js**。  
2. 在 **环境变量** 中为 **Production**（及需要的 Preview）配置：  
   - `DATABASE_URL`：Postgres 连接串（如 Vercel Postgres、Neon）。  
   - `OPENAI_API_KEY`：**Benchmark / Playground** 调用 OpenAI 所必需。  
   - `NEXT_PUBLIC_APP_URL`：建议填写生产地址（如 `https://xxx.vercel.app`），用于 `metadataBase` 与绝对链接；未设置时会尽量使用 `VERCEL_URL`。  
3. **库表：**在本地或 CI 对**同一** `DATABASE_URL` 执行 `pnpm run db:push` 或 `pnpm run db:migrate`，可选 `pnpm run db:seed`。  
4. **构建：**Vercel 执行 `pnpm install`（含 `postinstall` → `prisma generate`）再执行 `pnpm build`（内含再次 `prisma generate`），一般无需改默认 Build Command。  
5. **未配置 `DATABASE_URL`：**应用仍可构建与访问；`/dashboard` 为**演示/示例**数据；`/benchmark` 与 Playground API 会返回 **503** 及 JSON `code`，直到数据库与 OpenAI 配置完成。

---

## 11. 🔐 Environment variables / 环境变量

| **Variable / 变量** | **EN** | **中文** |
|---------------------|--------|----------|
| `DATABASE_URL` | Required for real runs, live dashboard data, and `/runs/[id]`. | 真实运行、仪表盘 live 数据、`/runs/[id]` 所必需。 |
| `OPENAI_API_KEY` | Required for **benchmark** and **playground** agent runs; optional LLM-as-judge when enabled. | **Benchmark / Playground** 跑 Agent 所必需；开启时亦用于可选 LLM 裁判。 |
| `NEXT_PUBLIC_APP_URL` | Recommended in production for metadata and absolute URLs; falls back to `VERCEL_URL`. | 生产环境建议设置；未设置时尝试使用 `VERCEL_URL`。 |

Copy from `.env.example`. Never commit secrets. / 从 `.env.example` 复制，勿将密钥提交入库。

---

## 12. 🧪 How to run benchmark / 如何运行 Benchmark

**EN:**

1. Migrate DB (and optionally seed).  
2. Open **`/benchmark`**.  
3. Select tasks and modes (**Baseline**, **Draft + Verifier**, or both).  
4. Optionally enable **LLM-as-judge** (extra API calls; needs `OPENAI_API_KEY`).  
5. Click **Run Benchmark** — persists `Run` rows and `ToolCall` traces.  
6. Open a row → **`/runs/[id]`**; review aggregates on **`/dashboard`**.

**API:** `POST /api/benchmark/run` with body `{ "taskIds": ["..."], "modes": ["baseline","draft_verifier"], "useLlmJudge": false }`.

**中文：**

1. 完成数据库迁移（可选执行 seed）。  
2. 打开 **`/benchmark`**。  
3. 选择任务与模式（**Baseline**、**Draft + Verifier** 或两者）。  
4. 可选开启 **LLM-as-judge**（额外调用；需 `OPENAI_API_KEY`）。  
5. 点击 **Run Benchmark** — 写入 `Run` 与 `ToolCall`。  
6. 在结果表中打开单次运行 → **`/runs/[id]`**；在 **`/dashboard`** 看聚合。

**API：** `POST /api/benchmark/run`，JSON 体示例：`{ "taskIds": ["..."], "modes": ["baseline","draft_verifier"], "useLlmJudge": false }`。

---

## 13. 🧾 Example experiment result / 示例实验结果

**EN (illustrative — your numbers will vary):**

| Mode | Runs | Avg latency | Avg cost (USD) | Avg task success |
|------|------|-------------|----------------|------------------|
| Baseline | 3 | ~9.2 s | ~0.034 | ~82% |
| Draft + Verifier | 3 | ~7.5 s | ~0.028 | ~79% |

**Takeaway:** Draft-verifier may improve wall-clock and cost while verifier guardrails bound risk; the UI makes the tradeoff explicit.

**中文（示例数据，实际以你的运行结果为准）：**

| 模式 | 运行次数 | 平均延迟 | 平均成本（USD） | 平均任务成功分 |
|------|----------|----------|-----------------|----------------|
| Baseline | 3 | ~9.2 s | ~0.034 | ~82% |
| Draft + Verifier | 3 | ~7.5 s | ~0.028 | ~79% |

**解读：** Draft-verifier 可能降低墙钟时间与成本，验证环节约束风险；界面把「速度—质量—成本」的取舍摊开讨论。

---

## 14. 🖼️ Screenshots placeholders / 截图占位

**EN:** Add images under `docs/screenshots/` (or your path) and embed below for your portfolio README.

**中文：** 将截图放入 `docs/screenshots/`（或自定义目录），并在下方嵌入 Markdown 图片链接。

| **EN — Placeholder** | **中文 — 建议截图内容** |
|----------------------|-------------------------|
| `docs/screenshots/overview.png` | Home `/` — value prop & routes |
| `docs/screenshots/benchmark.png` | `/benchmark` — task & mode selection |
| `docs/screenshots/dashboard.png` | `/dashboard` — charts & comparison table |
| `docs/screenshots/run-detail.png` | `/runs/[id]` — timeline & product interpretation |

```markdown
<!-- When files exist / 文件就绪后取消注释：
![Dashboard EN/仪表盘](docs/screenshots/dashboard.png)
-->
```

---

## 15. 🧭 Future work / 后续规划

| **EN** | **中文** |
|--------|----------|
| Auth & multi-tenant workspaces | 鉴权与多租户工作区 |
| Scheduled regression benchmarks + diff alerts | 定时回归 benchmark 与差异告警 |
| Human-in-the-loop labels merged with auto rubrics | 人工标注与自动 rubric 融合 |
| Export CSV / Parquet | 导出 CSV / Parquet |
| No-code rubric editor for PMs | 面向 PM 的无代码 rubric 编辑器 |

---

## 16. 📝 Resume bullet examples / 简历要点示例

**EN — copy/adapt with your deployment numbers:**

- Defined a **multi-metric evaluation framework** (success, latency, cost, tool errors, draft acceptance) for multi-turn agent benchmarks; shipped aggregated dashboards in Next.js + Recharts.  
- Implemented **baseline vs draft-verifier** comparison; documented that the pattern is **speculative-style orchestration**, not **token-level speculative decoding**.  
- Delivered **persisted traces** (Prisma + PostgreSQL) with `/runs/[id]` timeline and auto-generated **product interpretation** for stakeholder-ready narratives.  
- Built a **pluggable evaluator** (heuristic default + optional LLM-as-judge) balancing demo stability and deeper scoring when API keys are available.

**中文 — 可按你的真实数据改写后用于中文简历：**

- 设计**多指标评估框架**（成功分、延迟、成本、工具错误、草稿接受率等），基于 Next.js + Recharts 交付聚合仪表盘。  
- 实现 **Baseline 与 Draft-verifier** 对比，并在文档中明确：属于**推测式风格的编排**，**非 token 级推测解码**。  
- 使用 **Prisma + PostgreSQL** 持久化运行与工具 trace，提供 `/runs/[id]` 时间线与**产品解读**文案，便于对外叙事。  
- 搭建**可插拔评估器**（默认启发式 + 可选 LLM 裁判），在演示稳定性与有关键时的深度打分之间取得平衡。

---

## 📜 License / 许可

**EN:** Private / portfolio unless you add an explicit open-source license.

**中文：** 默认为私有/作品集用途；若开源请自行补充许可证文件。

---

<p align="center">
  <b>SpecAgent Lab</b> — ship agents with measurable quality, latency, and cost.<br />
  <b>SpecAgent 实验室</b> — 用可度量的质量、延迟与成本交付 Agent。
</p>
