import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "../supabaseClient";

export const useAuth = (cloudConfig) => {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [userRole, setUserRole] = useState("operario");

  const supabase = cloudConfig.url && cloudConfig.key
    ? getSupabaseClient(cloudConfig.url, cloudConfig.key)
    : null;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchUserRole(s.user.email);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user) {
          fetchUserRole(s.user.email);
        } else {
          setUserRole("operario");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const fetchUserRole = useCallback(async (email) => {
    if (!supabase || !email) return;
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("email", email)
        .single();
      if (data?.rol) setUserRole(data.role);
    } catch {
      setUserRole("operario");
    }
  }, [supabase]);

  const login = useCallback(async (email, password) => {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }, [supabase]);

  const signup = useCallback(async (email, password) => {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError(null);
    }
  }, [supabase]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUserRole("operario");
  }, [supabase]);

  return {
    session,
    authLoading,
    authError,
    setAuthError,
    login,
    signup,
    logout,
    isAuthenticated: !!session,
    userRole,
    userEmail: session?.user?.email || null,
  };
};
