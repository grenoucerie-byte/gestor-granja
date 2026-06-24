import { useCallback } from "react";
import { normalizarId, getFechaHoyNorm, parseSubgrupos, serializeSubgrupos } from "../utils";

export const useTraslados = ({
  isCloudConnected, setCloudSaveError,
  isProcessing, setIsProcessing,
  data, setData,
  transferenciaActiva, setTransferenciaActiva,
  modalPesajeActivo, setModalPesajeActivo,
  modalTrasladoEstandar, setModalTrasladoEstandar,
  pesajeForm, setPesajeForm,
  trasladoForm, setTrasladoForm,
  setTratamientos,
  planesAlimentacion, setPlanesAlimentacion,
  syncInventarioNube, guardarTratamientoEnNube,
  procesarTrasladoLote,
}) => {

  const ejecutarTraslado = useCallback(async (rawDestinoCell, destinoGrupo) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const { cell: rawOrigenCell, grupo: origenGrupo } = transferenciaActiva;
    const origenCell = { ...rawOrigenCell, id: normalizarId(rawOrigenCell.id) };
    const destinoCell = { ...rawDestinoCell, id: normalizarId(rawDestinoCell.id) };

    if (origenCell.id === destinoCell.id) {
      alert("No puedes trasladar al mismo raceway.");
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }

    const itemOrigen = data[origenGrupo]?.find(
      (i) => normalizarId(i.id).toLowerCase() === normalizarId(origenCell.id).toLowerCase(),
    );
    if (!itemOrigen) {
      alert(`Error: No se encontró el tanque de origen "${origenCell.id}" en el grupo "${origenGrupo}".`);
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }

    if (itemOrigen && itemOrigen.obs && itemOrigen.obs.includes("[BLOQUEADO")) {
      alert("El tanque de origen está BLOQUEADO. No puedes trasladar ranas desde él.");
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }
    const itemDestinoTest = data[destinoGrupo]?.find(
      (i) => normalizarId(i.id).toLowerCase() === normalizarId(destinoCell.id).toLowerCase(),
    );
    if (itemDestinoTest && itemDestinoTest.obs && itemDestinoTest.obs.includes("[BLOQUEADO")) {
      alert("El tanque de destino está BLOQUEADO. No puedes trasladar ranas hacia él.");
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }

    if (origenGrupo === "renacuajos" || origenGrupo === "metamorfoseadas") {
      setModalPesajeActivo({ origenCell, origenGrupo, destinoCell, destinoGrupo });
      setPesajeForm({ gramosTotales: "", m1: "", m2: "", m3: "", motivo: "" });
    } else {
      setModalTrasladoEstandar({ origenCell, origenGrupo, destinoCell, destinoGrupo });
      setTrasladoForm({ cantidad: 1, motivo: "", copiarTratamiento: true, copiarAlimentacion: true, sexo: "" });
    }
    setTransferenciaActiva(null);
    setIsProcessing(false);
  }, [isProcessing, transferenciaActiva, data, setIsProcessing, setTransferenciaActiva,
      setModalPesajeActivo, setPesajeForm, setModalTrasladoEstandar, setTrasladoForm]);

  const confirmarTrasladoConPesaje = useCallback(async () => {
    if (!modalPesajeActivo || isProcessing) return;
    setIsProcessing(true);
    const { origenCell, origenGrupo, destinoCell, destinoGrupo } = modalPesajeActivo;
    const gTotales = parseFloat(pesajeForm.gramosTotales) || 0;
    const m1 = parseFloat(pesajeForm.m1) || 0;
    const m2 = parseFloat(pesajeForm.m2) || 0;
    const m3 = parseFloat(pesajeForm.m3) || 0;
    const motivo = pesajeForm.motivo || "";

    if (gTotales <= 0) {
      alert("Por favor, ingresa los gramos totales a trasladar.");
      setIsProcessing(false);
      return;
    }

    const muestrasList = [m1, m2, m3].filter((m) => m > 0);
    if (muestrasList.length === 0) {
      alert("Por favor, ingresa al menos una muestra para calcular el peso medio.");
      setIsProcessing(false);
      return;
    }

    const sumaMuestras = muestrasList.reduce((a, b) => a + b, 0);
    const pesoMedioPor10 = sumaMuestras / muestrasList.length;
    const pesoMedioUnidad = pesoMedioPor10 / 10;
    const cant = Math.round(gTotales / pesoMedioUnidad);

    if (cant <= 0) {
      alert("El cálculo de unidades dio 0. Revisa las muestras y los gramos totales.");
      setIsProcessing(false);
      return;
    }

    const cleanOrigenId = normalizarId(origenCell.id);
    const cleanDestinoId = normalizarId(destinoCell.id);

    const itemOrigen = data[origenGrupo]?.find((i) => normalizarId(i.id) === cleanOrigenId);
    if (!itemOrigen || itemOrigen.count < cant) {
      alert(`No hay suficientes unidades en el origen (${itemOrigen ? itemOrigen.count : 0} uds disponibles) para cubrir las ${cant} unidades calculadas por el pesaje (${gTotales}g).`);
      setIsProcessing(false);
      return;
    }

    const nuevoCountOrigen = itemOrigen.count - cant;
    const itemDestino = data[destinoGrupo]?.find((i) => normalizarId(i.id) === cleanDestinoId) || { id: cleanDestinoId, count: 0 };
    const nuevoCountDestino = itemDestino.count + cant;

    const newData = { ...data };

    const actualizarLista = (grupo, idBuscado, nuevoCount, itemBase, isOrigen) => {
      let modificado = false;
      const extras = isOrigen && nuevoCount <= 0
        ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
        : {};
      let list = newData[grupo].map((item) => {
        const cId = normalizarId(item.id);
        if (cId.toLowerCase() === idBuscado.toLowerCase()) {
          modificado = true;
          return { ...item, id: idBuscado, count: nuevoCount, lastDate: getFechaHoyNorm(), ...extras };
        }
        return item;
      });
      if (!modificado) {
        list.push({ ...itemBase, id: idBuscado, count: nuevoCount, lastDate: getFechaHoyNorm(), ...extras });
      }
      newData[grupo] = list;
    };

    actualizarLista(origenGrupo, cleanOrigenId, nuevoCountOrigen, itemOrigen, true);
    actualizarLista(destinoGrupo, cleanDestinoId, nuevoCountDestino, itemDestino, false);
    setData(newData);

    const horaTrat = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const fechaTrat = new Date().toLocaleDateString("es-ES");
    const detallePesaje = ` (${gTotales}g, Peso medio: ${pesoMedioUnidad.toFixed(3)}g/ud${motivo ? `, Motivo: ${motivo}` : ""})`;

    const movOrigen = {
      id: Date.now(), fecha: fechaTrat, hora: horaTrat,
      tanque: cleanOrigenId, tipo: `Traslado a ${cleanDestinoId}${detallePesaje}`, dosis: String(cant),
    };
    const movDestino = {
      id: Date.now() + 1, fecha: fechaTrat, hora: horaTrat,
      tanque: cleanDestinoId, tipo: `Traslado desde ${cleanOrigenId}${detallePesaje}`, dosis: String(cant),
    };

    setTratamientos((prev) => [movOrigen, movDestino, ...prev]);
    setModalPesajeActivo(null);
    setIsProcessing(false);

    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: cleanOrigenId, grupo: origenGrupo, count: nuevoCountOrigen, last_date: getFechaHoyNorm() });
        await syncInventarioNube({ id: cleanDestinoId, grupo: destinoGrupo, count: nuevoCountDestino, last_date: getFechaHoyNorm() });
        await guardarTratamientoEnNube(movOrigen, "traslado con pesaje");
        await guardarTratamientoEnNube(movDestino, "traslado con pesaje");

        if (itemDestino.count > 0) {
          console.warn(`Traslado a destino ya ocupado (${cleanDestinoId}): se omite la actualización de lote para evitar mezclar lotes.`);
        } else {
          await procesarTrasladoLote({
            tanqueOrigenId: cleanOrigenId, grupoOrigen: origenGrupo, loteIdLocalOrigen: itemOrigen.lote_id,
            tanqueDestinoId: cleanDestinoId, grupoDestino: destinoGrupo,
            esCompleto: nuevoCountOrigen <= 0, motivo,
          });
        }
      } catch (err) {
        console.error("Error al registrar traslado con pesaje en la nube", err);
        setCloudSaveError(`Error al registrar traslado con pesaje: ${err.message}`);
      }
    }
  }, [modalPesajeActivo, isProcessing, pesajeForm, data, isCloudConnected,
      setIsProcessing, setData, setTratamientos, setModalPesajeActivo,
      syncInventarioNube, guardarTratamientoEnNube, procesarTrasladoLote, setCloudSaveError]);

  const confirmarTrasladoEstandar = useCallback(async () => {
    if (!modalTrasladoEstandar || isProcessing) return;
    setIsProcessing(true);

    const { origenCell, origenGrupo, destinoCell, destinoGrupo } = modalTrasladoEstandar;
    const cant = parseInt(trasladoForm.cantidad, 10);
    const motivo = trasladoForm.motivo || "";
    const copiarTratamiento = trasladoForm.copiarTratamiento;
    const copiarAlimentacion = trasladoForm.copiarAlimentacion;

    if (isNaN(cant) || cant <= 0) {
      alert("Por favor, introduce una cantidad válida mayor que 0.");
      setIsProcessing(false);
      return;
    }

    const cleanOrigenId = normalizarId(origenCell.id);
    const cleanDestinoId = normalizarId(destinoCell.id);

    const itemOrigen = data[origenGrupo]?.find(
      (i) => normalizarId(i.id).toLowerCase() === cleanOrigenId.toLowerCase()
    );

    if (!itemOrigen || itemOrigen.count < cant) {
      alert(`No hay suficientes unidades en el origen (${itemOrigen ? itemOrigen.count : 0} uds disponibles) para realizar el traslado.`);
      setIsProcessing(false);
      return;
    }

    const nuevoCountOrigen = itemOrigen.count - cant;
    const itemDestino = data[destinoGrupo]?.find(
      (i) => normalizarId(i.id).toLowerCase() === cleanDestinoId.toLowerCase()
    ) || { id: cleanDestinoId, count: 0 };
    const nuevoCountDestino = itemDestino.count + cant;

    const idOrigenExacto = itemOrigen.id;
    const idDestinoExacto = itemDestino.id;

    const newData = { ...data };

    const extrasOrigen = nuevoCountOrigen <= 0
      ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
      : {};

    const extrasDestino = {};
    if (copiarTratamiento && itemOrigen) {
      extrasDestino.type = itemOrigen.type || "";
      extrasDestino.dose = itemOrigen.dose || "";
      extrasDestino.obs = itemOrigen.obs || "";
      extrasDestino.muestras = itemOrigen.muestras || "";
      extrasDestino.pesoMedio = itemOrigen.pesoMedio || "";
      extrasDestino.peso_medio = itemOrigen.peso_medio || itemOrigen.pesoMedio || "";
    }

    if (origenGrupo === destinoGrupo) {
      newData[origenGrupo] = newData[origenGrupo].map((item) => {
        const cId = normalizarId(item.id).toLowerCase();
        if (cId === normalizarId(idOrigenExacto).toLowerCase()) {
          return { ...item, id: item.id, count: nuevoCountOrigen, ...extrasOrigen };
        }
        if (cId === normalizarId(idDestinoExacto).toLowerCase()) {
          return { ...item, id: item.id, count: nuevoCountDestino, ...extrasDestino };
        }
        return item;
      });
      if (!newData[destinoGrupo].some((i) => normalizarId(i.id).toLowerCase() === normalizarId(idDestinoExacto).toLowerCase())) {
        newData[destinoGrupo].push({ id: idDestinoExacto, count: nuevoCountDestino, ...extrasDestino });
      }
    } else {
      newData[origenGrupo] = newData[origenGrupo].map((item) => {
        const cId = normalizarId(item.id).toLowerCase();
        if (cId === normalizarId(idOrigenExacto).toLowerCase()) {
          return { ...item, id: item.id, count: nuevoCountOrigen, ...extrasOrigen };
        }
        return item;
      });
      let existeDestino = false;
      newData[destinoGrupo] = newData[destinoGrupo].map((item) => {
        const cId = normalizarId(item.id).toLowerCase();
        if (cId === normalizarId(idDestinoExacto).toLowerCase()) {
          existeDestino = true;
          return { ...item, id: item.id, count: nuevoCountDestino, ...extrasDestino };
        }
        return item;
      });
      if (!existeDestino) {
        newData[destinoGrupo].push({ id: idDestinoExacto, count: nuevoCountDestino, ...extrasDestino });
      }
    }

    const sexoTraslado = trasladoForm.sexo || "";
    if (sexoTraslado) {
      const origenEnNew = newData[origenGrupo]?.find(
        (i) => normalizarId(i.id).toLowerCase() === normalizarId(idOrigenExacto).toLowerCase()
      );
      if (origenEnNew) {
        const parsed = parseSubgrupos(origenEnNew.obs || "");
        let restante = cant;
        parsed.subgrupos = parsed.subgrupos.map(sg => {
          if (sg.sexo === sexoTraslado && restante > 0) {
            const quitar = Math.min(sg.cantidad, restante);
            restante -= quitar;
            return { ...sg, cantidad: sg.cantidad - quitar };
          }
          return sg;
        });
        origenEnNew.obs = serializeSubgrupos(parsed.subgrupos, parsed.comentario);
      }
    }

    setData(newData);

    if (copiarAlimentacion && planesAlimentacion && planesAlimentacion[idOrigenExacto]) {
      const newPlanes = { ...planesAlimentacion };
      newPlanes[idDestinoExacto] = JSON.parse(JSON.stringify(planesAlimentacion[idOrigenExacto]));
      if (nuevoCountOrigen <= 0) delete newPlanes[idOrigenExacto];
      setPlanesAlimentacion(newPlanes);
    } else if (nuevoCountOrigen <= 0 && planesAlimentacion && planesAlimentacion[idOrigenExacto]) {
      const newPlanes = { ...planesAlimentacion };
      delete newPlanes[idOrigenExacto];
      setPlanesAlimentacion(newPlanes);
    }

    const horaTrat = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const fechaTrat = new Date().toLocaleDateString("es-ES");
    const sufijoMotivo = motivo && motivo.trim() !== "" ? ` (Motivo: ${motivo.trim()})` : "";

    const movOrigen = {
      id: Date.now(), fecha: fechaTrat, hora: horaTrat,
      tanque: idOrigenExacto, tipo: `Traslado a ${idDestinoExacto}${sufijoMotivo}`, dosis: String(cant),
    };
    const movDestino = {
      id: Date.now() + 1, fecha: fechaTrat, hora: horaTrat,
      tanque: idDestinoExacto, tipo: `Traslado desde ${idOrigenExacto}${sufijoMotivo}`, dosis: String(cant),
    };

    setTratamientos((prev) => [movOrigen, movDestino, ...prev]);

    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: idOrigenExacto, grupo: origenGrupo, count: nuevoCountOrigen, last_date: getFechaHoyNorm(), ...extrasOrigen });
        await syncInventarioNube({ id: idDestinoExacto, grupo: destinoGrupo, count: nuevoCountDestino, last_date: getFechaHoyNorm(), ...extrasDestino });
        await guardarTratamientoEnNube(movOrigen, "traslado");
        await guardarTratamientoEnNube(movDestino, "traslado");

        if (itemDestino.count > 0) {
          console.warn(`Traslado a destino ya ocupado (${idDestinoExacto}): se omite la actualización de lote para evitar mezclar lotes.`);
        } else {
          await procesarTrasladoLote({
            tanqueOrigenId: idOrigenExacto, grupoOrigen: origenGrupo, loteIdLocalOrigen: itemOrigen.lote_id,
            tanqueDestinoId: idDestinoExacto, grupoDestino: destinoGrupo,
            esCompleto: nuevoCountOrigen <= 0, motivo,
          });
        }
      } catch (err) {
        console.error("Error al registrar traslado en la nube", err);
        setCloudSaveError(`Error al registrar traslado: ${err.message}`);
      }
    }

    setModalTrasladoEstandar(null);
    setTransferenciaActiva(null);
    setIsProcessing(false);
  }, [modalTrasladoEstandar, isProcessing, trasladoForm, data, isCloudConnected,
      planesAlimentacion, setPlanesAlimentacion, setIsProcessing, setData, setTratamientos,
      setModalTrasladoEstandar, setTransferenciaActiva,
      syncInventarioNube, guardarTratamientoEnNube, procesarTrasladoLote, setCloudSaveError]);

  return { ejecutarTraslado, confirmarTrasladoConPesaje, confirmarTrasladoEstandar };
};
