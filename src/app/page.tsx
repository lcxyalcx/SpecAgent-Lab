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

const snapshot = buildEvaluationSnapshot(DEFAULT_LAB_CONFIG);

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title="Evaluate agent quality, speed, and cost in one place."
        description="A clean starting point for configuring agents, running deterministic benchmarks, and reviewing run-level metrics."
        actions={
          <>
            <Button asChild>
              <Link href="/playground">
                Open playground
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">View dashboard</Link>
            </Button>
          </>
        }
      />

      <StatGrid
        items={[
          {
            label: "Benchmark tasks",
            value: String(benchmarkTasks.length),
            hint: "Seeded multi-turn scenarios",
            icon: FlaskConical,
          },
          {
            label: "Draft workflow success",
            value: `${Math.round(snapshot.draftVerifierMetrics.successRate * 100)}%`,
            hint: "Current mock baseline",
            icon: ShieldCheck,
          },
          {
            label: "P95 latency",
            value: `${(snapshot.draftVerifierMetrics.p95LatencyMs / 1000).toFixed(1)}s`,
            hint: "Deterministic run profile",
            icon: Gauge,
          },
          {
            label: "Agent configs",
            value: "2",
            hint: "Baseline and draft+verifier",
            icon: Bot,
          },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Included routes</CardTitle>
            <CardDescription>Every page is wired up so we can layer real features in incrementally.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { href: "/", label: "Overview", detail: "Project summary and launch points" },
              { href: "/playground", label: "Playground", detail: "Agent setup and prompt scaffolding" },
              { href: "/benchmark", label: "Benchmark", detail: "Seeded task inventory and benchmark queue" },
              { href: "/dashboard", label: "Dashboard", detail: "Aggregated runs, Recharts, and mode comparison" },
              { href: "/dashboard", label: "Run detail", detail: "Recent runs link to /runs/[id]" },
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
            <CardTitle>Current stack</CardTitle>
            <CardDescription>Initialized for the MVP you described.</CardDescription>
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
              "OpenAI-compatible provider",
            ].map((item) => (
              <Badge key={item} variant="secondary" className="rounded-md px-2.5 py-1 text-xs">
                {item}
              </Badge>
            ))}
          </CardContent>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              The app currently uses deterministic mock data for demos, with Prisma schema and seed scripts ready for a real Postgres-backed run history.
            </div>
          </CardContent>
        </Card>
      </section>

      <ApiConfigCard />

      <Card>
        <CardHeader>
          <CardTitle>What this scaffold gives us</CardTitle>
          <CardDescription>A practical base for building the real evaluator in small, reviewable steps.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "Playground flow",
              detail: "Configure agent settings and inspect prompt/tool contracts before a benchmark run.",
              icon: Bot,
            },
            {
              title: "Benchmark queue",
              detail: "Review seeded tasks and prepare run orchestration for baseline versus speculative workflows.",
              icon: FlaskConical,
            },
            {
              title: "Metrics surface",
              detail: "Track latency, task success, token cost, tool errors, and acceptance rate over time.",
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
