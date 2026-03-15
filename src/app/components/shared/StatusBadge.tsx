interface StatusBadgeProps {
  label: string;
  tone?: "success" | "info" | "warning" | "danger" | "neutral";
  pulse?: boolean;
}

const toneClasses = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

export function StatusBadge({ label, tone = "neutral", pulse = false }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
