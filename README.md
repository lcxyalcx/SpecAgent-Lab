# 🧪 SpecAgent 实验室

用于多轮智能体评测与对比的实验台，聚焦不同工作流下的延迟、成本、质量与工具稳定性，并提供可追溯的运行记录与仪表盘。

---

## 2. 🚀 在线演示

> [SpecAgent Lab](https://spec-agent-lab.vercel.app)  
> 建议部署在 Vercel（或同类平台），在环境变量中配置 `DATABASE_URL` 与模型提供方密钥（`SILICONFLOW_API_KEY` 或 `OPENAI_API_KEY`），完成数据库迁移后更新线上链接。

---

## 3. 🎯 产品动机

团队往往能快速搭建智能体，但缺少稳定、可复用的评测方式。SpecAgent 实验室把评估当作核心能力：任务带明确 rubric，运行过程可追溯，结果可对比，便于在不同工作流之间做公平的效果与成本权衡。

---

## 4. 👥 目标用户

| **人群** |
|--------|
| **AI / 技术型 PM** — 定义指标、对比模式、沉淀可解释的取舍结论。 |
| **全栈 / 应用工程师** — 接入智能体、扩展 rubric、查看运行与工具日志。 |
| **面试官 / 评审者** — 本地运行与复盘，验证指标理解与实现深度。 |

---

## 5. ✨ 核心功能

| **功能** |
|--------|
| **Benchmark 任务包** — 多轮任务 + rubric；在 `/benchmark` 发起运行。 |
| **双工作流** — Baseline（单智能体） vs Draft + Verifier（编排式，见 §8）。 |
| **评估模块** — 默认启发式打分；可选 LLM 评审（需 `SILICONFLOW_API_KEY` 或 `OPENAI_API_KEY`）。 |
| **持久化** — Prisma 记录 `AgentConfig` / `BenchmarkTask` / `Run` / `ToolCall`，详情见 `/runs/[id]`。 |
| **仪表盘** — `/dashboard` 聚合数据库结果；无数据时提供 mock 展示。 |
| **Playground** — `/playground` 用于交互试跑。 |
| **首页 API 切换** — 用户可在浏览器内保存自己的 OpenAI 或 SiliconFlow Key，减少对服务端密钥的依赖。 |

---

## 6. 🧭 架构

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


---

## 7. 📊 指标体系

| **指标** | **对应问题** |
|-----------------|---------------------------|
| 任务成功分 | 输出是否满足 rubric？ |
| 延迟 | 体验是否足够快？ |
| 估算成本 | 在目标量级下是否可承受？ |
| 工具错误率 | 工具链在帮忙还是拖后腿？ |
| 草稿接受率 | 验证器多大程度上“一次过”？ |
| 分项分（若有） | 应优先优化提示、工具还是验证？ |

---

## 8. 🔀 Baseline vs Draft–Verifier 工作流

**Baseline：** 单智能体闭环：规划 → 可选工具调用 → 输出结果；延迟与成本沿单一路径统计。

**Draft + Verifier：** 草稿模型先输出，验证模型审核后再定稿；指标包含验证器置信度与草稿接受率。

**重要澄清：** 该模式借鉴“先提案、再验证”的思路，但并非推理引擎内部的 token 级推测解码，而是应用层编排。

---

## 9. 🧰 技术栈

| **组件** |
|--------|
| Next.js（App Router）, React 19, TypeScript |
| Tailwind CSS, shadcn/ui, Recharts |
| Vercel AI SDK, `@ai-sdk/openai` |
| Prisma 6, PostgreSQL |
| Zod（API 校验） |

---

## 10. 🛠️ 本地运行

需要 Node 20+、**pnpm**（见 `packageManager`），完整持久化需要 PostgreSQL。

```bash
git clone <your-fork-url>
cd SpecAgent-Lab
pnpm install
cp .env.example .env
# Edit .env — set DATABASE_URL (and provider key)
pnpm run prisma:generate
pnpm run db:migrate   # or: pnpm run db:push
pnpm run db:seed
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。

如遇 npm 风格的 peer 依赖冲突，优先使用 **pnpm**；仅在必要时再考虑 `npm install --legacy-peer-deps`。

**构建说明：** `pnpm install` 会执行 **`postinstall` → `prisma generate`**；`pnpm build` 执行 **`prisma generate && next build`**，保证 Prisma Client 在 Vercel 与 CI 中可用。

---

## 11.🛜 Vercel 部署

1. 将仓库推送到 GitHub，在 [Vercel](https://vercel.com) **导入**项目，框架选择 **Next.js**。  
2. 在 **环境变量** 中为 **Production**（以及需要的 Preview）配置：  
   - `DATABASE_URL` — Postgres 连接串（Vercel Postgres / Neon 等）。  
   - `SILICONFLOW_API_KEY` 或 `OPENAI_API_KEY` — `/benchmark` 与 `/playground` 调用所需。  
   - `NEXT_PUBLIC_APP_URL` — 推荐配置生产地址，用于 `metadataBase` 与规范链接；未设置时尝试使用 `VERCEL_URL`。  
3. **数据库结构：**在本地或 CI 对**同一** `DATABASE_URL` 执行迁移或推送：  
   `pnpm run db:push` 或 `pnpm run db:migrate`；可选 `pnpm run db:seed` 填充示例数据。  
4. **部署：**Vercel 运行 `pnpm install`（含 `prisma generate`）再运行 `pnpm build`，一般无需改 Build Command。  
5. **未配置 `DATABASE_URL`：**应用仍可构建与访问；`/dashboard` 显示示例数据；`/benchmark` 与 `/playground` API 返回 **503**，直到数据库与模型提供方密钥配置完成。

---

## 12. 🔐 环境变量

| **变量** | **说明** |
|---------------------|--------|
| `DATABASE_URL` | 真实运行、仪表盘数据与 `/runs/[id]` 所必需。 |
| `SILICONFLOW_API_KEY` | 可选；使用 SiliconFlow 模型时需要。 |
| `OPENAI_API_KEY` | 可选；使用 OpenAI 模型时需要。 |
| `NEXT_PUBLIC_APP_URL` | 生产环境建议设置；未设置时尝试使用 `VERCEL_URL`。 |

从 `.env.example` 复制，勿提交密钥。

---

## 13. 🧪 如何运行 Benchmark

1. 完成数据库迁移（可选执行 seed）。  
2. 打开 **`/benchmark`**。  
3. 选择任务与模式（**Baseline**、**Draft + Verifier** 或两者）。  
4. 可选开启 **LLM-as-judge**（额外调用；需模型提供方密钥）。  
5. 点击 **Run Benchmark** — 写入 `Run` 与 `ToolCall`。  
6. 进入结果详情 **`/runs/[id]`**；在 **`/dashboard`** 查看聚合。

**API：** `POST /api/benchmark/run`，JSON 体示例：`{ "taskIds": ["..."], "modes": ["baseline","draft_verifier"], "useLlmJudge": false }`。

---

## 14. 🧾 示例实验结果

**示例数据（实际以你的运行结果为准）：**

| 模式 | 运行次数 | 平均延迟 | 平均成本（USD） | 平均任务成功分 |
|------|----------|----------|-----------------|----------------|
| Baseline | 3 | ~9.2 s | ~0.034 | ~82% |
| Draft + Verifier | 3 | ~7.5 s | ~0.028 | ~79% |

**解读：** Draft-verifier 可能降低墙钟时间与成本，验证环节用于约束风险；界面把「速度—质量—成本」的取舍摊开讨论。

---

## 15. 🧭 后续规划

| **方向** |
|--------|
| 鉴权与多租户工作区 |
| 定时回归 benchmark 与差异告警 |
| 人工标注与自动 rubric 融合 |
| 导出 CSV / Parquet |
| 面向 PM 的无代码 rubric 编辑器 |

---


