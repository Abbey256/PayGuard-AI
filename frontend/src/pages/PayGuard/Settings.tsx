import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect } from "react";
import { X, Loader, AlertTriangle } from "lucide-react";

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

export default function Settings() {
  const [settings, setSettings] = useState({
    organizationName: "Federal Revenue Service",
    timezone: "WAT (West Africa Time)",
    verificationTimeout: "30",
    paymentReviewRequired: true,
    emailNotifications: true,
    twoFactorAuth: true,
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "clear" | "reset" | null;
    confirmText: string;
    inputValue: string;
  }>({
    isOpen: false,
    type: null,
    confirmText: "",
    inputValue: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("payguard_settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
  }, []);

  // Show toast notification
  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setSettings({
      ...settings,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  // Save organization settings
  const handleSaveOrgSettings = () => {
    if (!settings.organizationName.trim()) {
      showToast("Organization Name cannot be empty", "error");
      return;
    }
    localStorage.setItem("payguard_settings", JSON.stringify(settings));
    showToast("Organization settings saved");
  };

  // Save security settings
  const handleSaveSecuritySettings = () => {
    localStorage.setItem("payguard_settings", JSON.stringify(settings));
    showToast("Security settings updated");
  };

  // Open confirmation modal
  const openConfirmModal = (type: "clear" | "reset") => {
    const confirmText = type === "clear" ? "CONFIRM" : "RESET";
    setConfirmModal({
      isOpen: true,
      type,
      confirmText,
      inputValue: "",
    });
  };

  // Handle confirmation modal submit
  const handleConfirmSubmit = async () => {
    if (confirmModal.inputValue !== confirmModal.confirmText) {
      showToast("Incorrect confirmation text", "error");
      return;
    }

    setIsProcessing(true);

    // Simulate API call
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1500);
      return () => clearTimeout(timeout);
    });

    if (confirmModal.type === "clear") {
      // Clear verification data
      localStorage.removeItem("payguard_verification_data");
      showToast("All verification data has been cleared");
    } else if (confirmModal.type === "reset") {
      // Reset system
      localStorage.clear();
      showToast("System has been reset to default state");
    }

    setIsProcessing(false);
    setConfirmModal({
      isOpen: false,
      type: null,
      confirmText: "",
      inputValue: "",
    });
  };

  return (
    <>
      <PageMeta
        title="Settings | PayGuard AI"
        description="System and organization settings"
      />
      <PageBreadCrumb pageTitle="Settings" />

      <div className="space-y-6">
        {/* Organization Settings */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
            Organization Settings
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                name="organizationName"
                value={settings.organizationName}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timezone
              </label>
              <select
                name="timezone"
                value={settings.timezone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option>WAT (West Africa Time)</option>
                <option>GMT (Greenwich Mean Time)</option>
                <option>CET (Central European Time)</option>
                <option>EST (Eastern Standard Time)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification Timeout (Days)
              </label>
              <input
                type="number"
                name="verificationTimeout"
                value={settings.verificationTimeout}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <button 
            onClick={handleSaveOrgSettings}
            className="mt-6 rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition"
          >
            Save Organization Settings
          </button>
        </div>

        {/* Security Settings */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
            Security & Verification
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Payment Review Required
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Require manual approval before processing payments
                </p>
              </div>
              <input
                type="checkbox"
                name="paymentReviewRequired"
                checked={settings.paymentReviewRequired}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Two-Factor Authentication
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Require 2FA for admin accounts
                </p>
              </div>
              <input
                type="checkbox"
                name="twoFactorAuth"
                checked={settings.twoFactorAuth}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Email Notifications
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send email alerts for verification events
                </p>
              </div>
              <input
                type="checkbox"
                name="emailNotifications"
                checked={settings.emailNotifications}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button 
            onClick={handleSaveSecuritySettings}
            className="mt-6 rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition"
          >
            Save Security Settings
          </button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-600 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <h2 className="mb-4 text-lg font-bold text-red-900 dark:text-red-100">
            Danger Zone
          </h2>
          <p className="text-sm text-red-800 dark:text-red-200 mb-4">
            These actions cannot be undone. Please proceed with caution.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => openConfirmModal("clear")}
              className="rounded-lg border border-red-600 px-6 py-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 transition"
            >
              Clear All Verification Data
            </button>
            <button 
              onClick={() => openConfirmModal("reset")}
              className="rounded-lg border border-red-600 px-6 py-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 transition"
            >
              Reset System
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Confirm {confirmModal.type === "clear" ? "Data Clearing" : "System Reset"}
                </h3>
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: false,
                      type: null,
                      confirmText: "",
                      inputValue: "",
                    })
                  }
                  disabled={isProcessing}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-4">
                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-900 dark:text-red-100" />
                    Warning: This action cannot be undone.
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200 mt-2">
                    {confirmModal.type === "clear"
                      ? "All verification data will be permanently deleted from the system."
                      : "The entire system will be reset to its default state. All settings and data will be cleared."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Type "{confirmModal.confirmText}" to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmModal.inputValue}
                    onChange={(e) =>
                      setConfirmModal({
                        ...confirmModal,
                        inputValue: e.target.value,
                      })
                    }
                    disabled={isProcessing}
                    placeholder={`Enter ${confirmModal.confirmText}`}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: false,
                      type: null,
                      confirmText: "",
                      inputValue: "",
                    })
                  }
                  disabled={isProcessing}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={
                    isProcessing ||
                    confirmModal.inputValue !== confirmModal.confirmText
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition"
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
