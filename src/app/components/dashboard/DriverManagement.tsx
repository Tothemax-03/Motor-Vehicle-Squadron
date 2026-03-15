import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Download,
  IdCard,
  UserCheck,
  Truck,
  CalendarClock,
  Save,
  X,
} from "lucide-react";
import type { DriverProfile } from "../../data/fleetData";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";
import { downloadCsv } from "../../data/exportUtils";
import {
  appendRuntimeAudit,
  buildNextNumericId,
  getRuntimeDrivers,
  nowTimestamp,
  syncRuntimeFromServer,
  setRuntimeDrivers,
} from "../../data/runtimeStore";

const statusMeta: Record<
  DriverProfile["status"],
  { tone: "success" | "info" | "warning" | "neutral" }
> = {
  Available: { tone: "success" },
  "Coming Available": { tone: "info" },
  "On Mission": { tone: "info" },
  "On Leave": { tone: "neutral" },
  Training: { tone: "warning" },
};

interface DriverDraft {
  fullName: string;
  rank: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  section: string;
  assignedVehicle: string;
  status: DriverProfile["status"];
  contactNumber: string;
  missionsThisMonth: string;
  lastDispatch: string;
}

const PAGE_SIZE = 6;

function emptyDraft(): DriverDraft {
  return {
    fullName: "",
    rank: "",
    licenseNumber: "",
    licenseType: "",
    licenseExpiry: new Date().toISOString().slice(0, 10),
    section: "",
    assignedVehicle: "Unassigned",
    status: "Available",
    contactNumber: "",
    missionsThisMonth: "0",
    lastDispatch: "",
  };
}

function buildDraftFromDriver(driver: DriverProfile): DriverDraft {
  return {
    fullName: driver.fullName,
    rank: driver.rank,
    licenseNumber: driver.licenseNumber,
    licenseType: driver.licenseType || "",
    licenseExpiry: driver.licenseExpiry,
    section: driver.section,
    assignedVehicle: driver.assignedVehicle,
    status: driver.status,
    contactNumber: driver.contactNumber,
    missionsThisMonth: String(driver.missionsThisMonth),
    lastDispatch: driver.lastDispatch,
  };
}

export function DriverManagement() {
  const [driverData, setDriverData] = useState<DriverProfile[]>(() => getRuntimeDrivers());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverProfile["status"] | "All">("All");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DriverDraft>(emptyDraft);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setRuntimeDrivers(driverData);
  }, [driverData]);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setDriverData(getRuntimeDrivers());
        }
      } catch {
        // Keep existing cache if server refresh fails.
      }
    };

    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredDrivers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return driverData.filter((driver) => {
      const matchesStatus = statusFilter === "All" || driver.status === statusFilter;
      const matchesSearch =
        !term ||
        `${driver.fullName} ${driver.rank} ${driver.section} ${driver.assignedVehicle} ${driver.licenseNumber}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [driverData, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const onMissionCount = driverData.filter((driver) => driver.status === "On Mission").length;
  const availableCount = driverData.filter((driver) => driver.status === "Available" || driver.status === "Coming Available").length;

  const expiringLicenses = driverData.filter((driver) => {
    const expiry = new Date(driver.licenseExpiry).getTime();
    if (Number.isNaN(expiry)) return false;
    const now = new Date().getTime();
    const within60Days = now + 60 * 24 * 60 * 60 * 1000;
    return expiry >= now && expiry <= within60Days;
  }).length;

  const openRegisterModal = () => {
    setEditingDriverId(null);
    setDraft(emptyDraft());
    setFormError("");
    setEditorOpen(true);
  };

  const openManageModal = (driver: DriverProfile) => {
    setEditingDriverId(driver.id);
    setDraft(buildDraftFromDriver(driver));
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingDriverId(null);
    setFormError("");
  };

  const updateDraft = <K extends keyof DriverDraft>(field: K, value: DriverDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const saveDriverRecord = () => {
    if (!draft.fullName.trim() || !draft.licenseNumber.trim() || !draft.licenseExpiry.trim()) {
      setFormError("Full name, license number, and license expiry are required.");
      return;
    }

    const missionCount = Number.parseInt(draft.missionsThisMonth, 10);
    if (Number.isNaN(missionCount) || missionCount < 0) {
      setFormError("Missions this month must be a valid non-negative number.");
      return;
    }

    const id =
      editingDriverId ||
      `DRV-${String(buildNextNumericId(driverData.map((driver) => driver.id))).padStart(3, "0")}`;

    const driverRecord: DriverProfile = {
      id,
      fullName: draft.fullName.trim(),
      rank: draft.rank.trim() || "Driver",
      licenseNumber: draft.licenseNumber.trim(),
      licenseType: draft.licenseType.trim() || undefined,
      licenseExpiry: draft.licenseExpiry,
      section: draft.section.trim() || "Unassigned",
      assignedVehicle: draft.assignedVehicle.trim() || "Unassigned",
      status: draft.status,
      contactNumber: draft.contactNumber.trim() || "N/A",
      missionsThisMonth: missionCount,
      lastDispatch: draft.lastDispatch.trim() || "No dispatch record",
    };

    setDriverData((previous) => {
      if (editingDriverId) {
        return previous.map((driver) => (driver.id === editingDriverId ? driverRecord : driver));
      }
      return [driverRecord, ...previous];
    });

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "SSgt. Reyes, J.",
      action: editingDriverId ? "Updated driver profile" : "Registered new driver profile",
      module: "Fleet Registry",
      severity: "Info",
      details: `${driverRecord.fullName} assigned status: ${driverRecord.status}.`,
    });

    closeEditor();
  };

  const exportDriverList = () => {
    downloadCsv(
      `driver-roster-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredDrivers,
      [
        { header: "Driver ID", value: (driver) => driver.id },
        { header: "Full Name", value: (driver) => driver.fullName },
        { header: "Rank", value: (driver) => driver.rank },
        { header: "License Number", value: (driver) => driver.licenseNumber },
        { header: "License Type", value: (driver) => driver.licenseType || "N/A" },
        { header: "License Expiry", value: (driver) => driver.licenseExpiry },
        { header: "Section", value: (driver) => driver.section },
        { header: "Assigned Vehicle", value: (driver) => driver.assignedVehicle },
        { header: "Status", value: (driver) => driver.status },
        { header: "Contact Number", value: (driver) => driver.contactNumber },
        { header: "Missions This Month", value: (driver) => driver.missionsThisMonth },
        { header: "Last Dispatch", value: (driver) => driver.lastDispatch },
      ]
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver Management"
        description="Manage driver records, license validity, duty status, and vehicle assignment readiness."
        rightSlot={
          <>
            <button
              type="button"
              onClick={exportDriverList}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Export Driver List
            </button>
            <button
              type="button"
              onClick={openRegisterModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
            >
              <Plus className="h-4 w-4" />
              Register Driver
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Drivers" value={driverData.length} helper="Personnel in the driver roster" icon={IdCard} tone="neutral" />
        <KpiCard title="Available Drivers" value={availableCount} helper="Ready for mission dispatch assignment" icon={UserCheck} tone="success" />
        <KpiCard title="On Mission" value={onMissionCount} helper="Currently assigned to active trips" icon={Truck} tone="info" />
        <KpiCard title="License Expiring" value={expiringLicenses} helper="Due for renewal within 60 days" icon={CalendarClock} tone="warning" />
      </div>

      <Panel
        title="Driver Roster"
        subtitle="Searchable and filterable list of assigned drivers and credentials."
        action={
          <span className="text-xs text-slate-500">
            Showing {filteredDrivers.length} of {driverData.length} driver(s)
          </span>
        }
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search driver name, section, license number, or assigned vehicle"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["All", "Available", "Coming Available", "On Mission", "Training", "On Leave"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  statusFilter === status
                    ? "border-[#0d1b2a] bg-[#0d1b2a] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {filteredDrivers.length === 0 ? (
          <EmptyState
            title="No driver records found"
            description="No drivers match your current filter and search criteria."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5">Section</th>
                    <th className="px-3 py-2.5">License Number</th>
                    <th className="px-3 py-2.5">License Type</th>
                    <th className="px-3 py-2.5">License Expiry</th>
                    <th className="px-3 py-2.5">Assigned Vehicle</th>
                    <th className="px-3 py-2.5">Missions (Month)</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDrivers.map((driver) => (
                    <tr key={driver.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800">{driver.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {driver.rank} - {driver.id}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{driver.section}</td>
                      <td className="px-3 py-3 text-slate-600">{driver.licenseNumber}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{driver.licenseType || "Unspecified"}</td>
                      <td className="px-3 py-3 text-slate-600">{driver.licenseExpiry}</td>
                      <td className="px-3 py-3 text-slate-600">{driver.assignedVehicle}</td>
                      <td className="px-3 py-3 text-slate-600">{driver.missionsThisMonth}</td>
                      <td className="px-3 py-3">
                        <StatusBadge label={driver.status} tone={statusMeta[driver.status].tone} />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openManageModal(driver)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          Manage Profile
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
              totalItems={filteredDrivers.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="driver record"
            />
          </>
        )}
      </Panel>

      {editorOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingDriverId ? "Manage Driver Profile" : "Register Driver"}
                </h3>
                <p className="text-xs text-slate-500">Capture driver credentials and assignment readiness.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {formError ? (
                <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Full Name *</label>
                <input
                  value={draft.fullName}
                  onChange={(event) => updateDraft("fullName", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Rank / Position</label>
                <input
                  value={draft.rank}
                  onChange={(event) => updateDraft("rank", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">License Number *</label>
                <input
                  value={draft.licenseNumber}
                  onChange={(event) => updateDraft("licenseNumber", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">License Type</label>
                <input
                  value={draft.licenseType}
                  onChange={(event) => updateDraft("licenseType", event.target.value)}
                  placeholder="Professional 1,2,3"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">License Expiry *</label>
                <input
                  type="date"
                  value={draft.licenseExpiry}
                  onChange={(event) => updateDraft("licenseExpiry", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Section</label>
                <input
                  value={draft.section}
                  onChange={(event) => updateDraft("section", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Assigned Vehicle</label>
                <input
                  value={draft.assignedVehicle}
                  onChange={(event) => updateDraft("assignedVehicle", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Status</label>
                <select
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value as DriverProfile["status"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="Available">Available</option>
                  <option value="Coming Available">Coming Available</option>
                  <option value="On Mission">On Mission</option>
                  <option value="Training">Training</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Contact Number</label>
                <input
                  value={draft.contactNumber}
                  onChange={(event) => updateDraft("contactNumber", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Missions This Month</label>
                <input
                  value={draft.missionsThisMonth}
                  onChange={(event) => updateDraft("missionsThisMonth", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Last Dispatch</label>
                <input
                  value={draft.lastDispatch}
                  onChange={(event) => updateDraft("lastDispatch", event.target.value)}
                  placeholder="YYYY-MM-DD HH:MM"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDriverRecord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-2 text-sm text-white hover:bg-[#16283d]"
              >
                <Save className="h-4 w-4" />
                Save Driver
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
