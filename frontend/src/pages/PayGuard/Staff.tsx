import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useRef } from "react";
import { X, Loader, Upload } from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface StaffMember {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  email: string;
  salary: number;
  status: "verified" | "pending" | "rejected";
  dateAdded: string;
}

const mockStaffData: StaffMember[] = [
  {
    id: "1",
    name: "John Smith",
    employeeId: "EMP001",
    department: "Finance",
    email: "john.smith@gov.com",
    salary: 65000,
    status: "verified",
    dateAdded: "2024-01-15",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    employeeId: "EMP002",
    department: "HR",
    email: "sarah.johnson@gov.com",
    salary: 58000,
    status: "pending",
    dateAdded: "2024-02-20",
  },
  {
    id: "3",
    name: "Michael Brown",
    employeeId: "EMP003",
    department: "Operations",
    email: "michael.brown@gov.com",
    salary: 72000,
    status: "verified",
    dateAdded: "2024-01-10",
  },
];

// Toast notification component
interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium shadow-lg animate-in fade-in slide-in-from-bottom-4 ${
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
  const [staffData, setStaffData] = useState<StaffMember[]>(mockStaffData);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add toast notification
  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Parse CSV file
  const parseCSV = (text: string): StaffMember[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const rows: StaffMember[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < 6) continue;

      const row: StaffMember = {
        id: `imported-${Date.now()}-${i}`,
        name: values[0] || "Unknown",
        email: values[1] || "",
        employeeId: values[2] || "",
        department: values[3] || "",
        salary: parseInt(values[4]) || 0,
        status: "pending",
        dateAdded: new Date().toISOString().split("T")[0],
      };

      rows.push(row);
    }

    return rows;
  };

  // Handle CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const newStaff = parseCSV(text);
        if (newStaff.length === 0) {
          showToast("No valid records found in CSV", "error");
          return;
        }
        setStaffData((prev) => [...prev, ...newStaff]);
        showToast(`${newStaff.length} staff members uploaded successfully`);
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await createNotification(
              user.id,
              `Payroll uploaded: ${newStaff.length} staff members added`,
              "info"
            );
          }
        } catch (err) {
          console.error(err);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        showToast("Error parsing CSV file", "error");
      }
    };
    reader.readAsText(file);
  };

  // Handle Send Verification Link
  const handleSendVerificationLink = async () => {
    if (!selectedStaff) return;
    setIsSendingLink(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSendingLink(false);
    showToast(`Verification link sent to ${selectedStaff.name}`);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await createNotification(user.id, `Verification link sent to ${selectedStaff.name}`, "info");
      }
    } catch (err) {
      console.error(err);
    }
    setIsSlideOverOpen(false);
    setSelectedStaff(null);
  };

  const filteredStaff = staffData.filter((staff) => {
    const matchSearch =
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      filterStatus === "all" || staff.status === filterStatus;

    return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "text-emerald-600 bg-emerald-100";
      case "pending":
        return "text-amber-600 bg-amber-100";
      case "rejected":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const openStaffDetails = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsSlideOverOpen(true);
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
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <Upload size={20} />
              Upload CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
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
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    ID
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Salary
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {staff.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {staff.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {staff.employeeId}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {staff.department}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {formatNaira(staff.salary)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                          staff.status
                        )}`}
                      >
                        {staff.status.charAt(0).toUpperCase() +
                          staff.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => openStaffDetails(staff)}
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
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Staff
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {staffData.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verified
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {staffData.filter((s) => s.status === "verified").length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pending Verification
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {staffData.filter((s) => s.status === "pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* Slide-over Panel */}
      {isSlideOverOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setIsSlideOverOpen(false)}
          />

          {/* Slide-over panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl transition-transform">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Staff Details
              </h3>
              <button
                onClick={() => setIsSlideOverOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100%-120px)] px-6 py-6 space-y-6">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {selectedStaff.name}
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {selectedStaff.email}
                </p>
              </div>

              {/* Employee ID */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Employee ID
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {selectedStaff.employeeId}
                </p>
              </div>

              {/* Department */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {selectedStaff.department}
                </p>
              </div>

              {/* Salary */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Salary
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {formatNaira(selectedStaff.salary)}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <div className="mt-1">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                      selectedStaff.status
                    )}`}
                  >
                    {selectedStaff.status.charAt(0).toUpperCase() +
                      selectedStaff.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer with Action Button */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
              <button
                onClick={handleSendVerificationLink}
                disabled={isSendingLink}
                className="w-full bg-emerald-600 text-white font-medium py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
              >
                {isSendingLink ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
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
