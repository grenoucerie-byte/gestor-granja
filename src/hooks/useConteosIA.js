import { useCallback, useState } from "react";
import { normalizarId } from "../utils";

// Lecturas del bot de vision (tabla conteos_ia, ver sql/003_conteos_ia.sql).
//
// Principio: el bot mide, la app inventaria. Este hook NUNCA aplica una
// lectura al censo por su cuenta; solo las trae, las compara con lo que hay
// ahora, y expone aplicar/descartar para que los llame una persona.
//
// El conteo por foto no se usa como censo: la vision subcuenta de forma
// sistematica porque los renacuajos se solapan en la bandeja (en las dos
// mediciones que tenemos, entre un 17% y un 23% por debajo del calculo por
// peso). Manda unidades_calculadas, que sale de biomasa/peso medio.
export const useConteosIA = ({ sbFetch, isCloudConnected }) => {
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargarPendientes = useCallback(async () => {
    if (!isCloudConnected) return;
    setCargando(true);
    setError(null);
    try {
      const res = await sbFetch(
        "conteos_ia?estado=eq.pendiente&select=*&order=medido_en.desc&limit=50",
      );
      if (!res) { setPendientes([]); return; }
      if (!res.ok) {
        // 404 = la tabla aun no existe (falta ejecutar 003_conteos_ia.sql).
        // No es un error que deba alarmar: simplemente todavia no hay buzon.
        if (res.status === 404) { setPendientes([]); return; }
        throw new Error(`${res.status}`);
      }
      setPendientes(await res.json());
    } catch (err) {
      console.error("Error al cargar lecturas de vision:", err);
      setError("No se pudieron cargar las lecturas del bot de visión.");
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  }, [sbFetch, isCloudConnected]);

  const marcarRevisado = useCallback(async (id, estado, revisadoPor, fuenteDefinitiva = null) => {
    const res = await sbFetch(`conteos_ia?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        estado,
        revisado_por: revisadoPor || null,
        revisado_en: new Date().toISOString(),
        // Queda registrado cual de las tres cifras se acepto, no solo que se
        // acepto algo: es lo que permitira ver con el tiempo cual acierta mas.
        fuente_definitiva: estado === "aplicado" ? fuenteDefinitiva : null,
      }),
    });
    if (!res || !res.ok) throw new Error("No se pudo actualizar la lectura.");
    setPendientes((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }, [sbFetch]);

  // Las tres estimaciones de cuantos animales hay, cada una por su lado.
  //
  // No se resuelven aqui: se devuelven las tres para que la persona que
  // revisa vea en que se parecen y en que no, y elija. El sistema no decide
  // cual es la buena.
  //
  // Ojo con la circularidad: el "peso medio usado" del bot suele salir de
  // dividir la biomasa entre el conteo humano, asi que biomasa/peso_medio
  // devuelve otra vez el conteo humano y no valida nada. La cifra
  // independiente es la del muestreo (biomasa / peso_medio_muestreo).
  const fuentesDe = useCallback((lectura) => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const biomasa = num(lectura.biomasa_g);
    const pesoMuestreo = num(lectura.peso_medio_muestreo);

    const humano = num(lectura.conteo_humano);
    const muestreo =
      num(lectura.unidades_por_muestreo) ||
      (biomasa && pesoMuestreo ? Math.round(biomasa / pesoMuestreo) : null);
    const foto = num(lectura.conteo_foto);

    const lista = [
      { clave: "humano", etiqueta: "Operario", valor: humano, nota: lectura.operario || "" },
      { clave: "muestreo", etiqueta: "Muestreo", valor: muestreo, nota: pesoMuestreo ? `${pesoMuestreo} g/ud` : "" },
      { clave: "foto", etiqueta: "Visión", valor: foto, nota: "suele quedarse corta" },
    ].filter((f) => f.valor !== null);

    // Cuanto se separan entre si las cifras disponibles, en % sobre la menor.
    let dispersion = null;
    if (lista.length > 1) {
      const valores = lista.map((f) => f.valor);
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      if (min > 0) dispersion = Math.round(((max - min) / min) * 1000) / 10;
    }

    // Sugerencia por defecto, no decision: se prefiere el muestreo por ser la
    // unica independiente; si no lo hay, lo que dijo la persona.
    const sugerida = muestreo !== null ? "muestreo" : humano !== null ? "humano" : foto !== null ? "foto" : null;

    return { lista, dispersion, sugerida, humano, muestreo, foto };
  }, []);

  // Une cada lectura con el censo que hay ahora mismo en esa bandeja, para
  // poder ensenar la diferencia antes de que nadie decida nada.
  const compararConCenso = useCallback((lectura, data, unidadesElegidas = null) => {
    const idNorm = normalizarId(lectura.tanque_id);
    let actual = null;
    let grupo = null;
    Object.entries(data || {}).forEach(([g, lista]) => {
      if (actual || !Array.isArray(lista)) return;
      const encontrado = lista.find((c) => normalizarId(c.id) === idNorm);
      if (encontrado) { actual = encontrado; grupo = g; }
    });

    const countActual = actual ? parseInt(actual.count, 10) || 0 : null;
    // Si quien revisa ha elegido una de las tres fuentes, manda esa.
    const propuesto = unidadesElegidas != null
      ? parseInt(unidadesElegidas, 10) || 0
      : parseInt(lectura.unidades_calculadas, 10) || 0;
    const diferencia = countActual === null ? null : propuesto - countActual;
    const porcentaje =
      countActual === null || countActual === 0
        ? null
        : Math.round((diferencia / countActual) * 1000) / 10;

    // Desvio del conteo por foto frente al calculo por peso. Se muestra para
    // ir viendo si el sesgo de la vision es estable.
    const foto = parseInt(lectura.conteo_foto, 10);
    const desvioFoto =
      Number.isFinite(foto) && propuesto > 0
        ? Math.round(((foto - propuesto) / propuesto) * 1000) / 10
        : null;

    return { grupo, celdaActual: actual, countActual, propuesto, diferencia, porcentaje, desvioFoto };
  }, []);

  return { pendientes, cargando, error, cargarPendientes, marcarRevisado, compararConCenso, fuentesDe };
};
