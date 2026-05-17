-- AttendEase Schema for NeonTech
-- Paste this into the NeonTech SQL editor (or run via psql with your connection string)
-- Do NOT include CREATE DATABASE — NeonTech already created it for you.

CREATE TABLE IF NOT EXISTS students (
    id          TEXT PRIMARY KEY,
    student_id  TEXT UNIQUE NOT NULL,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    course      TEXT NOT NULL,
    year_level  INTEGER NOT NULL,
    profile_image_url TEXT,
    face_encoding TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parents (
    id              TEXT PRIMARY KEY,
    student_id      TEXT REFERENCES students(id),
    name            TEXT NOT NULL,
    phone_number    TEXT NOT NULL,
    relationship_to_student TEXT DEFAULT 'Parent',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
    id              TEXT PRIMARY KEY,
    student_id      TEXT REFERENCES students(id),
    date            TIMESTAMP NOT NULL,
    time_in         TIMESTAMP NOT NULL,
    confidence_score FLOAT,
    camera_id       TEXT,
    status          TEXT DEFAULT 'present',
    is_manual_override BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cameras (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    location    TEXT NOT NULL,
    stream_url  TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    last_ping   TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id              TEXT PRIMARY KEY,
    parent_id       TEXT REFERENCES parents(id),
    attendance_id   TEXT REFERENCES attendance(id),
    message         TEXT NOT NULL,
    status          TEXT DEFAULT 'pending',
    sent_at         TIMESTAMP,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_accounts (
    id              TEXT PRIMARY KEY,
    student_id      TEXT UNIQUE REFERENCES students(id),
    hashed_password TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_accounts (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT DEFAULT 'admin',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_messages (
    id          TEXT PRIMARY KEY,
    student_id  TEXT REFERENCES students(id),
    body        TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
