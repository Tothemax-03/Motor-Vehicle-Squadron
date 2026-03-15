import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Truck,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { DriverProfile, MaintenanceRecord, Mission, UserAccount, Vehicle } from "../data/fleetData";
import { apiClient } from "../data/apiClient";
import {
  clearCurrentSession,
  getCurrentUser,
  getRuntimeAuditTrail,
  getRuntimeDrivers,
  getRuntimeMaintenance,
  getRuntimeMissions,
  getRuntimeUsers,
  getRuntimeVehicles,
  syncRuntimeFromServer,
} from "../data/runtimeStore";

type NavItem = { path: string; icon: typeof LayoutDashboard; label: string; end?: boolean };
type SearchModule = "Vehicles" | "Mission Orders" | "Drivers" | "Work Orders";
type ReadMap = Record<string, boolean>;

interface SearchResultItem {
  id: string;
  module: SearchModule;
  title: string;
  subtitle: string;
  route: string;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  route: string;
}

const operationsNav: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { path: "/movement", icon: Truck, label: "Vehicle Movement Logs" },
  { path: "/maintenance", icon: Wrench, label: "Maintenance Monitoring" },
  { path: "/fleet", icon: ClipboardList, label: "Vehicle Management" },
  { path: "/drivers", icon: IdCard, label: "Driver Management" },
  { path: "/reports", icon: BarChart3, label: "Reports & Analytics" },
];

const adminNav: NavItem[] = [
  { path: "/users", icon: Users, label: "User Management" },
  { path: "/activity-logs", icon: History, label: "Activity Logs / Audit" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard Overview", subtitle: "Operational status, readiness analytics, and command alerts" },
  "/movement": { title: "Vehicle Movement Monitoring", subtitle: "Mission dispatch tracking, route monitoring, and movement logs" },
  "/maintenance": { title: "Vehicle Maintenance Monitoring", subtitle: "Work orders, maintenance queue, and cost analytics" },
  "/fleet": { title: "Vehicle Management", subtitle: "Fleet registry, assignment profile, and service readiness" },
  "/drivers": { title: "Driver Management", subtitle: "Driver roster, licensing, and mission assignment readiness" },
  "/reports": { title: "Reports and Analytics", subtitle: "Executive reporting dashboard and document library" },
  "/users": { title: "User Management", subtitle: "Access control, user roles, and account lifecycle" },
  "/settings": { title: "System Settings", subtitle: "Platform configuration, security controls, and preferences" },
  "/activity-logs": { title: "Activity Logs / Audit Trail", subtitle: "System event traceability and compliance records" },
};

const workOrderStatusLabel: Record<MaintenanceRecord["status"], string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  overdue: "Overdue",
};

function getCurrentDate() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function getCurrentTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function parseDateValue(value: string | undefined | null) {
  if (!value || value === "Never") return null;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelativeTime(value: string) {
  const date = parseDateValue(value);
  if (!date) return value || "N/A";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function containsTerm(term: string, values: Array<string | number | undefined | null>) {
  return values.filter((v) => v !== undefined && v !== null).join(" ").toLowerCase().includes(term);
}

function buildSearchResults(query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return [] as SearchResultItem[];

  const results: SearchResultItem[] = [];
  getRuntimeVehicles().forEach((vehicle: Vehicle) => {
    if (containsTerm(term, [vehicle.id, vehicle.plateNumber, vehicle.designation, vehicle.type, vehicle.driver, vehicle.status])) {
      results.push({
        id: `vehicle-${vehicle.id}`,
        module: "Vehicles",
        title: `${vehicle.plateNumber} - ${vehicle.designation}`,
        subtitle: `${vehicle.type} - ${vehicle.status}`,
        route: "/fleet",
      });
    }
  });

  getRuntimeMissions().forEach((mission: Mission) => {
    if (containsTerm(term, [mission.id, mission.missionOrder, mission.plateNumber, mission.driver, mission.origin, mission.destination])) {
      results.push({
        id: `mission-${mission.id}`,
        module: "Mission Orders",
        title: `${mission.missionOrder} - ${mission.plateNumber}`,
        subtitle: `${mission.driver} - ${mission.origin} to ${mission.destination}`,
        route: "/movement",
      });
    }
  });

  getRuntimeDrivers().forEach((driver: DriverProfile) => {
    if (containsTerm(term, [driver.id, driver.fullName, driver.licenseNumber, driver.licenseType, driver.assignedVehicle, driver.status])) {
      results.push({
        id: `driver-${driver.id}`,
        module: "Drivers",
        title: driver.fullName,
        subtitle: `${driver.status} - ${driver.licenseNumber}`,
        route: "/drivers",
      });
    }
  });

  getRuntimeMaintenance().forEach((record: MaintenanceRecord) => {
    if (containsTerm(term, [record.id, record.title, record.description, record.plateNumber, record.vehicleType, record.technician])) {
      results.push({
        id: `work-order-${record.id}`,
        module: "Work Orders",
        title: `${record.id} - ${record.plateNumber}`,
        subtitle: `${workOrderStatusLabel[record.status]} - ${record.title || record.description}`,
        route: "/maintenance",
      });
    }
  });

  return results.slice(0, 12);
}

function buildNotifications(currentUser: UserAccount | null) {
  const notices: NotificationItem[] = [];
  const users = getRuntimeUsers();
  const vehicles = getRuntimeVehicles();
  const missions = getRuntimeMissions();
  const workOrders = getRuntimeMaintenance();
  const drivers = getRuntimeDrivers();
  const auditTrail = getRuntimeAuditTrail();

  if (currentUser?.role === "Admin") {
    users.filter((user) => user.status === "Pending").slice(0, 3).forEach((user) => {
      notices.push({
        id: `pending-user-${user.id}`,
        title: "New user request pending approval",
        description: `${user.fullName} (${user.email}) is awaiting approval.`,
        timestamp: user.createdAt,
        route: "/users",
      });
    });
  }

  const dueThreshold = new Date();
  dueThreshold.setDate(dueThreshold.getDate() + 7);
  vehicles.filter((vehicle) => {
    const due = parseDateValue(vehicle.nextMaintenance);
    return !!due && due <= dueThreshold;
  }).slice(0, 3).forEach((vehicle) => {
    notices.push({
      id: `maintenance-${vehicle.id}`,
      title: "Vehicle due for maintenance",
      description: `${vehicle.plateNumber} service target date: ${vehicle.nextMaintenance}.`,
      timestamp: vehicle.nextMaintenance,
      route: "/maintenance",
    });
  });

  [...missions].sort((a, b) => (parseDateValue(b.departureTime)?.getTime() || 0) - (parseDateValue(a.departureTime)?.getTime() || 0))
    .slice(0, 3).forEach((mission) => {
      notices.push({
        id: `mission-${mission.id}`,
        title: "New mission order created",
        description: `${mission.missionOrder} assigned to ${mission.plateNumber}.`,
        timestamp: mission.departureTime,
        route: "/movement",
      });
    });

  [...workOrders].filter((record) => record.status !== "pending")
    .sort((a, b) => (parseDateValue(b.dateCreated || b.scheduledDate)?.getTime() || 0) - (parseDateValue(a.dateCreated || a.scheduledDate)?.getTime() || 0))
    .slice(0, 3).forEach((record) => {
      notices.push({
        id: `work-order-${record.id}-${record.status}`,
        title: "Work order status updated",
        description: `${record.id} for ${record.plateNumber} is ${workOrderStatusLabel[record.status]}.`,
        timestamp: record.completedDate || record.dateCreated || record.scheduledDate,
        route: "/maintenance",
      });
    });

  drivers.filter((driver) => driver.status === "Coming Available").slice(0, 3).forEach((driver) => {
    notices.push({
      id: `driver-available-${driver.id}`,
      title: "Driver becoming available",
      description: `${driver.fullName} is marked Coming Available.`,
      timestamp: driver.lastDispatch || "",
      route: "/drivers",
    });
  });

  auditTrail.filter((entry) => entry.severity === "Critical").slice(0, 2).forEach((entry) => {
    notices.push({
      id: `audit-${entry.id}`,
      title: "Critical system activity",
      description: `${entry.module}: ${entry.action}`,
      timestamp: entry.timestamp,
      route: "/activity-logs",
    });
  });

  return Array.from(new Map(notices.map((notice) => [notice.id, notice])).values())
    .sort((a, b) => (parseDateValue(b.timestamp)?.getTime() || 0) - (parseDateValue(a.timestamp)?.getTime() || 0))
    .slice(0, 14);
}

function getReadStorageKey(userId: string) {
  return `mvsm_notification_reads_${userId}`;
}

function readStoredReadMap(key: string): ReadMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ReadMap) : {};
  } catch {
    return {};
  }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [readMap, setReadMap] = useState<ReadMap>({});
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(target)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const synced = await syncRuntimeFromServer();
        if (!mounted) return;
        if (!synced) return navigate("/login", { replace: true });
        const user = getCurrentUser();
        if (!user) return navigate("/login", { replace: true });
        setCurrentUser(user);
        setRefreshTick((previous) => previous + 1);
      } catch {
        if (mounted) navigate("/login", { replace: true });
      }
    })();
    return () => { mounted = false; };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setRefreshTick((previous) => previous + 1), 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  const readStorageKey = currentUser ? getReadStorageKey(currentUser.id) : "";
  useEffect(() => { if (readStorageKey) setReadMap(readStoredReadMap(readStorageKey)); }, [readStorageKey]);
  useEffect(() => { if (readStorageKey && typeof window !== "undefined") window.localStorage.setItem(readStorageKey, JSON.stringify(readMap)); }, [readMap, readStorageKey]);

  const searchResults = useMemo(() => buildSearchResults(searchValue), [searchValue, refreshTick]);
  const notifications = useMemo(() => buildNotifications(currentUser), [currentUser, refreshTick]);
  const notificationsWithRead = useMemo(() => notifications.map((item) => ({ ...item, read: !!readMap[item.id] })), [notifications, readMap]);
  const unreadCount = notificationsWithRead.filter((item) => !item.read).length;
  const meta = pageMeta[location.pathname] ?? pageMeta["/"];
  const roleBadgeClass = currentUser?.role === "Admin" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const handleSignOut = () => {
    (async () => {
      try { await apiClient.auth.logout(); } catch { /* ignore */ }
      clearCurrentSession();
      navigate("/login", { replace: true });
    })();
  };

  const selectSearchResult = (result: SearchResultItem) => {
    setSearchOpen(false);
    setSearchValue("");
    navigate(result.route);
  };

  const markRead = (id: string) => setReadMap((previous) => ({ ...previous, [id]: true }));
  const markAllRead = () => setReadMap((previous) => {
    const next = { ...previous };
    notificationsWithRead.forEach((item) => { next[item.id] = true; });
    return next;
  });

  if (!currentUser) return <div className="h-screen bg-slate-100" />;

  const renderNavSection = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.14em] text-slate-300/55">{title}</p>
      ) : null}
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
              isActive
                ? "bg-gradient-to-r from-emerald-700/95 to-emerald-600/95 text-white shadow-[0_8px_18px_-12px_rgba(16,185,129,0.8)]"
                : "text-slate-200/75 hover:bg-white/8 hover:text-white"
            }`
          }
          title={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <>
              {isActive ? <span className="absolute -left-0.5 h-5 w-1 rounded-r-full bg-emerald-300" /> : null}
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {mobileOpen ? <div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`fixed z-50 flex h-full flex-col border-r border-slate-800/40 bg-gradient-to-b from-[#071423] via-[#091a2f] to-[#0a1f35] text-white transition-all duration-300 ease-out lg:relative ${collapsed ? "w-[86px]" : "w-[292px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700/90 shadow-inner shadow-emerald-200/10"><Shield className="h-5 w-5" /></div>
            {!collapsed ? <div className="overflow-hidden"><p className="truncate text-[11px] uppercase tracking-[0.16em] text-emerald-300">MVSMS Command</p><p className="truncate text-sm text-white">Motor Vehicle Squadron</p></div> : null}
          </div>
          {!collapsed ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-200/85"><BadgeCheck className="h-3.5 w-3.5 text-emerald-300" />Enterprise Operations Console</div> : null}
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">{renderNavSection("Operations", operationsNav)}{renderNavSection("Administration", adminNav)}</nav>
        <div className="border-t border-white/10 px-3 py-3"><button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200/75 transition-colors hover:bg-white/8 hover:text-white" title={collapsed ? "Sign Out" : undefined}><LogOut className="h-4 w-4 shrink-0" />{!collapsed ? <span>Sign Out</span> : null}</button></div>
        <button onClick={() => setCollapsed((previous) => !previous)} className="absolute -right-3 top-20 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-100 lg:flex" type="button">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-lg lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileOpen((previous) => !previous)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" type="button">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
              <div ref={searchRef} className="relative hidden md:block">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:min-w-[340px]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={searchValue} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchValue(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && searchResults.length) { event.preventDefault(); selectSearchResult(searchResults[0]); } }} placeholder="Search plate number, mission order, driver, or work order" className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none" />
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400"><Command className="h-3 w-3" />K</span>
                </div>
                {searchOpen && searchValue.trim() ? <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div className="max-h-80 overflow-y-auto py-1.5">{searchResults.length === 0 ? <div className="px-3 py-5 text-center text-sm text-slate-500">No matching records found</div> : searchResults.map((result) => <button key={result.id} type="button" onClick={() => selectSearchResult(result)} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{result.title}</p><p className="truncate text-xs text-slate-500">{result.subtitle}</p></div><span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">{result.module}</span></button>)}</div></div> : null}
              </div>
              <div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-tight text-slate-900 lg:text-lg">{meta.title}</h1><p className="truncate text-xs text-slate-500">{meta.subtitle}</p></div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />System Online</div>
              <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 lg:flex"><Activity className="h-3.5 w-3.5" />Last sync {getCurrentTime()}</div>
              <div ref={notificationRef} className="relative">
                <button className="relative rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-100" type="button" onClick={() => setNotificationsOpen((previous) => !previous)}><Bell className="h-4 w-4" />{unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button>
                {notificationsOpen ? <div className="absolute right-0 top-full z-50 mt-2 w-[360px] rounded-xl border border-slate-200 bg-white shadow-lg"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-medium text-slate-800">System Notifications</p><p className="text-xs text-slate-500">{unreadCount} unread alert(s)</p></div><button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="text-xs text-slate-600 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300">Mark all as read</button></div><div className="max-h-[340px] overflow-y-auto">{notificationsWithRead.length === 0 ? <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications available.</div> : notificationsWithRead.map((notification) => <article key={notification.id} className={`border-b border-slate-100 px-4 py-3 ${notification.read ? "bg-white" : "bg-blue-50/35"}`}><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => { markRead(notification.id); setNotificationsOpen(false); navigate(notification.route); }} className="min-w-0 flex-1 text-left"><p className="text-sm font-medium text-slate-800">{notification.title}</p><p className="mt-0.5 text-xs text-slate-600">{notification.description}</p><p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(notification.timestamp)}</p></button>{!notification.read ? <button type="button" onClick={() => markRead(notification.id)} className="shrink-0 text-[11px] text-slate-600 hover:text-slate-800">Mark as read</button> : <span className="shrink-0 text-[11px] text-slate-400">Read</span>}</div></article>)}</div><div className="border-t border-slate-100 px-4 py-2"><button type="button" onClick={() => { setNotificationsOpen(false); navigate("/activity-logs"); }} className="text-xs text-slate-600 hover:text-slate-800">View full activity logs</button></div></div> : null}
              </div>
              <div ref={userMenuRef} className="relative">
                <button onClick={() => setUserMenuOpen((previous) => !previous)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:bg-slate-50" type="button"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b1728]"><User className="h-4 w-4 text-white" /></div><div className="hidden sm:block"><p className="text-sm text-slate-800">{currentUser.fullName}</p><div className="mt-0.5 flex items-center gap-1.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleBadgeClass}`}>{currentUser.role}</span></div></div><ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" /></button>
                {userMenuOpen ? <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"><div className="border-b border-slate-100 px-4 py-3"><p className="text-sm font-medium text-slate-800">{currentUser.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{currentUser.email}</p><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleBadgeClass}`}>Role: {currentUser.role}</span></div><button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" type="button" onClick={() => { setUserMenuOpen(false); navigate("/users"); }}>User Profile</button><button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" type="button" onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}>Preferences</button><hr className="my-1 border-slate-100" /><button onClick={handleSignOut} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" type="button">Sign Out</button></div> : null}
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white/80 px-4 py-1.5 text-xs text-slate-500 lg:px-6">{getCurrentDate()}</div>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
