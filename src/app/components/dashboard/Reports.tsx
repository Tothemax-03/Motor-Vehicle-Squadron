import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Printer,
  TrendingUp,
  Truck,
  Wrench,
  GaugeCircle,
  Calendar,
  Plus,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { monthlyMovementData } from "../../data/fleetData";
import type { Mission } from "../../data/fleetData";
import { downloadTextFile } from "../../data/exportUtils";
import {
  appendRuntimeAudit,
  getRuntimeMaintenance,
  getRuntimeMissions,
  getRuntimeVehicles,
  nowTimestamp,
  syncRuntimeFromServer,
} from "../../data/runtimeStore";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";
import { chartTooltipProps } from "../shared/chartTooltip";

const readinessTrendData = [
  { month: "Oct", rate: 86 },
  { month: "Nov", rate: 84 },
  { month: "Dec", rate: 78 },
  { month: "Jan", rate: 81 },
  { month: "Feb", rate: 79 },
  { month: "Mar", rate: 73 },
];

const maintenanceCostMonthly = [
  { month: "Oct", cost: 8500 },
  { month: "Nov", cost: 12000 },
  { month: "Dec", cost: 6200 },
  { month: "Jan", cost: 15800 },
  { month: "Feb", cost: 9400 },
  { month: "Mar", cost: 63200 },
];

const reportLibrary = [
  {
    id: "RPT-2026-031",
    title: "Monthly Vehicle Utilization Report",
    module: "Movement Monitoring",
    period: "February 2026",
    author: "MSgt. Lacson, B.",
    date: "2026-03-01",
    status: "Published",
  },
  {
    id: "RPT-2026-029",
    title: "Preventive Maintenance Completion Report",
    module: "Maintenance",
    period: "Q1 CY 2026",
    author: "SSgt. Reyes, J.",
    date: "2026-03-01",
    status: "Published",
  },
  {
    id: "RPT-2026-028",
    title: "Fleet Readiness Executive Summary",
    module: "Fleet Registry",
    period: "March 2026 - Week 1",
    author: "Lt. Gomez, R.",
    date: "2026-03-05",
    status: "Published",
  },
  {
    id: "RPT-2026-022",
    title: "Maintenance Cost Analysis",
    module: "Maintenance",
    period: "AY 2025-2026",
    author: "Cpt. Dela Cruz, M.",
    date: "2026-02-28",
    status: "Archived",
  },
  {
    id: "RPT-2026-019",
    title: "Incident and Safety Compliance Report",
    module: "Operations",
    period: "CY 2026",
    author: "Lt. Gomez, R.",
    date: "2026-02-20",
    status: "Archived",
  },
];

const PAGE_SIZE = 4;

export function Reports() {
  const [vehicleData, setVehicleData] = useState(() => getRuntimeVehicles());
  const [maintenanceData, setMaintenanceData] = useState(() => getRuntimeMaintenance());
  const [missionData, setMissionData] = useState<Mission[]>(() => getRuntimeMissions());
  const [reportData, setReportData] = useState(reportLibrary);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Published" | "Archived">("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setVehicleData(getRuntimeVehicles());
          setMaintenanceData(getRuntimeMaintenance());
          setMissionData(getRuntimeMissions());
        }
      } catch {
        // Use cached values when backend refresh fails.
      }
    };
    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const missionTrendData = useMemo(() => {
    if (missionData.length === 0) return monthlyMovementData;
    const months = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: date.toLocaleString("en-US", { month: "short" }) };
    });

    const aggregates = new Map<string, { missions: number; kmDriven: number }>();
    missionData.forEach((mission) => {
      const parsed = new Date(mission.departureTime.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) return;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      const current = aggregates.get(key) || { missions: 0, kmDriven: 0 };
      current.missions += 1;
      current.kmDriven += mission.milesDriven || 0;
      aggregates.set(key, current);
    });

    return months.map((month) => {
      const value = aggregates.get(month.key) || { missions: 0, kmDriven: 0 };
      return { month: month.month, missions: value.missions, kmDriven: value.kmDriven };
    });
  }, [missionData]);

  const totalMissions = missionData.length;
  const totalDistance = missionData.reduce((sum, mission) => sum + (mission.milesDriven || 0), 0);
  const averageReadiness = Math.round(
    readinessTrendData.reduce((sum, month) => sum + month.rate, 0) / readinessTrendData.length
  );
  const totalMaintenanceCost = maintenanceData.reduce((sum, record) => sum + (record.cost || 0), 0);

  const fleetComposition = [
    {
      name: "Truck",
      value: vehicleData.filter((vehicle) => vehicle.category === "truck").length,
      color: "#1f3e68",
    },
    {
      name: "Bus",
      value: vehicleData.filter((vehicle) => vehicle.category === "bus").length,
      color: "#2563eb",
    },
    {
      name: "Van",
      value: vehicleData.filter((vehicle) => vehicle.category === "van").length,
      color: "#22c55e",
    },
    {
      name: "MPV",
      value: vehicleData.filter((vehicle) => vehicle.category === "mpv").length,
      color: "#f59e0b",
    },
    {
      name: "Other",
      value: vehicleData.filter((vehicle) => vehicle.category === "other").length,
      color: "#ef4444",
    },
  ];

  const maintenanceByType = [
    { type: "PMCS", count: maintenanceData.filter((record) => record.type === "PMCS").length },
    { type: "Corrective", count: maintenanceData.filter((record) => record.type === "corrective").length },
    { type: "Periodic", count: maintenanceData.filter((record) => record.type === "periodic").length },
    { type: "Inspection", count: maintenanceData.filter((record) => record.type === "inspection").length },
  ];

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    return reportData.filter((report) => {
      const matchesStatus = statusFilter === "All" || report.status === statusFilter;
      const matchesSearch =
        !term ||
        `${report.id} ${report.title} ${report.module} ${report.period} ${report.author}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [query, reportData, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports and Analytics"
        description="Generate executive-ready analytics on fleet readiness, mission volume, maintenance costs, and operations."
        rightSlot={
          <>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-4 w-4" />
              Print Summary
            </button>
            <button
              type="button"
              onClick={() => {
                const analyticsPack = {
                  generatedAt: nowTimestamp(),
                  missionVolume: totalMissions,
                  distanceCoveredKm: totalDistance,
                  averageReadiness,
                  maintenanceCost: totalMaintenanceCost,
                  missionTrendData,
                  maintenanceByType,
                  fleetComposition,
                };
                downloadTextFile(
                  `analytics-pack-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(analyticsPack, null, 2),
                  "application/json;charset=utf-8"
                );

                appendRuntimeAudit({
                  id: `AUD-${Date.now()}`,
                  timestamp: nowTimestamp(),
                  actor: "SSgt. Reyes, J.",
                  action: "Exported analytics pack",
                  module: "Reports",
                  severity: "Info",
                  details: "Analytics export package downloaded from Reports module.",
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
            >
              <Download className="h-4 w-4" />
              Export Analytics Pack
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Mission Volume" value={totalMissions} helper="Total missions over reporting window" icon={TrendingUp} tone="info" />
        <KpiCard title="Distance Covered" value={`${(totalDistance / 1000).toFixed(1)}K km`} helper="Total fleet distance traveled" icon={Truck} tone="neutral" />
        <KpiCard title="Average Readiness" value={`${averageReadiness}%`} helper="Fleet readiness baseline (6 months)" icon={GaugeCircle} tone="success" />
        <KpiCard title="Maintenance Cost" value={`PHP ${(totalMaintenanceCost / 1000).toFixed(0)}K`} helper="Cumulative projected maintenance costs" icon={Wrench} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Readiness Trend" subtitle="Monthly operational readiness percentage">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readinessTrendData}>
                <defs>
                  <linearGradient id="readinessGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(value: number) => [`${value}%`, "Readiness"]}
                />
                <Area type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2.2} fill="url(#readinessGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Maintenance Cost Trend" subtitle="Monthly maintenance expenditures">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceCostMonthly} barSize={26}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(value: number) => [`PHP ${value.toLocaleString()}`, "Cost"]}
                />
                <Bar dataKey="cost" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Fleet Composition" subtitle="Distribution of fleet assets by vehicle category">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetComposition}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {fleetComposition.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipProps} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Mission Volume and Distance" subtitle="Monthly missions versus kilometers traveled">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={missionTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="missions" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <YAxis yAxisId="distance" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} tickFormatter={(value) => `${Math.round(value / 1000)}K`} />
                <Tooltip {...chartTooltipProps} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line yAxisId="missions" type="monotone" dataKey="missions" stroke="#1f3e68" strokeWidth={2.4} dot={{ r: 3 }} name="Missions" />
                <Line yAxisId="distance" type="monotone" dataKey="kmDriven" stroke="#16a34a" strokeWidth={2.4} dot={{ r: 3 }} name="Distance (km)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Maintenance Type Volume" subtitle="Count of work orders by maintenance type" className="xl:col-span-2">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceByType} barSize={34}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...chartTooltipProps} />
                <Bar dataKey="count" fill="#1f3e68" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title="Document Library"
        subtitle="Centralized report repository for command briefings and compliance references."
        action={
          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const newReport = {
                id: `RPT-${new Date().getFullYear()}-${String(reportData.length + 1).padStart(3, "0")}`,
                title: "Operations Snapshot Report",
                module: "Reports",
                period: today,
                author: "SSgt. Reyes, J.",
                date: today,
                status: "Published",
              };
              setReportData((previous) => [newReport, ...previous]);

              appendRuntimeAudit({
                id: `AUD-${Date.now()}`,
                timestamp: nowTimestamp(),
                actor: "SSgt. Reyes, J.",
                action: "Generated report document",
                module: "Reports",
                severity: "Info",
                details: `${newReport.id} added to the document library.`,
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0d1b2a] px-3 py-1.5 text-xs text-white hover:bg-[#16283d]"
          >
            <Plus className="h-3.5 w-3.5" />
            Generate Report
          </button>
        }
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search report ID, title, module, period, or author"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "All" | "Published" | "Archived")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="All">All Status</option>
            <option value="Published">Published</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {filteredReports.length === 0 ? (
          <EmptyState
            title="No reports found"
            description="No documents match your selected filters. Try updating the search criteria."
          />
        ) : (
          <>
            <div className="space-y-2">
              {paginatedReports.map((report) => (
                <article
                  key={report.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-slate-100 p-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{report.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{report.id}</span>
                        <span>|</span>
                        <span>{report.module}</span>
                        <span>|</span>
                        <span>{report.period}</span>
                        <span>|</span>
                        <span>By {report.author}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {report.date}
                    </div>
                    <StatusBadge label={report.status} tone={report.status === "Published" ? "success" : "neutral"} />
                    <button
                      type="button"
                      onClick={() => {
                        downloadTextFile(
                          `${report.id}.txt`,
                          `Report ID: ${report.id}
Title: ${report.title}
Module: ${report.module}
Period: ${report.period}
Author: ${report.author}
Date: ${report.date}
Status: ${report.status}`
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredReports.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="report"
            />
          </>
        )}
      </Panel>
    </div>
  );
}
