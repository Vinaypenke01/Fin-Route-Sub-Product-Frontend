-- ==============================================================================
-- FINROUTE TENANT DATABASE TEMPLATE SETUP SCRIPT
-- Run this in the Tenant's Supabase project SQL Editor (or in the same project for testing)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Villages Table (Dedicated first-class village master & visual order)
CREATE TABLE IF NOT EXISTS villages (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Customers Table (Supports Telugu names, phone/notes, dual loan amounts, renewal history)
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(100) PRIMARY KEY,
    village_id VARCHAR(100) REFERENCES villages(id) ON DELETE SET NULL,
    row_order INT NOT NULL DEFAULT 0,
    name VARCHAR(255) NOT NULL,
    phone TEXT,
    disbursed NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    original_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    disbursed_date DATE,
    start_week_id VARCHAR(50),
    is_village_divider BOOLEAN DEFAULT FALSE,
    village_name VARCHAR(255),
    renewed_at_week VARCHAR(50),
    past_cycle_payments JSONB DEFAULT '{}'::jsonb,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Weekly Ledger Columns Table
CREATE TABLE IF NOT EXISTS weeks (
    id VARCHAR(50) PRIMARY KEY,
    col_index INT NOT NULL,
    label VARCHAR(100) NOT NULL,
    week_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Customer Weekly Payments Table (Normalized for zero lock contention & ACID transactions)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE CASCADE,
    week_id VARCHAR(50) REFERENCES weeks(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, week_id)
);

-- 5. Weekly Financial Reconciliation (Bottom Cash Settlement Engine)
CREATE TABLE IF NOT EXISTS weekly_reconciliation (
    week_id VARCHAR(50) PRIMARY KEY REFERENCES weeks(id) ON DELETE CASCADE,
    prev_cash NUMERIC(12, 2),
    expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    salaries NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Loan History Archive Table (Preserves deleted customers & completed renewal cycles)
CREATE TABLE IF NOT EXISTS loan_archive (
    id VARCHAR(100) PRIMARY KEY,
    original_customer_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    phone TEXT,
    village_name VARCHAR(255),
    village_id VARCHAR(100),
    disbursed NUMERIC(12, 2) NOT NULL,
    original_amount NUMERIC(12, 2) NOT NULL,
    total_repaid NUMERIC(12, 2) NOT NULL,
    final_balance NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    date_archived DATE NOT NULL,
    payments_snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tenant Business Settings Table
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) DEFAULT 'FinRoute Collect',
    sub_title VARCHAR(255) DEFAULT 'Sunday Collections & Ledger',
    client_name VARCHAR(255) DEFAULT 'Valued Partner',
    currency_symbol VARCHAR(10) DEFAULT '₹',
    auto_roll_cash BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default settings if empty
INSERT INTO tenant_settings (business_name, sub_title, client_name, currency_symbol, auto_roll_cash)
SELECT 'FinRoute Collect', 'Sunday Collections & Ledger', 'Valued Partner', '₹', TRUE
WHERE NOT EXISTS (SELECT 1 FROM tenant_settings);

-- 8. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_row_order ON customers(row_order);
CREATE INDEX IF NOT EXISTS idx_customers_village ON customers(village_id);
CREATE INDEX IF NOT EXISTS idx_payments_lookup ON payments(customer_id, week_id);
CREATE INDEX IF NOT EXISTS idx_weeks_order ON weeks(col_index);
CREATE INDEX IF NOT EXISTS idx_loan_archive_date ON loan_archive(date_archived);

-- Row Level Security (RLS)
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow full read/write access for the tenant's authenticated / anon client
CREATE POLICY "Tenant full access villages" ON villages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access weeks" ON weeks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access weekly_reconciliation" ON weekly_reconciliation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access loan_archive" ON loan_archive FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access tenant_settings" ON tenant_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Tenant full access audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 9. Auto-link Village Trigger (Guarantees village_id is never orphaned on insert or update)
CREATE OR REPLACE FUNCTION trg_autolink_village()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_clean_name TEXT;
    v_vid VARCHAR(100);
BEGIN
    IF NEW.village_name IS NOT NULL AND TRIM(NEW.village_name) != '' THEN
        v_clean_name := TRIM(REPLACE(REPLACE(NEW.village_name, '📍 VILLAGE:', ''), 'VILLAGE:', ''));
        SELECT id INTO v_vid FROM villages WHERE LOWER(TRIM(name)) = LOWER(v_clean_name) LIMIT 1;
        IF v_vid IS NULL THEN
            v_vid := 'VIL-' || FLOOR(EXTRACT(EPOCH FROM NOW()));
            INSERT INTO villages (id, name, display_order)
            VALUES (v_vid, v_clean_name, 999)
            ON CONFLICT (id) DO NOTHING;
        END IF;
        NEW.village_id := COALESCE(NEW.village_id, v_vid);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_autolink_village ON customers;
CREATE TRIGGER trg_customers_autolink_village
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trg_autolink_village();
