import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState } from "react";
import { X, Loader, CreditCard, CheckCircle } from "lucide-react";
import { formatNaira } from "../../utils/format";
import { supabase, createNotification } from "../../lib/supabaseClient";

interface VerifiedStaff {
  id: string;
  name: string;
  employeeId: string;
  trustScore: number;
  salary: number;
}

interface PaymentBatch {
  id: string;
  batchName: string;
  staffCount: number;
  totalAmount: number;
  createdDate: string;
  status: "pending" | "approved" | "processed" | "failed";
  verificationRate: number;
  verifiedStaff?: VerifiedStaff[];
}

const mockPaymentBatches: PaymentBatch[] = [
  {
    id: "PB001",
    batchName: "February 2024 - Finance Dept",
    staffCount: 12,
    totalAmount: 780000,
    createdDate: "2024-02-01",
    status: "pending",
    verificationRate: 100,
    verifiedStaff: [
      { id: "EMP001", name: "John Smith", employeeId: "EMP001", trustScore: 98, salary: 65000 },
      { id: "EMP010", name: "Grace Chen", employeeId: "EMP010", trustScore: 99, salary: 72000 },
      { id: "EMP011", name: "Robert Taylor", employeeId: "EMP011", trustScore: 97, salary: 68000 },
      { id: "EMP012", name: "Lisa Anderson", employeeId: "EMP012", trustScore: 99, salary: 71000 },
    ],
  },
  {
    id: "PB002",
    batchName: "February 2024 - HR Dept",
    staffCount: 8,
    totalAmount: 464000,
    createdDate: "2024-02-01",
    status: "approved",
    verificationRate: 100,
    verifiedStaff: [
      { id: "EMP002", name: "Sarah Johnson", employeeId: "EMP002", trustScore: 96, salary: 58000 },
      { id: "EMP013", name: "James Wilson", employeeId: "EMP013", trustScore: 98, salary: 61000 },
    ],
  },
  {
    id: "PB003",
    batchName: "January 2024 - Operations",
    staffCount: 15,
    totalAmount: 1080000,
    createdDate: "2024-01-01",
    status: "processed",
    verificationRate: 100,
    verifiedStaff: [
      { id: "EMP003", name: "Michael Brown", employeeId: "EMP003", trustScore: 97, salary: 72000 },
      { id: "EMP014", name: "Patricia Davis", employeeId: "EMP014", trustScore: 99, salary: 69000 },
    ],
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

export default function Payments() {
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>(
    mockPaymentBatches
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [paymentConfirmModal, setPaymentConfirmModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add toast notification
  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Open review modal
  const handleReviewClick = (batch: PaymentBatch) => {
    setSelectedBatch(batch);
    setReviewModalOpen(true);
  };

  // Approve batch
  const handleApproveBatch = async (batchId: string) => {
    setPaymentBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, status: "approved" as const } : b))
    );
    showToast("Batch approved for payment processing");
    try {
      const batch = paymentBatches.find((b) => b.id === batchId);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && batch) {
        await createNotification(user.id, `Payment batch approved: ${formatNaira(batch.totalAmount)}`, "info");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open payment confirmation modal
  const handlePayClick = (batch: PaymentBatch) => {
    setSelectedBatch(batch);
    setPaymentConfirmModal(true);
  };

  // Process payment
  const handleConfirmPayment = async () => {
    if (!selectedBatch) return;
    setIsProcessing(true);

    // Simulate API call
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      return () => clearTimeout(timeout);
    });

    setPaymentBatches((prev) =>
      prev.map((b) =>
        b.id === selectedBatch.id ? { ...b, status: "processed" as const } : b
      )
    );

    setIsProcessing(false);
    setPaymentConfirmModal(false);
    showToast(
      `Payment of ${formatNaira(selectedBatch.totalAmount)} successfully processed via Squad`
    );
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && selectedBatch) {
        await createNotification(user.id, `Payment processed: ${formatNaira(selectedBatch.totalAmount)}`, "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-amber-600 bg-amber-100";
      case "approved":
        return "text-blue-600 bg-blue-100";
      case "processed":
        return "text-emerald-600 bg-emerald-100";
      case "failed":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  // Dynamic calculations
  const pendingAmount = paymentBatches
    .filter((b) => b.status === "pending")
    .reduce((sum, batch) => sum + batch.totalAmount, 0);
  const approvedAmount = paymentBatches
    .filter((b) => b.status === "approved")
    .reduce((sum, batch) => sum + batch.totalAmount, 0);
  const processedAmount = paymentBatches
    .filter((b) => b.status === "processed")
    .reduce((sum, batch) => sum + batch.totalAmount, 0);
  const totalStaff = paymentBatches.reduce((sum, batch) => sum + batch.staffCount, 0);

  return (
    <>
      <PageMeta
        title="Payment Batches | PayGuard AI"
        description="Review verified staff and approve payments"
      />
      <PageBreadCrumb pageTitle="Payment Batches" />

      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Pending
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {formatNaira(pendingAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Approved
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {formatNaira(approvedAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Processed
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {formatNaira(processedAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Staff
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {totalStaff}
            </p>
          </div>
        </div>

        {/* Payment Batches Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Payment Batches
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Batch Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Staff Count
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Total Amount
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Verification
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
                {paymentBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {batch.batchName}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {batch.id}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {batch.staffCount}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatNaira(batch.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{
                              width: `${batch.verificationRate}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {batch.verificationRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                          batch.status
                        )}`}
                      >
                        {batch.status.charAt(0).toUpperCase() +
                          batch.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleReviewClick(batch)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Review
                        </button>
                        {batch.status === "pending" && (
                          <button 
                            onClick={() => handleApproveBatch(batch.id)}
                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                          >
                            Approve
                          </button>
                        )}
                        {batch.status === "approved" && (
                          <button 
                            onClick={() => handlePayClick(batch)}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 transition flex items-center gap-2"
                          >
                            <CreditCard size={20} />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval Info */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950">
          <h3 className="mb-2 font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-700" />
            All Verification Requirements Met
          </h3>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            All staff in pending batches have been verified by the government system.
            Review batch details and click "Approve & Pay" to process payments.
          </p>
        </div>

        {/* Review Modal */}
        {reviewModalOpen && selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-900 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Verified Staff Details - {selectedBatch.batchName}
                </h3>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="max-h-96 overflow-y-auto px-6 py-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Employee ID
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Trust Score
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Salary
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.verifiedStaff?.map((staff) => (
                      <tr
                        key={staff.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {staff.name}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {staff.employeeId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                                staff.trustScore >= 98
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {staff.trustScore}%
                            </span>
                            <button
                              onClick={async () => {
                                showToast(`Ghost worker flagged: ${staff.name} — Trust score ${staff.trustScore}%`);
                                try {
                                  const {
                                    data: { user },
                                  } = await supabase.auth.getUser();
                                  if (user) {
                                    await createNotification(user.id, `Ghost worker flagged: ${staff.name} — Trust score ${staff.trustScore}%`, "warning");
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Flag Ghost
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatNaira(staff.salary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition"
                >
                  Close
                </button>
                {selectedBatch.status === "approved" && (
                  <button
                    onClick={() => {
                      setReviewModalOpen(false);
                      handlePayClick(selectedBatch);
                    }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition"
                  >
                    Proceed to Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Confirmation Modal */}
        {paymentConfirmModal && selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Confirm Payment
                </h3>
                <button
                  onClick={() => !isProcessing && setPaymentConfirmModal(false)}
                  disabled={isProcessing}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-4">
                  <p className="text-gray-900 dark:text-white">
                  You are about to process payment of{" "}
                  <span className="font-bold text-emerald-600">
                    {formatNaira(selectedBatch.totalAmount)}
                  </span>{" "}
                  for{" "}
                  <span className="font-bold text-emerald-600">
                    {selectedBatch.staffCount} verified staff
                  </span>{" "}
                  via Squad API. This action cannot be undone.
                </p>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  onClick={() => setPaymentConfirmModal(false)}
                  disabled={isProcessing}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm"
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
      </div>
    </>
  );
}
