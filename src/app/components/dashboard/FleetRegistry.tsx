import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
  Gauge,
  Calendar,
  MapPin,
  User,
  Truck,
  Fuel,
  ClipboardList,
  Save,
  X,
} from "lucide-react";
import type { DriverProfile, Vehicle, VehicleCategory, VehicleStatus } from "../../data/fleetData";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";
import { downloadCsv, downloadTextFile } from "../../data/exportUtils";
import {
  appendRuntimeAudit,
  buildNextNumericId,
  getRuntimeDrivers,
  getRuntimeVehicles,
  nowTimestamp,
  syncRuntimeFromServer,
  setRuntimeVehicles,
} from "../../data/runtimeStore";

const statusMeta: Record<
  VehicleStatus,
  { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" }
> = {
  operational: { label: "Operational", tone: "success" },
  "on-mission": { label: "On Mission", tone: "info" },
  maintenance: { label: "Maintenance", tone: "warning" },
  "non-operational": { label: "Non-Operational", tone: "danger" },
  standby: { label: "Standby", tone: "neutral" },
};

const statusOrder: VehicleStatus[] = [
  "operational",
  "on-mission",
  "maintenance",
  "non-operational",
  "standby",
];

const categoryOptions: Array<{ value: VehicleCategory; label: string }> = [
  { value: "truck", label: "Truck" },
  { value: "bus", label: "Bus" },
  { value: "van", label: "Van" },
  { value: "mpv", label: "MPV" },
  { value: "other", label: "Other" },
];

interface VehicleDraft {
  plateNumber: string;
  designation: string;
  type: string;
  category: VehicleCategory;
  make: string;
  year: string;
  status: VehicleStatus;
  driver: string;
  mileage: string;
  fuelLevel: string;
  section: string;
  location: string;
  lastMaintenance: string;
  nextMaintenance: string;
}

const PAGE_SIZE = 7;

function fuelBarColor(level: number) {
  if (level >= 70) return "bg-emerald-500";
  if (level >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): VehicleDraft {
  const date = todayDate();
  return {
    plateNumber: "",
    designation: "",
    type: "",
    category: "truck",
    make: "",
    year: String(new Date().getFullYear()),
    status: "operational",
    driver: "Unassigned",
    mileage: "0",
    fuelLevel: "100",
    section: "",
    location: "",
    lastMaintenance: date,
    nextMaintenance: date,
  };
}

function draftFromVehicle(vehicle: Vehicle): VehicleDraft {
  return {
    plateNumber: vehicle.plateNumber,
    designation: vehicle.designation,
    type: vehicle.type,
    category: vehicle.category,
    make: vehicle.make,
    year: String(vehicle.year),
    status: vehicle.status,
    driver: vehicle.driver,
    mileage: String(vehicle.mileage),
    fuelLevel: String(vehicle.fuelLevel),
    section: vehicle.section,
    location: vehicle.location,
    lastMaintenance: vehicle.lastMaintenance,
    nextMaintenance: vehicle.nextMaintenance,
  };
}

function FleetTableRow({
  vehicle,
  expanded,
  onToggle,
  onEdit,
}: {
  vehicle: Vehicle;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (vehicle: Vehicle) => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
        <td className="px-3 py-3">
          <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
            <div>
              <p className="font-medium text-slate-800">{vehicle.plateNumber}</p>
              <p className="text-xs text-slate-500">{vehicle.designation}</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
        </td>
        <td className="px-3 py-3">
          <p className="text-slate-800">{vehicle.type}</p>
          <p className="text-xs text-slate-500">{vehicle.make}</p>
        </td>
        <td className="px-3 py-3 text-slate-600">{vehicle.section || "N/A"}</td>
        <td className="px-3 py-3">
          <div className="inline-flex items-center gap-1.5 text-slate-600">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>{vehicle.driver || "Unassigned"}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-slate-600">{vehicle.mileage.toLocaleString()} km</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${fuelBarColor(vehicle.fuelLevel)}`} style={{ width: `${vehicle.fuelLevel}%` }} />
            </div>
            <span className="text-xs text-slate-600">{vehicle.fuelLevel}%</span>
          </div>
        </td>
        <td className="px-3 py-3 text-slate-600">{vehicle.nextMaintenance}</td>
        <td className="px-3 py-3">
          <StatusBadge label={statusMeta[vehicle.status].label} tone={statusMeta[vehicle.status].tone} />
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-slate-100 bg-slate-50/70">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Vehicle ID</p>
                <p className="mt-1 text-sm text-slate-700">{vehicle.id}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Year Model</p>
                <p className="mt-1 text-sm text-slate-700">{vehicle.year}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Last Maintenance</p>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  {vehicle.lastMaintenance}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Current Location</p>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {vehicle.location || "N/A"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(vehicle)}
                className="rounded-lg bg-[#0d1b2a] px-3 py-1.5 text-xs text-white hover:bg-[#16283d]"
              >
                Edit Vehicle Record
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadTextFile(
                    `${vehicle.id}-maintenance-summary.txt`,
                    `Vehicle: ${vehicle.plateNumber}\nDesignation: ${vehicle.designation}\nStatus: ${statusMeta[vehicle.status].label}\nNext Maintenance: ${vehicle.nextMaintenance}`
                  );
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                View Maintenance History
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadTextFile(
                    `${vehicle.id}-profile.txt`,
                    `Vehicle ID: ${vehicle.id}\nPlate: ${vehicle.plateNumber}\nType: ${vehicle.type}\nDesignation: ${vehicle.designation}\nDriver: ${vehicle.driver}\nSection: ${vehicle.section}\nLocation: ${vehicle.location}\nMileage: ${vehicle.mileage}\nFuel Level: ${vehicle.fuelLevel}%`
                  );
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                Print Vehicle Profile
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function FleetRegistry() {
  const [vehicleData, setVehicleData] = useState<Vehicle[]>(() => getRuntimeVehicles());
  const [driverData, setDriverData] = useState<DriverProfile[]>(() => getRuntimeDrivers());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VehicleDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [driverSearch, setDriverSearch] = useState("");

  useEffect(() => {
    setRuntimeVehicles(vehicleData);
  }, [vehicleData]);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setVehicleData(getRuntimeVehicles());
          setDriverData(getRuntimeDrivers());
        }
      } catch {
        // Keep local cache if server refresh fails.
      }
    };

    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredVehicles = useMemo(() => {
    const term = query.trim().toLowerCase();
    return vehicleData.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
      const matchesSearch =
        !term ||
        `${vehicle.plateNumber} ${vehicle.designation} ${vehicle.type} ${vehicle.section} ${vehicle.driver}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [vehicleData, query, statusFilter]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const statusCounts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: vehicleData.filter((vehicle) => vehicle.status === status).length,
      })),
    [vehicleData]
  );

  const avgFuelLevel =
    vehicleData.length === 0
      ? 0
      : Math.round(vehicleData.reduce((sum, vehicle) => sum + vehicle.fuelLevel, 0) / vehicleData.length);

  const dueWithin30Days = vehicleData.filter((vehicle) => {
    const due = new Date(vehicle.nextMaintenance).getTime();
    if (Number.isNaN(due)) return false;
    const now = new Date().getTime();
    const threshold = now + 30 * 24 * 60 * 60 * 1000;
    return due >= now && due <= threshold;
  }).length;

  const assignableDrivers = useMemo(() => {
    const assignedToActiveVehicle = new Map<string, string>();
    vehicleData.forEach((vehicle) => {
      if (vehicle.status === "non-operational") return;
      if (!vehicle.driver || vehicle.driver === "Unassigned") return;
      if (editingVehicleId && vehicle.id === editingVehicleId) return;
      assignedToActiveVehicle.set(vehicle.driver, vehicle.plateNumber);
    });

    const normalizedSearch = driverSearch.trim().toLowerCase();
    return driverData
      .filter((driver) => {
        if (normalizedSearch === "") return true;
        return `${driver.fullName} ${driver.status} ${driver.licenseType || ""}`.toLowerCase().includes(normalizedSearch);
      })
      .map((driver) => ({
        driver,
        assignedPlate: assignedToActiveVehicle.get(driver.fullName),
      }));
  }, [driverData, driverSearch, editingVehicleId, vehicleData]);

  const openAddModal = () => {
    setEditingVehicleId(null);
    setDraft(emptyDraft());
    setDriverSearch("");
    setFormError("");
    setEditorOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setDraft(draftFromVehicle(vehicle));
    setDriverSearch(vehicle.driver === "Unassigned" ? "" : vehicle.driver);
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingVehicleId(null);
    setDriverSearch("");
    setFormError("");
  };

  const updateDraft = <K extends keyof VehicleDraft>(field: K, value: VehicleDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const saveVehicle = () => {
    if (!draft.plateNumber.trim() || !draft.designation.trim() || !draft.type.trim()) {
      setFormError("Plate number, designation, and vehicle type are required.");
      return;
    }

    const parsedYear = Number.parseInt(draft.year, 10);
    const parsedMileage = Number.parseInt(draft.mileage, 10);
    const parsedFuel = Number.parseInt(draft.fuelLevel, 10);

    if (Number.isNaN(parsedYear) || parsedYear < 1980 || parsedYear > 2100) {
      setFormError("Year model must be a valid year between 1980 and 2100.");
      return;
    }

    if (Number.isNaN(parsedMileage) || parsedMileage < 0) {
      setFormError("Mileage must be a valid non-negative number.");
      return;
    }

    if (Number.isNaN(parsedFuel) || parsedFuel < 0 || parsedFuel > 100) {
      setFormError("Fuel level must be between 0 and 100.");
      return;
    }

    const normalizedDriver = draft.driver.trim();
    if (normalizedDriver && normalizedDriver !== "Unassigned") {
      const isDuplicate = vehicleData.some(
        (vehicle) =>
          vehicle.driver === normalizedDriver &&
          vehicle.id !== editingVehicleId &&
          vehicle.status !== "non-operational"
      );
      if (isDuplicate) {
        setFormError("Selected driver is already assigned to another active vehicle.");
        return;
      }
    }

    const id =
      editingVehicleId ||
      `V${String(buildNextNumericId(vehicleData.map((vehicle) => vehicle.id))).padStart(3, "0")}`;

    const vehicleRecord: Vehicle = {
      id,
      plateNumber: draft.plateNumber.trim().toUpperCase(),
      designation: draft.designation.trim(),
      type: draft.type.trim(),
      category: draft.category,
      make: draft.make.trim() || "Unspecified",
      year: parsedYear,
      status: draft.status,
      driver: normalizedDriver || "Unassigned",
      mileage: parsedMileage,
      lastMaintenance: draft.lastMaintenance,
      nextMaintenance: draft.nextMaintenance,
      fuelLevel: parsedFuel,
      section: draft.section.trim() || "Unassigned",
      location: draft.location.trim() || "Motor Pool",
    };

    setVehicleData((previous) => {
      if (editingVehicleId) {
        return previous.map((vehicle) => (vehicle.id === editingVehicleId ? vehicleRecord : vehicle));
      }
      return [vehicleRecord, ...previous];
    });

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "SSgt. Reyes, J.",
      action: editingVehicleId ? "Updated vehicle registry record" : "Registered new fleet asset",
      module: "Fleet Registry",
      severity: "Info",
      details: `${vehicleRecord.plateNumber} (${vehicleRecord.designation}) set to ${statusMeta[vehicleRecord.status].label}.`,
    });

    closeEditor();
  };

  const exportFleetRoster = () => {
    const rows = filteredVehicles.map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      designation: vehicle.designation,
      type: vehicle.type,
      status: statusMeta[vehicle.status].label,
      driver: vehicle.driver,
      section: vehicle.section,
      location: vehicle.location,
      mileage: vehicle.mileage,
      fuelLevel: `${vehicle.fuelLevel}%`,
      nextMaintenance: vehicle.nextMaintenance,
    }));

    downloadCsv(
      `fleet-roster-${todayDate()}.csv`,
      rows,
      [
        { header: "Vehicle ID", value: (row) => row.id },
        { header: "Plate Number", value: (row) => row.plateNumber },
        { header: "Designation", value: (row) => row.designation },
        { header: "Type", value: (row) => row.type },
        { header: "Status", value: (row) => row.status },
        { header: "Driver", value: (row) => row.driver },
        { header: "Section", value: (row) => row.section },
        { header: "Location", value: (row) => row.location },
        { header: "Mileage (km)", value: (row) => row.mileage },
        { header: "Fuel Level", value: (row) => row.fuelLevel },
        { header: "Next Maintenance", value: (row) => row.nextMaintenance },
      ]
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Management"
        description="Maintain a complete fleet registry with searchable vehicle records, assignments, and readiness details."
        rightSlot={
          <>
            <button
              type="button"
              onClick={exportFleetRoster}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Export Fleet Roster
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
            >
              <Plus className="h-4 w-4" />
              Add Vehicle
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Fleet Assets" value={vehicleData.length} helper="Registered vehicles in inventory" icon={Truck} tone="neutral" />
        <KpiCard title="Operational Assets" value={statusCounts.find((entry) => entry.status === "operational")?.count ?? 0} helper="Available for assignment" icon={ClipboardList} tone="success" />
        <KpiCard title="Average Fuel Level" value={`${avgFuelLevel}%`} helper="Current fleet fuel readiness" icon={Fuel} tone="warning" />
        <KpiCard title="Maintenance Due (30d)" value={dueWithin30Days} helper="Vehicles due for service within 30 days" icon={Gauge} tone="info" />
      </div>

      <Panel title="Fleet Status Overview" subtitle="Click any status card to filter the full vehicle roster.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {statusCounts.map((entry) => (
            <button
              key={entry.status}
              type="button"
              onClick={() =>
                setStatusFilter((previous) => (previous === entry.status ? "all" : entry.status))
              }
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                statusFilter === entry.status
                  ? "border-[#0d1b2a] bg-[#0d1b2a] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.08em] opacity-80">{statusMeta[entry.status].label}</p>
              <p className="mt-1 text-2xl font-semibold">{entry.count}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Vehicle Roster"
        subtitle="Searchable and filterable fleet registry with expandable record details."
        action={
          <span className="text-xs text-slate-500">
            Showing {filteredVehicles.length} of {vehicleData.length} vehicle(s)
          </span>
        }
      >
        <div className="mb-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plate number, designation, vehicle type, section, or driver"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {filteredVehicles.length === 0 ? (
          <EmptyState
            title="No vehicle records found"
            description="No vehicles match the selected status filter and search criteria."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Plate / Designation</th>
                    <th className="px-3 py-2.5">Type / Make</th>
                    <th className="px-3 py-2.5">Section</th>
                    <th className="px-3 py-2.5">Assigned Driver</th>
                    <th className="px-3 py-2.5">Mileage</th>
                    <th className="px-3 py-2.5">Fuel Level</th>
                    <th className="px-3 py-2.5">Next Maintenance</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVehicles.map((vehicle) => (
                    <FleetTableRow
                      key={vehicle.id}
                      vehicle={vehicle}
                      expanded={expandedId === vehicle.id}
                      onToggle={() => setExpandedId((previous) => (previous === vehicle.id ? null : vehicle.id))}
                      onEdit={openEditModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredVehicles.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="vehicle record"
            />
          </>
        )}
      </Panel>

      {editorOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingVehicleId ? "Edit Vehicle Record" : "Add Vehicle Record"}
                </h3>
                <p className="text-xs text-slate-500">Capture fleet registry details and readiness metadata.</p>
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
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Plate Number *</label>
                <input
                  value={draft.plateNumber}
                  onChange={(event) => updateDraft("plateNumber", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Designation *</label>
                <input
                  value={draft.designation}
                  onChange={(event) => updateDraft("designation", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Vehicle Type *</label>
                <input
                  value={draft.type}
                  onChange={(event) => updateDraft("type", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Category</label>
                <select
                  value={draft.category}
                  onChange={(event) => updateDraft("category", event.target.value as VehicleCategory)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Make / Model</label>
                <input
                  value={draft.make}
                  onChange={(event) => updateDraft("make", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Year Model</label>
                <input
                  value={draft.year}
                  onChange={(event) => updateDraft("year", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Status</label>
                <select
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value as VehicleStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {statusMeta[status].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Assigned Driver</label>
                <input
                  value={driverSearch}
                  onChange={(event) => setDriverSearch(event.target.value)}
                  placeholder="Search driver by name or status"
                  className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <select
                  value={draft.driver}
                  onChange={(event) => updateDraft("driver", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="Unassigned">Unassigned</option>
                  {assignableDrivers.map(({ driver, assignedPlate }) => (
                    <option
                      key={driver.id}
                      value={driver.fullName}
                      disabled={!!assignedPlate && driver.fullName !== draft.driver}
                    >
                      {`${driver.fullName} - ${driver.status}${driver.licenseType ? ` - ${driver.licenseType}` : ""}${
                        assignedPlate ? ` (Assigned: ${assignedPlate})` : ""
                      }`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Drivers already assigned to other active vehicles are disabled.</p>
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
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Location</label>
                <input
                  value={draft.location}
                  onChange={(event) => updateDraft("location", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Mileage (km)</label>
                <input
                  value={draft.mileage}
                  onChange={(event) => updateDraft("mileage", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Fuel Level (%)</label>
                <input
                  value={draft.fuelLevel}
                  onChange={(event) => updateDraft("fuelLevel", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Last Maintenance</label>
                <input
                  type="date"
                  value={draft.lastMaintenance}
                  onChange={(event) => updateDraft("lastMaintenance", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Next Maintenance</label>
                <input
                  type="date"
                  value={draft.nextMaintenance}
                  onChange={(event) => updateDraft("nextMaintenance", event.target.value)}
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
                onClick={saveVehicle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-2 text-sm text-white hover:bg-[#16283d]"
              >
                <Save className="h-4 w-4" />
                Save Vehicle
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
