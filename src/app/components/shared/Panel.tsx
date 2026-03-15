import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, action, children, className = "" }: PanelProps) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_26px_-18px_rgba(15,23,42,0.55)] ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
