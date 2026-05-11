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
        eyebrow="首页"
        title="配置智能体、试跑任务，并集中查看结果。"
        description="先保存模型供应商与密钥，再在试运行里检查回答效果，在批量测试里比较不同模式，最后回到结果总览查看整体表现。"
        actions={
          <>
            <Button asChild>
              <Link href="/playground">
                开始试运行
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">查看结果总览</Link>
            </Button>
          </>
        }
      />

      <StatGrid
        items={[
          {
            label: "内置任务",
            value: String(benchmarkTasks.length),
            hint: "覆盖常见多轮场景",
            icon: FlaskConical,
          },
          {
            label: "运行模式",
            value: "2",
            hint: "直接运行与草稿校验",
            icon: ShieldCheck,
          },
          {
            label: "参考响应时间",
            value: `${(snapshot.draftVerifierMetrics.p95LatencyMs / 1000).toFixed(1)}s`,
            hint: "基于示例数据",
            icon: Gauge,
          },
          {
            label: "内置工具",
            value: "4",
            hint: "搜索、计算、产品与日历",
            icon: Bot,
          },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>从哪里开始</CardTitle>
            <CardDescription>第一次使用时，按这个顺序最容易上手。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { href: "/", label: "首页", detail: "查看整体入口，并配置模型供应商与密钥" },
              { href: "/playground", label: "试运行", detail: "先用单个问题检查回答、耗时和工具调用" },
              { href: "/benchmark", label: "批量测试", detail: "一次运行多组任务，比较不同模式的表现" },
              { href: "/dashboard", label: "结果总览", detail: "从图表和列表里回看整体趋势与历史结果" },
              { href: "/runs/demo-run", label: "运行详情", detail: "查看单次结果、工具轨迹和错误原因" },
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
            <CardTitle>当前支持的能力</CardTitle>
            <CardDescription>不需要了解底层实现，也可以直接开始使用。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[
              "模型供应商配置",
              "单次试运行",
              "批量任务比较",
              "运行记录回看",
              "结果图表总览",
              "本地 API 凭证",
            ].map((item) => (
              <Badge key={item} variant="secondary" className="rounded-md px-2.5 py-1 text-xs">
                {item}
              </Badge>
            ))}
          </CardContent>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              如果你还没有配置数据库，运行结果仍然会先显示在当前页面；配置 <span className="font-mono">DATABASE_URL</span> 后，结果就会自动保存到历史记录中。
            </div>
          </CardContent>
        </Card>
      </section>

      <ApiConfigCard defaultProvider={defaultProvider} />

      <Card>
        <CardHeader>
          <CardTitle>常见使用场景</CardTitle>
          <CardDescription>如果你是第一次打开，建议先从这三个动作开始。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "先试跑一个问题",
              detail: "在试运行里填写系统设定、用户问题和模型，先确认回答是否靠谱、工具是否用对。",
              icon: Bot,
            },
            {
              title: "批量比较两种模式",
              detail: "在批量测试里选择几组任务，对比直接运行和草稿校验的耗时、成功率与错误情况。",
              icon: FlaskConical,
            },
            {
              title: "回看每次运行细节",
              detail: "在结果总览或运行详情中查看输出、工具调用和失败原因，方便继续优化。",
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
