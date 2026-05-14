-- PayGuard Database Schema for Supabase (PostgreSQL)
-- This schema provides the foundation for the government payroll verification system

-- Users table (auth handled by Supabase, this is supplementary user data)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT CHECK (org_type IN ('federal', 'state', 'lga', 'agency')),
  status TEXT CHECK (status IN ('pending', 'approved', 'suspended')) DEFAULT 'pending',
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT,
  department TEXT,
  phone TEXT,
  squad_sub_account_id TEXT,
  squad_wallet_balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, org_type)
);

-- Staff members table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT, -- Combined name for frontend usage
  first_name TEXT,
  last_name TEXT,
  employee_id TEXT,
  department TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  bank_account TEXT,
  bank_code TEXT,
  bvn TEXT,
  salary DECIMAL(15, 2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'verified', 'rejected', 'flagged')) DEFAULT 'pending',
  trust_score DECIMAL(5, 2) DEFAULT 0,
  virtual_account_number TEXT,
  virtual_account_bank TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, email, bvn)
);

-- Verification requests table
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  verification_type TEXT CHECK (verification_type IN ('liveness', 'face_match', 'document', 'account')) DEFAULT 'liveness',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  liveness_score DECIMAL(5, 2),
  facematch_score DECIMAL(5, 2),
  challenges_passed INTEGER DEFAULT 0,
  challenges_total INTEGER DEFAULT 0,
  account_name_match BOOLEAN DEFAULT FALSE,
  final_score DECIMAL(5, 2),
  final_verdict TEXT CHECK (final_verdict IN ('verified', 'review', 'flagged')),
  token TEXT UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment batches table
CREATE TABLE IF NOT EXISTS payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  staff_count INTEGER NOT NULL,
  status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'processing', 'processed', 'completed', 'failed')) DEFAULT 'draft',
  verification_rate DECIMAL(5, 2) DEFAULT 0,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment records table (Actual transactions)
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  transaction_ref TEXT UNIQUE,
  squad_transaction_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for staff in a payment batch (Expected by frontend)
CREATE TABLE IF NOT EXISTS payment_batch_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES payment_batches(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(batch_id, staff_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  target_staff TEXT,
  severity TEXT DEFAULT 'info',
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_organization ON staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_verification_staff ON verification_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_batch_org ON payment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_batch_status ON payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_batch ON payment_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_staff ON payment_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_batch_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for authenticated for demo/internal usage)
CREATE POLICY "Enable all for auth" ON organizations FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON staff FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON verification_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON payment_batches FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON payment_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON payment_batch_staff FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON notifications FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for auth" ON audit_logs FOR ALL TO authenticated USING (true);
