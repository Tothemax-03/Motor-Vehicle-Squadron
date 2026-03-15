import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardList, TriangleAlert } from "lucide-react";
import type { AuditEntry } from "../../data/fleetData";
import { getRuntimeAuditTrail, syncRuntimeFromServer } from "../../data/runtimeStore";
import { PageHeader } from "../shared/PageHeader";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";

type SeverityFilter = "All" | AuditEntry["severity"];
type ModuleFilter = "All" | AuditEntry["module"];

const PAGE_SIZE = 6;

function severityTone(value: AuditEntry["severity"]): "info" | "warning" | "danger" {
  if (value === "Critical") return "danger";
  if (value === "Warning") return "warning";
  return "info";
}

export function ActivityLogs() {
  const [auditData, setAuditData] = useState<AuditEntry[]>(() => getRuntimeAuditTrail());
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("All");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setAuditData(getRuntimeAuditTrail());
        }
      } catch {
        // Fallback to existing cache.
      }
    };
    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return auditData.filter((entry) => {
      const matchesSeverity = severityFilter === "All" || entry.severity === severityFilter;
      const matchesModule = moduleFilter === "All" || entry.module === moduleFilter;
      const matchesSearch =
        !term ||
        `${entry.actor} ${entry.action} ${entry.module} ${entry.details} ${entry.timestamp}`
          .toLowerCase()
          .includes(term);

      return matchesSeverity && matchesModule && matchesSearch;
    });
  }, [query, severityFilter, moduleFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, severityFilter, moduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const criticalCount = auditData.filter((entry) => entry.severity === "Critical").length;
  const moduleOptions = Array.from(new Set(auditData.map((entry) => entry.module))) as ModuleFilter[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs / Audit Trail"
        description="Centralized event logging for traceability, oversight, and compliance review."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Total Logged Events</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{auditData.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Critical Events</p>
          <p className="mt-1 text-3xl font-semibold text-red-600">{criticalCount}</p>
        </div>
      </div>

      <Panel title="Audit Events" subtitle="Track who changed what, when, and where across all system modules.">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="audit-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by actor, module, timestamp, action, or details"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value as ModuleFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="All">All Modules</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="All">All Severity</option>
              <option value="Info">Info</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit entries found"
            description="Update your filters or search keyword to view relevant audit trail records."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Actor</th>
                    <th className="px-3 py-2.5">Module</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Severity</th>
                    <th className="px-3 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-3 text-slate-600">{entry.timestamp}</td>
                      <td className="px-3 py-3 text-slate-800">{entry.actor}</td>
                      <td className="px-3 py-3"><StatusBadge label={entry.module} tone="neutral" /></td>
                      <td className="px-3 py-3 text-slate-700">{entry.action}</td>
                      <td className="px-3 py-3"><StatusBadge label={entry.severity} tone={severityTone(entry.severity)} pulse={entry.severity === "Critical"} /></td>
                      <td className="px-3 py-3 text-slate-600">{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredLogs.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="audit entry"
            />
          </>
        )}

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          {criticalCount > 0 ? <TriangleAlert className="h-3.5 w-3.5 text-red-500" /> : <ClipboardList className="h-3.5 w-3.5" />}
          {criticalCount > 0
            ? `${criticalCount} critical event(s) require immediate review.`
            : "No critical incidents in the current audit window."}
        </div>
      </Panel>
    </div>
  );
}
