-- 1. ADD MISSING VIRTUAL ACCOUNT COLUMNS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ministry_virtual_account_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ministry_virtual_account_bank TEXT;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS virtual_account_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS virtual_account_bank TEXT;

-- 2. FIX 403 RLS ERRORS FOR THE DEMO
-- These policies allow authenticated users (like the HR admin) to read/write their data from the frontend.

CREATE POLICY "Enable read access for authenticated users" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON staff FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable all access for authenticated users" ON payment_batches FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON payment_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON verification_requests FOR ALL TO authenticated USING (true);

-- Ensure organizations table is readable by the frontend
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON organizations;
CREATE POLICY "Enable read access for authenticated users" ON organizations FOR SELECT TO authenticated USING (true);

-- Force schema cache reload (so the API immediately recognizes the new columns)
NOTIFY pgrst, 'reload schema';
