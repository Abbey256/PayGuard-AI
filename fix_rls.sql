-- FIX RLS POLICIES (Idempotent: Drops them first if they exist to prevent errors)

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON staff;
  DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON staff;
  DROP POLICY IF EXISTS "Enable update access for authenticated users" ON staff;
  DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payment_batches;
  DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payment_records;
  DROP POLICY IF EXISTS "Enable all access for authenticated users" ON verification_requests;
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON organizations;
EXCEPTION WHEN OTHERS THEN 
  -- Ignore errors if policies don't exist
END $$;

CREATE POLICY "Enable read access for authenticated users" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON staff FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable all access for authenticated users" ON payment_batches FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON payment_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON verification_requests FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON organizations FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
