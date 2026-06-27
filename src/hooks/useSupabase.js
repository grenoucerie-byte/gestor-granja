import { useState, useRef, useCallback } from "react";

export const useSupabase = (session, cloudConfig) => {
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState(null);
  const ubicacionIdCacheRef = useRef({});

  const getHeaders = useCallback(() => {
    const PUBLISHABLE_KEY = "sb_publishable_jykeA73vChjrKc4CeMI8TQ_uZuZXfYQ";
    const token = (session && session.access_token) || PUBLISHABLE_KEY;
    return {
      "apikey": token,
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
    };
  }, [session]);

  const sbFetch = useCallback(async (path, options = {}) => {
    if (!cloudConfig || !cloudConfig.url) return null;
    return fetch(cloudConfig.url + "/rest/v1/" + path, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
    });
  }, [cloudConfig, getHeaders]);

  return {
    isCloudConnected, setIsCloudConnected,
    isSyncing, setIsSyncing,
    cloudSaveError, setCloudSaveError,
    ubicacionIdCacheRef,
    headers: getHeaders, sbFetch,
  };
};
