import { useCallback } from "react";

export const useFasesHistorial = (cloudConfig) => {
  const registrarCambioFase = useCallback(async ({ tanqueId, faseAnterior, faseNueva, diasEnFase, loteId, usuarioEmail }) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return false;
    
    try {
      const res = await fetch(cloudConfig.url + "/rest/v1/fases_historial", {
        method: "POST",
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          tanque_id: tanqueId,
          fase_anterior: faseAnterior,
          fase_nueva: faseNueva,
          dias_en_fase: diasEnFase,
          lote_id: loteId,
          usuario_email: usuarioEmail || null,
        }),
      });
      return res.ok;
    } catch (err) {
      console.error("FasesHistorial error:", err);
      return false;
    }
  }, [cloudConfig]);

  const obtenerHistorial = useCallback(async (tanqueId) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return [];
    
    try {
      const query = cloudConfig.url + "/rest/v1/fases_historial?tanque_id=eq." + encodeURIComponent(tanqueId) + "&order=fecha_cambio.desc&limit=50";
      const res = await fetch(query, {
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
        },
      });
      return await res.json();
    } catch {
      return [];
    }
  }, [cloudConfig]);

  const obtenerHistorialGeneral = useCallback(async () => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return [];
    
    try {
      const query = cloudConfig.url + "/rest/v1/fases_historial?order=fecha_cambio.desc&limit=100";
      const res = await fetch(query, {
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
        },
      });
      return await res.json();
    } catch {
      return [];
    }
  }, [cloudConfig]);

  return { registrarCambioFase, obtenerHistorial, obtenerHistorialGeneral };
};
