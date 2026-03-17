CREATE DATABASE IF NOT EXISTS motor_vehicle_squadron;
USE motor_vehicle_squadron;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS maintenance_records;
DROP TABLE IF EXISTS vehicle_movements;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Staff') NOT NULL DEFAULT 'Staff',
  status ENUM('Pending', 'Active', 'Disabled', 'Rejected') NOT NULL DEFAULT 'Pending',
  section VARCHAR(120) NULL,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(24) PRIMARY KEY,
  plate_number VARCHAR(30) NOT NULL UNIQUE,
  designation VARCHAR(120) NOT NULL,
  type VARCHAR(120) NOT NULL,
  category ENUM('bus', 'truck', 'van', 'mpv', 'other') NOT NULL DEFAULT 'other',
  make VARCHAR(120) NOT NULL,
  year INT NOT NULL,
  status ENUM('operational', 'on-mission', 'maintenance', 'non-operational', 'standby') NOT NULL DEFAULT 'operational',
  driver VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  mileage INT NOT NULL DEFAULT 0,
  last_maintenance DATE NOT NULL,
  next_maintenance DATE NOT NULL,
  fuel_level INT NOT NULL DEFAULT 100,
  section VARCHAR(120) NOT NULL,
  location VARCHAR(180) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id VARCHAR(24) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  user_rank VARCHAR(30) NOT NULL,
  license_number VARCHAR(60) NOT NULL UNIQUE,
  license_type VARCHAR(80) NULL,
  license_expiry DATE NOT NULL,
  section VARCHAR(120) NOT NULL,
  assigned_vehicle VARCHAR(30) NOT NULL DEFAULT 'Unassigned',
  status ENUM('Available', 'Coming Available', 'On Mission', 'On Leave', 'Training') NOT NULL DEFAULT 'Available',
  contact_number VARCHAR(30) NOT NULL,
  missions_this_month INT NOT NULL DEFAULT 0,
  last_dispatch VARCHAR(40) NOT NULL DEFAULT 'No dispatch record',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_movements (
  id VARCHAR(24) PRIMARY KEY,
  mission_order VARCHAR(40) NOT NULL UNIQUE,
  vehicle_id VARCHAR(24) NOT NULL,
  plate_number VARCHAR(30) NOT NULL,
  vehicle_type VARCHAR(120) NOT NULL,
  driver VARCHAR(120) NOT NULL,
  requesting_unit VARCHAR(120) NOT NULL,
  origin VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  departure_time DATETIME NOT NULL,
  eta DATETIME NOT NULL,
  status ENUM('active', 'completed', 'pending', 'cancelled') NOT NULL DEFAULT 'pending',
  cargo VARCHAR(180) NOT NULL,
  passengers INT NOT NULL DEFAULT 0,
  miles_driven INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id VARCHAR(24) PRIMARY KEY,
  vehicle_id VARCHAR(24) NOT NULL,
  plate_number VARCHAR(30) NOT NULL,
  vehicle_type VARCHAR(120) NOT NULL,
  title VARCHAR(180) NULL,
  type ENUM('PMCS', 'corrective', 'periodic', 'inspection') NOT NULL DEFAULT 'inspection',
  description TEXT NOT NULL,
  date_created DATE NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_date DATE NULL,
  technician VARCHAR(120) NOT NULL,
  priority ENUM('urgent', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  status ENUM('pending', 'in-progress', 'completed', 'overdue') NOT NULL DEFAULT 'pending',
  estimated_hours INT NOT NULL DEFAULT 1,
  parts_json JSON NULL,
  cost DECIMAL(12, 2) NULL,
  assigned_personnel VARCHAR(120) NULL,
  work_order_type VARCHAR(120) NULL,
  progress_percent INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(24) PRIMARY KEY,
  logged_at DATETIME NOT NULL,
  actor VARCHAR(120) NOT NULL,
  action VARCHAR(255) NOT NULL,
  module_name ENUM('Fleet Registry', 'Movement Monitoring', 'Maintenance', 'Reports', 'User Management', 'Settings') NOT NULL,
  severity ENUM('Info', 'Warning', 'Critical') NOT NULL DEFAULT 'Info',
  details TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE maintenance_records;
TRUNCATE TABLE vehicle_movements;
TRUNCATE TABLE drivers;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (full_name, username, email, password, role, status, section, last_login)
VALUES
  ('System Administrator', 'admin', 'admin@mvsm.com', '$2a$10$52DzAkIeLsU3vAqHXNt2O.zXIVZiBXniUcxqMuKTcVNxiyr7ABe1O', 'Admin', 'Active', 'System Administration', NOW()),
  ('Operations Staff', 'staff', 'staff@mvsm.com', '$2a$10$4ee7g0o.uB4/P75L8MIf4ezv82wg.bgTZlG1nG1Bl6KVb7/OPxsX.', 'Staff', 'Active', 'Operations Section', NOW()),
  ('Juan Dela Cruz', 'juan.delacruz', 'juan@email.com', '$2a$10$4ee7g0o.uB4/P75L8MIf4ezv82wg.bgTZlG1nG1Bl6KVb7/OPxsX.', 'Staff', 'Pending', 'HHC Section', NULL);

INSERT INTO vehicles (
  id, plate_number, designation, type, category, make, year, status, driver,
  mileage, last_maintenance, next_maintenance, fuel_level, section, location
)
VALUES
  ('V001', 'MVS-TRK-01', 'Truck 01', 'Cargo Truck', 'truck', 'Isuzu Forward', 2021, 'operational', 'Juan Dela Cruz', 45210, '2026-02-10', '2026-03-20', 78, 'Alpha Section', 'Motor Pool'),
  ('V002', 'MVS-BUS-02', 'Bus 02', 'Personnel Carrier', 'bus', 'Mitsubishi Rosa', 2020, 'on-mission', 'Maria Santos', 61240, '2026-02-15', '2026-03-18', 64, 'HHC Section', 'En Route'),
  ('V003', 'MVS-VAN-03', 'Van 03', 'Medical Van', 'van', 'Toyota HiAce', 2022, 'maintenance', 'Pedro Ramirez', 28300, '2026-03-01', '2026-03-17', 46, 'Medical Platoon', 'Maintenance Bay'),
  ('V004', 'MVS-MPV-04', 'MPV 04', 'Command MPV', 'mpv', 'Toyota Fortuner', 2024, 'operational', 'Unassigned', 10900, '2026-02-25', '2026-04-02', 91, 'CO Section', 'HQ Motor Bay');

INSERT INTO drivers (
  id, full_name, user_rank, license_number, license_type, license_expiry, section,
  assigned_vehicle, status, contact_number, missions_this_month, last_dispatch
)
VALUES
  ('DRV-001', 'Juan Dela Cruz', 'Cpl', 'DL-MVS-1001', 'Professional 1,2,3', '2026-11-30', 'Alpha Section', 'MVS-TRK-01', 'Available', '09170001001', 8, '2026-03-05 06:30'),
  ('DRV-002', 'Maria Santos', 'Sgt', 'DL-MVS-1002', 'Professional 1,2,3', '2026-10-11', 'HHC Section', 'MVS-BUS-02', 'On Mission', '09170001002', 11, '2026-03-05 07:10'),
  ('DRV-003', 'Pedro Ramirez', 'Cpl', 'DL-MVS-1003', 'Professional 1,2', '2026-08-14', 'Medical Platoon', 'MVS-VAN-03', 'Coming Available', '09170001003', 6, '2026-03-04 10:25');

INSERT INTO vehicle_movements (
  id, mission_order, vehicle_id, plate_number, vehicle_type, driver, requesting_unit, origin,
  destination, departure_time, eta, status, cargo, passengers, miles_driven, created_by
)
VALUES
  ('M001', 'MO-2026-0301', 'V001', 'MVS-TRK-01', 'Cargo Truck', 'Juan Dela Cruz', '3rd Infantry Brigade', 'Camp Capinpin, Tanay', 'City Center', '2026-03-05 06:30:00', '2026-03-05 09:00:00', 'completed', 'Supply Kits', 0, 48, 1),
  ('M002', 'MO-2026-0302', 'V002', 'MVS-BUS-02', 'Personnel Carrier', 'Maria Santos', 'Headquarters Company', 'Camp Capinpin, Tanay', 'Operations Zone', '2026-03-05 07:10:00', '2026-03-05 11:10:00', 'active', 'Personnel Transport', 34, 86, 2);

INSERT INTO maintenance_records (
  id, vehicle_id, plate_number, vehicle_type, title, type, description, date_created, scheduled_date,
  completed_date, technician, priority, status, estimated_hours, parts_json, cost,
  assigned_personnel, work_order_type, progress_percent, created_by
)
VALUES
  ('MNT001', 'V002', 'MVS-BUS-02', 'Personnel Carrier', 'Oil Change - Bus 02', 'periodic', 'Routine oil and filter replacement.', '2026-03-01', '2026-03-08', NULL, 'MSgt. Lacson', 'medium', 'pending', 4, JSON_ARRAY('Engine Oil', 'Oil Filter'), 3500.00, 'Motor Pool Team A', 'Preventive', 0, 1),
  ('MNT002', 'V003', 'MVS-VAN-03', 'Medical Van', 'Brake Inspection - Van 03', 'inspection', 'Brake system inspection and calibration.', '2026-03-02', '2026-03-07', NULL, 'Sgt. Magno', 'high', 'in-progress', 6, JSON_ARRAY('Brake Fluid', 'Brake Pads'), 5200.00, 'Maintenance Bay Team B', 'Corrective', 60, 1);

INSERT INTO activity_logs (id, logged_at, actor, action, module_name, severity, details)
VALUES
  ('AUD-0001', '2026-03-05 08:40:00', 'System Administrator', 'Reviewed pending user request', 'User Management', 'Info', 'Access request from Juan Dela Cruz is pending admin approval.'),
  ('AUD-0002', '2026-03-05 09:15:00', 'Operations Staff', 'Created mission order', 'Movement Monitoring', 'Info', 'Mission order MO-2026-0302 created for Bus 02.');
