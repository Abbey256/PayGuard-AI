import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect, useCallback } from "react";
import { 
  FileText, Download, Filter, Search, 
  AlertCircle, CheckCircle, Clock, BarChart2,
  DollarSign, RefreshCw, Loader
} from "lucide-react";

import { formatNaira } from "../../utils/format";
import { supabase } from "../../lib/supabaseClient";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  actor: string;
  target_staff: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

interface ReportMetrics {
  verificationsThisMonth: number;
  successRate: string;
  ghostsFlagged: number;
  totalAmountProcessed: number;
}

export default function Reports() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<ReportMetrics>({
    verificationsThisMonth: 0,
    successRate: "—",
    ghostsFlagged: 0,
    totalAmountProcessed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load audit logs
      const { data: logs, error: logsError } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, actor, target_staff, details, severity")
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setAuditLogs(logs ?? []);

      // Compute metrics from verification_requests + staff tables
      const [verifyResp, ghostResp, paymentsResp] = await Promise.all([
        supabase
          .from("verification_requests")
          .select("status")
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("staff").select("id").eq("status", "flagged"),
        supabase
          .from("payment_batches")
          .select("total_amount")
          .eq("status", "processed"),
      ]);

      const verifications = verifyResp.data ?? [];
      const completed = verifications.filter((v) => v.status === "completed").length;
      const total = verifications.length;
      const rate = total > 0 ? ((completed / total) * 100).toFixed(1) + "%" : "—";
      const processed = (paymentsResp.data ?? []).reduce((sum, b) => sum + (b.total_amount ?? 0), 0);

      setMetrics({
        verificationsThisMonth: total,
        successRate: rate,
        ghostsFlagged: (ghostResp.data ?? []).length,
        totalAmountProcessed: processed,
      });
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadWalletHistory = async () => {
    setIsLoadingWallet(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/api/payments/transactions`, {
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      const result = await response.json();
      if (result.success) setWalletTransactions(result.transactions);
    } catch (err) {
      console.error("Failed to load wallet history", err);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { loadWalletHistory(); }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info": return "text-blue-600 bg-blue-100";
      case "warning": return "text-amber-600 bg-amber-100";
      case "critical": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const handleExportCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = ["Timestamp", "Action", "Actor", "Target", "Details", "Severity"];
    const rows = auditLogs.map((log) => [
      log.created_at,
      log.action,
      log.actor,
      log.target_staff,
      log.details,
      log.severity,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageMeta title="Reports | PayGuard AI" description="View audit logs and system impact metrics" />
      <PageBreadCrumb pageTitle="Reports & Analytics" />

      <div className="space-y-6">
        {/* Impact Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Verifications This Month", value: metrics.verificationsThisMonth.toString(), sub: "From DB" },
            { label: "Success Rate", value: metrics.successRate, sub: "Completed / total" },
            { label: "Ghosts Flagged", value: metrics.ghostsFlagged.toString(), sub: "Total flagged staff" },
            { label: "Total Amount Processed", value: formatNaira(metrics.totalAmountProcessed), sub: "All-time processed batches" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Date Range</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={loadReports} disabled={isLoading}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50">
              {isLoading ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
              {isLoading ? "Loading…" : "Filter"}
            </button>
            <button onClick={handleExportCSV} disabled={auditLogs.length === 0}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition flex items-center gap-2 disabled:opacity-50">
              <Download size={18} />
              Export CSV
            </button>
            <button onClick={loadReports} disabled={isLoading}
              className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Logs</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Loader size={24} className="animate-spin mr-3" />
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              No audit logs found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {["Timestamp", "Action", "Actor", "Target", "Details", "Severity"].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{log.action}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{log.actor}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{log.target_staff}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{log.details}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getSeverityColor(log.severity)}`}>
                          {log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Wallet Transactions Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Wallet Transactions</h2>
                <p className="text-sm text-gray-500">Audit trail of all funding and disbursement activities</p>
              </div>
            </div>
            <button
              onClick={loadWalletHistory}
              className="p-2 text-gray-400 hover:text-blue-600 transition"
              title="Refresh Transactions"
            >
              <RefreshCw size={18} className={isLoadingWallet ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reason / Narration</th>
                  <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {isLoadingWallet ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      <Loader size={20} className="animate-spin mx-auto mb-2" />
                      Fetching audit trail...
                    </td>
                  </tr>
                ) : walletTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                      No wallet transactions recorded.
                    </td>
                  </tr>
                ) : (
                  walletTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          tx.action === 'WALLET_FUNDED' ? 'bg-emerald-100 text-emerald-700' : 
                          tx.action === 'PAYOUT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {tx.action === 'WALLET_FUNDED' ? 'Inflow' : tx.action === 'PAYOUT' ? 'Outflow' : 'Audit'}
                        </span>
                      </td>
                      <td className={`py-4 text-sm font-bold ${tx.action === 'WALLET_FUNDED' ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                        ₦{(tx.changes?.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-4 text-sm text-gray-700 dark:text-gray-300">
                        {tx.changes?.reason || tx.target_staff || '—'}
                      </td>
                      <td className="py-4">
                        <span className="text-[10px] font-mono text-gray-500 uppercase">
                          {tx.changes?.status || 'Completed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

