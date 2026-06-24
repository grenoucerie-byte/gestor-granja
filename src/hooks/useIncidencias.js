import { useCallback } from "react";

export const useIncidencias = ({
  isCloudConnected, cloudConfig, obtenerCabeceras, setCloudSaveError,
  incidencias, setIncidencias,
  aplicarTratamiento,
}) => {

  const abrirIncidencia = useCallback(async (form) => {
    if (!form.agenteCausante || !form.agenteCausante.trim()) {
      alert("Indica el agente causante de la incidencia.");
      return;
    }
    if (!form.racewaysAfectados || !form.racewaysAfectados.trim()) {
      alert("Indica al menos un raceway afectado.");
      return;
    }
    const tieneTratamiento = form.tratProducto && form.tratProducto.trim();
    const resumenTratamiento = tieneTratamiento
      ? `${form.tratCategoria}: ${form.tratProducto.trim()}${form.tratDosis ? ` (${form.tratDosis})` : ""}${form.tratFrecuencia ? ` · ${form.tratFrecuencia}` : ""}`
      : "";

    const nuevaIncidencia = {
      id: Date.now(),
      fecha_inicio: form.fechaInicio || new Date().toLocaleDateString("es-ES"),
      agente_causante: form.agenteCausante.trim(),
      raceways_afectados: form.racewaysAfectados.trim(),
      tratamiento_aplicado: resumenTratamiento,
      severidad: form.severidad || "Media",
      estado: "Abierta",
      notas: form.notas || "",
      fecha_cierre: "",
    };
    setIncidencias((prev) => [nuevaIncidencia, ...prev]);

    if (isCloudConnected) {
      try {
        const res = await fetch(`${cloudConfig.url}/rest/v1/incidencias`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(nuevaIncidencia),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = errBody.message || errBody.hint || errBody.details || "Error desconocido";
          setCloudSaveError(`Error al guardar incidencia (${res.status}): ${msg}`);
        } else {
          setCloudSaveError(null);
        }
      } catch (err) {
        setCloudSaveError(`Error de red al guardar incidencia: ${err.message}`);
      }
    }

    if (tieneTratamiento) {
      const tanques = form.racewaysAfectados
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const tanqueId of tanques) {
        await aplicarTratamiento(tanqueId, form.tratProducto.trim(), form.tratDosis || "-", {
          categoria: form.tratCategoria,
          frecuencia: form.tratFrecuencia || "",
          notas: `Por incidencia: ${form.agenteCausante.trim()}`,
        });
      }
    }

    return nuevaIncidencia;
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setCloudSaveError, setIncidencias, aplicarTratamiento]);

  const actualizarIncidencia = useCallback(async (id, cambios) => {
    setIncidencias((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, ...cambios } : inc)),
    );

    if (isCloudConnected) {
      try {
        const res = await fetch(`${cloudConfig.url}/rest/v1/incidencias?id=eq.${id}`, {
          method: "PATCH",
          headers: obtenerCabeceras(),
          body: JSON.stringify(cambios),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = errBody.message || errBody.hint || errBody.details || "Error desconocido";
          setCloudSaveError(`Error al actualizar incidencia (${res.status}): ${msg}`);
        } else {
          setCloudSaveError(null);
        }
      } catch (err) {
        setCloudSaveError(`Error de red al actualizar incidencia: ${err.message}`);
      }
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setCloudSaveError, setIncidencias]);

  const cerrarIncidencia = useCallback(async (id, notasCierre, tratamientoFinal) => {
    const actual = incidencias.find((inc) => inc.id === id);
    const notasCombinadas = notasCierre
      ? `${actual?.notas ? actual.notas + " | " : ""}Cierre: ${notasCierre}`
      : actual?.notas || "";
    const cambios = {
      estado: "Cerrada",
      fecha_cierre: new Date().toLocaleDateString("es-ES"),
      notas: notasCombinadas,
      ...(tratamientoFinal ? { tratamiento_aplicado: tratamientoFinal } : {}),
    };
    await actualizarIncidencia(id, cambios);
  }, [incidencias, actualizarIncidencia]);

  const borrarIncidencia = useCallback(async (id) => {
    setIncidencias((prev) => prev.filter((inc) => inc.id !== id));
    if (isCloudConnected) {
      try {
        await fetch(`${cloudConfig.url}/rest/v1/incidencias?id=eq.${id}`, {
          method: "DELETE",
          headers: obtenerCabeceras(),
        });
      } catch (err) {
        console.error("Error al borrar incidencia en la nube:", err);
      }
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setIncidencias]);

  return { abrirIncidencia, actualizarIncidencia, cerrarIncidencia, borrarIncidencia };
};
