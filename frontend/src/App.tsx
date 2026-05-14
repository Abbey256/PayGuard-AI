import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Staff from "./pages/PayGuard/Staff";
import Verification from "./pages/PayGuard/Verification";
import Payments from "./pages/PayGuard/Payments";
import Reports from "./pages/PayGuard/Reports";
import Settings from "./pages/PayGuard/Settings";
import Profile from "./pages/PayGuard/Profile";
import Notifications from "./pages/PayGuard/Notifications";
import RootRedirect from "./components/auth/RootRedirect";
import VerificationPage from "./pages/Verification/VerificationPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PendingApproval from "./pages/AuthPages/PendingApproval";
import { AuthProvider } from "./components/auth/AuthProvider";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            {/* Public worker-facing verification route (no auth, no AppLayout) */}
            <Route path="/verify/:token" element={<VerificationPage />} />

            {/* Dashboard Layout (authenticated) */}
            <Route element={<AppLayout />}>
              {/* PayGuard AI Pages */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
              <Route path="/verify" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            </Route>

            {/* Auth Layout */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/pending-approval" element={<PendingApproval />} />

            {/* Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}
