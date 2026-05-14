import { ShieldAlert } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabaseClient";

export default function PendingApproval() {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Pending Approval | PayGuard AI"
        description="Your organization is pending approval"
      />
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert size={32} className="text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Account Under Review
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Your organization's account is currently pending administrative approval. 
            We will notify you once your account has been approved and activated.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}
            className="w-full rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 font-semibold hover:opacity-90 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
