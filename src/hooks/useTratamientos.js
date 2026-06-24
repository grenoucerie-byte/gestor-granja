import { useCallback } from "react";
import { esEventoNoTratamiento, parseFechaTrat } from "../utils";
import { INTERVALO_2A_DOSIS, PRODUCTOS_2A_DOSIS } from "../constants";

export const useTratamientos = ({
  isCloudConnected, cloudConfig, obtenerCabeceras, setCloudSaveError,
  tratamientos, setTratamientos,
  // Bulk state
  bulkTratSelectedTanks, setBulkTratSelectedTanks,
  bulkTratCategoria, bulkTratProducto, setBulkTratProducto,
  bulkTratDosis, setBulkTratDosis, bulkTratTiempo, setBulkTratTiempo,
  bulkTratFecha,
}) => {

  const aplicarTratamiento = useCallback(async (id, tipo, dosis, extras = {}) => {
    const nuevoTrat = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: new Date().toLocaleDateString("es-ES"),
      hora: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      tanque: id,
      tipo,
      dosis,
      categoria: extras.categoria || "alimento",
      frecuencia: extras.frecuencia || "",
      numDosis: extras.numDosis || "",
      notas: extras.notas || "",
    };
    setTratamientos((prev) => [nuevoTrat, ...prev]);

    if (isCloudConnected) {
      try {
        const res = await fetch(`${cloudConfig.url}/rest/v1/tratamientos`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            id: nuevoTrat.id, fecha: nuevoTrat.fecha, hora: nuevoTrat.hora,
            tanque: nuevoTrat.tanque, tipo: nuevoTrat.tipo, dosis: nuevoTrat.dosis,
            categoria: nuevoTrat.categoria, frecuencia: nuevoTrat.frecuencia,
            num_dosis: nuevoTrat.numDosis, notas: nuevoTrat.notas,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error("Supabase tratamiento error:", res.status, errBody);
          setCloudSaveError(`Error al guardar tratamiento (${res.status}): ${errBody.message || errBody.hint || 'Error desconocido'}`);
        }
      } catch (err) {
        console.error("Error al aplicar tratamiento en la nube:", err);
      }
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setCloudSaveError, setTratamientos]);

  const aplicarTratamientoMasivo = useCallback(async () => {
    if (bulkTratSelectedTanks.length === 0) return alert('Selecciona al menos un tanque.');
    if (!bulkTratProducto) return alert('Escribe el producto o tratamiento.');

    const horaTrat = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    let fechaFormat = new Date().toLocaleDateString('es-ES');
    if (bulkTratFecha) {
      const [yyyy, mm, dd] = bulkTratFecha.split('-');
      fechaFormat = `${dd}/${mm}/${yyyy}`;
    }

    const nuevosTrats = bulkTratSelectedTanks.map((tanqueId, index) => ({
      id: Date.now() + index,
      fecha: fechaFormat,
      hora: horaTrat,
      tanque: tanqueId,
      tipo: bulkTratProducto,
      dosis: bulkTratDosis || '-',
      categoria: bulkTratCategoria,
      frecuencia: '',
      notas: bulkTratTiempo || '',
    }));

    setTratamientos((prev) => [...nuevosTrats, ...prev]);

    if (isCloudConnected) {
      for (const t of nuevosTrats) {
        try {
          const res = await fetch(`${cloudConfig.url}/rest/v1/tratamientos`, {
            method: 'POST',
            headers: { ...obtenerCabeceras(), Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({
              id: t.id, fecha: t.fecha, hora: t.hora, tanque: t.tanque,
              tipo: t.tipo, dosis: t.dosis, categoria: t.categoria,
              frecuencia: t.frecuencia, notas: t.notas,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('Error bulk trat:', res.status, err);
            setCloudSaveError(`Error al guardar tratamiento (${res.status}): ${err.message || err.hint || 'Error desconocido'}`);
          }
        } catch (e) {
          console.error('Error insertando bulk trat:', e);
          setCloudSaveError(`Error de red al guardar tratamiento: ${e.message}`);
        }
      }
    }

    alert('✅ Tratamiento aplicado a ' + bulkTratSelectedTanks.length + ' tanque(s).');
    setBulkTratSelectedTanks([]);
    setBulkTratProducto('');
    setBulkTratDosis('');
    setBulkTratTiempo('');
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setCloudSaveError, setTratamientos,
      bulkTratSelectedTanks, setBulkTratSelectedTanks, bulkTratProducto, setBulkTratProducto,
      bulkTratDosis, setBulkTratDosis, bulkTratTiempo, setBulkTratTiempo, bulkTratFecha, bulkTratCategoria]);

  const obtenerAlarmasTratamientos = useCallback(() => {
    const alarmas = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const MAX_DIAS_ALARMA = 14;

    const requiere2aDosis = (t) => {
      if (esEventoNoTratamiento(t)) return false;
      const cat = (t.categoria || "").toLowerCase();
      if (cat.includes("desparasit")) return true;
      if (parseInt(t.numDosis, 10) > 1) return true;
      const tipo = (t.tipo || "").toLowerCase();
      return PRODUCTOS_2A_DOSIS.some(p => tipo.includes(p));
    };

    const extraerProductoBase = (tipo) => {
      const t = (tipo || "").toUpperCase();
      if (t.includes("LEVAMISOL")) return "LEVAMISOL";
      if (t.includes("GANADEXIL")) return "GANADEXIL";
      if (t.includes("VETERELIN")) return "VETERELIN";
      if (t.includes("SAL")) return "SAL";
      return t.trim();
    };

    const candidatos = tratamientos.filter(t => t.tipo && requiere2aDosis(t));

    const porTanqueProducto = {};
    candidatos.forEach(t => {
      const producto = extraerProductoBase(t.tipo);
      const key = `${t.tanque}||${producto}`;
      if (!porTanqueProducto[key]) porTanqueProducto[key] = [];
      porTanqueProducto[key].push(t);
    });

    const tanquesConAlarma = new Set();

    Object.entries(porTanqueProducto).forEach(([key, trats]) => {
      const tanqueId = key.split("||")[0];
      if (tanquesConAlarma.has(tanqueId)) return;

      const sorted = trats
        .map(t => ({ ...t, _fecha: parseFechaTrat(t.fecha) }))
        .filter(t => t._fecha)
        .sort((a, b) => b._fecha - a._fecha);

      if (sorted.length === 0) return;

      if (sorted.length >= 2) {
        const diasEntre = Math.floor((sorted[0]._fecha - sorted[1]._fecha) / (1000 * 60 * 60 * 24));
        if (diasEntre >= 3 && diasEntre <= 12) return;
      }

      const primera = sorted[sorted.length - 1];
      const diasPasados = Math.floor((hoy - primera._fecha) / (1000 * 60 * 60 * 24));

      if (diasPasados > MAX_DIAS_ALARMA) return;
      if (diasPasados < 5) return;
      if (sorted.length >= 2) return;

      const diasParaVencer = INTERVALO_2A_DOSIS - diasPasados;
      tanquesConAlarma.add(tanqueId);
      alarmas.push({
        tanqueId,
        producto: extraerProductoBase(primera.tipo),
        fechaPrimera: primera.fecha,
        diasPasados,
        diasParaVencer,
        vencida: diasParaVencer < 0,
      });
    });

    return alarmas;
  }, [tratamientos]);

  const alarmas2aDosis = obtenerAlarmasTratamientos();
  const alarmasDesparasitacion = alarmas2aDosis.map(a => a.tanqueId);

  return {
    aplicarTratamiento,
    aplicarTratamientoMasivo,
    alarmas2aDosis,
    alarmasDesparasitacion,
  };
};
