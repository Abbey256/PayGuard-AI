import PageMeta from "../../components/common/PageMeta";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users, CheckCircle, AlertTriangle, DollarSign,
  Sparkles, BarChart2, Upload, Settings,
} from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase } from "../../lib/supabaseClient";

interface DashboardStats {
  totalStaff: number;
  verifiedThisMonth: number;
  ghostsFlagged: number;
  estimatedSavings: number;
}

export default function Home() {
  const navigate = useNavigate();
  const [roundActive, setRoundActive] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalStaff: 0,
    verifiedThisMonth: 0,
    ghostsFlagged: 0,
    estimatedSavings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [verificationBreakdown, setVerificationBreakdown] = useState({
    completed: 0,
    inProgress: 0,
    failed: 0,
  });

  const [paymentStatus, setPaymentStatus] = useState({
    pendingReview: 0,
    approved: 0,
    processed: 0,
  });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('admin_id', user.id)
          .single();

        if (!org) return;

        const [staffResp, batchResp] = await Promise.all([
          supabase.from("staff").select("status, salary").eq("organization_id", org.id),
          supabase.from("payment_batches").select("status, total_amount").eq("organization_id", org.id),
        ]);

        const staff = staffResp.data ?? [];
        const batches = batchResp.data ?? [];

        const totalStaff = staff.length;
        // "Verified This Month" = staff currently with status 'verified' (current round)
        const verifiedThisMonth = staff.filter((s) => s.status === "verified").length;
        const ghostsFlagged = staff.filter((s) => s.status === "flagged").length;
        const pendingCount = staff.filter((s) => s.status === "pending" || s.status === "sent").length;

        // Estimate savings: ₦180,000 avg ghost salary × flagged count
        const estimatedSavings = ghostsFlagged * 180_000;

        setStats({ totalStaff, verifiedThisMonth, ghostsFlagged, estimatedSavings });

        // Verification breakdown — derived from staff.status (current round only)
        const total = totalStaff || 1;
        setVerificationBreakdown({
          completed: Math.round((verifiedThisMonth / total) * 100),
          inProgress: Math.round((staff.filter((s) => s.status === "sent").length / total) * 100),
          failed: Math.round((pendingCount / total) * 100),
        });

        // Payment status amounts
        setPaymentStatus({
          pendingReview: batches.filter((b) => b.status === "pending").reduce((s, b) => s + (b.total_amount ?? 0), 0),
          approved: batches.filter((b) => b.status === "approved").reduce((s, b) => s + (b.total_amount ?? 0), 0),
          processed: batches.filter((b) => b.status === "processed").reduce((s, b) => s + (b.total_amount ?? 0), 0),
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();

    const staffSub = supabase
      .channel('dashboard-staff-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff' }, () => {
         loadDashboard();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(staffSub); }
  }, []);

  const statCards = [
    { label: "Total Staff", value: isLoading ? "…" : stats.totalStaff.toLocaleString(), change: "Live from DB", color: "text-blue-600", bgColor: "bg-blue-100", icon: Users },
    { label: "Verified This Month", value: isLoading ? "…" : stats.verifiedThisMonth.toLocaleString(), change: "This month", color: "text-emerald-600", bgColor: "bg-emerald-100", icon: CheckCircle },
    { label: "Ghosts Flagged", value: isLoading ? "…" : stats.ghostsFlagged.toLocaleString(), change: "All-time flagged", color: "text-red-600", bgColor: "bg-red-100", icon: AlertTriangle },
    { label: "Estimated Savings (₦)", value: isLoading ? "…" : formatNaira(stats.estimatedSavings), change: "₦180k avg × ghosts", color: "text-emerald-600", bgColor: "bg-emerald-100", icon: DollarSign },
  ];

  return (
    <>
      <PageMeta
        title="Dashboard | PayGuard AI - Government Payroll Verification"
        description="Government staff verification and payroll processing dashboard"
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Verification Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })} Payroll Verification
              </p>
            </div>
            <button
              onClick={async () => {
                if (!window.confirm("This will reset all staff verification status for the new month. All staff must re-verify before next salary payment. Continue?")) return;

                try {
                  setIsLoading(true);
                  const { data: { user } } = await supabase.auth.getUser();
                  const { data: org } = await supabase.from('organizations').select('id').eq('admin_id', user!.id).single();
                  const orgId = org.id;

                  // 1. Update ALL staff in this organization (only existing columns):
                  const { data: staffData, error: staffError } = await supabase
                    .from("staff")
                    .update({ 
                       status: 'pending',
                       trust_score: null,
                     })
                    .eq('organization_id', orgId)
                    .select('id');

                  if (staffError) throw staffError;

                  const staffIds = (staffData || []).map((s: any) => s.id);

                  // 2. Expire ALL existing requests for these staff (no duplicates)
                  if (staffIds.length > 0) {
                    await supabase
                      .from('verification_requests')
                      .update({ status: 'expired', token_expires_at: new Date().toISOString() })
                      .in('staff_id', staffIds)
                      .in('status', ['pending', 'sent', 'completed']);
                  }

                  // 3. Insert exactly ONE fresh pending request per staff member
                  const expiryDate = new Date();
                  expiryDate.setDate(expiryDate.getDate() + 7);
                  
                  const newRequests = staffIds.map((id: string) => ({
                    staff_id: id,
                    token: crypto.randomUUID(),
                    token_expires_at: expiryDate.toISOString(),
                    status: 'pending'
                  }));
                  
                  if (newRequests.length > 0) {
                     await supabase.from('verification_requests').insert(newRequests);
                  }

                  // 5. Log to audit_logs
                  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                  await supabase.from('audit_logs').insert({
                    action: 'NEW_VERIFICATION_ROUND_STARTED',
                    changes: { month: monthName, staffReset: staffData?.length || 0 }
                  });

                  // 3 & 4. Show success toast and refresh stats
                  alert(`New verification round started. All ${staffData?.length || 0} staff reset to pending. Send new verification links to begin.`);
                  window.location.reload(); 
                } catch (err) {
                  console.error(err);
                  alert("Failed to start new round");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={20} />
              Start New Verification Round
            </button>
          </div>
        </div>

        {/* Key Statistics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 hover:shadow-lg transition">
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${stat.bgColor} mb-4`}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
              <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <div className={`mt-3 text-sm font-semibold ${stat.color}`}>{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Verification Status */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Verification Status</h2>
            <div className="space-y-4">
              {[
                { label: "Completed", value: verificationBreakdown.completed, color: "bg-emerald-600", textColor: "text-emerald-600" },
                { label: "In Progress (Sent)", value: verificationBreakdown.inProgress, color: "bg-blue-600", textColor: "text-blue-600" },
                { label: "Pending", value: verificationBreakdown.failed, color: "bg-amber-500", textColor: "text-amber-600" },
              ].map(({ label, value, color, textColor }) => (
                <div key={label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <span className={`text-sm font-bold ${textColor}`}>{value}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                    <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Processing */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Payment Processing Status</h2>
            <div className="space-y-4">
              {[
                { label: "Pending Review", value: paymentStatus.pendingReview, color: "text-gray-900 dark:text-white" },
                { label: "Approved", value: paymentStatus.approved, color: "text-emerald-600" },
                { label: "Processed", value: paymentStatus.processed, color: "text-emerald-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                  <span className={`font-bold text-lg ${color}`}>{formatNaira(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-700 dark:text-gray-300 font-semibold">Total Processed</span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">{formatNaira(paymentStatus.processed)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <button 
              onClick={() => navigate("/reports")}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2"
            >
              <BarChart2 size={20} /> Generate Report
            </button>
            <button 
              onClick={() => navigate("/staff")}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2"
            >
              <Upload size={20} /> Export Data
            </button>
            <button 
              onClick={() => navigate("/settings")}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2"
            >
              <Settings size={20} /> System Settings
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block w-3 h-3 bg-emerald-600 rounded-full animate-pulse" />
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">System Operational</h3>
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            All services running normally. Data loaded live from Supabase. Squad API sandbox active.
          </p>
        </div>
      </div>
    </>
  );
}
