import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router";

interface AuthContextType {
  session: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const timeoutRef = useRef<any>(null);

  // 10 minutes in milliseconds
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Only set timeout if there's an active session
    if (session) {
      timeoutRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        // Clear session state
        setSession(null);
        navigate("/login?expired=true", { replace: true });
      }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (!session) {
          setSession(null);
          navigate("/login");
        } else {
          setSession(session);
        }
      } else {
        setSession(session);
      }
      setLoading(false);
      resetTimeout();
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [navigate]);

  useEffect(() => {
    // Setup activity listeners to reset inactivity timeout
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    const handleActivity = () => resetTimeout();

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimeout();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
    };
  }, [session]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
