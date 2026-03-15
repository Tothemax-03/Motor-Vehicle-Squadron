import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  rightSlot?: ReactNode;
}

export function PageHeader({ title, description, rightSlot }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {rightSlot ? <div className="flex flex-wrap items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
