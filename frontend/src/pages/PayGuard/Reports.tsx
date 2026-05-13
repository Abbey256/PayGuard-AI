import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState } from "react";
import { formatNaira } from "../../utils/format";
import { Search, Download } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  targetStaff: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

const mockAuditLogs: AuditLog[] = [
  {
    id: "LOG001",
    timestamp: "2024-02-22 14:30:00",
    action: "Verification Sent",
    actor: "Admin User",
    targetStaff: "Sarah Johnson",
    details: "Verification link sent to email",
    severity: "info",
  },
  {
    id: "LOG002",
    timestamp: "2024-02-21 10:15:00",
    action: "Staff Verified",
    actor: "System",
    targetStaff: "David Lee",
    details: "Government verification completed successfully",
    severity: "info",
  },
  {
    id: "LOG003",
    timestamp: "2024-02-20 16:45:00",
    action: "Payment Approved",
    actor: "Admin User",
    targetStaff: "Finance Batch",
    details: "Batch payment approved for processing",
    severity: "info",
  },
  {
    id: "LOG004",
    timestamp: "2024-02-19 09:20:00",
    action: "Verification Failed",
    actor: "System",
    targetStaff: "Test User",
    details: "Government records did not match",
    severity: "warning",
  },
];

export default function Reports() {
  const [auditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [dateFrom, setDateFrom] = useState("2024-02-01");
  const [dateTo, setDateTo] = useState("2024-02-29");

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "text-blue-600 bg-blue-100";
      case "warning":
        return "text-amber-600 bg-amber-100";
      case "critical":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <>
      <PageMeta
        title="Reports | PayGuard AI"
        description="View audit logs and system impact metrics"
      />
      <PageBreadCrumb pageTitle="Reports & Analytics" />

      <div className="space-y-6">
        {/* Impact Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verifications This Month
            </p>
            <p className="text-3xl font-bold text-emerald-600">42</p>
            <p className="text-xs text-gray-500 mt-2">↑ 15% from last month</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Success Rate
            </p>
            <p className="text-3xl font-bold text-emerald-600">98.5%</p>
            <p className="text-xs text-gray-500 mt-2">1 failure in 42 attempts</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Avg. Verification Time
            </p>
            <p className="text-3xl font-bold text-blue-600">2.3s</p>
            <p className="text-xs text-gray-500 mt-2">System performance</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Amount Processed
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatNaira(4200000)}
            </p>
            <p className="text-xs text-gray-500 mt-2">This quarter</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Date Range
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700 transition flex items-center gap-2">
              <Search size={20} />
              Filter
            </button>
            <button className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition flex items-center gap-2">
              <Download size={20} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Audit Logs
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Action
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Actor
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Target
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Details
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {log.timestamp}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {log.actor}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {log.targetStaff}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {log.details}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getSeverityColor(
                          log.severity
                        )}`}
                      >
                        {log.severity.charAt(0).toUpperCase() +
                          log.severity.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            System Health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  API Uptime
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  99.99%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-emerald-600 h-2 rounded-full"
                  style={{ width: "99.99%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Database Performance
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  95ms avg
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: "85%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
