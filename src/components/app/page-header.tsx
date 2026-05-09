import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/85 px-6 py-7 shadow-sm">
      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </div>
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="text-base leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}
