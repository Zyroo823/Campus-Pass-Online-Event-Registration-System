-- ============================================================================
-- Schema: Online Event Registration System (CampusPass)
-- Compatible with MySQL 8.0+ and MariaDB 10.4+ (XAMPP compatible)
-- NFR-007, NFR-008: Strict foreign keys, sensible indexes, cascade rules
-- ============================================================================

CREATE DATABASE IF NOT EXISTS campus_events CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_events;

-- Drop in reverse dependency order
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

-- 1. Users table (FR-001, FR-002, FR-016)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  school_id VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('participant', 'organizer', 'admin') NOT NULL DEFAULT 'participant',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_school_id UNIQUE (school_id),
  INDEX idx_users_role (role),
  INDEX idx_users_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Events table (FR-004, FR-005, FR-006, FR-009, FR-010, FR-011)
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category ENUM(
    'Academic',
    'Sports',
    'Arts & Culture',
    'Career & Networking',
    'Community & Service',
    'Technology & STEM'
  ) NOT NULL,
  venue VARCHAR(150) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  registration_deadline DATETIME NOT NULL,
  capacity INT NOT NULL,
  requires_approval TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('published', 'cancelled') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id)
    REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_events_starts_at (starts_at),
  INDEX idx_events_status (status),
  INDEX idx_events_category (category),
  INDEX idx_events_deadline (registration_deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Registrations table (FR-007, FR-008, FR-012, FR-015, NFR-004)
CREATE TABLE registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'approved',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_event_user UNIQUE (event_id, user_id),
  CONSTRAINT fk_registrations_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_registrations_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_reg_status (status),
  INDEX idx_reg_user (user_id),
  INDEX idx_reg_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Notifications table (FR-013)
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  event_id INT NULL DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE SET NULL,
  INDEX idx_notifications_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
