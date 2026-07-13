import { useState, useRef, useCallback } from "react";

export const useSupabase = () => {
  const [cloudConfig, setCloudConfig] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_cloud_config");
    return saved ? JSON.parse(saved) : { url: "", key: "" };
  });

  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState(null);
  const ubicacionIdCacheRef = useRef({});

  // Token de sesion del usuario autenticado (useAuth). Mientras no haya
  // sesion, se sigue usando la anon key como Authorization, igual que antes;
  // en cuanto hay sesion, se usa el access_token para que Supabase reconozca
  // las peticiones como "authenticated" (necesario para las politicas RLS
  // restrictivas de sql/002_auth_rls.sql).
  const sessionTokenRef = useRef(null);
  const setSessionToken = useCallback((token) => {
    sessionTokenRef.current = token || null;
  }, []);

  const headers = useCallback(() => ({
    apikey: cloudConfig.key,
    Authorization: `Bearer ${sessionTokenRef.current || cloudConfig.key}`,
    "Content-Type": "application/json",
  }), [cloudConfig.key]);

  const sbFetch = useCallback(async (path, options = {}) => {
    if (!cloudConfig.url) return null;
    return fetch(`${cloudConfig.url}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers(), ...options.headers },
    });
  }, [cloudConfig.url, headers]);

  return {
    cloudConfig, setCloudConfig,
    isCloudConnected, setIsCloudConnected,
    isSyncing, setIsSyncing,
    cloudSaveError, setCloudSaveError,
    ubicacionIdCacheRef,
    headers, sbFetch,
    setSessionToken,
  };
};
