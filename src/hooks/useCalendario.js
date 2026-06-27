import { useCallback } from "react";

export const useCalendario = (cloudConfig, session) => {
  const obtenerTareas = useCallback(async () => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return [];
    
    try {
      const query = cloudConfig.url + "/rest/v1/tareas_programadas?order=fecha_programada.asc&limit=200";
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

  const crearTarea = useCallback(async (tarea) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return false;
    
    try {
      const res = await fetch(cloudConfig.url + "/rest/v1/tareas_programadas", {
        method: "POST",
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          tipo: tarea.tipo,
          tanque_id: tarea.tanqueId || null,
          grupo: tarea.grupo || null,
          fecha_programada: tarea.fechaProgramada,
          fecha_limite: tarea.fechaLimite || null,
          estado: "pendiente",
          asignado_a: session && session.user ? session.user.email : null,
          notas: tarea.notas || null,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [cloudConfig, session]);

  const completarTarea = useCallback(async (id) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return false;
    
    try {
      const res = await fetch(cloudConfig.url + "/rest/v1/tareas_programadas?id=eq." + id, {
        method: "PATCH",
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ estado: "completada" }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [cloudConfig]);

  const eliminarTarea = useCallback(async (id) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key) return false;
    
    try {
      const res = await fetch(cloudConfig.url + "/rest/v1/tareas_programadas?id=eq." + id, {
        method: "DELETE",
        headers: {
          "apikey": cloudConfig.key,
          "Authorization": "Bearer " + cloudConfig.key,
          "Prefer": "return=minimal",
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [cloudConfig]);

  const generarTareasPeriodicas = useCallback(async (tanques) => {
    if (!cloudConfig || !cloudConfig.url || !cloudConfig.key || !tanques) return;
    
    const tareas = [];
    const hoy = new Date();
    
    for (const tanque of tanques) {
      if (!tanque.count || parseInt(tanque.count) <= 0) continue;
      
      // Desparasitacion cada 30 dias
      const fechaDesparasitacion = new Date(hoy);
      fechaDesparasitacion.setDate(hoy.getDate() + 30);
      tareas.push({
        tipo: "desparasitacion",
        tanque_id: tanque.id,
        grupo: tanque.grupo,
        fecha_programada: fechaDesparasitacion.toISOString().split("T")[0],
        notas: "Desparasitacion periodica automatica",
      });
      
      // Censo semanal
      const fechaCenso = new Date(hoy);
      fechaCenso.setDate(hoy.getDate() + 7);
      tareas.push({
        tipo: "censo",
        tanque_id: tanque.id,
        grupo: tanque.grupo,
        fecha_programada: fechaCenso.toISOString().split("T")[0],
        notas: "Censo semanal",
      });
    }
    
    if (tareas.length > 0) {
      try {
        await fetch(cloudConfig.url + "/rest/v1/tareas_programadas", {
          method: "POST",
          headers: {
            "apikey": cloudConfig.key,
            "Authorization": "Bearer " + cloudConfig.key,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
          },
          body: JSON.stringify(tareas),
        });
      } catch (err) {
        console.error("Error generando tareas:", err);
      }
    }
  }, [cloudConfig]);

  return { obtenerTareas, crearTarea, completarTarea, eliminarTarea, generarTareasPeriodicas };
};
