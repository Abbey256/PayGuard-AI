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
  const [isSimulatingFunding, setIsSimulatingFunding] = useState(false);
  const [showSubAccountId, setShowSubAccountId] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  // -------------------------------------------------------------------------
  // Simulate Funding
  // -------------------------------------------------------------------------
  const handleSimulateFunding = async () => {
    setIsSimulatingFunding(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${apiUrl}/api/payments/simulate-funding`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ amount: 50000000 }),
      });

      if (!response.ok) {
        throw new Error("Failed to simulate funding");
      }
      
      showToast("Funding simulated successfully");
      await loadProfile(true);
    } catch (err) {
      console.error(err);
      showToast("Failed to simulate funding", "error");
    } finally {
      setIsSimulatingFunding(false);
    }
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

        {/* Squad Wallet — Emergency Reference */}
        <div className="rounded-xl border border-emerald-200 bg-white p-6 dark:border-emerald-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <ShieldCheck size={16} className="text-emerald-700" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment Wallet</h2>
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-semibold ml-1">Squad</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Your ministry's isolated payment wallet. This is used to process verified staff payroll.
            Keep the Sub-Account ID secure — it is your wallet identifier.
          </p>

          {org?.squad_sub_account_id ? (
            <div className="space-y-4">
              {/* Sub-account ID */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                    Sub-Account ID
                    <span className="ml-2 text-red-500 font-semibold">(Emergency reference — keep secure)</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSubAccountId((v) => !v)}
                      className="text-emerald-600 hover:text-emerald-700 transition"
                      title={showSubAccountId ? "Hide" : "Reveal"}
                    >
                      {showSubAccountId ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={handleCopySubAccountId}
                      className="text-emerald-600 hover:text-emerald-700 transition"
                      title="Copy"
                    >
                      {copiedId ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                <p className="text-base font-mono font-bold text-emerald-900 dark:text-emerald-100 tracking-wider">
                  {showSubAccountId
                    ? org.squad_sub_account_id
                    : "•".repeat(Math.min(org.squad_sub_account_id.length, 24))}
                </p>
              </div>

              {org.ministry_virtual_account_number && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Government should transfer salary funds to:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
                      <p className="text-base font-mono font-bold text-gray-900 dark:text-white">{org.ministry_virtual_account_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Bank</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{org.ministry_virtual_account_bank}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{org.name} - PayGuard</p>
                  </div>
                </div>
              )}

              {/* Wallet balance */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Wallet Balance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ₦{((org.squad_wallet_balance ?? 0) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSimulateFunding}
                    disabled={isSimulatingFunding}
                    className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {isSimulatingFunding ? "Simulating..." : "Simulate Funding"}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm text-emerald-600 font-medium">Live</span>
                  </div>
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
                onClick={() => loadProfile(true)}
                disabled={isRefreshing}
                className="mt-3 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                Refresh
              </button>
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

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </>
  );
}
