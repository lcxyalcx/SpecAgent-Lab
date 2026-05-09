import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatGridProps = {
  items: Array<{
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
  }>;
};

export function StatGrid({ items }: StatGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm" className="bg-card/85 shadow-sm">
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </span>
              <span className="flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-normal">{item.value}</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
