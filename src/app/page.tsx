import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  FlaskConical,
  Gauge,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { ApiConfigCard } from "@/components/home/api-config-card";
import { StatGrid } from "@/components/app/stat-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  benchmarkTasks,
  buildEvaluationSnapshot,
  DEFAULT_LAB_CONFIG,
} from "@/lib/mock-evaluation";
import { getConfiguredAiProvider } from "@/lib/env";

const snapshot = buildEvaluationSnapshot(DEFAULT_LAB_CONFIG);
const defaultProvider = getConfiguredAiProvider();

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="总览"
        title="在一个界面里评估智能体的质量、速度和成本。"
        description="从配置供应商与智能体开始，运行确定性的基准任务，并集中查看每次运行的质量、时延和成本指标。"
        actions={
          <>
            <Button asChild>
              <Link href="/playground">
                打开调试台
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">查看仪表盘</Link>
            </Button>
          </>
        }
      />

      <StatGrid
        items={[
          {
            label: "基准任务",
            value: String(benchmarkTasks.length),
            hint: "内置多轮任务场景",
            icon: FlaskConical,
          },
          {
            label: "草稿链路成功率",
            value: `${Math.round(snapshot.draftVerifierMetrics.successRate * 100)}%`,
            hint: "当前示例基线",
            icon: ShieldCheck,
          },
          {
            label: "P95 latency",
            value: `${(snapshot.draftVerifierMetrics.p95LatencyMs / 1000).toFixed(1)}s`,
            hint: "确定性任务画像",
            icon: Gauge,
          },
          {
            label: "智能体配置",
            value: "2",
            hint: "Baseline 与草稿校验双模式",
            icon: Bot,
          },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>当前页面入口</CardTitle>
            <CardDescription>核心路由已经串起来了，便于后续把真实能力逐步接入。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { href: "/", label: "总览", detail: "项目摘要与快速入口" },
              { href: "/playground", label: "调试台", detail: "配置智能体、提示词与工具集" },
              { href: "/benchmark", label: "基准测试", detail: "查看内置任务并发起评测" },
              { href: "/dashboard", label: "仪表盘", detail: "聚合运行结果、图表与模式对比" },
              { href: "/dashboard", label: "运行详情", detail: "最近运行可跳转到 /runs/[id]" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition hover:border-primary/40 hover:bg-accent/50"
              >
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.detail}</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前技术栈</CardTitle>
            <CardDescription>已经按这个 MVP 方向完成基础初始化。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[
              "Next.js App Router",
              "TypeScript",
              "Tailwind CSS",
              "shadcn/ui",
              "Recharts",
              "Prisma",
              "Vercel AI SDK",
              "OpenAI 兼容供应商",
            ].map((item) => (
              <Badge key={item} variant="secondary" className="rounded-md px-2.5 py-1 text-xs">
                {item}
              </Badge>
            ))}
          </CardContent>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              当前应用默认使用可复现的示例数据做演示，同时已经准备好了 Prisma schema 和 seed 脚本，后续可以接入真实 Postgres 运行历史。
            </div>
          </CardContent>
        </Card>
      </section>

      <ApiConfigCard defaultProvider={defaultProvider} />

      <Card>
        <CardHeader>
          <CardTitle>这个脚手架已经具备什么</CardTitle>
          <CardDescription>可以从这里开始，小步迭代出真正可用的评测平台。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "调试台链路",
              detail: "先配置智能体参数，运行单次任务，再检查提示词和工具调用是否符合预期。",
              icon: Bot,
            },
            {
              title: "基准测试队列",
              detail: "查看内置任务，并对 Baseline 与草稿校验两种工作流做对比运行。",
              icon: FlaskConical,
            },
            {
              title: "指标面板",
              detail: "持续跟踪时延、任务成功率、Token 成本、工具报错率与草稿接受率。",
              icon: BarChart3,
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-background p-4">
              <item.icon className="size-4 text-primary" aria-hidden="true" />
              <div className="mt-3 font-medium">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
