import { useCallback } from "react";
import { normalizarId } from "../utils";

export const useBajas = ({
  isCloudConnected, cloudConfig, obtenerCabeceras, setCloudSaveError,
  data, setData, setBajasCloud,
  syncInventarioNube, guardarBajaEnNube,
}) => {

  const registrarBajasEspecial = useCallback(async (grupo, rawId, cantidadStr, { sexo = null } = {}) => {
    const id = normalizarId(rawId);
    const cantidad = parseInt(cantidadStr, 10);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const itemAfectado = data[grupo].find(
      (item) => normalizarId(item.id) === id,
    );
    if (!itemAfectado || itemAfectado.count < cantidad) {
      alert("No hay suficientes unidades en este tanque/celda para registrar esa cantidad de bajas.");
      return;
    }

    const nuevoCount = itemAfectado.count - cantidad;

    const newData = { ...data };
    const extrasBaja = nuevoCount <= 0
      ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
      : {};
    newData[grupo] = newData[grupo].map((item) => {
      const cId = normalizarId(item.id).toLowerCase();
      if (cId === id.toLowerCase())
        return { ...item, id: id, count: nuevoCount, ...extrasBaja };
      return item;
    });
    setData(newData);

    const hoyISO = new Date().toISOString().split("T")[0];
    const horaISO = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    setBajasCloud((prev) => [{ id: Date.now(), fecha: hoyISO, hora: horaISO, tanque_id: id, cantidad, causa: null, sexo: sexo || null, lote_id: itemAfectado.lote_id || null }, ...prev]);

    if (isCloudConnected) {
      try {
        await syncInventarioNube({ ...itemAfectado, id: id, grupo: grupo, count: nuevoCount });
        await guardarBajaEnNube({
          tanqueId: id, grupo, cantidad,
          categoria: "Mortalidad",
          loteIdLocal: itemAfectado.lote_id,
          sexo,
        });
      } catch (err) {
        console.error("Error al guardar baja en la nube:", err);
        setCloudSaveError(`Error al guardar baja: ${err.message}`);
      }
    }
  }, [isCloudConnected, data, setData, setBajasCloud, syncInventarioNube, guardarBajaEnNube, setCloudSaveError]);

  const registrarBaja = useCallback(async (grupo, id) => {
    const cantPrompt = window.prompt("¿Cuántas bajas deseas registrar?", "1");
    if (cantPrompt === null) return;
    await registrarBajasEspecial(grupo, id, cantPrompt);
  }, [registrarBajasEspecial]);

  const borrarBajaCloud = useCallback(async (bajaId) => {
    setBajasCloud(prev => prev.filter(b => b.id !== bajaId));
    if (isCloudConnected) {
      try {
        await fetch(`${cloudConfig.url}/rest/v1/bajas?id=eq.${bajaId}`, {
          method: "DELETE",
          headers: obtenerCabeceras(),
        });
      } catch (err) {
        console.error("Error al borrar baja en la nube:", err);
      }
    }
  }, [isCloudConnected, cloudConfig.url, obtenerCabeceras, setBajasCloud]);

  return { registrarBajasEspecial, registrarBaja, borrarBajaCloud };
};
