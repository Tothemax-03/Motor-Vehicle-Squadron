
const state = {
  user: null,
  vehicles: [],
  drivers: [],
  movements: [],
  maintenance: [],
  fleetStatusCard: 'all',
  reportSnapshots: {
    usage: [],
    maintenance: []
  }
};

const SECTION_TITLES = {
  dashboard: 'Dashboard Overview',
  movements: 'Vehicle Movement Monitoring',
  maintenance: 'Vehicle Maintenance Monitoring',
  vehicles: 'Fleet Registry',
  reports: 'Reports & Analytics',
  drivers: 'Driver Management'
};

const chartRefs = {};

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authMessage = document.getElementById('authMessage');
const alertBox = document.getElementById('alertBox');
const sectionTitle = document.getElementById('sectionTitle');
const dashboardDate = document.getElementById('dashboardDate');

const CARGO_PRESETS = [
  'Relief supplies',
  'Medical equipment',
  'Engineering tools',
  'Communication kits',
  'Food and water stock',
  'Personnel support cargo'
];

const FORM_DEFAULT_SUBMIT_LABEL = {
  vehicleForm: 'Save Vehicle',
  driverForm: 'Save',
  movementForm: 'Save Mission',
  maintenanceForm: 'Save Work Order'
};

async function apiFetch(url, options = {}) {
  const requestOptions = { ...options };
  if (!requestOptions.headers) requestOptions.headers = {};

  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !requestOptions.headers['Content-Type']) {
    requestOptions.headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, requestOptions);

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.message || 'Request failed.');
  }

  return data;
}

function showAlert(type, message, target = alertBox) {
  target.innerHTML = `<div class="alert alert-${type} py-2">${message}</div>`;
  setTimeout(() => {
    target.innerHTML = '';
  }, 3600);
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setSubmitLabel(formId, text) {
  const submitButton = document.querySelector(`#${formId} button[type="submit"]`);
  if (submitButton) {
    submitButton.textContent = text;
  }
}

function resetCrudForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.reset();
  if (form.id) form.id.value = '';
  setSubmitLabel(formId, FORM_DEFAULT_SUBMIT_LABEL[formId] || 'Save');
}

function setAuthState(authenticated) {
  authView.classList.toggle('d-none', authenticated);
  appView.classList.toggle('d-none', !authenticated);
}

function encodeRowData(row) {
  return encodeURIComponent(JSON.stringify(row));
}

function decodeRowData(data) {
  return JSON.parse(decodeURIComponent(data));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function toDateTimeLocalValue(value) {
  if (!value) return '';

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  if (typeof value === 'string') {
    return value.trim().replace(' ', 'T').slice(0, 16);
  }

  return '';
}

function toCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status) {
  const map = {
    Available: 'success',
    'In Use': 'primary',
    Maintenance: 'warning',
    Pending: 'secondary',
    Ongoing: 'warning',
    Completed: 'success',
    Returned: 'success',
    Dispatched: 'info',
    Delayed: 'danger',
    'En Route': 'primary',
    Active: 'success',
    Inactive: 'secondary'
  };
  return `<span class="badge text-bg-${map[status] || 'secondary'} badge-status">${status}</span>`;
}

function pillTag(label, variant) {
  return `<span class="pill-tag ${variant}">${label}</span>`;
}

function setupPasswordToggles() {
  document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = `<i class="bi ${isHidden ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}

function downloadFileFromResponse(response, blob, fallbackName) {
  const disposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
  const fileName = fileNameMatch?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = objectUrl;
  tempLink.download = fileName;
  document.body.appendChild(tempLink);
  tempLink.click();
  tempLink.remove();
  URL.revokeObjectURL(objectUrl);
}

async function handleExportClick(event) {
  event.preventDefault();
  const link = event.currentTarget;
  const href = link.getAttribute('href');
  if (!href || href === '#') return;

  try {
    const response = await fetch(href);
    if (!response.ok) {
      let message = 'Export failed.';
      const isJson = response.headers.get('content-type')?.includes('application/json');
      if (isJson) {
        const errorBody = await response.json();
        message = errorBody?.message || message;
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const fallbackName = href.includes('pdf') ? 'report.pdf' : href.includes('csv') ? 'report.csv' : 'analytics_pack.json';
    downloadFileFromResponse(response, blob, fallbackName);
    showAlert('success', 'Export file downloaded successfully.');
  } catch (error) {
    showAlert('danger', error.message);
  }
}

function bindExportLinks() {
  document.querySelectorAll('[data-export-link]').forEach((link) => {
    if (link.dataset.exportBound === '1') return;
    link.dataset.exportBound = '1';
    link.addEventListener('click', handleExportClick);
  });
}

function updateSectionHeader(section) {
  sectionTitle.textContent = SECTION_TITLES[section] || 'Dashboard Overview';
  if (section === 'dashboard') {
    dashboardDate.textContent = formatLongDate();
    dashboardDate.classList.remove('d-none');
  } else {
    dashboardDate.classList.add('d-none');
  }
}

function getVehicleById(vehicleId) {
  return state.vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId)) || null;
}

function getDriverById(driverId) {
  return state.drivers.find((driver) => Number(driver.id) === Number(driverId)) || null;
}

function getLatestMovementForVehicle(vehicleId) {
  return state.movements
    .filter((movement) => Number(movement.vehicle_id) === Number(vehicleId))
    .sort((a, b) => new Date(b.time_out || 0) - new Date(a.time_out || 0))[0];
}

function getNextMaintenanceForVehicle(vehicleId) {
  return state.maintenance
    .filter((record) => Number(record.vehicle_id) === Number(vehicleId) && record.next_due_date)
    .sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date))[0];
}

function estimatedMileage(vehicle) {
  return 12000 + Number(vehicle.id) * 2870 + (vehicle.model || '').length * 90;
}

function estimatedFuelLevel(vehicle) {
  const seed = (Number(vehicle.id) * 17 + (vehicle.vehicle_type || '').length * 13 + (vehicle.model || '').length) % 63;
  let base = 32 + seed;
  if (vehicle.status === 'In Use') base -= 16;
  if (vehicle.status === 'Maintenance') base -= 10;
  return clamp(base, 6, 99);
}

function fuelClass(level) {
  if (level >= 60) return 'fuel-high';
  if (level >= 35) return 'fuel-mid';
  return 'fuel-low';
}

function priorityFromMaintenance(record) {
  if (record.status === 'Completed') return 'Low';
  const schedule = new Date(record.scheduled_date);
  const now = new Date();
  schedule.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((schedule - now) / 86400000);

  if (dayDiff < 0) return 'Critical';
  if (dayDiff <= 2) return 'High';
  if (dayDiff <= 7) return 'Medium';
  return 'Low';
}

function progressFromStatus(status) {
  if (status === 'Completed') return 100;
  if (status === 'Ongoing') return 62;
  return 24;
}

function classifyMaintenanceCategory(serviceType = '') {
  const text = serviceType.toLowerCase();
  if (text.includes('engine')) return 'Engine';
  if (text.includes('tire') || text.includes('wheel')) return 'Tires';
  if (text.includes('brake')) return 'Brakes';
  if (text.includes('elect')) return 'Electrical';
  if (text.includes('body') || text.includes('paint')) return 'Body';
  return 'Preventive';
}

function readinessScore(vehicle) {
  const base = vehicle.status === 'Available' ? 88 : vehicle.status === 'In Use' ? 74 : 46;
  const fuel = estimatedFuelLevel(vehicle);
  return clamp(Math.round(base + fuel * 0.1), 25, 99);
}

function enrichVehicle(vehicle) {
  const latestMovement = getLatestMovementForVehicle(vehicle.id);
  const nextMaintenance = getNextMaintenanceForVehicle(vehicle.id);
  const fuelLevel = estimatedFuelLevel(vehicle);
  const location = latestMovement && latestMovement.status !== 'Returned' ? latestMovement.destination : 'Motor Pool HQ';

  return {
    ...vehicle,
    mileage: estimatedMileage(vehicle),
    fuelLevel,
    location,
    nextMaintenanceDate: nextMaintenance?.next_due_date || null,
    readiness: readinessScore(vehicle)
  };
}

function enrichMovement(movement) {
  const vehicle = getVehicleById(movement.vehicle_id);
  const driver = getDriverById(movement.driver_id);
  const vehicleType = vehicle?.vehicle_type || '';

  const paxBase = vehicleType === 'Bus' ? 38 : vehicleType === 'Van' ? 12 : vehicleType === 'Multipurpose Vehicle' ? 7 : 2;
  const pax = Math.max(1, paxBase - (Number(movement.id) % 5));
  const cargo = CARGO_PRESETS[Number(movement.id) % CARGO_PRESETS.length];

  return {
    ...movement,
    missionId: `MO-${String(movement.id).padStart(4, '0')}`,
    route: `HQ -> ${movement.destination}`,
    cargo,
    pax,
    vehicleCode: vehicle?.vehicle_code || 'Unknown',
    plateNumber: vehicle?.plate_number || '-',
    vehicleType: vehicle?.vehicle_type || '-',
    driverName: driver?.name || movement.driver_name || 'Unassigned'
  };
}

function enrichMaintenance(record) {
  const vehicle = getVehicleById(record.vehicle_id);
  const category = classifyMaintenanceCategory(record.service_type);
  const priority = priorityFromMaintenance(record);

  return {
    ...record,
    vehicleCode: vehicle?.vehicle_code || record.vehicle_code || '-',
    plateNumber: vehicle?.plate_number || record.plate_number || '-',
    category,
    priority,
    progress: progressFromStatus(record.status)
  };
}

function upsertChart(key, canvasId, config) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (chartRefs[key]) {
    chartRefs[key].destroy();
  }

  chartRefs[key] = new Chart(canvas, config);
}

function buildMonthBuckets(monthCount) {
  const now = new Date();
  const buckets = [];

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('en-US', { month: 'short' })
    });
  }

  return buckets;
}

function aggregateMovementsByMonth(monthCount) {
  const buckets = buildMonthBuckets(monthCount);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  state.movements.forEach((movement) => {
    if (!movement.time_out) return;
    const date = new Date(movement.time_out);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => counts.get(bucket.key) || 0)
  };
}

function aggregateMovementsByRecentDays(dayCount) {
  const now = new Date();
  const buckets = [];
  const counts = new Map();

  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    buckets.push({ key, label: date.toLocaleString('en-US', { weekday: 'short' }) });
    counts.set(key, 0);
  }

  state.movements.forEach((movement) => {
    if (!movement.time_out) return;
    const key = new Date(movement.time_out).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => counts.get(bucket.key) || 0)
  };
}

function movementQuery() {
  const search = document.getElementById('movementSearchInput')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('movementStatusFilter')?.value || '';
  const vehicleId = document.getElementById('movementVehicleFilter')?.value || '';
  return { search, status, vehicleId };
}

function fleetQuery() {
  const search = document.getElementById('fleetSearchInput')?.value.trim().toLowerCase() || '';
  const type = document.getElementById('fleetTypeFilter')?.value || 'all';
  const status = document.getElementById('fleetStatusFilter')?.value || 'all';
  return { search, type, status };
}

function renderDashboard() {
  const vehicles = state.vehicles.map(enrichVehicle);
  const movements = state.movements.map(enrichMovement).sort((a, b) => new Date(b.time_out || 0) - new Date(a.time_out || 0));
  const maintenance = state.maintenance.map(enrichMaintenance).sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));

  const fleetTotal = vehicles.length;
  const onMission = vehicles.filter((vehicle) => vehicle.status === 'In Use').length;
  const maintenanceQueue = maintenance.filter((record) => record.status !== 'Completed').length;
  const available = vehicles.filter((vehicle) => vehicle.status === 'Available').length;
  const readinessRate = fleetTotal ? Math.round((available / fleetTotal) * 100) : 0;

  document.getElementById('kpiFleetTotal').textContent = fleetTotal;
  document.getElementById('kpiOnMission').textContent = onMission;
  document.getElementById('kpiMaintenanceQueue').textContent = maintenanceQueue;
  document.getElementById('kpiReadinessRate').textContent = readinessRate;

  const safeFleet = Math.max(fleetTotal, 1);
  document.getElementById('kpiOnMissionBar').style.width = `${Math.round((onMission / safeFleet) * 100)}%`;
  document.getElementById('kpiMaintenanceQueueBar').style.width = `${Math.round((maintenanceQueue / safeFleet) * 100)}%`;
  document.getElementById('kpiReadinessBar').style.width = `${readinessRate}%`;

  const monthly = aggregateMovementsByMonth(8);
  upsertChart('dashboardMissionMonthly', 'dashboardMissionMonthlyChart', {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [
        {
          data: monthly.values,
          borderRadius: 6,
          maxBarThickness: 30,
          backgroundColor: '#1e3e6d'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7186a4' } },
        y: { beginAtZero: true, ticks: { color: '#7186a4', stepSize: 5 }, grid: { color: '#e8edf5', borderDash: [4, 3] } }
      }
    }
  });

  const statusPoints = [
    { label: 'Available', value: vehicles.filter((v) => v.status === 'Available').length, color: '#1fbb5c' },
    { label: 'In Use', value: vehicles.filter((v) => v.status === 'In Use').length, color: '#2d7df4' },
    { label: 'Maintenance', value: vehicles.filter((v) => v.status === 'Maintenance').length, color: '#f09819' },
    { label: 'Standby', value: Math.max(0, Math.round(available * 0.25)), color: '#8f45ec' }
  ];

  upsertChart('dashboardFleetStatus', 'dashboardFleetStatusChart', {
    type: 'doughnut',
    data: {
      labels: statusPoints.map((item) => item.label),
      datasets: [
        {
          data: statusPoints.map((item) => item.value),
          backgroundColor: statusPoints.map((item) => item.color),
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: { legend: { display: false } }
    }
  });

  document.getElementById('dashboardFleetStatusLegend').innerHTML = statusPoints
    .map((item) => `<li><span><span class="legend-dot" style="background:${item.color}"></span>${item.label}</span><strong>${item.value}</strong></li>`)
    .join('');

  document.getElementById('recentMissionFeed').innerHTML = movements.length
    ? movements
        .slice(0, 6)
        .map(
          (movement) => `
          <article class="feed-item">
            <div class="d-flex justify-content-between align-items-start">
              <h6>${movement.missionId} · ${movement.route}</h6>
              ${statusBadge(movement.status)}
            </div>
            <small>${movement.vehicleCode} (${movement.plateNumber}) · ${movement.driverName}</small>
            <div class="small text-muted mt-1">${formatDateTime(movement.time_out)}</div>
          </article>`
        )
        .join('')
    : '<div class="text-muted px-1 py-2">No mission activity yet.</div>';

  const queue = maintenance.filter((record) => record.status !== 'Completed').slice(0, 6);
  document.getElementById('dashboardMaintenanceQueue').innerHTML = queue.length
    ? queue
        .map(
          (record) => `
          <article class="queue-item">
            <div class="d-flex justify-content-between align-items-start">
              <h6>WO-${String(record.id).padStart(4, '0')} · ${record.vehicleCode}</h6>
              ${statusBadge(record.status)}
            </div>
            <small>${record.service_type} · ${record.priority} priority</small>
            <div class="small text-muted mt-1">Scheduled ${formatDate(record.scheduled_date)}</div>
          </article>`
        )
        .join('')
    : '<div class="text-muted px-1 py-2">No maintenance queue items.</div>';

  document.getElementById('fleetQuickStatusBody').innerHTML = vehicles.length
    ? vehicles
        .map(
          (vehicle) => `
          <tr>
            <td>${vehicle.vehicle_code} (${vehicle.plate_number})</td>
            <td>${statusBadge(vehicle.status)}</td>
            <td>${vehicle.location}</td>
            <td>
              <div class="fuel-meter">
                <div class="fuel-track"><span class="fuel-bar ${fuelClass(vehicle.fuelLevel)}" style="width:${vehicle.fuelLevel}%"></span></div>
                <small>${vehicle.fuelLevel}%</small>
              </div>
            </td>
            <td><span class="quick-ready">${vehicle.readiness}%</span></td>
            <td>${formatDate(vehicle.nextMaintenanceDate)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="text-center text-muted py-3">No fleet data available.</td></tr>';
}

function filteredMovements() {
  const query = movementQuery();
  return state.movements
    .map(enrichMovement)
    .filter((movement) => {
      const searchable = `${movement.missionId} ${movement.vehicleCode} ${movement.plateNumber} ${movement.driverName} ${movement.destination} ${movement.route}`.toLowerCase();
      const searchMatch = !query.search || searchable.includes(query.search);
      const statusMatch = !query.status || movement.status === query.status;
      const vehicleMatch = !query.vehicleId || Number(movement.vehicle_id) === Number(query.vehicleId);
      return searchMatch && statusMatch && vehicleMatch;
    })
    .sort((a, b) => new Date(b.time_out || 0) - new Date(a.time_out || 0));
}

function renderMovementMonitoring() {
  const rows = filteredMovements();

  document.getElementById('missionOrderCards').innerHTML = rows.length
    ? rows
        .map(
          (movement) => `
          <article class="mission-order-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="mb-1">${movement.missionId} · ${movement.route}</h6>
                <small>${movement.vehicleCode} (${movement.plateNumber}) · ${movement.driverName}</small>
              </div>
              ${statusBadge(movement.status)}
            </div>
            <div class="mission-meta">
              ${pillTag(movement.vehicleType, 'pill-info')}
              ${pillTag(`${movement.pax} PAX`, 'pill-violet')}
              ${pillTag(movement.cargo, 'pill-warn')}
            </div>
            <button class="btn btn-sm btn-link px-0 mt-1" type="button" data-bs-toggle="collapse" data-bs-target="#missionDetail${movement.id}">View full details</button>
            <div class="collapse" id="missionDetail${movement.id}">
              <div class="pt-2 small text-muted">
                <div><strong>Route:</strong> ${movement.route}</div>
                <div><strong>Cargo:</strong> ${movement.cargo}</div>
                <div><strong>PAX:</strong> ${movement.pax}</div>
                <div><strong>Time Out:</strong> ${formatDateTime(movement.time_out)}</div>
                <div><strong>Time In:</strong> ${formatDateTime(movement.time_in)}</div>
                <div><strong>Notes:</strong> ${movement.notes || '-'}</div>
              </div>
            </div>
          </article>`
        )
        .join('')
    : '<div class="text-muted px-1 py-2">No mission orders match the filter.</div>';

  const deployed = state.vehicles
    .map(enrichVehicle)
    .filter((vehicle) => vehicle.status === 'In Use')
    .map((vehicle) => {
      const lastMovement = getLatestMovementForVehicle(vehicle.id);
      const driver = lastMovement ? getDriverById(lastMovement.driver_id) : null;
      return { vehicle, lastMovement, driver };
    });

  document.getElementById('deployedVehiclesPanel').innerHTML = deployed.length
    ? deployed
        .map(
          (item) => `
          <article class="deployed-item">
            <div class="d-flex justify-content-between align-items-start">
              <h6>${item.vehicle.vehicle_code}</h6>
              ${statusBadge('In Use')}
            </div>
            <small>${item.vehicle.plate_number} · ${item.driver?.name || 'No driver assigned'}</small>
            <div class="small text-muted mt-1">${item.lastMovement?.destination || 'No destination'}</div>
          </article>`
        )
        .join('')
    : '<div class="text-muted px-1 py-2">No deployed vehicles right now.</div>';

  const weekly = aggregateMovementsByRecentDays(7);
  upsertChart('movementWeekly', 'movementWeeklyChart', {
    type: 'bar',
    data: {
      labels: weekly.labels,
      datasets: [
        {
          data: weekly.values,
          borderRadius: 6,
          maxBarThickness: 28,
          backgroundColor: '#2d7df4'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b809f' } },
        y: { beginAtZero: true, ticks: { color: '#6b809f', stepSize: 1 }, grid: { color: '#e8edf5' } }
      }
    }
  });

  const trend = aggregateMovementsByMonth(6);
  upsertChart('movementTrend', 'movementTrendChart', {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [
        {
          data: trend.values,
          fill: false,
          borderWidth: 3,
          borderColor: '#1e3e6d',
          pointRadius: 4,
          pointBackgroundColor: '#1e3e6d',
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b809f' }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#6b809f', stepSize: 2 }, grid: { color: '#e8edf5' } }
      }
    }
  });

  document.getElementById('movementsTable').innerHTML = rows.length
    ? rows
        .map(
          (movement) => `
          <tr>
            <td>${movement.missionId}</td>
            <td>${movement.vehicleCode}</td>
            <td>${movement.route}</td>
            <td>${movement.cargo}</td>
            <td>${movement.pax}</td>
            <td>${movement.driverName}</td>
            <td>${formatDateTime(movement.time_out)}</td>
            <td>${formatDateTime(movement.time_in)}</td>
            <td>${statusBadge(movement.status)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick='editMovement("${encodeRowData(movement)}")'>Edit</button></td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="10" class="text-center text-muted py-3">No movement records found.</td></tr>';
}

function renderMaintenanceMonitoring() {
  const rows = state.maintenance.map(enrichMaintenance).sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0));

  const overdue = rows.filter((record) => record.priority === 'Critical' && record.status !== 'Completed');
  const overdueBanner = document.getElementById('overdueBanner');
  if (overdue.length > 0) {
    overdueBanner.classList.remove('d-none');
    overdueBanner.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i><strong>${overdue.length}</strong> overdue work order(s) require immediate action.`;
  } else {
    overdueBanner.classList.add('d-none');
    overdueBanner.innerHTML = '';
  }

  document.getElementById('workOrderCards').innerHTML = rows.length
    ? rows
        .slice(0, 10)
        .map((record) => {
          const priorityTag =
            record.priority === 'Critical'
              ? pillTag(record.priority, 'pill-danger')
              : record.priority === 'High'
                ? pillTag(record.priority, 'pill-warn')
                : record.priority === 'Medium'
                  ? pillTag(record.priority, 'pill-info')
                  : pillTag(record.priority, 'pill-ok');

          return `
          <article class="workorder-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="mb-1">WO-${String(record.id).padStart(4, '0')} · ${record.vehicleCode}</h6>
                <small>${record.service_type} · Scheduled ${formatDate(record.scheduled_date)}</small>
              </div>
              ${statusBadge(record.status)}
            </div>
            <div class="workorder-meta">
              ${priorityTag}
              ${pillTag(record.category, 'pill-violet')}
              ${pillTag(`Cost: ${toCurrency(record.cost)}`, 'pill-info')}
            </div>
          </article>`;
        })
        .join('')
    : '<div class="text-muted px-1 py-2">No work orders available.</div>';

  const costByCategory = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + Number(row.cost || 0);
    return acc;
  }, {});

  const categoryLabels = Object.keys(costByCategory);
  const categoryValues = categoryLabels.map((label) => Number(costByCategory[label].toFixed(2)));

  upsertChart('maintenanceCost', 'maintenanceCostChart', {
    type: 'bar',
    data: {
      labels: categoryLabels.length ? categoryLabels : ['No Data'],
      datasets: [
        {
          data: categoryLabels.length ? categoryValues : [0],
          borderRadius: 6,
          backgroundColor: ['#2d6bef', '#1fbb5c', '#f09819', '#8f45ec', '#e04646', '#3f516d']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b809f' }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#6b809f' }, grid: { color: '#e8edf5' } }
      }
    }
  });

  const typeCounts = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});

  const typeLabels = Object.keys(typeCounts);
  const typeValues = typeLabels.map((label) => typeCounts[label]);

  upsertChart('maintenanceType', 'maintenanceTypeChart', {
    type: 'doughnut',
    data: {
      labels: typeLabels.length ? typeLabels : ['No Data'],
      datasets: [
        {
          data: typeLabels.length ? typeValues : [1],
          backgroundColor: ['#2d7df4', '#1fbb5c', '#f09819', '#8f45ec', '#e04646', '#4f7cb8'],
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '63%',
      plugins: { legend: { display: false } }
    }
  });

  const activeMaintenance = rows.filter((row) => row.status !== 'Completed');
  document.getElementById('vehiclesUnderMaintenancePanel').innerHTML = activeMaintenance.length
    ? activeMaintenance
        .slice(0, 8)
        .map(
          (row) => `
          <article class="progress-item">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <h6>${row.vehicleCode} · ${row.service_type}</h6>
              <small>${row.progress}%</small>
            </div>
            <div class="progress" style="height:8px;">
              <div class="progress-bar ${row.status === 'Ongoing' ? 'bg-warning' : 'bg-secondary'}" style="width:${row.progress}%;"></div>
            </div>
            <small class="d-block mt-1">${row.priority} priority · ${formatDate(row.scheduled_date)}</small>
          </article>`
        )
        .join('')
    : '<div class="text-muted px-1 py-2">No active maintenance tasks.</div>';

  document.getElementById('maintenanceTable').innerHTML = rows.length
    ? rows
        .map((row) => {
          const priorityTag =
            row.priority === 'Critical'
              ? pillTag(row.priority, 'pill-danger')
              : row.priority === 'High'
                ? pillTag(row.priority, 'pill-warn')
                : row.priority === 'Medium'
                  ? pillTag(row.priority, 'pill-info')
                  : pillTag(row.priority, 'pill-ok');

          return `
          <tr>
            <td>WO-${String(row.id).padStart(4, '0')}</td>
            <td>${row.vehicleCode} (${row.plateNumber})</td>
            <td>${row.service_type}</td>
            <td>${priorityTag}</td>
            <td>${statusBadge(row.status)}</td>
            <td>${formatDate(row.scheduled_date)}</td>
            <td>${formatDate(row.next_due_date)}</td>
            <td>${toCurrency(row.cost)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick='editMaintenance("${encodeRowData(row)}")'>Edit</button></td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="9" class="text-center text-muted py-3">No maintenance records found.</td></tr>';
}

function filteredFleetVehicles() {
  const query = fleetQuery();
  const rows = state.vehicles.map(enrichVehicle);
  const cardStatus = state.fleetStatusCard;
  const statusFilter = cardStatus !== 'all' ? cardStatus : query.status;

  return rows.filter((vehicle) => {
    const searchable = `${vehicle.vehicle_code} ${vehicle.plate_number} ${vehicle.vehicle_type} ${vehicle.model} ${vehicle.location}`.toLowerCase();
    const searchMatch = !query.search || searchable.includes(query.search);
    const typeMatch = query.type === 'all' || vehicle.vehicle_type === query.type;
    const statusMatch = statusFilter === 'all' || vehicle.status === statusFilter;
    return searchMatch && typeMatch && statusMatch;
  });
}

function renderFleetStatusSummary() {
  const rows = state.vehicles.map(enrichVehicle);
  const stats = {
    all: rows.length,
    Available: rows.filter((row) => row.status === 'Available').length,
    'In Use': rows.filter((row) => row.status === 'In Use').length,
    Maintenance: rows.filter((row) => row.status === 'Maintenance').length
  };

  const cards = [
    { key: 'all', label: 'All Vehicles' },
    { key: 'Available', label: 'Available' },
    { key: 'In Use', label: 'In Use' },
    { key: 'Maintenance', label: 'Maintenance' }
  ];

  document.getElementById('fleetStatusSummary').innerHTML = cards
    .map(
      (card) => `
      <div class="col-lg-3 col-md-6">
        <article class="fleet-summary-card ${state.fleetStatusCard === card.key ? 'active' : ''}" data-fleet-card="${card.key}">
          <h6>${card.label}</h6>
          <strong>${stats[card.key]}</strong>
        </article>
      </div>`
    )
    .join('');

  document.querySelectorAll('[data-fleet-card]').forEach((card) => {
    card.addEventListener('click', () => {
      state.fleetStatusCard = card.dataset.fleetCard;
      renderFleetRegistry();
    });
  });
}

function renderFleetRegistry() {
  renderFleetStatusSummary();
  const rows = filteredFleetVehicles();

  document.getElementById('vehiclesTable').innerHTML = rows.length
    ? rows
        .map(
          (vehicle) => `
          <tr>
            <td>
              <button class="btn btn-sm btn-light" type="button" data-bs-toggle="collapse" data-bs-target="#vehicleExpand${vehicle.id}">
                <i class="bi bi-chevron-down"></i>
              </button>
            </td>
            <td>${vehicle.vehicle_code}</td>
            <td>${vehicle.plate_number}</td>
            <td>${vehicle.vehicle_type}</td>
            <td>${statusBadge(vehicle.status)}</td>
            <td>${vehicle.location}</td>
            <td>
              <div class="fuel-meter">
                <div class="fuel-track"><span class="fuel-bar ${fuelClass(vehicle.fuelLevel)}" style="width:${vehicle.fuelLevel}%"></span></div>
                <small>${vehicle.fuelLevel}%</small>
              </div>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" onclick='editVehicle("${encodeRowData(vehicle)}")'>Edit</button>
              ${state.user.role === 'Admin' ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteVehicle(${vehicle.id})">Delete</button>` : ''}
            </td>
          </tr>
          <tr class="expand-row">
            <td colspan="8" class="py-0 border-0">
              <div class="collapse" id="vehicleExpand${vehicle.id}">
                <div class="expand-box my-2">
                  <div class="expand-grid">
                    <div><strong>Model:</strong> ${vehicle.model}</div>
                    <div><strong>Mileage:</strong> ${vehicle.mileage.toLocaleString()} km</div>
                    <div><strong>Fuel Level:</strong> ${vehicle.fuelLevel}%</div>
                    <div><strong>Readiness:</strong> ${vehicle.readiness}%</div>
                    <div><strong>Next Maintenance:</strong> ${formatDate(vehicle.nextMaintenanceDate)}</div>
                    <div><strong>Current Location:</strong> ${vehicle.location}</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="8" class="text-center text-muted py-3">No vehicles match the filter.</td></tr>';
}

function renderDrivers() {
  document.getElementById('driversTable').innerHTML = state.drivers.length
    ? state.drivers
        .map(
          (driver) => `
          <tr>
            <td>${driver.name}</td>
            <td>${driver.license_number}</td>
            <td>${driver.phone || '-'}</td>
            <td>${driver.vehicle_code ? `${driver.vehicle_code} (${driver.plate_number})` : '-'}</td>
            <td>${statusBadge(driver.status)}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" onclick='editDriver("${encodeRowData(driver)}")'>Edit</button>
              ${state.user.role === 'Admin' ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteDriver(${driver.id})">Delete</button>` : ''}
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="text-center text-muted py-3">No drivers available.</td></tr>';
}

function renderReportsAnalytics() {
  const monthly = aggregateMovementsByMonth(6);
  const fleet = state.vehicles.map(enrichVehicle);
  const maintenanceRows = state.maintenance.map(enrichMaintenance);

  const readinessBase = fleet.length ? (fleet.filter((row) => row.status === 'Available').length / fleet.length) * 100 : 0;
  const readinessTrend = monthly.values.map((missionCount, index) => {
    const modifier = (monthly.values.length - index) * 0.4;
    return clamp(Math.round(readinessBase + modifier - missionCount * 1.6), 42, 99);
  });

  upsertChart('reportReadiness', 'reportReadinessChart', {
    type: 'line',
    data: {
      labels: monthly.labels,
      datasets: [
        {
          data: readinessTrend,
          borderColor: '#1fbb5c',
          backgroundColor: 'rgba(31, 187, 92, 0.2)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b809f' } },
        y: { beginAtZero: false, min: 40, max: 100, ticks: { color: '#6b809f' }, grid: { color: '#e8edf5' } }
      }
    }
  });

  const maintenanceByMonth = buildMonthBuckets(6).map((bucket) => {
    const total = maintenanceRows
      .filter((record) => record.scheduled_date?.slice(0, 7) === bucket.key)
      .reduce((sum, record) => sum + Number(record.cost || 0), 0);
    return Number(total.toFixed(2));
  });

  upsertChart('reportMaintenanceCost', 'reportMaintenanceCostChart', {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [
        {
          data: maintenanceByMonth,
          borderRadius: 6,
          backgroundColor: '#f09819'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b809f' } },
        y: { beginAtZero: true, ticks: { color: '#6b809f' }, grid: { color: '#e8edf5' } }
      }
    }
  });

  const typeCounts = ['Bus', 'Truck', 'Van', 'Multipurpose Vehicle'].map((type) =>
    fleet.filter((vehicle) => vehicle.vehicle_type === type).length
  );

  upsertChart('reportFleetComposition', 'reportFleetCompositionChart', {
    type: 'doughnut',
    data: {
      labels: ['Bus', 'Truck', 'Van', 'MPV'],
      datasets: [
        {
          data: typeCounts,
          backgroundColor: ['#2d7df4', '#f09819', '#1fbb5c', '#8f45ec'],
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, color: '#556983' } } }
    }
  });

  upsertChart('reportMissionVolume', 'reportMissionVolumeChart', {
    type: 'line',
    data: {
      labels: monthly.labels,
      datasets: [
        {
          data: monthly.values,
          borderColor: '#2d6bef',
          backgroundColor: '#2d6bef',
          fill: false,
          tension: 0.3,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b809f' } },
        y: { beginAtZero: true, ticks: { color: '#6b809f' }, grid: { color: '#e8edf5' } }
      }
    }
  });

  const documents = [
    { name: 'Analytics Pack', category: 'Executive', format: 'JSON', href: '/api/reports/analytics-pack/json' },
    { name: 'Vehicle Usage Report', category: 'Operations', format: 'CSV', href: '/api/reports/vehicle-usage/csv' },
    { name: 'Vehicle Usage Report', category: 'Operations', format: 'PDF', href: '/api/reports/vehicle-usage/pdf' },
    { name: 'Maintenance Report', category: 'Maintenance', format: 'CSV', href: '/api/reports/maintenance/csv' },
    { name: 'Maintenance Report', category: 'Maintenance', format: 'PDF', href: '/api/reports/maintenance/pdf' },
    { name: 'Mission Movement Log Snapshot', category: 'Monitoring', format: 'Live', href: '#' }
  ];

  const today = formatDate(new Date());
  document.getElementById('documentLibraryTable').innerHTML = documents
    .map(
      (doc) => `
      <tr>
        <td>${doc.name}</td>
        <td>${doc.category}</td>
        <td>${today}</td>
        <td>${doc.format}</td>
        <td>${doc.href === '#' ? '<span class="text-muted">In-app view</span>' : `<a href="${doc.href}" data-export-link target="_blank" class="btn btn-sm btn-outline-primary">Open</a>`}</td>
      </tr>`
    )
    .join('');

  bindExportLinks();
}

async function loadReportsSnapshot() {
  try {
    const [usage, maintenance] = await Promise.all([apiFetch('/api/reports/vehicle-usage'), apiFetch('/api/reports/maintenance')]);
    state.reportSnapshots.usage = usage;
    state.reportSnapshots.maintenance = maintenance;
  } catch {
    state.reportSnapshots.usage = [];
    state.reportSnapshots.maintenance = [];
  }

  document.getElementById('vehicleUsageTable').innerHTML = state.reportSnapshots.usage.length
    ? state.reportSnapshots.usage
        .map(
          (item) => `<tr>
            <td>${item.vehicleCode}</td>
            <td>${item.plateNumber}</td>
            <td>${item.totalTrips}</td>
            <td>${item.totalHours || 0}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="text-center text-muted py-3">No report data found.</td></tr>';

  document.getElementById('maintenanceReportTable').innerHTML = state.reportSnapshots.maintenance.length
    ? state.reportSnapshots.maintenance
        .map(
          (item) => `<tr>
            <td>${item.id}</td>
            <td>${item.vehicleCode}</td>
            <td>${formatDate(item.scheduledDate)}</td>
            <td>${statusBadge(item.status)}</td>
            <td>${toCurrency(item.cost)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="5" class="text-center text-muted py-3">No report data found.</td></tr>';
}

function renderCurrentSection(section) {
  if (section === 'dashboard') renderDashboard();
  if (section === 'movements') renderMovementMonitoring();
  if (section === 'maintenance') renderMaintenanceMonitoring();
  if (section === 'vehicles') renderFleetRegistry();
  if (section === 'reports') {
    renderReportsAnalytics();
    loadReportsSnapshot();
  }
  if (section === 'drivers') renderDrivers();
}

function currentSection() {
  return document.querySelector('.section-link.active')?.dataset.section || 'dashboard';
}

function setupNavigation() {
  document.querySelectorAll('.section-link').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.section-link').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');

      const section = button.dataset.section;
      document.querySelectorAll('.section-pane').forEach((pane) => pane.classList.add('d-none'));
      document.getElementById(section).classList.remove('d-none');
      updateSectionHeader(section);
      renderCurrentSection(section);
    });
  });
}

function populateVehicleSelects() {
  const vehicleLabel = (vehicle) => `${vehicle.vehicle_code} - ${vehicle.plate_number}`;
  const options = state.vehicles.map((vehicle) => `<option value="${vehicle.id}">${vehicleLabel(vehicle)}</option>`).join('');

  document.getElementById('movementVehicle').innerHTML = `<option value="">Select Vehicle</option>${options}`;
  document.getElementById('maintenanceVehicle').innerHTML = `<option value="">Select Vehicle</option>${options}`;
  document.getElementById('driverVehicle').innerHTML = `<option value="">Unassigned</option>${options}`;
  document.getElementById('movementVehicleFilter').innerHTML = `<option value="">All Vehicles</option>${options}`;

  const typeSet = new Set(state.vehicles.map((vehicle) => vehicle.vehicle_type));
  const typeOptions = ['<option value="all">All Types</option>', ...Array.from(typeSet).sort().map((type) => `<option value="${type}">${type}</option>`)].join('');
  document.getElementById('fleetTypeFilter').innerHTML = typeOptions;
}

function populateDriverSelect() {
  const options = state.drivers.map((driver) => `<option value="${driver.id}">${driver.name} - ${driver.license_number}</option>`).join('');
  document.getElementById('movementDriver').innerHTML = `<option value="">Select Driver</option>${options}`;
}

async function loadVehicles() {
  state.vehicles = await apiFetch('/api/vehicles');
  populateVehicleSelects();
}

async function loadDrivers() {
  state.drivers = await apiFetch('/api/drivers');
  populateDriverSelect();
  renderDrivers();
}

async function loadMovements() {
  state.movements = await apiFetch('/api/movements');
}

async function loadMaintenance() {
  state.maintenance = await apiFetch('/api/maintenance');
}

async function refreshAll() {
  await loadVehicles();
  await loadDrivers();
  await loadMovements();
  await loadMaintenance();

  renderDashboard();
  renderMovementMonitoring();
  renderMaintenanceMonitoring();
  renderFleetRegistry();
  renderReportsAnalytics();

  if (currentSection() === 'reports') {
    await loadReportsSnapshot();
  }
}

async function initializeApp() {
  document.getElementById('userName').textContent = state.user.fullName;
  document.getElementById('userRole').textContent = state.user.role;
  updateSectionHeader('dashboard');
  setAuthState(true);
  await refreshAll();
}

async function checkSession() {
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.user) {
      state.user = res.user;
      await initializeApp();
    } else {
      setAuthState(false);
    }
  } catch {
    setAuthState(false);
  }
}

async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore API logout error.
  }
  state.user = null;
  setAuthState(false);
}

window.editVehicle = (encodedVehicle) => {
  const vehicle = decodeRowData(encodedVehicle);
  const form = document.getElementById('vehicleForm');
  form.id.value = vehicle.id;
  form.vehicleCode.value = vehicle.vehicle_code;
  form.plateNumber.value = vehicle.plate_number;
  form.vehicleType.value = vehicle.vehicle_type;
  form.model.value = vehicle.model;
  form.status.value = vehicle.status;
  setSubmitLabel('vehicleForm', 'Update Vehicle');
};

window.deleteVehicle = async (id) => {
  if (!confirm('Delete this vehicle?')) return;
  try {
    await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
    showAlert('success', 'Vehicle deleted.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
};

window.editDriver = (encodedDriver) => {
  const driver = decodeRowData(encodedDriver);
  const form = document.getElementById('driverForm');
  form.id.value = driver.id;
  form.name.value = driver.name;
  form.licenseNumber.value = driver.license_number;
  form.phone.value = driver.phone || '';
  form.address.value = driver.address || '';
  form.assignedVehicleId.value = driver.assigned_vehicle_id || '';
  form.status.value = driver.status;
  setSubmitLabel('driverForm', 'Update Driver');
};

window.deleteDriver = async (id) => {
  if (!confirm('Delete this driver?')) return;
  try {
    await apiFetch(`/api/drivers/${id}`, { method: 'DELETE' });
    showAlert('success', 'Driver deleted.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
};

window.editMovement = (encodedMovement) => {
  const movement = decodeRowData(encodedMovement);
  const form = document.getElementById('movementForm');
  form.id.value = movement.id;
  form.vehicleId.value = movement.vehicle_id;
  form.driverId.value = movement.driver_id;
  form.destination.value = movement.destination;
  form.timeOut.value = toDateTimeLocalValue(movement.time_out);
  form.timeIn.value = toDateTimeLocalValue(movement.time_in);
  form.status.value = movement.status;
  form.notes.value = movement.notes || '';
  setSubmitLabel('movementForm', 'Update Mission');
};

window.editMaintenance = (encodedRecord) => {
  const record = decodeRowData(encodedRecord);
  const form = document.getElementById('maintenanceForm');
  form.id.value = record.id;
  form.vehicleId.value = record.vehicle_id;
  form.scheduledDate.value = record.scheduled_date?.slice(0, 10) || '';
  form.serviceType.value = record.service_type;
  form.details.value = record.details || '';
  form.status.value = record.status;
  form.cost.value = record.cost;
  form.nextDueDate.value = record.next_due_date?.slice(0, 10) || '';
  setSubmitLabel('maintenanceForm', 'Update Work Order');
};

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = formToObject(event.target);
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    state.user = data.user;
    await initializeApp();
  } catch (error) {
    showAlert('danger', error.message, authMessage);
  }
});

document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = formToObject(event.target);
    const data = await apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
    state.user = data.user;
    await initializeApp();
  } catch (error) {
    showAlert('danger', error.message, authMessage);
  }
});

document.querySelectorAll('[data-logout]').forEach((btn) => {
  btn.addEventListener('click', handleLogout);
});

document.getElementById('vehicleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formToObject(event.target);
  const id = payload.id;
  delete payload.id;

  try {
    await apiFetch(id ? `/api/vehicles/${id}` : '/api/vehicles', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetCrudForm('vehicleForm');
    showAlert('success', 'Vehicle saved successfully.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
});

document.getElementById('driverForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formToObject(event.target);
  const id = payload.id;
  delete payload.id;

  try {
    await apiFetch(id ? `/api/drivers/${id}` : '/api/drivers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetCrudForm('driverForm');
    showAlert('success', 'Driver saved successfully.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
});

document.getElementById('movementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formToObject(event.target);
  const id = payload.id;
  delete payload.id;

  try {
    await apiFetch(id ? `/api/movements/${id}` : '/api/movements', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetCrudForm('movementForm');
    showAlert('success', 'Mission order saved successfully.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
});

document.getElementById('maintenanceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formToObject(event.target);
  const id = payload.id;
  delete payload.id;

  try {
    await apiFetch(id ? `/api/maintenance/${id}` : '/api/maintenance', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetCrudForm('maintenanceForm');
    showAlert('success', 'Maintenance work order saved successfully.');
    await refreshAll();
  } catch (error) {
    showAlert('danger', error.message);
  }
});

document.getElementById('movementSearchInput').addEventListener('input', renderMovementMonitoring);
document.getElementById('movementStatusFilter').addEventListener('change', renderMovementMonitoring);
document.getElementById('movementVehicleFilter').addEventListener('change', renderMovementMonitoring);
document.getElementById('movementRefreshBtn').addEventListener('click', async () => {
  await loadMovements();
  renderMovementMonitoring();
  renderDashboard();
  renderReportsAnalytics();
});

document.getElementById('fleetSearchInput').addEventListener('input', renderFleetRegistry);
document.getElementById('fleetTypeFilter').addEventListener('change', () => {
  state.fleetStatusCard = 'all';
  renderFleetRegistry();
});
document.getElementById('fleetStatusFilter').addEventListener('change', () => {
  state.fleetStatusCard = 'all';
  renderFleetRegistry();
});

document.getElementById('vehicleNewBtn').addEventListener('click', () => resetCrudForm('vehicleForm'));
document.getElementById('vehicleClearBtn').addEventListener('click', () => resetCrudForm('vehicleForm'));
document.getElementById('driverNewBtn').addEventListener('click', () => resetCrudForm('driverForm'));
document.getElementById('driverClearBtn').addEventListener('click', () => resetCrudForm('driverForm'));
document.getElementById('movementNewBtn').addEventListener('click', () => resetCrudForm('movementForm'));
document.getElementById('movementClearBtn').addEventListener('click', () => resetCrudForm('movementForm'));
document.getElementById('maintenanceNewBtn').addEventListener('click', () => resetCrudForm('maintenanceForm'));
document.getElementById('maintenanceClearBtn').addEventListener('click', () => resetCrudForm('maintenanceForm'));

document.getElementById('notificationBtn').addEventListener('click', () => {
  showAlert('info', 'No new alerts at this time.');
});
document.getElementById('profileBtn').addEventListener('click', () => {
  showAlert('info', 'Profile details are available in User Management.');
});
document.getElementById('settingsBtn').addEventListener('click', () => {
  showAlert('info', 'System settings can be configured by administrators.');
});
document.getElementById('sidebarSettingsBtn').addEventListener('click', () => {
  showAlert('info', 'System settings can be configured by administrators.');
});

setupNavigation();
setupPasswordToggles();
bindExportLinks();
checkSession();


