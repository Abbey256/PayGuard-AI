import { useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabaseClient";

export default function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) navigate("/login", { replace: true });
          return;
        }

        // Fetch organization by user id
        const { data: org, error } = await supabase
          .from("organizations")
          .select("id, name, status")
          .eq("admin_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching organization:", error);
          if (mounted) navigate("/login", { replace: true });
          return;
        }

        if (org && org.status === "approved") {
          if (mounted) navigate("/dashboard", { replace: true });
        } else {
          if (mounted) navigate("/pending-approval", { replace: true });
        }
      } catch (err) {
        console.error(err);
        navigate("/login", { replace: true });
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-gray-600">Checking authentication...</div>
    </div>
  );
}
