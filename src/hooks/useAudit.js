import { useCallback } from "react";

const PUBLISHABLE_KEY = "sb_publishable_jykeA73vChjrKc4CeMI8TQ_uZuZXfYQ";

export const useAudit = (cloudConfig, session) => {
  const registrarAccion = useCallback(async ({ tabla, accion, registroId, datosAnteriores, datosNuevos }) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key || !session || !session.user) return;
    
    try {
      await fetch(cloudConfig.url + "/rest/v1/audit_log", {
        method: "POST",
        headers: {
          "apikey": PUBLISHABLE_KEY,
          "Authorization": "Bearer " + PUBLISHABLE_KEY,
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
