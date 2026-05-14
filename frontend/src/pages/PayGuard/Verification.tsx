import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Loader, RefreshCw } from "lucide-react";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface VerificationRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  employee_id: string;
  email: string;
  created_at: string;
  status: "pending" | "sent" | "completed";
  token_expires_at: string | null;
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

export default function Verification() {
  const [verificationData, setVerificationData] = useState<VerificationRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // -------------------------------------------------------------------------
  // Load verification requests from Supabase
  // -------------------------------------------------------------------------
  const loadVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("verification_requests")
        .select(`
          id,
          staff_id,
          status,
          token_expires_at,
          created_at,
          staff ( name, employee_id, email )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: VerificationRequest[] = (data ?? []).map((row: any) => ({
        id: row.id,
        staff_id: row.staff_id,
        staff_name: row.staff?.name ?? "Unknown",
        employee_id: row.staff?.employee_id ?? "",
        email: row.staff?.email ?? "",
        created_at: row.created_at,
        status: row.status === "completed" ? "completed" : row.status,
        token_expires_at: row.token_expires_at,
      }));

      setVerificationData(mapped);
    } catch (err) {
      console.error(err);
      showToast("Failed to load verification requests", "error");
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadVerifications(); }, [loadVerifications]);

  // -------------------------------------------------------------------------
  // Send verification link for a single request
  // -------------------------------------------------------------------------
  const handleSendLink = async (item: VerificationRequest) => {
    setSendingIds((prev) => new Set(prev).add(item.id));
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/api/verification/send`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ staffId: item.staff_id, email: item.email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to send link");
      }

      showToast(`Verification link sent to ${item.email}`);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await createNotification(user.id, `Verification link sent to ${item.email}`, "info");
      } catch { /* non-fatal */ }

      await loadVerifications();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send link", "error");
    } finally {
      setSendingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  // -------------------------------------------------------------------------
  // Send all pending
  // -------------------------------------------------------------------------
  const handleSendAllPending = async () => {
    const pending = verificationData.filter((v) => v.status === "pending");
    if (pending.length === 0) { showToast("No pending requests to send", "error"); return; }
    for (const item of pending) await handleSendLink(item);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-emerald-600 bg-emerald-100";
      case "sent": return "text-blue-600 bg-blue-100";
      case "pending": return "text-amber-600 bg-amber-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "completed") return "Verified";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const pendingCount = verificationData.filter((v) => v.status === "pending").length;
  const sentCount = verificationData.filter((v) => v.status === "sent").length;
  const verifiedCount = verificationData.filter((v) => v.status === "completed").length;

  return (
    <>
      <PageMeta title="Verification Center | PayGuard AI" description="Send and manage staff verification requests" />
      <PageBreadCrumb pageTitle="Verification Center" />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Pending", value: pendingCount, color: "text-amber-600" },
            { label: "Sent", value: sentCount, color: "text-blue-600" },
            { label: "Verified", value: verifiedCount, color: "text-emerald-600" },
            { label: "Total Requests", value: verificationData.length, color: "text-gray-900 dark:text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Verification Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verification Requests</h3>
            <button onClick={loadVerifications} disabled={isLoading} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Loader size={24} className="animate-spin mr-3" />
              Loading verification requests...
            </div>
          ) : verificationData.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              No verification requests yet. Add staff and send verification links to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {["Staff Member", "Employee ID", "Email", "Status", "Expires", "Actions"].map((h) => (
                      <th key={h} className={`px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white ${h === "Actions" ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verificationData.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{item.staff_name}</p>
                        <p className="text-xs text-gray-500">{item.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{item.employee_id}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{item.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.token_expires_at ? new Date(item.token_expires_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.status === "pending" && (
                          <button
                            onClick={() => handleSendLink(item)}
                            disabled={sendingIds.has(item.id)}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1 mx-auto"
                          >
                            {sendingIds.has(item.id) && <Loader size={14} className="animate-spin" />}
                            Send Link
                          </button>
                        )}
                        {item.status === "sent" && (
                          <button
                            onClick={() => handleSendLink(item)}
                            disabled={sendingIds.has(item.id)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                          >
                            {sendingIds.has(item.id) ? "Sending…" : "Resend"}
                          </button>
                        )}
                        {item.status === "completed" && (
                          <span className="text-emerald-600 font-medium flex items-center gap-1 justify-center">
                            <CheckCircle size={16} />
                            Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Batch Operations */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Batch Operations</h3>
          <div className="flex gap-3">
            <button
              onClick={handleSendAllPending}
              disabled={pendingCount === 0}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              Send All Pending ({pendingCount})
            </button>
          </div>
        </div>
      </div>

      {toasts.map((toast) => (<Toast key={toast.id} message={toast.message} type={toast.type} />))}
    </>
  );
}
