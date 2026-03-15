import { Link } from "react-router";
import {
  AlertTriangle,
  BarChart3,
  ClipboardPlus,
  FileText,
  Truck,
  Wrench,
  CheckCircle2,
  Navigation,
  Bell,
  Gauge,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { getRuntimeAuditTrail, getRuntimeMaintenance, getRuntimeMissions, getRuntimeVehicles, syncRuntimeFromServer } from "../../data/runtimeStore";
import { KpiCard } from "../shared/KpiCard";
import { Panel } from "../shared/Panel";
import { PageHeader } from "../shared/PageHeader";
import { StatusBadge } from "../shared/StatusBadge";
import { chartTooltipProps } from "../shared/chartTooltip";

export function Overview() {
  const [, setRefreshNonce] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setRefreshNonce((previous) => previous + 1);
        }
      } catch {
        // Keep cached values when backend refresh fails.
      }
    };
    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const vehicles = getRuntimeVehicles();
  const missions = getRuntimeMissions();
  const maintenanceRecords = getRuntimeMaintenance();
  const auditTrail = getRuntimeAuditTrail();

  const monthlyMovementData = useMemo(() => {
    const months = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (6 - index));
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: date.toLocaleString("en-US", { month: "short" }),
      };
    });

    const aggregates = new Map<string, { missions: number; kmDriven: number }>();
    missions.forEach((mission) => {
      const parsed = new Date(mission.departureTime.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) return;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      const current = aggregates.get(key) || { missions: 0, kmDriven: 0 };
      current.missions += 1;
      current.kmDriven += mission.milesDriven || 0;
      aggregates.set(key, current);
    });

    return months.map((month) => {
      const row = aggregates.get(month.key) || { missions: 0, kmDriven: 0 };
      return { month: month.month, missions: row.missions, kmDriven: row.kmDriven };
    });
  }, [missions]);

  const fleetStatusData = useMemo(
    () => [
      { name: "Operational", value: vehicles.filter((vehicle) => vehicle.status === "operational").length, color: "#22c55e" },
      { name: "On Mission", value: vehicles.filter((vehicle) => vehicle.status === "on-mission").length, color: "#3b82f6" },
      { name: "Maintenance", value: vehicles.filter((vehicle) => vehicle.status === "maintenance").length, color: "#f59e0b" },
      { name: "Non-Operational", value: vehicles.filter((vehicle) => vehicle.status === "non-operational").length, color: "#ef4444" },
      { name: "Standby", value: vehicles.filter((vehicle) => vehicle.status === "standby").length, color: "#8b5cf6" },
    ],
    [vehicles]
  );

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "operational" || vehicle.status === "on-mission"
  ).length;
  const underMaintenance = vehicles.filter(
    (vehicle) => vehicle.status === "maintenance" || vehicle.status === "non-operational"
  ).length;
  const completedTripsToday = missions.filter((mission) => mission.status === "completed").length;

  const overdueMaintenance = maintenanceRecords.filter((record) => record.status === "overdue");
  const pendingMaintenance = maintenanceRecords.filter(
    (record) => record.status === "pending" || record.status === "in-progress"
  );

  const maintenanceTrend = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((month) => {
    const total = maintenanceRecords.filter((record) => record.scheduledDate.includes(month)).length;
    const completed = maintenanceRecords.filter(
      (record) => record.scheduledDate.includes(month) && record.status === "completed"
    ).length;

    return { month, total, completed };
  });

  const readinessRate = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
  const recentActivity = auditTrail.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Enterprise command view of fleet status, mission execution, and maintenance readiness."
        rightSlot={
          <>
            <Link
              to="/movement"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ClipboardPlus className="h-4 w-4" />
              Create Mission Order
            </Link>
            <Link
              to="/maintenance"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Wrench className="h-4 w-4" />
              Open Work Order
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d] transition-colors"
            >
              <FileText className="h-4 w-4" />
              Generate Report
            </Link>
          </>
        }
      />

      {overdueMaintenance.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            <strong>{overdueMaintenance.length} overdue maintenance task(s)</strong> detected.
            Prioritize workshop action to prevent mission interruptions.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Vehicles" value={totalVehicles} helper="Registered in fleet registry" icon={Truck} tone="neutral" />
        <KpiCard title="Active Vehicles" value={activeVehicles} helper="Operational or currently deployed" icon={CheckCircle2} tone="success" />
        <KpiCard title="Under Maintenance" value={underMaintenance} helper="In workshop or non-operational" icon={Wrench} tone="warning" />
        <KpiCard title="Completed Trips Today" value={completedTripsToday} helper="Closed mission movement logs" icon={Navigation} tone="info" trendLabel={`Readiness rate: ${readinessRate}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Panel
          title="Vehicle Usage Trend"
          subtitle="Monthly mission volume and operational activity"
          className="xl:col-span-2"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMovementData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...chartTooltipProps} />
                <Bar dataKey="missions" fill="#1f3e68" radius={[6, 6, 0, 0]} name="Mission Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Maintenance Trend" subtitle="Scheduled versus completed maintenance tasks">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={maintenanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...chartTooltipProps} />
                <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} name="Scheduled" />
                <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Fleet Status Mix" subtitle="Current distribution of vehicle readiness states">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetStatusData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {fleetStatusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Tooltip {...chartTooltipProps} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Recent Activity Feed" subtitle="Latest command actions and system updates">
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{entry.action}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{entry.actor} | {entry.module}</p>
                    </div>
                    <StatusBadge
                      label={entry.severity}
                      tone={entry.severity === "Critical" ? "danger" : entry.severity === "Warning" ? "warning" : "info"}
                      pulse={entry.severity === "Critical"}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{entry.details}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{entry.timestamp}</p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No recent activity logs available.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Alerts and Notifications" subtitle="Items requiring command attention and follow-up">
          <div className="space-y-3">
            {pendingMaintenance.length > 0 ? (
              pendingMaintenance.slice(0, 5).map((item) => (
                <article key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="mt-0.5 rounded-lg bg-amber-100 p-1.5 text-amber-700">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-slate-800">{item.plateNumber} - {item.description}</p>
                      <StatusBadge label={item.status === "in-progress" ? "In Progress" : "Pending"} tone={item.status === "in-progress" ? "info" : "warning"} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Scheduled: {item.scheduledDate} | Technician: {item.technician}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No maintenance alerts currently queued.
              </div>
            )}

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-slate-500" />
                System readiness is currently at <strong>{readinessRate}%</strong>.
              </div>
            </div>

            <Link to="/maintenance" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800">
              <BarChart3 className="h-4 w-4" />
              Open Maintenance Queue
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
