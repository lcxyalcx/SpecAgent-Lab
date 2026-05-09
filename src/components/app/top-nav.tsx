"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Beaker, Bot, FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/playground", label: "Playground" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/dashboard", label: "Dashboard" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 text-primary">
            <FlaskConical className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <Link href="/" className="block truncate text-sm font-semibold tracking-normal">
              SpecAgent Lab
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Agent evaluation scaffold</span>
              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">
                MVP
              </Badge>
            </div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Button
                key={item.href}
                asChild
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(active && "text-foreground shadow-sm")}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/runs/demo-run">
              <Beaker className="size-4" aria-hidden="true" />
              Latest run
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">
              <BarChart3 className="size-4" aria-hidden="true" />
              Open dashboard
            </Link>
          </Button>
        </div>
      </div>
      <div className="border-t border-border/70 px-4 py-2 md:hidden">
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto sm:px-2">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Button
                key={item.href}
                asChild
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
          <Button asChild variant={pathname.startsWith("/runs/") ? "secondary" : "ghost"} size="sm" className="shrink-0">
            <Link href="/runs/demo-run">
              <Bot className="size-4" aria-hidden="true" />
              Run
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
