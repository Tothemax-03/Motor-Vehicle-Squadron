import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  CheckCircle2,
  Search,
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Package,
  Wrench,
  Save,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { MaintenanceRecord, Vehicle } from "../../data/fleetData";
import { downloadCsv, downloadTextFile } from "../../data/exportUtils";
import {
  appendRuntimeAudit,
  buildNextNumericId,
  getRuntimeDrivers,
  getRuntimeMaintenance,
  getRuntimeVehicles,
  nowTimestamp,
  syncRuntimeFromServer,
  setRuntimeMaintenance,
  setRuntimeVehicles,
} from "../../data/runtimeStore";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";
import { chartTooltipProps } from "../shared/chartTooltip";

type MaintenanceStatus = MaintenanceRecord["status"];
const PAGE_SIZE = 6;

const statusMeta: Record<
  MaintenanceStatus,
  { label: string; tone: "info" | "success" | "warning" | "danger" }
> = {
  "in-progress": { label: "In Progress", tone: "info" },
  pending: { label: "Pending", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

const priorityMeta: Record<
  MaintenanceRecord["priority"],
  { label: string; tone: "danger" | "warning" | "info" | "success" }
> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warning" },
  medium: { label: "Medium", tone: "info" },
  low: { label: "Low", tone: "success" },
};

const typeMeta: Record<MaintenanceRecord["type"], { label: string; tone: "info" | "warning" | "success" | "danger" }> = {
  PMCS: { label: "PMCS", tone: "info" },
  corrective: { label: "Corrective", tone: "danger" },
  periodic: { label: "Periodic", tone: "warning" },
  inspection: { label: "Inspection", tone: "success" },
};

function getProgress(status: MaintenanceStatus) {
  if (status === "completed") return 100;
  if (status === "in-progress") return 65;
  if (status === "overdue") return 95;
  return 20;
}

interface WorkOrderDraft {
  title: string;
  type: MaintenanceRecord["type"];
  description: string;
  vehicleId: string;
  technician: string;
  priority: MaintenanceRecord["priority"];
  status: MaintenanceStatus;
  dateCreated: string;
  scheduledDate: string;
  estimatedHours: string;
  cost: string;
}

function emptyWorkOrderDraft(defaultVehicleId: string): WorkOrderDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    type: "PMCS",
    description: "",
    vehicleId: defaultVehicleId,
    technician: "",
    priority: "medium",
    status: "pending",
    dateCreated: today,
    scheduledDate: today,
    estimatedHours: "4",
    cost: "0",
  };
}

function WorkOrderCard({
  record,
  expanded,
  onToggle,
  onUpdate,
  onServiceSheet,
  onDelete,
}: {
  record: MaintenanceRecord;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (record: MaintenanceRecord) => void;
  onServiceSheet: (record: MaintenanceRecord) => void;
  onDelete: (record: MaintenanceRecord) => void;
}) {
  const status = statusMeta[record.status];
  const priority = priorityMeta[record.priority];
  const type = typeMeta[record.type];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-slate-50/80"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                {record.id}
              </span>
              <StatusBadge label={type.label} tone={type.tone} />
              <StatusBadge label={status.label} tone={status.tone} />
              <StatusBadge label={priority.label} tone={priority.tone} />
            </div>
            <p className="text-sm font-medium text-slate-800">
              {record.plateNumber} - {record.vehicleType}
            </p>
            {record.title ? <p className="mt-1 text-xs font-medium text-slate-700">{record.title}</p> : null}
            <p className="mt-1 text-xs text-slate-500">{record.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-600">{record.scheduledDate}</p>
              <p className="text-xs text-slate-400">{record.estimatedHours} hrs</p>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Technician</p>
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                <User className="h-3.5 w-3.5 text-slate-500" />
                {record.technician}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Scheduled Date</p>
              <p className="mt-1 text-sm text-slate-700">{record.scheduledDate}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Estimated Hours</p>
              <p className="mt-1 text-sm text-slate-700">{record.estimatedHours} hrs</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Estimated Cost</p>
              <p className="mt-1 text-sm text-slate-700">
                PHP {record.cost ? record.cost.toLocaleString() : "0"}
              </p>
            </div>
            {record.completedDate ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Completed Date</p>
                <p className="mt-1 text-sm text-slate-700">{record.completedDate}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Progress</p>
              <div className="mt-1">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{status.label}</span>
                  <span>{getProgress(record.status)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      record.status === "overdue"
                        ? "bg-red-500"
                        : record.status === "in-progress"
                          ? "bg-blue-500"
                          : record.status === "completed"
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                    }`}
                    style={{ width: `${getProgress(record.status)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {record.parts && record.parts.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Required Parts</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.parts.map((part) => (
                  <span
                    key={`${record.id}-${part}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    <Package className="h-3.5 w-3.5" />
                    {part}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpdate(record)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-1.5 text-xs text-white hover:bg-[#16283d]"
            >
              <Save className="h-3.5 w-3.5" />
              Update Work Order
            </button>
            <button
              type="button"
              onClick={() => onServiceSheet(record)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Open Service Sheet
            </button>
            <button
              type="button"
              onClick={() => onDelete(record)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Delete Work Order
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function MaintenanceMonitoring() {
  const [records, setRecords] = useState<MaintenanceRecord[]>(() => getRuntimeMaintenance());
  const [vehicleData, setVehicleData] = useState<Vehicle[]>(() => getRuntimeVehicles());
  const [driverData] = useState(() => getRuntimeDrivers());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | MaintenanceStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderDraft, setWorkOrderDraft] = useState<WorkOrderDraft>(() =>
    emptyWorkOrderDraft(getRuntimeVehicles()[0]?.id || "")
  );
  const [workOrderError, setWorkOrderError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  useEffect(() => {
    setRuntimeMaintenance(records);
  }, [records]);

  useEffect(() => {
    setRuntimeVehicles(vehicleData);
  }, [vehicleData]);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setRecords(getRuntimeMaintenance());
          setVehicleData(getRuntimeVehicles());
        }
      } catch {
        // Preserve existing cache values when refresh is unavailable.
      }
    };

    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const overdueCount = records.filter((record) => record.status === "overdue").length;
  const inProgressCount = records.filter((record) => record.status === "in-progress").length;
  const pendingCount = records.filter((record) => record.status === "pending").length;
  const completedCount = records.filter((record) => record.status === "completed").length;

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = filter === "all" || record.status === filter;
      const matchesSearch =
        !term ||
        `${record.id} ${record.title || ""} ${record.plateNumber} ${record.vehicleType} ${record.technician} ${record.description}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [records, search, filter]);

  useEffect(() => {
    setExpandedId(null);
    setTablePage(1);
  }, [search, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(tablePage, totalPages);
  const paginatedRows = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const typeBreakdown = useMemo(() => {
    const entries = [
      { name: "PMCS", key: "PMCS" as const, color: "#3b82f6" },
      { name: "Corrective", key: "corrective" as const, color: "#ef4444" },
      { name: "Periodic", key: "periodic" as const, color: "#f59e0b" },
      { name: "Inspection", key: "inspection" as const, color: "#22c55e" },
    ];
    return entries.map((entry) => ({
      name: entry.name,
      value: records.filter((record) => record.type === entry.key).length,
      color: entry.color,
    }));
  }, [records]);

  const costByCategory = useMemo(() => {
    const totals = {
      PMCS: 0,
      corrective: 0,
      periodic: 0,
      inspection: 0,
    };

    records.forEach((record) => {
      totals[record.type] += record.cost || 0;
    });

    return [
      { category: "PMCS", cost: totals.PMCS },
      { category: "Corrective", cost: totals.corrective },
      { category: "Periodic", cost: totals.periodic },
      { category: "Inspection", cost: totals.inspection },
    ];
  }, [records]);

  const totalCost = records.reduce((sum, record) => sum + (record.cost || 0), 0);

  const vehiclesInMaintenance = vehicleData.filter(
    (vehicle) => vehicle.status === "maintenance" || vehicle.status === "non-operational"
  );

  const exportMaintenanceReport = () => {
    downloadCsv(
      `maintenance-report-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRecords,
      [
        { header: "Work Order", value: (record) => record.id },
        { header: "Vehicle", value: (record) => record.plateNumber },
        { header: "Vehicle Type", value: (record) => record.vehicleType },
        { header: "Type", value: (record) => typeMeta[record.type].label },
        { header: "Description", value: (record) => record.description },
        { header: "Technician", value: (record) => record.technician },
        { header: "Scheduled Date", value: (record) => record.scheduledDate },
        { header: "Priority", value: (record) => priorityMeta[record.priority].label },
        { header: "Status", value: (record) => statusMeta[record.status].label },
        { header: "Estimated Hours", value: (record) => record.estimatedHours },
        { header: "Cost", value: (record) => record.cost ?? 0 },
      ]
    );
  };

  const openServiceSheet = (record: MaintenanceRecord) => {
    downloadTextFile(
      `${record.id}-service-sheet.txt`,
      `Work Order: ${record.id}
Title: ${record.title || "N/A"}
Vehicle: ${record.plateNumber} (${record.vehicleType})
Type: ${typeMeta[record.type].label}
Priority: ${priorityMeta[record.priority].label}
Status: ${statusMeta[record.status].label}
Technician: ${record.technician}
Date Created: ${record.dateCreated || "N/A"}
Scheduled Date: ${record.scheduledDate}
Estimated Hours: ${record.estimatedHours}
Description: ${record.description}
Parts: ${record.parts?.join(", ") || "None listed"}
Estimated Cost: PHP ${(record.cost || 0).toLocaleString()}`
    );
  };

  const applyVehicleStatusFromWorkOrder = (record: MaintenanceRecord) => {
    setVehicleData((previous) =>
      previous.map((vehicle) =>
        vehicle.id === record.vehicleId
          ? {
              ...vehicle,
              status: record.status === "completed" ? "operational" : "maintenance",
              location: record.status === "completed" ? "Motor Pool" : "Maintenance Bay - Workshop",
            }
          : vehicle
      )
    );
  };

  const updateWorkOrder = (record: MaintenanceRecord) => {
    const nextStatus: MaintenanceStatus =
      record.status === "pending"
        ? "in-progress"
        : record.status === "in-progress"
          ? "completed"
          : record.status === "overdue"
            ? "in-progress"
            : "completed";

    const updatedRecord: MaintenanceRecord = {
      ...record,
      status: nextStatus,
      completedDate:
        nextStatus === "completed" ? new Date().toISOString().slice(0, 10) : record.completedDate,
    };

    setRecords((previous) =>
      previous.map((row) => (row.id === record.id ? updatedRecord : row))
    );
    applyVehicleStatusFromWorkOrder(updatedRecord);

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "MSgt. Lacson, B.",
      action: "Updated maintenance work order status",
      module: "Maintenance",
      severity: nextStatus === "completed" ? "Info" : "Warning",
      details: `${record.id} marked as ${statusMeta[nextStatus].label}.`,
    });
  };

  const openNewWorkOrderModal = () => {
    setWorkOrderDraft(emptyWorkOrderDraft(vehicleData[0]?.id || ""));
    setWorkOrderError("");
    setWorkOrderModalOpen(true);
  };

  const closeWorkOrderModal = () => {
    setWorkOrderModalOpen(false);
    setWorkOrderError("");
  };

  const updateWorkOrderDraft = <K extends keyof WorkOrderDraft>(field: K, value: WorkOrderDraft[K]) => {
    setWorkOrderDraft((previous) => ({ ...previous, [field]: value }));
    setWorkOrderError("");
  };

  const saveNewWorkOrder = () => {
    const selectedVehicle = vehicleData.find((vehicle) => vehicle.id === workOrderDraft.vehicleId);
    if (!selectedVehicle) {
      setWorkOrderError("Please select a vehicle for this work order.");
      return;
    }

    if (!workOrderDraft.title.trim() || !workOrderDraft.description.trim() || !workOrderDraft.technician.trim()) {
      setWorkOrderError("Work order title, description, and assigned mechanic are required.");
      return;
    }

    const estimatedHours = Number.parseFloat(workOrderDraft.estimatedHours);
    const cost = Number.parseFloat(workOrderDraft.cost);
    if (Number.isNaN(estimatedHours) || estimatedHours <= 0) {
      setWorkOrderError("Estimated hours must be a valid value greater than zero.");
      return;
    }

    if (Number.isNaN(cost) || cost < 0) {
      setWorkOrderError("Estimated cost must be a valid non-negative number.");
      return;
    }

    const newId = `MNT${String(buildNextNumericId(records.map((record) => record.id))).padStart(3, "0")}`;
    const newRecord: MaintenanceRecord = {
      id: newId,
      vehicleId: selectedVehicle.id,
      plateNumber: selectedVehicle.plateNumber,
      vehicleType: selectedVehicle.type,
      title: workOrderDraft.title.trim(),
      type: workOrderDraft.type,
      description: workOrderDraft.description.trim(),
      dateCreated: workOrderDraft.dateCreated,
      scheduledDate: workOrderDraft.scheduledDate,
      technician: workOrderDraft.technician.trim(),
      priority: workOrderDraft.priority,
      status: workOrderDraft.status,
      estimatedHours,
      parts: [],
      cost,
    };

    setRecords((previous) => [newRecord, ...previous]);
    applyVehicleStatusFromWorkOrder(newRecord);
    setFeedbackMessage({ tone: "success", text: `${newRecord.id} created successfully.` });

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "MSgt. Lacson, B.",
      action: "Created new maintenance work order",
      module: "Maintenance",
      severity: "Info",
      details: `${newId} created for ${selectedVehicle.plateNumber}.`,
    });

    closeWorkOrderModal();
  };

  const deleteWorkOrder = (record: MaintenanceRecord) => {
    const confirmed = window.confirm("Are you sure you want to delete this work order?");
    if (!confirmed) return;

    setRecords((previous) => {
      const nextRecords = previous.filter((row) => row.id !== record.id);
      const hasRemainingOpenOrder = nextRecords.some(
        (row) => row.vehicleId === record.vehicleId && row.status !== "completed"
      );

      if (!hasRemainingOpenOrder) {
        setVehicleData((vehicleRows) =>
          vehicleRows.map((vehicle) =>
            vehicle.id === record.vehicleId
              ? { ...vehicle, status: "operational", location: "Motor Pool" }
              : vehicle
          )
        );
      }

      return nextRecords;
    });
    setFeedbackMessage({ tone: "success", text: `${record.id} deleted successfully.` });

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "MSgt. Lacson, B.",
      action: "Deleted maintenance work order",
      module: "Maintenance",
      severity: "Warning",
      details: `${record.id} removed from maintenance records.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Maintenance Monitoring"
        description="Track work orders, maintenance costs, priorities, and vehicle recovery progress."
        rightSlot={
          <>
            <button
              type="button"
              onClick={exportMaintenanceReport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Export Maintenance Report
            </button>
            <button
              type="button"
              onClick={openNewWorkOrderModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
            >
              <Plus className="h-4 w-4" />
              New Work Order
            </button>
          </>
        }
      />

      {feedbackMessage ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedbackMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="rounded-md border border-transparent px-2 py-0.5 text-xs hover:border-slate-200 hover:bg-white/70"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {overdueCount > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              <strong>{overdueCount} overdue maintenance work order(s)</strong> detected.
              Immediate workshop action is required to avoid mission readiness impact.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Overdue Orders" value={overdueCount} helper="Beyond maintenance SLA window" icon={AlertTriangle} tone="danger" />
        <KpiCard title="In Progress" value={inProgressCount} helper="Currently under active repair" icon={Wrench} tone="info" />
        <KpiCard title="Pending" value={pendingCount} helper="Queued for workshop scheduling" icon={Clock3} tone="warning" />
        <KpiCard title="Completed" value={completedCount} helper="Closed and serviceable work orders" icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Maintenance Work Orders"
          subtitle="Searchable and filterable work order cards with detailed service data."
          className="xl:col-span-2"
          action={<span className="text-xs text-slate-500">{filteredRecords.length} active record(s)</span>}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search work order, vehicle, technician, or description"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "overdue", "in-progress", "pending", "completed"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={`rounded-lg border px-3 py-2 text-xs capitalize transition-colors ${
                      filter === status
                        ? "border-[#0d1b2a] bg-[#0d1b2a] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {status === "all" ? "All Orders" : status.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <WorkOrderCard
                    key={record.id}
                    record={record}
                    expanded={expandedId === record.id}
                    onToggle={() => setExpandedId((previous) => (previous === record.id ? null : record.id))}
                    onUpdate={updateWorkOrder}
                    onServiceSheet={openServiceSheet}
                    onDelete={deleteWorkOrder}
                  />
                ))
              ) : (
                <EmptyState
                  title="No maintenance work orders found"
                  description="No records match your selected status filter and search criteria."
                />
              )}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Maintenance Type Breakdown" subtitle="Distribution of work order types">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {typeBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipProps} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {typeBreakdown.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                  <span className="text-slate-800">{entry.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Vehicles Under Maintenance" subtitle="Assets currently in workshop workflow">
            <div className="space-y-3">
              {vehiclesInMaintenance.map((vehicle) => {
                const activeRecord = records.find(
                  (record) =>
                    record.vehicleId === vehicle.id &&
                    (record.status === "in-progress" || record.status === "overdue" || record.status === "pending")
                );
                const progress = activeRecord ? getProgress(activeRecord.status) : 0;

                return (
                  <article key={vehicle.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{vehicle.plateNumber}</p>
                        <p className="text-xs text-slate-500">{vehicle.designation}</p>
                      </div>
                      {activeRecord ? (
                        <StatusBadge label={statusMeta[activeRecord.status].label} tone={statusMeta[activeRecord.status].tone} />
                      ) : (
                        <StatusBadge label="Queued" tone="neutral" />
                      )}
                    </div>

                    {activeRecord ? (
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>{activeRecord.id}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              activeRecord.status === "overdue"
                                ? "bg-red-500"
                                : activeRecord.status === "in-progress"
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel title="Cost by Category" subtitle="Estimated maintenance cost allocation">
            <p className="mb-3 text-sm text-slate-600">
              Total projected cost: <span className="font-medium text-slate-900">PHP {totalCost.toLocaleString()}</span>
            </p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByCategory} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={(value: number) => [`PHP ${value.toLocaleString()}`, "Cost"]}
                  />
                  <Bar dataKey="cost" fill="#1f3e68" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Maintenance Control Record"
        subtitle="Complete maintenance record for all tracked fleet assets."
        action={<span className="text-xs text-slate-500">{filteredRecords.length} filtered records</span>}
      >
        {filteredRecords.length === 0 ? (
          <EmptyState
            title="No maintenance records found"
            description="Try adjusting your search and status filters to display maintenance control records."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Work Order</th>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Technician</th>
                    <th className="px-3 py-2.5">Scheduled</th>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-medium text-slate-800">{record.id}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-800">{record.plateNumber}</p>
                        <p className="text-xs text-slate-500">{record.vehicleType}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={typeMeta[record.type].label} tone={typeMeta[record.type].tone} />
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {record.title ? <p className="text-xs font-medium text-slate-700">{record.title}</p> : null}
                        <p className="text-xs text-slate-500">{record.description}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{record.technician}</td>
                      <td className="px-3 py-3 text-slate-600">{record.scheduledDate}</td>
                      <td className="px-3 py-3">
                        <StatusBadge label={priorityMeta[record.priority].label} tone={priorityMeta[record.priority].tone} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={statusMeta[record.status].label} tone={statusMeta[record.status].tone} />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => deleteWorkOrder(record)}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredRecords.length}
              pageSize={PAGE_SIZE}
              onPageChange={setTablePage}
              itemLabel="maintenance record"
            />
          </>
        )}
      </Panel>

      {workOrderModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">New Work Order</h3>
                <p className="text-xs text-slate-500">Create a maintenance work order with complete job details.</p>
              </div>
              <button
                type="button"
                onClick={closeWorkOrderModal}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {workOrderError ? (
                <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {workOrderError}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Work Order Title *</label>
                <input
                  value={workOrderDraft.title}
                  onChange={(event) => updateWorkOrderDraft("title", event.target.value)}
                  placeholder="Brake System Overhaul"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Work Order Type</label>
                <select
                  value={workOrderDraft.type}
                  onChange={(event) => updateWorkOrderDraft("type", event.target.value as MaintenanceRecord["type"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="PMCS">PMCS</option>
                  <option value="corrective">Corrective</option>
                  <option value="periodic">Periodic</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Description / Details *</label>
                <textarea
                  value={workOrderDraft.description}
                  onChange={(event) => updateWorkOrderDraft("description", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Vehicle *</label>
                <select
                  value={workOrderDraft.vehicleId}
                  onChange={(event) => updateWorkOrderDraft("vehicleId", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Select vehicle</option>
                  {vehicleData.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber} - {vehicle.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Assigned Mechanic / Personnel *</label>
                <select
                  value={workOrderDraft.technician}
                  onChange={(event) => updateWorkOrderDraft("technician", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Select personnel</option>
                  {driverData.map((driver) => (
                    <option key={driver.id} value={driver.fullName}>
                      {driver.fullName}
                    </option>
                  ))}
                  <option value="Workshop Team A">Workshop Team A</option>
                  <option value="Workshop Team B">Workshop Team B</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Priority</label>
                <select
                  value={workOrderDraft.priority}
                  onChange={(event) => updateWorkOrderDraft("priority", event.target.value as MaintenanceRecord["priority"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Status</label>
                <select
                  value={workOrderDraft.status}
                  onChange={(event) => updateWorkOrderDraft("status", event.target.value as MaintenanceStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="overdue">Overdue</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Date Created</label>
                <input
                  type="date"
                  value={workOrderDraft.dateCreated}
                  onChange={(event) => updateWorkOrderDraft("dateCreated", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Scheduled Date</label>
                <input
                  type="date"
                  value={workOrderDraft.scheduledDate}
                  onChange={(event) => updateWorkOrderDraft("scheduledDate", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Estimated Hours</label>
                <input
                  value={workOrderDraft.estimatedHours}
                  onChange={(event) => updateWorkOrderDraft("estimatedHours", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Estimated Cost (PHP)</label>
                <input
                  value={workOrderDraft.cost}
                  onChange={(event) => updateWorkOrderDraft("cost", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeWorkOrderModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewWorkOrder}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-2 text-sm text-white hover:bg-[#16283d]"
              >
                <Save className="h-4 w-4" />
                Save Work Order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
