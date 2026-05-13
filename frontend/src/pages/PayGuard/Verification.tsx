import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useRef } from "react";
import { CheckCircle, Send, Upload } from "lucide-react";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface VerificationRequest {
  id: string;
  staffName: string;
  employeeId: string;
  email: string;
  dateRequested: string;
  status: "pending" | "sent" | "verified";
  expiresAt: string;
}

const mockVerificationData: VerificationRequest[] = [
  {
    id: "V001",
    staffName: "Sarah Johnson",
    employeeId: "EMP002",
    email: "sarah.johnson@gov.com",
    dateRequested: "2024-02-20",
    status: "pending",
    expiresAt: "2024-03-01",
  },
  {
    id: "V002",
    staffName: "Emma Wilson",
    employeeId: "EMP004",
    email: "emma.wilson@gov.com",
    dateRequested: "2024-02-18",
    status: "sent",
    expiresAt: "2024-02-28",
  },
  {
    id: "V003",
    staffName: "David Lee",
    employeeId: "EMP005",
    email: "david.lee@gov.com",
    dateRequested: "2024-02-15",
    status: "verified",
    expiresAt: "2025-02-15",
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

export default function Verification() {
  const [verificationData, setVerificationData] = useState<VerificationRequest[]>(
    mockVerificationData
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
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
  const parseVerificationCSV = (text: string): VerificationRequest[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const rows: VerificationRequest[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < 5) continue;

      const row: VerificationRequest = {
        id: `V${String(Date.now() + i).slice(-3)}`,
        staffName: values[0] || "Unknown",
        employeeId: values[1] || "",
        email: values[2] || "",
        dateRequested: new Date().toISOString().split("T")[0],
        status: "pending",
        expiresAt: values[3] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };

      rows.push(row);
    }

    return rows;
  };

  // Handle CSV import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const newRequests = parseVerificationCSV(text);
        if (newRequests.length === 0) {
          showToast("No valid records found in CSV", "error");
          return;
        }
        setVerificationData((prev) => [...prev, ...newRequests]);
        showToast(`${newRequests.length} verification requests imported successfully`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        showToast("Error parsing CSV file", "error");
      }
    };
    reader.readAsText(file);
  };

  // Handle Send Link button
  const handleSendLink = async (id: string) => {
    setVerificationData((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          showToast(`Verification link sent to ${v.email}`);
          (async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                await createNotification(user.id, `Verification link sent to ${v.email}`, "info");
              }
            } catch (err) {
              console.error(err);
            }
          })();
          return { ...v, status: "sent" as const };
        }
        return v;
      })
    );
  };

  // Handle Resend button
  const handleResend = async (email: string) => {
    showToast(`Verification link resent to ${email}`);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await createNotification(user.id, `Verification link resent to ${email}`, "info");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Send All Pending
  const handleSendAllPending = () => {
    const pendingCount = verificationData.filter((v) => v.status === "pending")
      .length;

    if (pendingCount === 0) {
      showToast("No pending requests to send", "error");
      return;
    }

    setVerificationData((prev) =>
      prev.map((v) => (v.status === "pending" ? { ...v, status: "sent" as const } : v))
    );

    showToast(
      `${pendingCount} verification link${pendingCount > 1 ? "s" : ""} sent successfully`
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "text-emerald-600 bg-emerald-100";
      case "sent":
        return "text-blue-600 bg-blue-100";
      case "pending":
        return "text-amber-600 bg-amber-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  // Calculate dynamic stats
  const pendingCount = verificationData.filter((v) => v.status === "pending").length;
  const sentCount = verificationData.filter((v) => v.status === "sent").length;
  const verifiedCount = verificationData.filter((v) => v.status === "verified").length;
  const totalCount = verificationData.length;

  return (
    <>
      <PageMeta
        title="Verification Center | PayGuard AI"
        description="Send and manage staff verification requests"
      />
      <PageBreadCrumb pageTitle="Verification Center" />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pending
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sent
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {sentCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verified
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {verifiedCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Requests
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {totalCount}
            </p>
          </div>
        </div>

        {/* Verification Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Verification Requests
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Staff Member
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Employee ID
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Expires
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {verificationData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.staffName}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.id}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {item.employeeId}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {item.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.expiresAt}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.status === "pending" && (
                        <button
                          onClick={() => handleSendLink(item.id)}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
                        >
                          Send Link
                        </button>
                      )}
                      {item.status === "sent" && (
                        <button 
                          onClick={() => handleResend(item.email)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Resend
                        </button>
                      )}
                      {item.status === "verified" && (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
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
        </div>

        {/* Batch Operations */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Batch Operations
          </h3>
          <div className="flex gap-3">
            <button 
              onClick={handleSendAllPending}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <Send size={20} />
              Send All Pending
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition flex items-center gap-2"
            >
              <Upload size={20} />
              Import Requests
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </div>
        </div>

        {/* Toast Notifications */}
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </>
  );
}
