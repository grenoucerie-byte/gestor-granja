import { useCallback, useState } from "react";
import { normalizarId, extraerPesoDeNotas, parseFechaTrat } from "../utils";

// Lee (nunca escribe) movimientos_lote y lotes para reconstruir cuándo entró
// un lote a una ubicación y qué triajes/desdobles ha sufrido. No toca RLS ni
// crea tablas nuevas: reutiliza las mismas tablas que useLotes ya alimenta.
export const useHistorialCrecimiento = ({ sbFetch, resolverUbicacionId }) => {
  const [historialMovimientos, setHistorialMovimientos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const cargarMovimientosTanque = useCallback(async (tanqueId) => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    try {
      const ubicacionId = await resolverUbicacionId(tanqueId);
      if (!ubicacionId) {
        setHistorialMovimientos([]);
        return;
      }
      const [resDestino, resOrigen] = await Promise.all([
        sbFetch(`movimientos_lote?ubicacion_destino_id=eq.${ubicacionId}&select=*&order=fecha.asc`),
        sbFetch(`movimientos_lote?ubicacion_origen_id=eq.${ubicacionId}&select=*&order=fecha.asc`),
      ]);
      const destino = resDestino && resDestino.ok ? await resDestino.json() : [];
      const origen = resOrigen && resOrigen.ok ? await resOrigen.json() : [];

      const combinados = [
        ...destino.map((m) => ({ ...m, direccion: "entrada" })),
        ...origen.map((m) => ({ ...m, direccion: "salida" })),
      ].sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));

      setHistorialMovimientos(combinados);
    } catch (err) {
      console.error("Error al cargar histórico de movimientos del tanque:", err);
      setErrorHistorial("No se pudo cargar el histórico de movimientos de este tanque.");
      setHistorialMovimientos([]);
    } finally {
      setCargandoHistorial(false);
    }
  }, [sbFetch, resolverUbicacionId]);

  // "HH:MM" -> minutos desde medianoche, para desempatar pesajes del mismo día.
  const parseHoraMinutos = (horaStr) => {
    if (!horaStr) return 0;
    const m = String(horaStr).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  // Curva de peso: se construye en cliente a partir del array de tratamientos
  // ya cargado en memoria (nada de red extra) — cada pesaje deja una marca
  // [PESO_MEDIO:x] en notas (ver construirNotaPeso/extraerPesoDeNotas).
  //
  // Importante: se ordena por fecha Y hora. Los tratamientos se guardan con
  // el más reciente al principio del array (ver App.jsx, setTratamientos
  // ((prev) => [nuevo, ...prev])), así que si dos pesajes son del mismo día
  // y solo se ordenara por fecha, el más nuevo quedaría antes que el más
  // viejo en la curva (orden "al revés").
