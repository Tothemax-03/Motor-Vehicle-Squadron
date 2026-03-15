import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  MapPin,
  Navigation,
  Package,
  PencilLine,
  Plus,
  Save,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DriverProfile, Mission, MissionStatus, Vehicle } from "../../data/fleetData";
import { downloadCsv, downloadTextFile } from "../../data/exportUtils";
import {
  appendRuntimeAudit,
  buildNextNumericId,
  getRuntimeDrivers,
  getRuntimeMissions,
  getRuntimeVehicles,
  nowTimestamp,
  syncRuntimeFromServer,
  setRuntimeDrivers,
  setRuntimeMissions,
  setRuntimeVehicles,
} from "../../data/runtimeStore";
import { EmptyState } from "../shared/EmptyState";
import { KpiCard } from "../shared/KpiCard";
import { PageHeader } from "../shared/PageHeader";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";
import { TablePagination } from "../shared/TablePagination";
import { chartTooltipProps } from "../shared/chartTooltip";

const PAGE_SIZE = 6;

const missionStatusMeta: Record<
  MissionStatus,
  { label: string; tone: "info" | "success" | "warning" | "danger" }
> = {
  active: { label: "Active", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

interface MissionDraft {
  vehicleId: string;
  driver: string;
  requestingUnit: string;
  origin: string;
  destination: string;
  departureTime: string;
  eta: string;
  status: MissionStatus;
  cargo: string;
  passengers: string;
  milesDriven: string;
}

function parseDateValue(value: string) {
  if (!value.trim()) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatForStore(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function emptyDraft(defaultVehicleId: string): MissionDraft {
  return {
    vehicleId: defaultVehicleId,
    driver: "",
    requestingUnit: "",
    origin: "",
    destination: "",
    departureTime: "",
    eta: "",
    status: "pending",
    cargo: "",
    passengers: "0",
    milesDriven: "",
  };
}

function draftFromMission(mission: Mission): MissionDraft {
  return {
    vehicleId: mission.vehicleId,
    driver: mission.driver,
    requestingUnit: mission.requestingUnit,
    origin: mission.origin,
    destination: mission.destination,
    departureTime: mission.departureTime.replace(" ", "T"),
    eta: mission.eta.replace(" ", "T"),
    status: mission.status,
    cargo: mission.cargo,
    passengers: String(mission.passengers),
    milesDriven: mission.milesDriven !== undefined ? String(mission.milesDriven) : "",
  };
}

function nextMissionOrder(missions: Mission[]) {
  const year = new Date().getFullYear();
  const sequence =
    missions.reduce((max, mission) => {
      const match = mission.missionOrder.match(/-(\d{4})$/);
      if (!match) return max;
      const parsed = Number.parseInt(match[1], 10);
      return Number.isNaN(parsed) ? max : Math.max(max, parsed);
    }, 0) + 1;
  return `MO-${year}-${String(sequence).padStart(4, "0")}`;
}

export function MovementMonitoring() {
  const [vehicleData, setVehicleData] = useState<Vehicle[]>(() => getRuntimeVehicles());
  const [driverData, setDriverData] = useState<DriverProfile[]>(() => getRuntimeDrivers());
  const [missionData, setMissionData] = useState<Mission[]>(() => getRuntimeMissions());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MissionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MissionDraft>(() => emptyDraft(vehicleData[0]?.id || ""));
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setRuntimeMissions(missionData);
  }, [missionData]);

  useEffect(() => {
    setRuntimeVehicles(vehicleData);
  }, [vehicleData]);

  useEffect(() => {
    setRuntimeDrivers(driverData);
  }, [driverData]);

  useEffect(() => {
    let mounted = true;
    const refreshFromServer = async () => {
      try {
        await syncRuntimeFromServer();
        if (mounted) {
          setVehicleData(getRuntimeVehicles());
          setDriverData(getRuntimeDrivers());
          setMissionData(getRuntimeMissions());
        }
      } catch {
        // Keep cache values if server refresh fails.
      }
    };

    refreshFromServer();
    const intervalId = window.setInterval(refreshFromServer, 20000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredMissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return missionData.filter((mission) => {
      const matchesStatus = filter === "all" || mission.status === filter;
      const matchesSearch =
        !term ||
        `${mission.missionOrder} ${mission.plateNumber} ${mission.driver} ${mission.origin} ${mission.destination}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [missionData, search, filter]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, missionData]);

  const totalPages = Math.max(1, Math.ceil(filteredMissions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredMissions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeMissions = missionData.filter((mission) => mission.status === "active").length;
  const completedToday = missionData.filter((mission) => mission.status === "completed").length;
  const pendingDispatch = missionData.filter((mission) => mission.status === "pending").length;
  const deployedVehicles = vehicleData.filter((vehicle) => vehicle.status === "on-mission");
  const activeMissionDrivers = useMemo(
    () => new Set(missionData.filter((mission) => mission.status === "active").map((mission) => mission.driver)),
    [missionData]
  );

  const eligibleMissionDrivers = useMemo(
    () =>
      driverData.filter((driver) => {
        const isEligibleStatus = driver.status === "Available" || driver.status === "Coming Available";
        if (!isEligibleStatus) return false;
        if (activeMissionDrivers.has(driver.fullName) && driver.fullName !== draft.driver) return false;
        return true;
      }),
    [activeMissionDrivers, draft.driver, driverData]
  );

  const weeklyActivityData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const counts = new Map<number, number>();

    missionData.forEach((mission) => {
      const date = parseDateValue(mission.departureTime);
      if (!date || date < start || date > now) return;
      counts.set(date.getDay(), (counts.get(date.getDay()) || 0) + 1);
    });

    return days.map((day, index) => ({ day, missions: counts.get(index) || 0 }));
  }, [missionData]);

  const monthlyTrendData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - offset));
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: date.toLocaleString("en-US", { month: "short" }),
      };
    });

    const counts = new Map<string, number>();
    missionData.forEach((mission) => {
      const date = parseDateValue(mission.departureTime);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return months.map((month) => ({ month: month.month, missions: counts.get(month.key) || 0 }));
  }, [missionData]);

  const updateDraft = <K extends keyof MissionDraft>(field: K, value: MissionDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const openCreateModal = () => {
    setEditingId(null);
    setDraft((previous) => ({
      ...emptyDraft(vehicleData[0]?.id || ""),
      driver: eligibleMissionDrivers[0]?.fullName || previous.driver || "",
    }));
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (mission: Mission) => {
    setEditingId(mission.id);
    setDraft(draftFromMission(mission));
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormError("");
  };
  const syncVehicleStatus = (mission: Mission) => {
    setVehicleData((previous) =>
      previous.map((vehicle) =>
        vehicle.id === mission.vehicleId
          ? {
              ...vehicle,
              driver: mission.driver,
              status: mission.status === "active" ? "on-mission" : "operational",
              location: mission.status === "active" ? `En Route - ${mission.destination}` : "Motor Pool",
            }
          : vehicle
      )
    );
  };

  const syncDriverStatus = (mission: Mission) => {
    setDriverData((previous) =>
      previous.map((driver) =>
        driver.fullName === mission.driver
          ? {
              ...driver,
              status: mission.status === "active" ? "On Mission" : "Coming Available",
              assignedVehicle: mission.plateNumber,
              lastDispatch: mission.departureTime,
              missionsThisMonth: mission.status === "active" ? driver.missionsThisMonth + 1 : driver.missionsThisMonth,
            }
          : driver
      )
    );
  };

  const saveMission = () => {
    const selectedVehicle = vehicleData.find((vehicle) => vehicle.id === draft.vehicleId);
    if (!selectedVehicle) {
      setFormError("Please select a valid vehicle.");
      return;
    }

    if (
      !draft.driver.trim() ||
      !draft.requestingUnit.trim() ||
      !draft.origin.trim() ||
      !draft.destination.trim() ||
      !draft.departureTime.trim() ||
      !draft.eta.trim() ||
      !draft.cargo.trim()
    ) {
      setFormError("Please complete all required mission fields.");
      return;
    }

    const passengers = Number.parseInt(draft.passengers, 10);
    const distance = Number.parseFloat(draft.milesDriven);
    if (Number.isNaN(passengers) || passengers < 0) {
      setFormError("Passenger count must be a valid non-negative number.");
      return;
    }

    if (draft.milesDriven.trim() !== "" && (Number.isNaN(distance) || distance < 0)) {
      setFormError("Distance must be a valid non-negative number.");
      return;
    }

    const missionRecord: Mission = {
      id: editingId || `M${String(buildNextNumericId(missionData.map((mission) => mission.id))).padStart(3, "0")}`,
      missionOrder: editingId
        ? missionData.find((mission) => mission.id === editingId)?.missionOrder || nextMissionOrder(missionData)
        : nextMissionOrder(missionData),
      vehicleId: selectedVehicle.id,
      plateNumber: selectedVehicle.plateNumber,
      vehicleType: selectedVehicle.type,
      driver: draft.driver.trim(),
      requestingUnit: draft.requestingUnit.trim(),
      origin: draft.origin.trim(),
      destination: draft.destination.trim(),
      departureTime: formatForStore(draft.departureTime.trim()),
      eta: formatForStore(draft.eta.trim()),
      status: draft.status,
      cargo: draft.cargo.trim(),
      passengers,
      milesDriven: Number.isNaN(distance) ? undefined : distance,
    };

    setMissionData((previous) => {
      if (!editingId) return [missionRecord, ...previous];
      return previous.map((mission) => (mission.id === editingId ? missionRecord : mission));
    });

    syncVehicleStatus(missionRecord);
    syncDriverStatus(missionRecord);

    appendRuntimeAudit({
      id: `AUD-${Date.now()}`,
      timestamp: nowTimestamp(),
      actor: "SSgt. Reyes, J.",
      action: editingId ? "Updated mission movement log" : "Created mission dispatch order",
      module: "Movement Monitoring",
      severity: "Info",
      details: `${missionRecord.missionOrder} set to ${missionStatusMeta[missionRecord.status].label}.`,
    });

    closeModal();
  };

  const exportMissionLog = () => {
    downloadCsv(
      `mission-log-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredMissions,
      [
        { header: "Mission Order", value: (mission) => mission.missionOrder },
        { header: "Vehicle", value: (mission) => mission.plateNumber },
        { header: "Vehicle Type", value: (mission) => mission.vehicleType },
        { header: "Driver", value: (mission) => mission.driver },
        { header: "Requesting Unit", value: (mission) => mission.requestingUnit },
        { header: "Origin", value: (mission) => mission.origin },
        { header: "Destination", value: (mission) => mission.destination },
        { header: "Time Out", value: (mission) => mission.departureTime },
        { header: "Time In / ETA", value: (mission) => mission.eta },
        { header: "Status", value: (mission) => missionStatusMeta[mission.status].label },
        { header: "Cargo", value: (mission) => mission.cargo },
        { header: "Passengers", value: (mission) => mission.passengers },
      ]
    );
  };

  const downloadDispatchOrder = (mission: Mission) => {
    downloadTextFile(
      `${mission.missionOrder}.txt`,
      `Mission Order: ${mission.missionOrder}\nVehicle: ${mission.plateNumber}\nDriver: ${mission.driver}\nRequesting Unit: ${mission.requestingUnit}\nRoute: ${mission.origin} -> ${mission.destination}\nTime Out: ${mission.departureTime}\nETA: ${mission.eta}\nStatus: ${missionStatusMeta[mission.status].label}\nCargo: ${mission.cargo}\nPassengers: ${mission.passengers}`
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Movement Monitoring"
        description="Monitor mission orders, deployed assets, and complete movement records with full traceability."
        rightSlot={
          <>
            <button
              type="button"
              onClick={exportMissionLog}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Export Mission Log
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
            >
              <Plus className="h-4 w-4" />
              New Mission Order
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Active Missions" value={activeMissions} helper="Currently deployed movement orders" icon={Navigation} tone="info" />
        <KpiCard title="Completed Today" value={completedToday} helper="Missions closed in current cycle" icon={CheckCircle2} tone="success" />
        <KpiCard title="Pending Dispatch" value={pendingDispatch} helper="Awaiting release and assignment" icon={CalendarClock} tone="warning" />
        <KpiCard title="Vehicles Deployed" value={deployedVehicles.length} helper="Fleet assets on current mission" icon={Activity} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Mission Orders"
          subtitle="Searchable and filterable mission cards with full movement details."
          className="xl:col-span-2"
          action={<span className="text-xs text-slate-500">{filteredMissions.length} record(s)</span>}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search mission order, vehicle, driver, or route"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "active", "pending", "completed", "cancelled"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={`rounded-lg border px-3 py-2 text-xs capitalize ${
                      filter === status
                        ? "border-[#0d1b2a] bg-[#0d1b2a] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {status === "all" ? "All Missions" : status}
                  </button>
                ))}
              </div>
            </div>

            {filteredMissions.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No mission orders found"
                description="No missions match your selected status filter and search criteria."
              />
            ) : (
              <div className="space-y-3">
                {filteredMissions.slice(0, 6).map((mission) => (
                  <article key={mission.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{mission.missionOrder}</span>
                          <StatusBadge label={missionStatusMeta[mission.status].label} tone={missionStatusMeta[mission.status].tone} />
                        </div>
                        <p className="text-sm font-medium text-slate-800">{mission.plateNumber} - {mission.vehicleType}</p>
                        <p className="mt-1 text-xs text-slate-500">{mission.origin} to {mission.destination}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(mission)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDispatchOrder(mission)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          Dispatch Order
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Weekly Mission Activity" subtitle="Current week dispatch volume by day">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyActivityData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="missions" fill="#1f3e68" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Deployed Vehicles" subtitle="Assets currently assigned to active missions">
            {deployedVehicles.length === 0 ? (
              <EmptyState title="No deployed vehicles" description="Vehicles appear here after setting a mission status to Active." />
            ) : (
              <div className="space-y-3">
                {deployedVehicles.map((vehicle) => (
                  <article key={vehicle.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-800">{vehicle.plateNumber}</p>
                    <p className="text-xs text-slate-500">{vehicle.designation}</p>
                    <p className="mt-1 text-xs text-slate-500">Driver: {vehicle.driver}</p>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {vehicle.location}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="6-Month Mission Trend" subtitle="Mission volume over time">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip {...chartTooltipProps} />
                  <Line type="monotone" dataKey="missions" stroke="#1e6b3c" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Mission Movement Log"
        subtitle="Comprehensive movement control records for review and updates."
        action={<span className="text-xs text-slate-500">{filteredMissions.length} filtered record(s)</span>}
      >
        {filteredMissions.length === 0 ? (
          <EmptyState title="No mission log records found" description="Create a mission order to populate this table." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Mission Order</th>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5">Route</th>
                    <th className="px-3 py-2.5">Time Out</th>
                    <th className="px-3 py-2.5">Time In / ETA</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((mission) => (
                    <tr key={mission.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-medium text-slate-800">{mission.missionOrder}</td>
                      <td className="px-3 py-3">{mission.plateNumber}</td>
                      <td className="px-3 py-3">{mission.driver}</td>
                      <td className="px-3 py-3 text-xs">{mission.origin}<br /><span className="text-slate-500">to {mission.destination}</span></td>
                      <td className="px-3 py-3">{mission.departureTime}</td>
                      <td className="px-3 py-3">{mission.eta}</td>
                      <td className="px-3 py-3"><StatusBadge label={missionStatusMeta[mission.status].label} tone={missionStatusMeta[mission.status].tone} /></td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(mission)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination page={currentPage} totalPages={totalPages} totalItems={filteredMissions.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="mission log" />
          </>
        )}
      </Panel>

      {modalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{editingId ? "Edit Mission Movement Log" : "New Mission Order"}</h3>
                <p className="text-xs text-slate-500">Capture mission dispatch details and status.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {formError ? <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div> : null}

              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Vehicle *</label><select value={draft.vehicleId} onChange={(event) => updateDraft("vehicleId", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"><option value="">Select vehicle</option>{vehicleData.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} - {vehicle.designation}</option>)}</select></div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Driver *</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={draft.driver}
                    onChange={(event) => updateDraft("driver", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Select eligible driver</option>
                    {eligibleMissionDrivers.map((driver) => (
                      <option key={driver.id} value={driver.fullName}>
                        {`${driver.fullName} - ${driver.status}${driver.licenseType ? ` - ${driver.licenseType}` : ""}`}
                      </option>
                    ))}
                    {!eligibleMissionDrivers.some((driver) => driver.fullName === draft.driver) && draft.driver ? (
                      <option value={draft.driver}>{`${draft.driver} - Assigned`}</option>
                    ) : null}
                  </select>
                </div>
                {eligibleMissionDrivers.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-600">No drivers are currently eligible (Available or Coming Available).</p>
                ) : null}
              </div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Requesting Unit *</label><input value={draft.requestingUnit} onChange={(event) => updateDraft("requestingUnit", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Mission Status</label><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as MissionStatus)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Origin *</label><input value={draft.origin} onChange={(event) => updateDraft("origin", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Destination *</label><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Time Out *</label><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="datetime-local" value={draft.departureTime} onChange={(event) => updateDraft("departureTime", event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Time In / ETA *</label><input type="datetime-local" value={draft.eta} onChange={(event) => updateDraft("eta", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Cargo / Purpose *</label><div className="relative"><Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={draft.cargo} onChange={(event) => updateDraft("cargo", event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Passengers (PAX)</label><div className="relative"><Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={draft.passengers} onChange={(event) => updateDraft("passengers", event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div></div>
              <div><label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Distance (km)</label><div className="relative"><Gauge className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={draft.milesDriven} onChange={(event) => updateDraft("milesDriven", event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" /></div></div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={saveMission} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-2 text-sm text-white hover:bg-[#16283d]"><Save className="h-4 w-4" />{editingId ? "Save Changes" : "Create Mission Order"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
