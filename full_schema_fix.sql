-- Comprehensive Schema Fix for PayGuard AI
-- Run this in the Supabase SQL Editor to resolve the 400 and 403 errors.

-- 1. FIX STAFF TABLE
-- Add missing columns expected by frontend
ALTER TABLE staff ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS trust_score DECIMAL(5, 2) DEFAULT 0;

-- Update 'name' if first_name/last_name exist but name is null
UPDATE staff SET name = first_name || ' ' || last_name WHERE name IS NULL AND first_name IS NOT NULL;

-- 2. FIX AUDIT_LOGS TABLE
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_staff TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';

-- 3. FIX PAYMENT BATCHES AND RECORDS
-- Add missing columns to payment_batches
ALTER TABLE payment_batches ADD COLUMN IF NOT EXISTS verification_rate DECIMAL(5, 2) DEFAULT 0;

-- Create payment_batch_staff table (junction table for batch members)
-- This is what Payments.tsx expects for the relationship
CREATE TABLE IF NOT EXISTS payment_batch_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES payment_batches(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(batch_id, staff_id)
);

-- 4. RLS POLICIES (Comprehensive)
-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON organizations;
CREATE POLICY "Enable all access for authenticated users" ON organizations FOR ALL TO authenticated USING (true);

-- Staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON staff;
CREATE POLICY "Enable all access for authenticated users" ON staff FOR ALL TO authenticated USING (true);

-- Verification Requests
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON verification_requests;
CREATE POLICY "Enable all access for authenticated users" ON verification_requests FOR ALL TO authenticated USING (true);

-- Payment Batches
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payment_batches;
CREATE POLICY "Enable all access for authenticated users" ON payment_batches FOR ALL TO authenticated USING (true);

-- Payment Records
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payment_records;
CREATE POLICY "Enable all access for authenticated users" ON payment_records FOR ALL TO authenticated USING (true);

-- Payment Batch Staff
ALTER TABLE payment_batch_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payment_batch_staff;
CREATE POLICY "Enable all access for authenticated users" ON payment_batch_staff FOR ALL TO authenticated USING (true);

-- Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON audit_logs;
CREATE POLICY "Enable all access for authenticated users" ON audit_logs FOR ALL TO authenticated USING (true);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON notifications;
CREATE POLICY "Enable all access for authenticated users" ON notifications FOR ALL TO authenticated USING (true);

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
