import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader, Upload, RefreshCw, Download, Camera, Image, Check, AlertCircle } from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface StaffMember {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  department: string;
  email: string;
  phone: string;
  salary: number;
  bank_account: string;
  bank_code: string;
  bvn?: string;
  status: "verified" | "pending" | "flagged";
  photo_url?: string | null;
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
        .select("*")
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

    const channel = supabase
      .channel('staff-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'staff' },
        (payload) => {
          // update that staff row in local state immediately
          setStaffData(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  // Download CSV Template
  // -------------------------------------------------------------------------
  const handleDownloadTemplate = () => {
    const headers = "staff_id,first_name,last_name,email,phone,department,salary_amount,bank_account_number,bank_code,bvn";
    const samples = [
      "EMP001,Adewale,Okafor,adewale.okafor@ministry.gov.ng,08012345678,Finance,180000,0123456789,057,12345678901",
      "EMP002,Ngozi,Kalu,ngozi.kalu@ministry.gov.ng,08023456789,Health,220000,9876543210,058,23456789012",
      "EMP003,Babatunde,Musa,babatunde.musa@ministry.gov.ng,08034567890,Education,150000,1122334455,033,34567890123"
    ];
    const instructions = [
      "",
      "Bank Codes Reference:",
      "057 = Zenith Bank",
      "058 = GTBank",
      "033 = UBA",
      "044 = Access Bank",
      "011 = First Bank",
      "050 = Ecobank"
    ];
    
    const csv = [headers, ...samples, ...instructions].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payguard-staff-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------------------
  // Parse CSV → rows for insert
  // -------------------------------------------------------------------------
  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("Bank Codes Reference:") || line.startsWith("0")) {
        // Skip empty lines or instruction lines that start with bank codes
        if (!line.includes(",")) continue; 
      }
      
      const values = line.split(",").map((v) => v.trim());
      if (values.length < 5) continue;

      // Map from template: staff_id,first_name,last_name,email,phone,department,salary_amount,bank_account_number,bank_code,bvn
      rows.push({
        employee_id: values[0] || "Unknown",
        first_name: values[1] || "",
        last_name: values[2] || "",
        name: `${values[1]} ${values[2]}`.trim() || "Unknown",
        email: values[3] || "",
        phone: values[4] || "",
        department: values[5] || "",
        salary: parseInt(values[6]) || 0,
        bank_account: values[7] || "",
        bank_code: values[8] || "",
        bvn: values[9] || "",
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

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          showToast("You must be logged in to upload staff", "error");
          return;
        }

        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("admin_id", user.id)
          .single();

        if (!org) {
          showToast("Organization not found for your account", "error");
          return;
        }

        const staffToInsert = newStaff.map(s => ({
          ...s,
          organization_id: org.id
        }));

        // De-duplicate rows in the CSV itself before sending to Supabase
        const uniqueStaff = staffToInsert.reduce((acc: any[], current) => {
          const x = acc.find(item => item.bvn === current.bvn || item.email === current.email);
          if (!x) return acc.concat([current]);
          else return acc;
        }, []);

        const { error } = await supabase
          .from("staff")
          .upsert(uniqueStaff, { 
            onConflict: 'organization_id,email,bvn',
            ignoreDuplicates: false 
          });
        if (error) throw error;

        showToast(`${uniqueStaff.length} staff members uploaded successfully`);

        // Notify
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await createNotification(user.id, `Payroll uploaded: ${uniqueStaff.length} staff members added`, "info");
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
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
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

  const handleDeleteStaff = async (staffId: string) => {
    if (!window.confirm("Are you sure you want to delete this staff record? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from("staff").delete().eq("id", staffId);
      if (error) throw error;
      
      showToast("Staff record deleted successfully");
      await loadStaff();
      setIsSlideOverOpen(false);
      setSelectedStaff(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete staff record", "error");
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
            <div className="flex flex-col gap-2">
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
                  onClick={handleDownloadTemplate}
                  className="rounded-lg border border-emerald-600 px-4 py-2 text-emerald-600 hover:bg-emerald-50 transition flex items-center gap-2"
                >
                  <Download size={18} />
                  Download Template
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Download the template, fill in your staff details, then upload. Staff photos can be added after upload by editing each staff record.
              </p>
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
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-10 w-10 overflow-hidden rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                              {staff.photo_url ? (
                                <img src={staff.photo_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                staff.name.charAt(0)
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1">
                              {staff.photo_url ? (
                                <div className="rounded-full bg-white p-0.5 dark:bg-gray-900 shadow-sm border border-emerald-100 dark:border-emerald-900" title="Verification photo uploaded">
                                  <Camera size={12} className="text-emerald-600" />
                                </div>
                              ) : (
                                <div className="rounded-full bg-white p-0.5 dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800" title="No verification photo - click View to add photo before sending verification link">
                                  <AlertCircle size={12} className="text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-mono text-xs">{staff.employee_id}</td>
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
                          className="rounded-lg bg-emerald-50 px-3 py-1 text-emerald-600 hover:bg-emerald-100 transition text-sm font-medium dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40"
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
        <StaffEditPanel
          staff={selectedStaff}
          onClose={() => {
            setIsSlideOverOpen(false);
            setSelectedStaff(null);
          }}
          onUpdate={async (id, updates) => {
            try {
              const { error } = await supabase.from("staff").update(updates).eq("id", id);
              if (error) throw error;
              showToast("Staff record updated successfully");
              await loadStaff();
              setIsSlideOverOpen(false);
            } catch (err) {
              console.error(err);
              showToast("Failed to update staff", "error");
            }
          }}
          onPhotoUpload={async (id, file) => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("Not authenticated");

              const { data: org } = await supabase
                .from("organizations")
                .select("id")
                .eq("admin_id", user.id)
                .single();
              if (!org) throw new Error("Organization not found");

              const fileExt = file.name.split('.').pop();
              // Unique filename scoped under org folder (satisfies Storage RLS)
              const filePath = `${org.id}/staff_${id}_${Date.now()}.${fileExt}`;

              // Step 1: Upload
              const { error: uploadError } = await supabase.storage
                .from('staff-photos')
                .upload(filePath, file, { upsert: true });

              if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Upload failed: ${uploadError.message}`);
              }

              // Step 2: Get public URL immediately after upload
              const { data: { publicUrl } } = supabase.storage
                .from('staff-photos')
                .getPublicUrl(filePath);

              if (!publicUrl) throw new Error("Could not generate public URL");

              // Step 3: Database sync — only return success if this completes
              const { error: updateError } = await supabase
                .from("staff")
                .update({ photo_url: publicUrl })
                .eq("id", id);

              if (updateError) {
                console.error('DB update error:', updateError);
                throw new Error(`Database update failed: ${updateError.message}`);
              }

              showToast(`Verification photo saved for ${selectedStaff!.name}`);
              await loadStaff();
              setSelectedStaff(prev => prev ? {...prev, photo_url: publicUrl} : prev);

              return 'Success';
            } catch (err: any) {
              console.error('Photo upload failed:', err);
              showToast(err.message || "Failed to upload photo", "error");
            }
          }}
          onSendLink={handleSendVerificationLink}
          onDelete={handleDeleteStaff}
          isSendingLink={isSendingLink}
        />
      )}

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </>
  );
}

function StaffEditPanel({
  staff,
  onClose,
  onUpdate,
  onPhotoUpload,
  onSendLink,
  onDelete,
  isSendingLink,
}: {
  staff: StaffMember;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<StaffMember>) => Promise<void>;
  onPhotoUpload: (id: string, file: File) => Promise<void>;
  onSendLink: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSendingLink: boolean;
}) {
  const [formData, setFormData] = useState({ 
    email: staff.email,
    phone: staff.phone || "",
    department: staff.department,
    salary: staff.salary,
    bank_account: staff.bank_account || "",
    bank_code: staff.bank_code || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(staff.id, formData);
    setIsSaving(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      await onPhotoUpload(staff.id, file);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Staff Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Photo Section */}
          <div className="flex flex-col items-center gap-4 py-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="relative">
              {staff.photo_url ? (
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-emerald-500 shadow-inner">
                  <img src={staff.photo_url} alt={staff.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-200 text-gray-400 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <Camera size={48} />
                </div>
              )}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 rounded-full bg-emerald-600 p-2.5 text-white shadow-lg hover:bg-emerald-700 transition disabled:opacity-50 border-2 border-white dark:border-gray-900"
                title={staff.photo_url ? "Replace Photo" : "Upload Photo"}
              >
                {isUploading ? <Loader size={18} className="animate-spin" /> : <Camera size={18} />}
              </button>
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".jpg,.jpeg,.png" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {staff.photo_url ? "Verification photo uploaded" : "No verification photo uploaded"}
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-[200px]">This photo will be used for face matching during payment verification.</p>
            </div>
          </div>

          {/* Info Banner */}
          {staff.status === "verified" && staff.virtual_account_number && (
            <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 flex gap-3">
              <Check className="text-emerald-600 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Staff Verified</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Virtual account created: <span className="font-mono font-bold">{staff.virtual_account_number}</span>
                </p>
              </div>
            </div>
          )}

          {/* Editable Fields */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">First Name</label>
                <input type="text" value={staff.first_name || staff.name.split(' ')[0]} readOnly className="w-full rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-gray-500 dark:bg-gray-800/50 dark:border-gray-700 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Last Name</label>
                <input type="text" value={staff.last_name || staff.name.split(' ')[1] || ""} readOnly className="w-full rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-gray-500 dark:bg-gray-800/50 dark:border-gray-700 cursor-not-allowed" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Phone Number</label>
              <input 
                type="text" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Department</label>
                <input 
                  type="text" 
                  value={formData.department} 
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Salary (₦)</label>
                <input 
                  type="number" 
                  value={formData.salary} 
                  onChange={(e) => setFormData({...formData, salary: parseInt(e.target.value) || 0})}
                  className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Bank Account</label>
                <input 
                  type="text" 
                  value={formData.bank_account} 
                  onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Bank Code</label>
                <input 
                  type="text" 
                  value={formData.bank_code} 
                  onChange={(e) => setFormData({...formData, bank_code: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6 dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-900/80">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader size={18} className="animate-spin" />}
            Save Staff Changes
          </button>
          
          {staff.status !== "verified" && (
            <button 
              onClick={onSendLink}
              disabled={isSendingLink || !staff.photo_url}
              className="w-full rounded-lg border border-emerald-600 py-3 font-bold text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSendingLink ? <Loader size={18} className="animate-spin" /> : <Upload size={18} />}
              {staff.photo_url ? "Send Verification Link" : "Upload photo to send link"}
            </button>
          )}

          <button 
            onClick={() => onDelete(staff.id)}
            className="w-full rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition mt-2"
          >
            Delete Staff Record
          </button>
        </div>
      </div>
    </div>
  );
}
