import type { LucideIcon } from "lucide-react";
import { DatabaseZap } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = DatabaseZap,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center ${className}`}
    >
      <Icon className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
