import { useState, useRef, useCallback } from "react";

export const useSupabase = (session, cloudConfig) => {
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState(null);
  const ubicacionIdCacheRef = useRef({});

  const headers = useCallback(() => ({
    apikey: cloudConfig.key,
    Authorization: `Bearer ${session?.access_token || cloudConfig.key}`,
    "Content-Type": "application/json",
  }), [cloudConfig.key, session?.access_token]);

  const sbFetch = useCallback(async (path, options = {}) => {
    if (!cloudConfig.url) return null;
    return fetch(`${cloudConfig.url}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers(), ...options.headers },
    });
  }, [cloudConfig.url, headers]);

  return {
    isCloudConnected, setIsCloudConnected,
    isSyncing, setIsSyncing,
    cloudSaveError, setCloudSaveError,
    ubicacionIdCacheRef,
    headers, sbFetch,
  };
};
