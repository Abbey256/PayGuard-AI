import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect, useCallback } from "react";
import { X, Loader, CreditCard, CheckCircle, RefreshCw } from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface VerifiedStaff {
  id: string;
  name: string;
  employee_id: string;
  trust_score: number;
  salary: number;
}

interface PaymentBatch {
  id: string;
  batch_name: string;
  staff_count: number;
  total_amount: number;
  created_at: string;
  status: "pending" | "approved" | "processed" | "failed";
  verification_rate: number;
  verified_staff?: VerifiedStaff[];
}

// Toast
interface Toast { id: string; message: string; type: "success" | "error"; }
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium shadow-lg ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
      {message}
    </div>
  );
}

export default function Payments() {
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([]);
  const [flaggedStaffData, setFlaggedStaffData] = useState<VerifiedStaff[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [paymentConfirmModal, setPaymentConfirmModal] = useState(false);
  const [approveText, setApproveText] = useState("");
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // -------------------------------------------------------------------------
  // Load payment batches from Supabase
  // -------------------------------------------------------------------------
  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: org } = await supabase.from('organizations').select('id').eq('admin_id', user.id).single();
      if (!org) return;

      const orgId = org.id;

      // Fetch all verified staff for this org (status='verified' is set by verifyController after liveness passes)
      const { data: pendingStaff, error: staffFetchError } = await supabase
        .from('staff')
        .select('id, name, first_name, last_name, employee_id, salary, trust_score, status')
        .eq('organization_id', orgId)
        .eq('status', 'verified');

      if (staffFetchError) console.error('Staff fetch error:', staffFetchError);

      if (pendingStaff && pendingStaff.length > 0) {
        const monthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const batchName = `${monthStr} Payroll`;
        const monthFilter = new Date().toISOString().substring(0, 7);

        let sumOfSalaries = pendingStaff.reduce((sum, s) => sum + (s.salary || 0), 0);
        let verifiedCount = pendingStaff.length;

        let { data: batch, error: batchFetchError } = await supabase
          .from('payment_batches')
          .select('id, staff_count, total_amount')
          .eq('organization_id', orgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // returns null (not an error) when no row exists

        if (batchFetchError) console.error('Batch fetch error:', batchFetchError);

        if (!batch) {
          const { data: newBatch } = await supabase.from('payment_batches').insert({
            organization_id: orgId,
            batch_name: batchName,
            status: 'pending',
            staff_count: verifiedCount,
            total_amount: sumOfSalaries,
            created_by: user.id
          }).select().single();
          batch = newBatch;
        }

        if (batch) {
           // Add staff to batch only if not already there
           const { data: existingEntries } = await supabase
             .from('payment_batch_staff')
             .select('staff_id')
             .eq('batch_id', batch.id);

           const alreadyInBatch = new Set((existingEntries || []).map((e: any) => e.staff_id));
           const newEntries = pendingStaff
             .filter(s => !alreadyInBatch.has(s.id))
             .map(s => ({ batch_id: batch.id, staff_id: s.id }));

           if (newEntries.length > 0) {
             await supabase.from('payment_batch_staff').insert(newEntries);
             // Update batch totals to reflect the newly added staff
             await supabase.from('payment_batches').update({
               staff_count: (existingEntries?.length || 0) + newEntries.length,
               total_amount: pendingStaff.reduce((sum: number, s: any) => sum + (s.salary || 0), 0),
             }).eq('id', batch.id);
           }
        }
      }

      // Load flagged staff
      const { data: flagged } = await supabase
        .from('staff')
        .select('id, name, first_name, last_name, employee_id, trust_score, salary')
        .eq('organization_id', orgId)
        .eq('status', 'flagged');
      setFlaggedStaffData((flagged as any) || []);

      const { data, error } = await supabase
        .from("payment_batches")
        .select(`
          id,
          batch_name,
          staff_count,
          total_amount,
          created_at,
          status,
          payment_batch_staff (
            staff ( id, name, first_name, last_name, employee_id, trust_score, salary )
          )
        `)
        .eq('organization_id', orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: PaymentBatch[] = (data ?? []).map((b: any) => ({
        id: b.id,
        batch_name: b.batch_name,
        staff_count: b.staff_count,
        total_amount: b.total_amount,
        created_at: b.created_at,
        status: b.status,
        verified_staff: (b.payment_batch_staff ?? [])
          .map((r: any) => {
             if (r.staff) {
               const name = r.staff.name || `${r.staff.first_name || ''} ${r.staff.last_name || ''}`.trim();
               return { ...r.staff, name };
             }
             return null;
          })
          .filter(Boolean),
      }));

      setPaymentBatches(mapped);
    } catch (err) {
      console.error(err);
      showToast("Failed to load payment batches", "error");
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // -------------------------------------------------------------------------
  // Approve batch
  // -------------------------------------------------------------------------
  const handleApproveBatch = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from("payment_batches")
        .update({ status: "approved" })
        .eq("id", batchId);
      if (error) throw error;

      setPaymentBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, status: "approved" as const } : b));
      showToast("Batch approved for payment processing");

      const batch = paymentBatches.find((b) => b.id === batchId);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && batch) {
        await createNotification(user.id, `Payment batch approved: ${formatNaira(batch.total_amount)}`, "info");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to approve batch", "error");
    }
  };

  // -------------------------------------------------------------------------
  // Process payment via backend (Squad API)
  // -------------------------------------------------------------------------
  const handleConfirmPayment = async () => {
    if (!selectedBatch) return;
    setIsProcessing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/api/payments/process`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ batchId: selectedBatch.id }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Payment processing failed");
      }

      // Refresh batches from DB
      await loadBatches();

      const { summary } = await response.json();
      setPaymentSummary(summary);
      setPaymentConfirmModal(false);
      setApproveText("");
      setSummaryModalOpen(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createNotification(
          user.id, 
          `Payment complete — ${summary.paid} staff paid, ${formatNaira(summary.total_disbursed)} disbursed, ${formatNaira(summary.remaining_balance)} remaining in wallet`, 
          "success"
        );
      }
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Payment failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "text-amber-600 bg-amber-100";
      case "approved": return "text-blue-600 bg-blue-100";
      case "processed": return "text-emerald-600 bg-emerald-100";
      case "failed": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  // Dynamic calculations from real data
  const pendingAmount = paymentBatches.filter((b) => b.status === "pending").reduce((s, b) => s + b.total_amount, 0);
  const approvedAmount = paymentBatches.filter((b) => b.status === "approved").reduce((s, b) => s + b.total_amount, 0);
  const processedAmount = paymentBatches.filter((b) => b.status === "processed").reduce((s, b) => s + b.total_amount, 0);
  const totalStaff = paymentBatches.reduce((s, b) => s + b.staff_count, 0);

  return (
    <>
      <PageMeta title="Payment Batches | PayGuard AI" description="Review verified staff and approve payments" />
      <PageBreadCrumb pageTitle="Payment Batches" />

      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total Pending", value: formatNaira(pendingAmount), color: "text-amber-600" },
            { label: "Total Approved", value: formatNaira(approvedAmount), color: "text-blue-600" },
            { label: "Processed", value: formatNaira(processedAmount), color: "text-emerald-600" },
            { label: "Total Staff", value: totalStaff.toString(), color: "text-gray-900 dark:text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Batches Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Batches</h3>
            <button onClick={loadBatches} disabled={isLoading} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Loader size={24} className="animate-spin mr-3" />
              Loading payment batches...
            </div>
          ) : paymentBatches.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              No payment batches yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {["Batch Name", "Staff Count", "Total Amount", "Verification", "Status", "Actions"].map((h) => (
                      <th key={h} className={`px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white ${h === "Actions" ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentBatches.map((batch) => (
                    <tr key={batch.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{batch.batch_name}</p>
                        <p className="text-xs text-gray-500">{batch.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{batch.staff_count}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{formatNaira(batch.total_amount)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `100%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">100%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(batch.status)}`}>
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => { setSelectedBatch(batch); setReviewModalOpen(true); }}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            Review
                          </button>
                          {batch.status === "pending" && (
                            <button onClick={() => handleApproveBatch(batch.id)}
                              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                              Approve
                            </button>
                          )}
                          {batch.status === "approved" && (
                            <button onClick={() => { setSelectedBatch(batch); setPaymentConfirmModal(true); }}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 transition flex items-center gap-1">
                              <CreditCard size={14} /> Approve & Process Payment
                            </button>
                          )}
                          {batch.status === "processed" && (
                            <span className="text-emerald-600 font-medium flex items-center gap-1 text-sm">
                              <CheckCircle size={14} /> Processed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950">
          <h3 className="mb-2 font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-700" />
            Zero-Trust Payment Flow
          </h3>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            Only staff with AI-confirmed liveness scores ≥ 90 appear in approved batches.
            Each payment is released via Squad API only after HR approval — never by AI alone.
          </p>
        </div>

        {/* Flagged Staff Table */}
        {flaggedStaffData.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-red-200 bg-white dark:border-red-900 dark:bg-gray-900 mt-8">
            <div className="border-b border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Flagged Staff (Excluded from Payment)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {["Name", "Employee ID", "Trust Score", "Salary"].map((h) => (
                      <th key={h} className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flaggedStaffData.map((staff) => (
                    <tr key={staff.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{staff.name || `${(staff as any).first_name || ''} ${(staff as any).last_name || ''}`.trim()}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{staff.employee_id}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          {staff.trust_score}%
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{formatNaira(staff.salary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedBatch.batch_name} — Verified Staff
              </h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto px-6 py-4">
              {(selectedBatch.verified_staff ?? []).length === 0 ? (
                <p className="text-center text-gray-500 py-8">No verified staff details available.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {["Name", "Employee ID", "Trust Score", "Salary"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.verified_staff!.map((staff) => (
                      <tr key={staff.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{staff.name}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{staff.employee_id}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${staff.trust_score >= 95 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                            {staff.trust_score}%
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{formatNaira(staff.salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button onClick={() => setReviewModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 transition">
                Close
              </button>
              {selectedBatch.status === "approved" && (
                <button onClick={() => { setReviewModalOpen(false); setPaymentConfirmModal(true); }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition">
                  Proceed to Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirm Modal */}
      {paymentConfirmModal && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Payment</h3>
              <button onClick={() => !isProcessing && setPaymentConfirmModal(false)} disabled={isProcessing}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-gray-900 dark:text-white">
                You are about to process{" "}
                <span className="font-bold text-emerald-600">{formatNaira(selectedBatch.total_amount)}</span>
                {" "}for{" "}
                <span className="font-bold text-emerald-600">{selectedBatch.staff_count} verified staff</span>
                {" "}via Squad API. This action cannot be undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <span className="font-mono font-bold text-red-600">APPROVE</span> to confirm
                </label>
                <input
                  type="text"
                  value={approveText}
                  onChange={(e) => setApproveText(e.target.value)}
                  placeholder="APPROVE"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button onClick={() => { setPaymentConfirmModal(false); setApproveText(""); }} disabled={isProcessing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
                Cancel
              </button>
              <button onClick={handleConfirmPayment} disabled={isProcessing || approveText !== "APPROVE"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition">
                {isProcessing ? <><Loader className="w-4 h-4 animate-spin" /> Processing…</> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && paymentSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            <div className="bg-emerald-600 px-6 py-6 text-center">
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">Payment Processing Complete</h3>
              <p className="text-emerald-100 mt-2">All eligible transfers have been initiated via Squad.</p>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Staff Processed</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{paymentSummary.total_staff}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Successfully Paid</span>
                  <span className="font-semibold text-emerald-600">{paymentSummary.paid}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Blocked (Name Mismatch)</span>
                  <span className="font-semibold text-red-600">{paymentSummary.blocked}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Disbursed</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNaira(paymentSummary.total_disbursed)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">PayGuard Platform Fee</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNaira(paymentSummary.payguard_fee)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Remaining Wallet Balance</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatNaira(paymentSummary.remaining_balance)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex justify-end">
              <button 
                onClick={() => setSummaryModalOpen(false)}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition font-medium"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.map((toast) => (<Toast key={toast.id} message={toast.message} type={toast.type} />))}
    </>
  );
}
