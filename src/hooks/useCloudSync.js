import { useEffect, useCallback, useRef } from "react";
import { normalizarId } from "../utils";
import {
  asegurarEstructurasIncubadoras, asegurarEstructurasRenacuajos,
  asegurarEstructurasMetamorfoseadas, asegurarEstructurasReproduccion,
  asegurarEstructurasAdultas, asegurarEstructurasNaveVerde,
  asegurarEstructurasBrumacion, asegurarEstructurasInvernadero,
  DEFAULT_DATA,
} from "../gridStructures";

export const useCloudSync = ({
  cloudConfig, isCloudConnected, setIsCloudConnected,
  setIsSyncing, setCloudSaveError,
  headers: obtenerCabeceras,
  // State values (for persistence effects & reading current values)
  data, puestas, tratamientos, incidencias, inventario,
  registrosAlimentacion, planesAlimentacion, planesTratamiento, planesFase, productosDisponibles,
  // Setters
  setData, setPuestas, setTratamientos, setIncidencias,
  setBajasCloud, setNotasPizarra, setInventario,
  setPlanesAlimentacion, setPlanesTratamiento, setPlanesFase, setProductosDisponibles,
  setRegistrosAlimentacion,
  // Dependencies from other hooks
  obtenerOCrearLote,
}) => {
  // Internal refs for async access to latest state
  const dataRef = useRef(data);
  const puestasRef = useRef(puestas);
  const tratamientosRef = useRef(tratamientos);
  const inventarioRef = useRef(inventario);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { puestasRef.current = puestas; }, [puestas]);
  useEffect(() => { tratamientosRef.current = tratamientos; }, [tratamientos]);
  useEffect(() => { inventarioRef.current = inventario; }, [inventario]);

  const calcularCensoGrupo = (grupoArr) => {
    if (!grupoArr) return 0;
    return grupoArr.reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  };

  // ─── syncInventarioNube ──────────────────────────────────────────────────────
  const syncInventarioNube = useCallback(async (item) => {
    if (!isCloudConnected) return;
    const tabla = item.grupo ? "censos" : "inventario";

    const payload = item.grupo
      ? {
          id: item.id,
          grupo: item.grupo,
          count: item.count !== undefined && item.count !== "" ? parseInt(item.count, 10) : 0,
          last_date: item.last_date || item.lastDate || null,
          type: item.type || null,
          dose: item.dose || null,
          obs: item.obs || null,
          peso_medio: item.peso_medio || item.pesoMedio || null,
          muestras: item.muestras || null,
          fecha_fase: item.fecha_fase || item.fechaFase || null
        }
      : item;

    try {
      const res = await fetch(`${cloudConfig.url}/rest/v1/${tabla}`, {
        method: "POST",
        headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Error al sincronizar en la nube (${res.status}):`, errorText);
        if (errorText.includes("column") && (errorText.includes("muestras") || errorText.includes("peso_medio") || errorText.includes("fecha_fase"))) {
          alert(
            "⚠️ ATENCIÓN: Faltan columnas en tu base de datos de Supabase.\n\n" +
            "Ve al panel de Supabase -> SQL Editor, pega el siguiente texto y pulsa RUN:\n\n" +
            "ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS muestras text;\n" +
            "ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS peso_medio text;\n" +
            "ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS fecha_fase date;\n\n" +
            "Una vez hecho esto, los datos se guardarán correctamente."
          );
        } else {
          alert(`⚠️ Error de base de datos Supabase:\n\n${errorText}\n\nPor favor, dime qué dice este mensaje.`);
        }
      }
    } catch (err) {
      console.error(`Error al sincronizar ${tabla} en la nube:`, err);
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras]);

  // ─── guardarTratamientoEnNube ────────────────────────────────────────────────
  const guardarTratamientoEnNube = useCallback(async (payload, etiqueta = "movimiento") => {
    try {
      const res = await fetch(`${cloudConfig.url}/rest/v1/tratamientos`, {
        method: "POST",
        headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody.message || errBody.hint || errBody.details || "Error desconocido";
        console.error(`Supabase tratamientos error (${etiqueta}):`, res.status, errBody);
        setCloudSaveError(`Error al guardar ${etiqueta} (${res.status}): ${msg}`);
        return false;
      }
      setCloudSaveError(null);
      return true;
    } catch (err) {
      console.error(`Error de red al guardar ${etiqueta}`, err);
      setCloudSaveError(`Error de red al guardar ${etiqueta}: ${err.message}`);
      return false;
    }
  }, [cloudConfig.url, obtenerCabeceras, setCloudSaveError]);

  // ─── guardarBajaEnNube ───────────────────────────────────────────────────────
  const guardarBajaEnNube = useCallback(async ({ tanqueId, grupo, cantidad, categoria, causa, tipoSalida, destino, loteIdLocal = null, sexo = null }) => {
    try {
      const loteId = await obtenerOCrearLote(tanqueId, grupo, loteIdLocal);
      if (!loteId) {
        setCloudSaveError(`Aviso: se guardó en el historial pero no se pudo enlazar a un lote (sin ubicación reconocida para "${tanqueId}").`);
        return false;
      }
      const res = await fetch(`${cloudConfig.url}/rest/v1/bajas`, {
        method: "POST",
        headers: obtenerCabeceras(),
        body: JSON.stringify({
          lote_id: loteId,
          tanque_id: tanqueId,
          fecha: new Date().toISOString().split("T")[0],
          hora: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          cantidad,
          categoria: categoria || "Mortalidad",
          tipo_salida: tipoSalida || null,
          destino: destino || null,
          causa: causa || "",
          sexo: sexo || null,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (errText.includes("sexo")) {
          alert("Falta columna en Supabase. Ve a SQL Editor y ejecuta:\n\nALTER TABLE public.bajas ADD COLUMN IF NOT EXISTS sexo text;");
        }
        console.error("Error al guardar en bajas:", res.status, errText);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error de red al guardar en bajas:", err);
      return false;
    }
  }, [cloudConfig.url, obtenerCabeceras, obtenerOCrearLote, setCloudSaveError]);

  // ─── syncPlanesNube ──────────────────────────────────────────────────────────
  const syncPlanesNube = useCallback(async (tipo, datos) => {
    if (!isCloudConnected || !cloudConfig.url) return;
    try {
      await fetch(`${cloudConfig.url}/rest/v1/configuracion`, {
        method: "POST",
        headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: tipo, datos, updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.warn("Error al sincronizar planes:", e);
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras]);

  // ─── cargarPlanesDesdeNube ───────────────────────────────────────────────────
  const cargarPlanesDesdeNube = useCallback(async () => {
    if (!isCloudConnected || !cloudConfig.url) return;
    try {
      const res = await fetch(`${cloudConfig.url}/rest/v1/configuracion?id=in.(planes_alimentacion,planes_tratamiento,planes_fase,productos_disponibles)`, {
        headers: obtenerCabeceras(),
      });
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach(row => {
        if (!row.datos) return;
        if (row.id === "planes_alimentacion") setPlanesAlimentacion(prev => ({ ...row.datos, ...prev }));
        if (row.id === "planes_tratamiento") setPlanesTratamiento(prev => ({ ...row.datos, ...prev }));
        if (row.id === "planes_fase") setPlanesFase(prev => ({ ...row.datos, ...prev }));
        if (row.id === "productos_disponibles" && Array.isArray(row.datos)) setProductosDisponibles(row.datos);
      });
    } catch (e) {
      console.warn("Error al cargar planes desde nube:", e);
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setPlanesAlimentacion, setPlanesTratamiento, setPlanesFase, setProductosDisponibles]);

  // ─── subirDatosLocalesALaNube ────────────────────────────────────────────────
  const subirDatosLocalesALaNube = useCallback(async (config) => {
    setIsSyncing(true);
    try {
      const hdrs = {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      };

      const filasCensos = [];
      const currentData = dataRef.current;
      Object.keys(currentData).forEach((grupo) => {
        currentData[grupo].forEach((item) => {
          const cleanId = normalizarId(item.id);
          const esGrid = grupo === "renacuajos" && /^E\d-F\d-C\d+/.test(cleanId);
          if (!esGrid || item.count > 0 || item.obs || item.type || item.dose) {
            filasCensos.push({
              id: cleanId, grupo, count: parseInt(item.count, 10) || 0,
              last_date: item.lastDate || "", type: item.type || "",
              dose: item.dose || "", obs: item.obs || "",
            });
          }
        });
      });

      if (filasCensos.length > 0) {
        await fetch(`${config.url}/rest/v1/censos`, { method: "POST", headers: hdrs, body: JSON.stringify(filasCensos) });
      }

      const currentPuestas = puestasRef.current;
      if (currentPuestas.length > 0) {
        await fetch(`${config.url}/rest/v1/puestas`, {
          method: "POST", headers: hdrs,
          body: JSON.stringify(currentPuestas.map((p) => ({
            id: p.id, fecha: p.fecha, hora: p.hora, tanque: p.tanque,
            grupo: p.grupo, destino: p.destino || null, huevos: p.huevos || null,
            tipo_puesta: p.tipo_puesta || null, estado: p.estado || null, obs: p.obs || null,
          }))),
        });
      }

      try {
        const currentInv = inventarioRef.current;
        if (currentInv.length > 0) {
          await fetch(`${config.url}/rest/v1/inventario`, { method: "POST", headers: hdrs, body: JSON.stringify(currentInv) });
        }
      } catch (err) {
        console.log("Error al subir inventario.", err);
      }

      const currentTrat = tratamientosRef.current;
      if (currentTrat.length > 0) {
        await fetch(`${config.url}/rest/v1/tratamientos`, {
          method: "POST", headers: hdrs,
          body: JSON.stringify(currentTrat.map((t) => ({
            id: t.id, fecha: t.fecha, hora: t.hora, tanque: t.tanque, tipo: t.tipo, dosis: t.dosis,
          }))),
        });
      }

      alert("Datos locales migrados a la nube con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al migrar los datos locales.");
    } finally {
      setIsSyncing(false);
    }
  }, [setIsSyncing]);

  // ─── cargarDatosDeLaNube ─────────────────────────────────────────────────────
  const cargarDatosDeLaNube = useCallback(async (configOverride = null) => {
    const config = configOverride || cloudConfig;
    if (!config.url || !config.key) return;
    setIsSyncing(true);
    try {
      const hdrs = { apikey: config.key, Authorization: `Bearer ${config.key}` };

      const resCensos = await fetch(`${config.url}/rest/v1/censos?select=*`, { headers: hdrs });
      if (!resCensos.ok) throw new Error("Error al obtener censos");
      const censosNubeRaw = await resCensos.json();

      const censosNube = censosNubeRaw.map(c => ({
        id: c.id || '', grupo: c.grupo || 'adultas', count: c.count || 0,
        lastDate: c.last_date || '', type: c.type || '', dose: c.dose || '',
        obs: c.obs || '',
        pesoMedio: c.peso_medio !== undefined && c.peso_medio !== null ? String(c.peso_medio) : '',
        muestras: c.muestras || '', fechaFase: c.fecha_fase || '', lote_id: c.lote_id || null
      }));

      const resPuestas = await fetch(`${config.url}/rest/v1/puestas?select=*&order=id.desc`, { headers: hdrs });
      if (!resPuestas.ok) throw new Error("Error al obtener puestas");
      const puestasNube = await resPuestas.json();

      const resTratamientos = await fetch(`${config.url}/rest/v1/tratamientos?select=*&order=id.desc`, { headers: hdrs });
      if (!resTratamientos.ok) throw new Error("Error al obtener tratamientos");
      const tratNube = await resTratamientos.json();

      let incidenciasNube = [];
      try {
        const resInc = await fetch(`${config.url}/rest/v1/incidencias?select=*&order=id.desc`, { headers: hdrs });
        if (resInc.ok) incidenciasNube = await resInc.json();
      } catch (err) { console.log("Error al cargar incidencias.", err); }

      let bajasNube = [];
      try {
        const resBajas = await fetch(`${config.url}/rest/v1/bajas?select=id,fecha,hora,tanque_id,cantidad,causa,sexo,lote_id&order=fecha.desc`, { headers: hdrs });
        if (resBajas.ok) bajasNube = await resBajas.json();
      } catch (err) { console.log("Error al cargar bajas.", err); }

      let notasNube = [];
      try {
        const resNotas = await fetch(`${config.url}/rest/v1/notas_pizarra?select=*&order=created_at.desc`, { headers: hdrs });
        if (resNotas.ok) notasNube = await resNotas.json();
      } catch (err) { console.log("Error al cargar notas pizarra.", err); }

      try {
        const resInv = await fetch(`${config.url}/rest/v1/inventario?select=*`, { headers: hdrs });
        if (resInv.ok) {
          const invNube = await resInv.json();
          if (invNube && invNube.length > 0) {
            setInventario(invNube);
          } else if (inventarioRef.current && inventarioRef.current.length > 0) {
            fetch(`${config.url}/rest/v1/inventario`, {
              method: "POST",
              headers: { ...hdrs, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
              body: JSON.stringify(inventarioRef.current),
            }).catch((e) => console.error("Error al subir inventario local:", e));
          }
        }
      } catch (err) { console.log("Tabla de inventario no encontrada o error", err); }

      const corruptos = [];
      const nuevaData = {
        adultas: asegurarEstructurasAdultas(
          { adultas: censosNube.filter(c => c.grupo === "adultas" || c.grupo === "grupo31" || c.grupo === "grupo24" || c.grupo === "grupo21") },
          corruptos,
        ),
        naveVerde: asegurarEstructurasNaveVerde(censosNube.filter(c => c.grupo === "naveVerde"), corruptos),
        incubadoras: asegurarEstructurasIncubadoras(censosNube.filter(c => c.grupo === "incubadoras"), corruptos),
        renacuajos: asegurarEstructurasRenacuajos(censosNube.filter(c => c.grupo === "renacuajos"), corruptos),
        metamorfoseadas: asegurarEstructurasMetamorfoseadas(censosNube.filter(c => c.grupo === "metamorfoseadas"), corruptos),
        reproduccion: asegurarEstructurasReproduccion(censosNube.filter(c => c.grupo === "reproduccion"), corruptos),
        brumacion: asegurarEstructurasBrumacion(censosNube.filter(c => c.grupo === "brumacion")),
        invernadero: asegurarEstructurasInvernadero(censosNube.filter(c => c.grupo === "invernadero")),
      };

      if (corruptos.length > 0) {
        console.log("Registros corruptos identificados para eliminación en Supabase:", corruptos);
        (async () => {
          for (const item of corruptos) {
            try {
              const response = await fetch(`${config.url}/rest/v1/censos?id=eq.${encodeURIComponent(item.id)}`, { method: "DELETE", headers: hdrs });
              if (response.ok) console.log(`Registro corrupto eliminado: ${item.id}`);
              else console.warn(`Eliminación fallida para ${item.id}:`, response.status);
            } catch (err) { console.error(`Error al eliminar corrupto ${item.id}:`, err); }
          }
        })();
      }

      Object.keys(DEFAULT_DATA).forEach((k) => {
        if (!nuevaData[k] || nuevaData[k].length === 0) nuevaData[k] = DEFAULT_DATA[k];
      });

      const censoTotalLocal =
        calcularCensoGrupo(dataRef.current.adultas) +
        calcularCensoGrupo(dataRef.current.naveVerde) +
        calcularCensoGrupo(dataRef.current.renacuajos) +
        calcularCensoGrupo(dataRef.current.metamorfoseadas);

      if (
        censosNube.length === 0 &&
        (puestasRef.current.length > 0 || tratamientosRef.current.length > 0 || censoTotalLocal > 0)
      ) {
        if (window.confirm("La base de datos en la nube está vacía. ¿Quieres subir tus datos locales actuales a la nube para no perderlos?")) {
          await subirDatosLocalesALaNube(config);
          setIsCloudConnected(true);
          return;
        }
      }

      setData(nuevaData);
      setPuestas(prev => {
        const nubeIds = new Set(puestasNube.map(p => String(p.id)));
        return [...puestasNube, ...prev.filter(p => !nubeIds.has(String(p.id)))];
      });
      setTratamientos(prev => {
        const nubeIds = new Set(tratNube.map(t => String(t.id)));
        return [...tratNube, ...prev.filter(t => !nubeIds.has(String(t.id)))];
      });
      setIncidencias(prev => {
        const nubeIds = new Set(incidenciasNube.map(i => String(i.id)));
        return [...incidenciasNube, ...prev.filter(i => !nubeIds.has(String(i.id)))];
      });
      setBajasCloud(prev => {
        if (bajasNube.length === 0) return prev;
        const nubeIds = new Set(bajasNube.map(b => b.id));
        return [...bajasNube, ...prev.filter(b => !nubeIds.has(b.id))];
      });
      setNotasPizarra(prev => {
        if (notasNube.length === 0) return prev;
        const nubeIds = new Set(notasNube.map(n => String(n.id)));
        return [...notasNube, ...prev.filter(n => !nubeIds.has(String(n.id)))];
      });
      setIsCloudConnected(true);
      cargarPlanesDesdeNube();
    } catch (err) {
      console.error(err);
      setIsCloudConnected(false);
      alert("No se pudo conectar a la base de datos de la nube. Detalle del error:\n\n" + (err.message || err) + "\n\nComprueba la URL y la Anon Key.");
    } finally {
      setIsSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudConfig]);

  // ─── localStorage persistence ────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("grenoucerie_data", JSON.stringify(data)); }, [data]);
  useEffect(() => { localStorage.setItem("grenoucerie_puestas", JSON.stringify(puestas)); }, [puestas]);
  useEffect(() => { localStorage.setItem("grenoucerie_tratamientos", JSON.stringify(tratamientos)); }, [tratamientos]);
  useEffect(() => { localStorage.setItem("grenoucerie_incidencias", JSON.stringify(incidencias)); }, [incidencias]);
  useEffect(() => { localStorage.setItem("grenoucerie_inventario", JSON.stringify(inventario)); }, [inventario]);
  useEffect(() => { localStorage.setItem("grenoucerie_alimentacion", JSON.stringify(registrosAlimentacion)); }, [registrosAlimentacion]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_planes_alimentacion", JSON.stringify(planesAlimentacion));
    syncPlanesNube("planes_alimentacion", planesAlimentacion);
  }, [planesAlimentacion]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_planes_tratamiento", JSON.stringify(planesTratamiento));
    syncPlanesNube("planes_tratamiento", planesTratamiento);
  }, [planesTratamiento]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_planes_fase", JSON.stringify(planesFase));
    syncPlanesNube("planes_fase", planesFase);
  }, [planesFase]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_productos", JSON.stringify(productosDisponibles));
    syncPlanesNube("productos_disponibles", productosDisponibles);
  }, [productosDisponibles]);

  // ─── Auto-load on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (cloudConfig.url && cloudConfig.key) {
      cargarDatosDeLaNube();
      cargarPlanesDesdeNube();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-refresh every 5 min (NANO instance can't handle 60s with 8 queries) ─
  useEffect(() => {
    if (!isCloudConnected) return;
    const intervalo = setInterval(() => { cargarDatosDeLaNube(); }, 300000);
    return () => clearInterval(intervalo);
  }, [isCloudConnected, cargarDatosDeLaNube]);

  return {
    syncInventarioNube,
    guardarTratamientoEnNube,
    guardarBajaEnNube,
    syncPlanesNube,
    cargarPlanesDesdeNube,
    cargarDatosDeLaNube,
    subirDatosLocalesALaNube,
  };
};
