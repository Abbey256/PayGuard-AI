import PageMeta from "../../components/common/PageMeta";
import { useState } from "react";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Sparkles,
  BarChart2,
  Upload,
  Settings,
} from "lucide-react";
import { formatNaira } from "../../utils/format";

export default function Home() {
  const [roundActive, setRoundActive] = useState(false);

  const stats = [
    {
      label: "Total Staff",
      value: "12,847",
      change: "+2.3%",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      icon: Users,
    },
    {
      label: "Verified This Month",
      value: "2,156",
      change: "+18.2%",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      icon: CheckCircle,
    },
    {
      label: "Ghosts Flagged",
      value: "47",
      change: "-12.5%",
      color: "text-red-600",
      bgColor: "bg-red-100",
      icon: AlertTriangle,
    },
    {
      label: "Estimated Savings (₦)",
      // full naira amount
      value: 2340000000,
      change: "+45.3%",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      icon: DollarSign,
    },
  ];

  return (
    <>
      <PageMeta
        title="Dashboard | PayGuard AI - Government Payroll Verification"
        description="Government staff verification and payroll processing dashboard"
      />

      <div className="space-y-6">
        {/* Header Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Verification Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Q1 2024 Payroll Verification Round
              </p>
            </div>
            <button
              onClick={() => setRoundActive(!roundActive)}
              className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 transition shadow-lg flex items-center gap-2"
            >
              <Sparkles size={20} />
              Start New Verification Round
            </button>
          </div>
        </div>

        {/* Key Statistics - Large & Impactful */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 hover:shadow-lg transition"
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${stat.bgColor} mb-4`}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-2 text-4xl font-bold text-gray-900 dark:text-white">
                {typeof stat.value === 'number' ? formatNaira(stat.value) : stat.value}
              </p>
              <div className={`mt-3 text-sm font-semibold ${stat.color}`}>
                {stat.change} from last month
              </div>
            </div>
          ))}
        </div>

        {/* Two Column Layout for Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Verification Status Overview */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
              Verification Status
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Completed
                  </span>
                  <span className="text-sm font-bold text-emerald-600">84%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div
                    className="bg-emerald-600 h-3 rounded-full"
                    style={{ width: "84%" }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    In Progress
                  </span>
                  <span className="text-sm font-bold text-blue-600">12%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: "12%" }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Failed/Flagged
                  </span>
                  <span className="text-sm font-bold text-red-600">4%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{ width: "4%" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Processing */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
              Payment Processing Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Pending Review</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">{formatNaira(420000000)}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Approved</span>
                <span className="font-bold text-lg text-emerald-600">{formatNaira(1800000000)}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Processed</span>
                <span className="font-bold text-lg text-emerald-600">{formatNaira(8300000000)}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-700 dark:text-gray-300 font-semibold">
                  Total This Quarter
                </span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">
                  {formatNaira(10500000000)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <button className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2">
              <BarChart2 size={20} />
              Generate Report
            </button>
            <button className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2">
              <Upload size={20} />
              Export Data
            </button>
            <button className="rounded-lg border border-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition font-medium flex items-center gap-2">
              <Settings size={20} />
              System Settings
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block w-3 h-3 bg-emerald-600 rounded-full animate-pulse"></span>
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
              System Operational
            </h3>
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            All services running normally. Last sync: 2 minutes ago. API uptime: 99.99%
          </p>
        </div>
      </div>
    </>
  );
}
