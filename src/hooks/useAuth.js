import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseClient } from "../supabaseClient";

// Autenticacion de Supabase, pensada para NO bloquear la app.
//
// Importante (leccion del intento anterior, revertido en el commit
// "revert: remove broken auth layer, restore working app"): aquella vez la
// app entera quedaba detras de un `if (!isAuthenticated) return <LoginPage/>`,
// asi que si Supabase Auth no estaba configurado (o no habia usuarios creados
// todavia) nadie podia entrar ni siquiera en modo local. Este hook solo
// informa del estado de sesion; quien lo use decide que bloquear (en
// gestor-granja, solo la sincronizacion con la nube).
export const useAuth = (cloudConfig) => {
  const url = cloudConfig?.url;
  const key = cloudConfig?.key;

  const supabase = useMemo(() => {
    if (!url || !key) return null;
    return getSupabaseClient(url, key);
  }, [url, key]);

  const [session, setSession] = useState(null);
  const [rawAuthLoading, setRawAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!supabase) return;

    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSession(data?.session ?? null);
      setRawAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Si no hay cliente (nube no configurada), no hay nada que cargar: no
  // dejamos la app en estado "cargando sesion" para siempre.
  const authLoading = supabase ? rawAuthLoading : false;

  const login = useCallback(async (email, password) => {
    if (!supabase) {
      setAuthError("Configura primero la URL y la clave de Supabase.");
      return false;
    }
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    setSession(data.session);
    return true;
  }, [supabase]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  return {
    session,
    authLoading,
    authError,
    setAuthError,
    login,
    logout,
    isAuthenticated: !!session,
    userEmail: session?.user?.email ?? null,
  };
};
