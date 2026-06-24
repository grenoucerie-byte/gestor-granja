import { useCallback } from "react";
import { normalizarId } from "../utils";

export const useLotes = ({ sbFetch, ubicacionIdCacheRef }) => {
  const resolverUbicacionId = useCallback(async (tanqueId) => {
    const codigo = normalizarId(tanqueId);
    if (!codigo) return null;
    if (codigo in ubicacionIdCacheRef.current) return ubicacionIdCacheRef.current[codigo];
    try {
      const res = await sbFetch(`ubicaciones?codigo=eq.${encodeURIComponent(codigo)}&select=id`);
      if (!res || !res.ok) { ubicacionIdCacheRef.current[codigo] = null; return null; }
      const rows = await res.json();
      if (rows[0]?.id) {
        ubicacionIdCacheRef.current[codigo] = rows[0].id;
        return rows[0].id;
      }
      const resCrear = await sbFetch("ubicaciones", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ codigo, nombre: codigo }),
      });
      if (!resCrear || !resCrear.ok) {
        const errDetail = resCrear ? await resCrear.text().catch(() => "") : "sin respuesta";
        console.error(`No se pudo auto-crear ubicación "${codigo}" (${resCrear?.status}):`, errDetail);
        ubicacionIdCacheRef.current[codigo] = null;
        return null;
      }
      const creados = await resCrear.json();
      const nuevoId = creados[0]?.id || null;
      ubicacionIdCacheRef.current[codigo] = nuevoId;
      return nuevoId;
    } catch (err) {
      console.error("Error al resolver ubicación:", err);
      return null;
    }
  }, [sbFetch, ubicacionIdCacheRef]);

  const actualizarLoteIdEnCenso = useCallback(async (tanqueId, loteId) => {
    try {
      await sbFetch(`censos?id=eq.${encodeURIComponent(normalizarId(tanqueId))}`, {
        method: "PATCH",
        body: JSON.stringify({ lote_id: loteId }),
      });
    } catch (err) {
      console.error("Error al guardar lote_id en censo:", err);
    }
  }, [sbFetch]);

  const obtenerOCrearLote = useCallback(async (tanqueId, grupo, loteIdLocal = null) => {
    if (loteIdLocal) return loteIdLocal;

    const ubicacionId = await resolverUbicacionId(tanqueId);
    if (!ubicacionId) {
      console.warn(`No se encontró ubicación para "${tanqueId}"; no se podrá enlazar el lote.`);
      return null;
    }

    try {
      const resBuscar = await sbFetch(
        `lotes?ubicacion_id=eq.${ubicacionId}&activo=eq.true&select=id&order=fecha_alta.desc&limit=1`
      );
      if (resBuscar && resBuscar.ok) {
        const encontrados = await resBuscar.json();
        if (encontrados[0]?.id) {
          await actualizarLoteIdEnCenso(tanqueId, encontrados[0].id);
          return encontrados[0].id;
        }
      }

      const resCrear = await sbFetch("lotes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          nombre: `Lote_${grupo}_${normalizarId(tanqueId)}`,
          ubicacion_id: ubicacionId,
          activo: true,
          fecha_alta: new Date().toISOString().split("T")[0],
        }),
      });
      if (!resCrear || !resCrear.ok) {
        console.error("Error al crear lote:", resCrear ? await resCrear.text() : "");
        return null;
      }
      const creados = await resCrear.json();
      const nuevoLoteId = creados[0]?.id || null;
      if (nuevoLoteId) await actualizarLoteIdEnCenso(tanqueId, nuevoLoteId);
      return nuevoLoteId;
    } catch (err) {
      console.error("Error al resolver/crear lote:", err);
      return null;
    }
  }, [sbFetch, resolverUbicacionId, actualizarLoteIdEnCenso]);

  const moverLoteCompleto = useCallback(async (loteId, ubicacionOrigenId, ubicacionDestinoId, motivo) => {
    try {
      await sbFetch(`lotes?id=eq.${loteId}`, {
        method: "PATCH",
        body: JSON.stringify({ ubicacion_id: ubicacionDestinoId }),
      });
      await sbFetch("movimientos_lote", {
        method: "POST",
        body: JSON.stringify({
          lote_id: loteId,
          ubicacion_origen_id: ubicacionOrigenId,
          ubicacion_destino_id: ubicacionDestinoId,
          fecha: new Date().toISOString().split("T")[0],
          motivo: motivo || "",
        }),
      });
    } catch (err) {
      console.error("Error al registrar movimiento de lote:", err);
    }
  }, [sbFetch]);

  const crearLoteHijoEnDestino = useCallback(async (loteOrigenId, ubicacionOrigenId, ubicacionDestinoId, tanqueDestinoId, grupoDestino, motivo) => {
    try {
      const resCrear = await sbFetch("lotes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          nombre: `Lote_${grupoDestino}_${normalizarId(tanqueDestinoId)}`,
          ubicacion_id: ubicacionDestinoId,
          lote_origen_id: loteOrigenId,
          activo: true,
          fecha_alta: new Date().toISOString().split("T")[0],
        }),
      });
      if (!resCrear || !resCrear.ok) { console.error("Error al crear lote hijo:", resCrear ? await resCrear.text() : ""); return null; }
      const creados = await resCrear.json();
      const nuevoLoteId = creados[0]?.id || null;
      if (nuevoLoteId) {
        await actualizarLoteIdEnCenso(tanqueDestinoId, nuevoLoteId);
        await sbFetch("movimientos_lote", {
          method: "POST",
          body: JSON.stringify({
            lote_id: nuevoLoteId,
            ubicacion_origen_id: ubicacionOrigenId,
            ubicacion_destino_id: ubicacionDestinoId,
            fecha: new Date().toISOString().split("T")[0],
            motivo: motivo || "",
          }),
        });
      }
      return nuevoLoteId;
    } catch (err) {
      console.error("Error al crear lote hijo en destino:", err);
      return null;
    }
  }, [sbFetch, actualizarLoteIdEnCenso]);

  const procesarTrasladoLote = useCallback(async ({ tanqueOrigenId, grupoOrigen, loteIdLocalOrigen, tanqueDestinoId, grupoDestino, esCompleto, motivo }) => {
    try {
      const [ubicacionOrigenId, ubicacionDestinoId] = await Promise.all([
        resolverUbicacionId(tanqueOrigenId),
        resolverUbicacionId(tanqueDestinoId),
      ]);
      if (!ubicacionOrigenId || !ubicacionDestinoId) {
        console.warn(`No se pudo resolver ubicación de origen/destino para el traslado ${tanqueOrigenId} -> ${tanqueDestinoId}.`);
        return;
      }
      const loteId = await obtenerOCrearLote(tanqueOrigenId, grupoOrigen, loteIdLocalOrigen);
      if (!loteId) return;

      if (esCompleto) {
        await moverLoteCompleto(loteId, ubicacionOrigenId, ubicacionDestinoId, motivo);
        await actualizarLoteIdEnCenso(tanqueDestinoId, loteId);
        await actualizarLoteIdEnCenso(tanqueOrigenId, null);
      } else {
        await crearLoteHijoEnDestino(loteId, ubicacionOrigenId, ubicacionDestinoId, tanqueDestinoId, grupoDestino, motivo);
      }
    } catch (err) {
      console.error("Error al procesar traslado normalizado:", err);
    }
  }, [resolverUbicacionId, obtenerOCrearLote, moverLoteCompleto, crearLoteHijoEnDestino, actualizarLoteIdEnCenso]);

  return {
    resolverUbicacionId,
    obtenerOCrearLote,
    actualizarLoteIdEnCenso,
    moverLoteCompleto,
    crearLoteHijoEnDestino,
    procesarTrasladoLote,
  };
};
