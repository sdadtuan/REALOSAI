-- R2-HR — Payroll tables (WIN-2-B)
-- Apply: ./scripts/apply_pg_ddl_payroll_r2_hr.sh

CREATE TABLE IF NOT EXISTS crm_payroll_policy (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    work_weekdays TEXT NOT NULL DEFAULT '0,1,2,3,4',
    shift_start TEXT NOT NULL DEFAULT '08:30',
    shift_end TEXT NOT NULL DEFAULT '17:30',
    break_minutes_default INTEGER NOT NULL DEFAULT 60,
    late_grace_minutes INTEGER NOT NULL DEFAULT 5,
    late_penalty_vnd_per_min INTEGER NOT NULL DEFAULT 5000,
    late_penalty_max_vnd INTEGER NOT NULL DEFAULT 200000,
    standard_hours_per_day REAL NOT NULL DEFAULT 8,
    bonus_mode TEXT NOT NULL DEFAULT 'attendance',
    bonus_pct REAL NOT NULL DEFAULT 5,
    bonus_min_days INTEGER NOT NULL DEFAULT 20,
    overtime_multiplier REAL NOT NULL DEFAULT 1.5,
    weekday_shifts TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_payroll_policy (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_position_payroll (
    position_id INTEGER PRIMARY KEY REFERENCES crm_positions (id) ON DELETE CASCADE,
    rank_level INTEGER NOT NULL DEFAULT 1,
    allowance_vnd INTEGER NOT NULL DEFAULT 0,
    bonus_pct REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_payroll (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    workdays_standard INTEGER NOT NULL DEFAULT 22,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS crm_payroll_line (
    id BIGSERIAL PRIMARY KEY,
    payroll_id BIGINT NOT NULL REFERENCES crm_payroll (id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL,
    base_salary_vnd INTEGER NOT NULL DEFAULT 0,
    hours_worked_total REAL NOT NULL DEFAULT 0,
    late_minutes_total INTEGER NOT NULL DEFAULT 0,
    late_deduction_vnd INTEGER NOT NULL DEFAULT 0,
    position_allowance_vnd INTEGER NOT NULL DEFAULT 0,
    bonus_vnd INTEGER NOT NULL DEFAULT 0,
    net_vnd INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_payroll_line_payroll
    ON crm_payroll_line (payroll_id, staff_id);

CREATE TABLE IF NOT EXISTS crm_attendance (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    check_in TEXT NOT NULL DEFAULT '',
    check_out TEXT NOT NULL DEFAULT '',
    break_minutes INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_crm_attendance_staff_date
    ON crm_attendance (staff_id, work_date);
