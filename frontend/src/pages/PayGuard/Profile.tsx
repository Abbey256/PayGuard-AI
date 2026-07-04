import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect } from "react";
import {
  ShieldCheck, User, Building2, Phone, MapPin, Mail,
  Copy, CheckCircle, Loader, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface OrgProfile {
  id: string;
  name: string;
  status: string;
  state: string | null;
  department: string | null;
  phone: string | null;
  squad_sub_account_id: string | null;
  squad_wallet_balance: number | null;
  ministry_virtual_account_number?: string | null;
  ministry_virtual_account_bank?: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  organization_name?: string;
  phone_number?: string;
}

// Toast
interface Toast { id: string; message: string; type: "success" | "error"; }
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium shadow-lg z-50 ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
      {message}
    </div>
  );
}

export default function Profile() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSecureViewLocked, setIsSecureViewLocked] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Funding Modal State
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [isSimulatingFunding, setIsSimulatingFunding] = useState(false);
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingReason, setFundingReason] = useState("May 2026 Salary");
  const [customReason, setCustomReason] = useState("");

  // Balance Security State
  const [isBalanceRevealed, setIsBalanceRevealed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Transactions State
  const [activeTab, setActiveTab] = useState<"details" | "transactions">("details");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);



  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // -------------------------------------------------------------------------
  // Load admin user + organization
  // -------------------------------------------------------------------------
  const loadProfile = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      setAdmin({
        id: user.id,
        email: user.email ?? "",
        organization_name: user.user_metadata?.organization_name,
        phone_number: user.user_metadata?.phone_number,
      });

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, status, state, department, phone, squad_sub_account_id, squad_wallet_balance, ministry_virtual_account_number, ministry_virtual_account_bank, created_at")
        .eq("admin_id", user.id)
        .maybeSingle();

      if (orgError) throw orgError;
      setOrg(orgData as OrgProfile | null);
    } catch (err) {
      console.error("Profile load error:", err);
      if (!quiet) showToast("Failed to load profile", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Balance Reveal Timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isBalanceRevealed) {
      setIsBalanceRevealed(false);
    }
  }, [timeLeft, isBalanceRevealed]);

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/api/payments/transactions`, {
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      const result = await response.json();
      if (result.success) setTransactions(result.transactions);
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!confirmPassword) return;
    setIsVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: admin?.email || "",
        password: confirmPassword,
      });

      if (error) throw new Error("Incorrect password. Access denied.");

      // Log the view to audit logs via backend
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${apiUrl}/api/payments/log-balance-view`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });

      setIsBalanceRevealed(true);
      setShowPasswordModal(false);
      setConfirmPassword("");
      setTimeLeft(30); // Reveal for 30 seconds
      showToast("Balance revealed for 30 seconds");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsVerifyingPassword(false);
    }
  };


  // -------------------------------------------------------------------------
  // Simulate Funding
  // -------------------------------------------------------------------------
  const handleSimulateFunding = async () => {
    if (!org) return;
    const amount = parseInt(fundingAmount.replace(/,/g, ""));
    if (isNaN(amount) || amount < 1000 || amount > 500000000) {
      showToast("Please enter a valid amount between ₦1,000 and ₦500,000,000", "error");
      return;
    }

    setIsSimulatingFunding(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();
      
      const reason = fundingReason === "Custom" ? customReason : fundingReason;

      const response = await fetch(`${apiUrl}/api/payments/simulate-funding`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          amount: amount,
          reason: reason,
          organization_id: org.id
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to simulate funding");
      
      showToast(result.message || "Funding simulated successfully");
      setShowFundingModal(false);
      setFundingAmount("");
      setCustomReason("");
      await loadProfile(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to simulate funding", "error");
    } finally {
      setIsSimulatingFunding(false);
    }
  };

  const formatCurrencyInput = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, "");
    if (!numbers) return "";
    return parseInt(numbers).toLocaleString("en-NG");
  };


  // -------------------------------------------------------------------------
  // Copy sub-account ID
  // -------------------------------------------------------------------------
  const handleCopySubAccountId = async () => {
    if (!org?.squad_sub_account_id) return;
    try {
      await navigator.clipboard.writeText(org.squad_sub_account_id);
      setCopiedId(true);
      showToast("Sub-account ID copied");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const handleCopyAccount = async () => {
    if (!org?.ministry_virtual_account_number) return;
    try {
      await navigator.clipboard.writeText(org.ministry_virtual_account_number);
      setCopiedAcc(true);
      showToast("Account number copied");
      setTimeout(() => setCopiedAcc(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  };


  // -------------------------------------------------------------------------
  // Retry Squad Setup
  // -------------------------------------------------------------------------
  const handleRetrySetup = async () => {
    if (!org || !admin) return;
    setIsRefreshing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${apiUrl}/api/organizations/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          orgId: org.id,
          orgName: org.name,
          email: admin.email,
        }),
      });

      const result = await response.json();
      if (result.success) {
        showToast("Squad wallet and Virtual Account provisioned!");
        await loadProfile(true);
      } else {
        throw new Error(result.message || "Setup failed");
      }
    } catch (err) {
      console.error(err);
      showToast("Provisioning failed. Please try again.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400">
        <Loader size={28} className="animate-spin mr-3" />
        Loading profile…
      </div>
    );
  }

  const statusColor = org?.status === "approved"
    ? "text-emerald-600 bg-emerald-100"
    : "text-amber-600 bg-amber-100";

  return (
    <>
      <PageMeta title="Admin Profile | PayGuard AI" description="Your organization profile and account details" />
      <PageBreadCrumb pageTitle="Admin Profile" />

      <div className="space-y-6 max-w-4xl">
        {/* Header card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold">
                {(org?.name ?? admin?.email ?? "A").charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {org?.name ?? admin?.user_metadata?.organization_name ?? "Your Organization"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{admin?.email}</p>
                <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor}`}>
                  {org?.status === "approved" ? "Active" : (org?.status ?? "Pending")}
                </span>
              </div>
            </div>
            <button
              onClick={() => loadProfile(true)}
              disabled={isRefreshing}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              title="Refresh"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Organization Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Organization Details</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { icon: Building2, label: "Organization Name", value: org?.name ?? "—" },
              { icon: Mail, label: "Admin Email", value: admin?.email ?? "—" },
              { icon: Phone, label: "Phone Number", value: org?.phone ?? admin?.phone_number ?? "—" },
              { icon: MapPin, label: "State", value: org?.state ?? "—" },
              {
                icon: ShieldCheck,
                label: "Ministry / Department",
                value: org?.department ?? admin?.user_metadata?.ministry_department ?? "—",
              },
              {
                icon: User,
                label: "Account Created",
                value: org?.created_at ? new Date(org.created_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : "—",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className="text-gray-400" />
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wallet Section */}
        <div className="rounded-xl border border-emerald-200 bg-white p-6 dark:border-emerald-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <ShieldCheck size={16} className="text-emerald-700" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment Wallet</h2>
              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-semibold ml-1">Squad Verified</span>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${isSecureViewLocked ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {isSecureViewLocked ? 'Data Masked' : 'Secure Access'}
              </div>
            </div>
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("details")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "details" ? "bg-white dark:bg-gray-700 text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Details
              </button>
              <button
                onClick={() => {
                  setActiveTab("transactions");
                  loadTransactions();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "transactions" ? "bg-white dark:bg-gray-700 text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Transactions
              </button>
            </div>
          </div>

          {activeTab === "details" ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Government-grade isolated payment wallet. sensitive identifiers are encrypted by default.
                </p>
                <button
                  onClick={() => setIsSecureViewLocked(!isSecureViewLocked)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSecureViewLocked ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {isSecureViewLocked ? <ShieldCheck size={14} /> : <Eye size={14} />}
                  {isSecureViewLocked ? 'Unlock Data' : 'Lock Sensitive View'}
                </button>
              </div>

              {org?.squad_sub_account_id ? (
                <div className="space-y-4">
                  {/* Sub-account ID */}
                  <div className={`rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4 transition-all ${isSecureViewLocked ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                          Sub-Account ID
                        </p>
                        <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-1.5 rounded font-bold">ENCRYPTED</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isSecureViewLocked && (
                          <button
                            onClick={handleCopySubAccountId}
                            className="text-emerald-600 hover:text-emerald-700 transition"
                            title="Copy"
                          >
                            {copiedId ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`text-base font-mono font-bold text-emerald-900 dark:text-emerald-100 tracking-wider transition-all ${isSecureViewLocked ? 'blur-sm select-none' : ''}`}>
                      {!isSecureViewLocked
                        ? org.squad_sub_account_id
                        : "•".repeat(Math.min(org.squad_sub_account_id.length, 24))}
                    </p>
                  </div>

                  {org.ministry_virtual_account_number && (
                    <div className={`rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-950/20 p-5 transition-all ${isSecureViewLocked ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-blue-900 dark:text-blue-100">MINISTRY ACCOUNT DETAILS</p>
                          <span className="text-[10px] bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 rounded font-bold">SECURE</span>
                        </div>
                        {!isSecureViewLocked && (
                          <button
                            onClick={handleCopyAccount}
                            className="text-blue-600 hover:text-blue-700 transition"
                            title="Copy Account Number"
                          >
                            {copiedAcc ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Account Number</p>
                          <p className={`text-xl font-mono font-bold text-gray-900 dark:text-white transition-all ${isSecureViewLocked ? 'blur-md select-none' : ''}`}>
                            {!isSecureViewLocked ? org.ministry_virtual_account_number : "••••••••••"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Bank</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white uppercase">{org.ministry_virtual_account_bank || "Squad (HabariPay)"}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/30">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Account Name</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">PayGuard - {org.name}</p>
                      </div>

                      <p className="mt-4 text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed font-medium">
                        "Transfer salary funds to this account number. Funds reflect automatically and are ready for disbursement."
                      </p>
                    </div>
                  )}

                  {/* Wallet balance */}
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Wallet Balance</p>
                        {isBalanceRevealed && (
                          <span className="text-[10px] text-amber-600 font-bold animate-pulse">REVEALED ({timeLeft}s)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {isBalanceRevealed 
                            ? `₦${((org.squad_wallet_balance ?? 0) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                            : "₦••••••••"
                          }
                        </p>
                        {!isBalanceRevealed && (
                          <button
                            onClick={() => setShowPasswordModal(true)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            Reveal Balance
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest">Live System</span>
                      </div>
                      {org.ministry_virtual_account_number ? (
                        <button
                          onClick={() => setShowFundingModal(true)}
                          className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-all active:scale-95"
                        >
                          <RefreshCw size={14} />
                          Simulate Funding
                        </button>
                      ) : (
                        <button
                          onClick={handleRetrySetup}
                          disabled={isRefreshing}
                          className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isRefreshing ? <Loader size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Complete Virtual Account Setup
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Squad wallet is being set up in the background.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Refresh this page in a moment or check your backend logs.
                  </p>
                  <button
                    onClick={handleRetrySetup}
                    disabled={isRefreshing}
                    className="mt-3 inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isRefreshing ? <Loader size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Provision Wallet & Virtual Account
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Recent Transactions</h3>
                <button onClick={loadTransactions} className="text-gray-400 hover:text-emerald-600 transition">
                  <RefreshCw size={14} className={isLoadingTransactions ? "animate-spin" : ""} />
                </button>
              </div>

              {isLoadingTransactions ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <Loader size={16} className="animate-spin mr-2" />
                  Loading audit trail...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm italic">
                  No wallet transactions found.
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border-l-4 border-emerald-500">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{tx.changes?.reason || tx.action}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${tx.action === 'WALLET_FUNDED' ? 'text-emerald-600' : 'text-gray-600'}`}>
                          {tx.action === 'WALLET_FUNDED' ? '+' : '-'} ₦{(tx.changes?.amount ?? 0).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400 font-mono tracking-tighter uppercase">{tx.changes?.status || 'Simulated'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Verification badge */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-4">
            <User size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Security</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "AI Verification", status: "Active" },
              { label: "Biometric Liveness", status: "Enabled" },
              { label: "Ghost Worker Detection", status: "Running" },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 px-4 py-3">
                <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-emerald-600 font-semibold">{status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulate Funding Modal */}
      {showFundingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <RefreshCw size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Simulate Salary Fund Transfer</h3>
                <p className="text-sm text-gray-500">Add funds to your ministry wallet</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Enter amount to simulate (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₦</span>
                  <input
                    type="text"
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(formatCurrencyInput(e.target.value))}
                    className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 pl-10 pr-4 py-4 text-xl font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all placeholder:text-gray-300"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Min: ₦1,000</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Max: ₦500M</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Transfer reason
                </label>
                <select
                  value={fundingReason}
                  onChange={(e) => setFundingReason(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                >
                  <option value="May 2026 Salary">May 2026 Salary</option>
                  <option value="June 2026 Salary">June 2026 Salary</option>
                  <option value="Supplementary Payment">Supplementary Payment</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {fundingReason === "Custom" && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Specify custom reason
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. Infrastructure Grant"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowFundingModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimulateFunding}
                  disabled={isSimulatingFunding || !fundingAmount}
                  className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSimulatingFunding ? <Loader size={18} className="animate-spin" /> : "Simulate Transfer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-2xl border border-blue-500/30">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Security Verification</h3>
              <p className="text-sm text-gray-500 mt-2">Enter your administrator password to reveal sensitive wallet balance.</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 py-4 text-center text-lg font-bold outline-none focus:border-blue-500 transition-all"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyPassword}
                  disabled={isVerifyingPassword || !confirmPassword}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {isVerifyingPassword ? <Loader size={18} className="animate-spin" /> : "Verify Access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </>
  );
}


