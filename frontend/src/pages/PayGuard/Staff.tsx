import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader, Upload, RefreshCw } from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface StaffMember {
  id: string;
  name: string;
  employee_id: string;
  department: string;
  email: string;
  salary: number;
  status: "verified" | "pending" | "flagged";
  created_at: string;
  virtual_account_number?: string | null;
  virtual_account_bank?: string | null;
}

// Toast notification component
interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium shadow-lg ${
        type === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      {message}
    </div>
  );
}

export default function Staff() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [staffData, setStaffData] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Load staff from Supabase
  // -------------------------------------------------------------------------
  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, employee_id, department, email, salary, status, virtual_account_number, virtual_account_bank, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStaffData(data ?? []);
    } catch (err) {
      console.error("Failed to load staff:", err);
      showToast("Failed to load staff records", "error");
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // -------------------------------------------------------------------------
  // Toast helper
  // -------------------------------------------------------------------------
  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // -------------------------------------------------------------------------
  // Parse CSV → rows for insert
  // -------------------------------------------------------------------------
  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const rows: Omit<StaffMember, "id" | "created_at">[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < 5) continue;

      rows.push({
        name: values[0] || "Unknown",
        email: values[1] || "",
        employee_id: values[2] || "",
        department: values[3] || "",
        salary: parseInt(values[4]) || 0,
        status: "pending",
      });
    }
    return rows;
  };

  // -------------------------------------------------------------------------
  // Handle CSV upload → insert to Supabase
  // -------------------------------------------------------------------------
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsUploading(true);
        const text = event.target?.result as string;
        const newStaff = parseCSV(text);
        if (newStaff.length === 0) {
          showToast("No valid records found in CSV", "error");
          return;
        }

        const { error } = await supabase.from("staff").insert(newStaff);
        if (error) throw error;

        showToast(`${newStaff.length} staff members uploaded successfully`);

        // Notify
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await createNotification(user.id, `Payroll uploaded: ${newStaff.length} staff members added`, "info");
          }
        } catch { /* non-fatal */ }

        await loadStaff();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        console.error(error);
        showToast("Error uploading staff data", "error");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  // -------------------------------------------------------------------------
  // Send verification link via backend API
  // -------------------------------------------------------------------------
  const handleSendVerificationLink = async () => {
    if (!selectedStaff) return;
    setIsSendingLink(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/api/verification/send`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ staffId: selectedStaff.id, email: selectedStaff.email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to send verification link");
      }

      showToast(`Verification link sent to ${selectedStaff.name}`);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createNotification(user.id, `Verification link sent to ${selectedStaff.name}`, "info");
        }
      } catch { /* non-fatal */ }

      setIsSlideOverOpen(false);
      setSelectedStaff(null);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to send link", "error");
    } finally {
      setIsSendingLink(false);
    }
  };

  // -------------------------------------------------------------------------
  // Filter
  // -------------------------------------------------------------------------
  const filteredStaff = staffData.filter((staff) => {
    const matchSearch =
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "all" || staff.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified": return "text-emerald-600 bg-emerald-100";
      case "pending": return "text-amber-600 bg-amber-100";
      case "flagged": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <>
      <PageMeta
        title="Staff Management | PayGuard AI"
        description="Manage government staff records and verification status"
      />
      <PageBreadCrumb pageTitle="Staff Management" />

      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Staff Records
            </h2>
            <div className="flex gap-2">
              <button
                onClick={loadStaff}
                disabled={isLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? <Loader size={18} className="animate-spin" /> : <Upload size={18} />}
                {isUploading ? "Uploading..." : "Upload CSV"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Staff
              </label>
              <input
                type="text"
                placeholder="Search by name, ID or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Loader size={24} className="animate-spin mr-3" />
              Loading staff records...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              {staffData.length === 0
                ? "No staff records yet. Upload a CSV to get started."
                : "No records match your search."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Employee</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Department</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Salary</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{staff.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{staff.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{staff.employee_id}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{staff.department}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{formatNaira(staff.salary)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(staff.status)}`}>
                          {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => { setSelectedStaff(staff); setIsSlideOverOpen(true); }}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Staff</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{staffData.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">Verified</p>
            <p className="text-3xl font-bold text-emerald-600">
              {staffData.filter((s) => s.status === "verified").length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Verification</p>
            <p className="text-3xl font-bold text-amber-600">
              {staffData.filter((s) => s.status === "pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* Slide-over Panel */}
      {isSlideOverOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsSlideOverOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Staff Details</h3>
              <button onClick={() => setIsSlideOverOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto h-[calc(100%-120px)] px-6 py-6 space-y-6">
              {[
                { label: "Full Name", value: selectedStaff.name },
                { label: "Email", value: selectedStaff.email },
                { label: "Employee ID", value: selectedStaff.employee_id },
                { label: "Department", value: selectedStaff.department },
                { label: "Salary", value: formatNaira(selectedStaff.salary) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                  <p className="mt-1 text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="mt-1">
                  <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(selectedStaff.status)}`}>
                    {selectedStaff.status.charAt(0).toUpperCase() + selectedStaff.status.slice(1)}
                  </span>
                </div>
              </div>

              {selectedStaff.status === "verified" && selectedStaff.virtual_account_number && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 mt-4">
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Payment Details</h4>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Squad Virtual Account</p>
                    <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{selectedStaff.virtual_account_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Bank</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedStaff.virtual_account_bank}</p>
                    <p className="text-xs text-emerald-600 font-medium mt-2">Status: Ready for payment</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
              <button
                onClick={handleSendVerificationLink}
                disabled={isSendingLink || selectedStaff.status === "verified"}
                className="w-full bg-emerald-600 text-white font-medium py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
              >
                {isSendingLink ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Sending...</>
                ) : selectedStaff.status === "verified" ? (
                  "Already Verified"
                ) : (
                  "Send Verification Link"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </>
  );
}
