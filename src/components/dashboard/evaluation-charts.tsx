"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ChartRow = {
  task: string;
  Baseline: number;
  "Draft+Verifier": number;
};

type EvaluationChartsProps = {
  latencyChartRows: ChartRow[];
  qualityChartRows: ChartRow[];
};

export function EvaluationCharts({ latencyChartRows, qualityChartRows }: EvaluationChartsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Latency by Task</CardTitle>
          <CardDescription>Lower is better</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ChartViewport>
            {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={latencyChartRows}
                margin={{ left: -12, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="task"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={formatSeconds}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMs(Number(value))} />
                <Bar dataKey="Baseline" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Draft+Verifier" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartViewport>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rubric Score</CardTitle>
          <CardDescription>Task-level quality score</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ChartViewport>
            {({ width, height }) => (
              <LineChart
                width={width}
                height={height}
                data={qualityChartRows}
                margin={{ left: -12, right: 12, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="task"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  domain={[50, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} />
                <Line type="monotone" dataKey="Baseline" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
                <Line
                  type="monotone"
                  dataKey="Draft+Verifier"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            )}
          </ChartViewport>
        </CardContent>
      </Card>
    </>
  );
}

function ChartViewport({
  children,
}: {
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      if (width <= 0 || height <= 0) {
        return;
      }

      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full min-w-0">
      {size ? children(size) : <Skeleton className="h-full w-full" />}
    </div>
  );
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function formatSeconds(value: number) {
  return `${Math.round(value / 1000)}s`;
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
};
