import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "info" | "warning" | "danger";
  footer?: ReactNode;
  trendLabel?: string;
}

const toneStyles = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  info: "bg-blue-100 text-blue-700 ring-blue-200",
  warning: "bg-amber-100 text-amber-700 ring-amber-200",
  danger: "bg-red-100 text-red-700 ring-red-200",
};

export function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  footer,
  trendLabel,
}: KpiCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgba(15,23,42,0.55)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{title}</p>
          <p className="mt-1 text-3xl font-semibold leading-none text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{helper}</p>

          {trendLabel ? (
            <p className="mt-2 text-[11px] text-slate-500">{trendLabel}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneStyles[tone]} transition-transform group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
    </article>
  );
}
