import { useCallback } from "react";

export const useAudit = (cloudConfig, session) => {
  const registrarAccion = useCallback(async ({ tabla, accion, registroId, datosAnteriores, datosNuevos }) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key || !session || !session.user) return;
    
    try {
      await fetch(cloudConfig.url + "/rest/v1/audit_log", {
        method: "POST",
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          tabla: tabla,
          registro_id: registroId,
          accion: accion,
          datos_anteriores: datosAnteriores || null,
          datos_nuevos: datosNuevos || null,
          usuario_email: session.user.email,
        }),
      });
    } catch (err) {
      console.error("Audit error:", err);
    }
  }, [cloudConfig, session]);

  return { registrarAccion };
};
