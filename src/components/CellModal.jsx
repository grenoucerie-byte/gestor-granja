import React, { useState, useEffect } from "react";
import { normalizarId, parseCellId, parseSubgrupos, serializeSubgrupos, esEventoNoTratamiento, lockIcon } from "../utils";

function CellModal({
  selectedCell, setSelectedCell,
  data, setData,
  puestas, setPuestas,
  tratamientos, setTratamientos,
  isCloudConnected,
  syncInventarioNube, guardarTratamientoEnNube, guardarBajaEnNube,
  aplicarTratamiento,
  registrarBajasEspecial,
  setCloudSaveError,
  initModalPuestaDesdeInc,
  planesAlimentacion, setPlanesAlimentacion,
  planesTratamiento, setPlanesTratamiento,
  registrosAlimentacion,
  cloudConfig, obtenerCabeceras,
  setTransferenciaActiva,
  registrarPuesta,
  inventario,
  isProcessing, setIsProcessing,
  planesExpanded, setPlanesExpanded,
}) {
  // Estados locales para el modal de edición de celda
  const [modalCount, setModalCount] = useState(0);
  const [modalDose, setModalDose] = useState("");
  const [modalType, setModalType] = useState("");
  const [modalObs, setModalObs] = useState("");
  const [modalLockReason, setModalLockReason] = useState("Revisar");
  
  // Estados para invernadero
  const [modalPh, setModalPh] = useState("");
  const [modalNo3, setModalNo3] = useState("");
  const [modalNo2, setModalNo2] = useState("");
  const [modalAireacion, setModalAireacion] = useState("");
  const [modalFechaInicio, setModalFechaInicio] = useState("");
  const [modalFaseAguaVerde, setModalFaseAguaVerde] = useState("Fase 1: Preparación");
  const [modalAdiciones, setModalAdiciones] = useState([]);
  const [modalIngredienteAdicionar, setModalIngredienteAdicionar] = useState("Nitrato de Calcio");
  const [modalCantAdicionar, setModalCantAdicionar] = useState("");
  
  const [modalSubgrupos, setModalSubgrupos] = useState([]);
  
  const [modalLastDate, setModalLastDate] = useState("");
  const [modalTratTipo, setModalTratTipo] = useState("");
  const [modalTratDosis, setModalTratDosis] = useState("");
  const [modalTratCategoria, setModalTratCategoria] = useState("alimento");
  const [modalTratFrecuencia, setModalTratFrecuencia] = useState("");
  const [modalTratNumDosis, setModalTratNumDosis] = useState("");
  const [modalTratNumTomas, setModalTratNumTomas] = useState("1");
  const [modalTratNotas, setModalTratNotas] = useState("");
  const [mostrarTratExpandido, setMostrarTratExpandido] = useState(false);
  const [modalTratNumIndividuos, setModalTratNumIndividuos] = useState("1");
  const [modalBajaCant, setModalBajaCant] = useState("1");
  const [modalBajaSexo, setModalBajaSexo] = useState("");
  const [modalSalidaCant, setModalSalidaCant] = useState("1");
  const [modalRegaDestino, setModalRegaDestino] = useState("");
  const [modalTipoSalida, setModalTipoSalida] = useState("REGA");

  // Alimentación individual del modal
  const [modalAlimItems, setModalAlimItems] = useState([{ producto: "", gramos: "" }]);

  // Biomasa (Renacuajos)
  const [biomasaLotes, setBiomasaLotes] = useState([]);
  const [modalPesoMedio, setModalPesoMedio] = useState("");

  useEffect(() => {
    if (selectedCell) {
      const parsedData = parseSubgrupos(selectedCell.cell.obs || "");
      
      setModalSubgrupos(parsedData.subgrupos);
      
      setModalCount(selectedCell.cell.count || 0);
      setModalDose(selectedCell.cell.dose || "");
      setModalType(selectedCell.cell.type || "");
      setModalObs(parsedData.comentario || "");
      setModalLastDate(selectedCell.cell.lastDate || "");
      setModalTratTipo("");
      setModalTratDosis("");
      setModalTratCategoria("alimento");
      setModalTratFrecuencia("");
      setModalTratNumDosis("");
      setModalTratNotas("");
      setMostrarTratExpandido(false);
      setModalTratNumIndividuos("1");
      setModalBajaCant("1");
      setModalBajaSexo("");
      setModalPesoMedio(selectedCell.cell.pesoMedio || "");

      if (selectedCell.grupo === "invernadero") {
        setModalPh(selectedCell.cell.ph || "");
        setModalNo3(selectedCell.cell.no3 || "");
        setModalNo2(selectedCell.cell.no2 || "");
        setModalAireacion(selectedCell.cell.aireacion || "");
        
        let extra = {};
        try {
          if (selectedCell.cell.muestras) {
            extra = JSON.parse(selectedCell.cell.muestras);
          }
        } catch (e) {}
        setModalFechaInicio(extra.fechaInicio || "");
        setModalFaseAguaVerde(extra.fase || "Fase 1: Preparación");
        setModalAdiciones(extra.adiciones || []);
      } else {
        setModalPh("");
        setModalNo3("");
        setModalNo2("");
        setModalAireacion("");
        setModalFechaInicio("");
        setModalFaseAguaVerde("Fase 1: Preparación");
        setModalAdiciones([]);
      }

      let parsedMuestras = [];
      try {
        if (selectedCell.cell.muestras) {
          parsedMuestras = JSON.parse(selectedCell.cell.muestras);
        }
      } catch (e) {}

      if (parsedMuestras.length > 0) {
        setBiomasaLotes(parsedMuestras);
      } else {
        const preCount = parseInt(selectedCell.cell.count || 0, 10);
        const preDose = parseFloat(selectedCell.cell.dose || 0);
        if (preCount > 0 && preDose > 0) {
          const avgGramsPerUnit = preDose / preCount;
          const m1Val = (avgGramsPerUnit * 10).toFixed(2);
          setBiomasaLotes([
            {
              id: Date.now(),
              m1: m1Val,
              m2: "",
              m3: "",
              gramosTotal: preDose.toString(),
              origenE: "",
              origenF: "",
              origenC: "",
              trasladado: false,
            },
          ]);
        } else {
          setBiomasaLotes([
            {
              id: Date.now(),
              m1: "",
              m2: "",
              m3: "",
              gramosTotal: "",
              origenE: "",
              origenF: "",
              origenC: "",
              trasladado: false,
            },
          ]);
        }
      }
    }
  }, [selectedCell]);

  const toggleLock = async () => {
    if (!selectedCell || isProcessing) return;
    setIsProcessing(true);
    const { id: rawId } = selectedCell.cell;
    const id = normalizarId(rawId);
    const grupo = selectedCell.grupo;
    const isLocked = modalObs && modalObs.includes("[BLOQUEADO");
    let newObs = modalObs || "";

    if (isLocked) {
      newObs = newObs.replace(/\[BLOQUEADO[^\]]*\]\s*/g, "");
    } else {
      let motivo = modalLockReason;
      if (motivo === "Otros") {
        motivo = window.prompt("Especifique el motivo del bloqueo:");
        if (motivo === null) {
          setIsProcessing(false);
          return;
        }
      }
      newObs = `[BLOQUEADO: ${motivo}] ${newObs}`;
    }

    setModalObs(newObs);
    const newData = { ...data };
    newData[grupo] = newData[grupo].map((item) => {
      if (normalizarId(item.id) === id) {
        return { ...item, obs: newObs };
      }
      return item;
    });
    setData(newData);

    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id, grupo, obs: newObs });
      } catch (err) {}
    }
    setIsProcessing(false);
  };

  const registrarAdicionIngrediente = async () => {
    if (!modalCantAdicionar || isNaN(parseFloat(modalCantAdicionar))) {
      alert("Por favor, introduce una cantidad válida en gramos.");
      return;
    }

    const fechaHoy = new Date().toLocaleDateString("es-ES");
    const horaHoy = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const nuevaAdicion = {
      id: Date.now(),
      fecha: fechaHoy,
      ingrediente: modalIngredienteAdicionar,
      cantidad: `${modalCantAdicionar} gr`
    };

    const nuevasAdiciones = [nuevaAdicion, ...modalAdiciones];
    setModalAdiciones(nuevasAdiciones);
    setModalCantAdicionar("");

    const nuevoTrat = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: fechaHoy,
      hora: horaHoy,
      tanque: selectedCell.cell.id,
      tipo: `Adición de ${modalIngredienteAdicionar} (Mantenimiento Agua Verde)`,
      dosis: `${modalCantAdicionar} gr`
    };

    setTratamientos((prev) => [nuevoTrat, ...prev]);

    if (isCloudConnected) {
      guardarTratamientoEnNube(nuevoTrat, "adición de ingrediente");
    }
  };

  const eliminarAdicionIngrediente = (idAdicion) => {
    setModalAdiciones(modalAdiciones.filter(a => a.id !== idAdicion));
  };

  // Guardar cambios editados en el modal de la cuadrícula
  const guardarCambiosCelda = async () => {
    if (!selectedCell) return;
    const { id: rawId } = selectedCell.cell;
    const id = normalizarId(rawId);
    const grupo = selectedCell.grupo;

    const countVal = parseInt(modalCount, 10) || 0;
    
    // Serializar subgrupos dinámicos en la observación
    const finalObs = serializeSubgrupos(modalSubgrupos, modalObs);

    const isInv = grupo === "invernadero";
    const muestrasVal = isInv
      ? JSON.stringify({ 
          ph: modalPh, 
          no3: modalNo3, 
          no2: modalNo2, 
          aireacion: modalAireacion,
          fechaInicio: modalFechaInicio,
          fase: modalFaseAguaVerde,
          adiciones: modalAdiciones
        })
      : JSON.stringify(biomasaLotes);

    const newData = { ...data };
    newData[grupo] = newData[grupo].map((item) => {
      const cId = normalizarId(item.id).toLowerCase();
      if (cId === id.toLowerCase()) {
        return {
          ...item,
          count: countVal,
          type: modalType,
          dose: modalDose,
          obs: finalObs,
          lastDate: modalLastDate,
          pesoMedio: modalPesoMedio,
          muestras: muestrasVal,
          ...(isInv ? { 
            ph: modalPh, 
            no3: modalNo3, 
            no2: modalNo2, 
            aireacion: modalAireacion,
            fechaInicio: modalFechaInicio,
            fase: modalFaseAguaVerde,
            adiciones: modalAdiciones
          } : {})
        };
      }
      return item;
    });
    setData(newData);

    // REGISTRO DE HISTORIAL (TRAZABILIDAD)
    const oldCount = parseInt(selectedCell.cell.count || 0, 10);
    if (countVal !== oldCount) {
      const horaTrat = new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const fechaTrat = new Date().toLocaleDateString("es-ES");
      const tipoRegistro =
        countVal > oldCount
          ? "Ingreso/Actualización de Lote"
          : "Ajuste de Censo (Reducción)";

      const nuevoTrat = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        fecha: fechaTrat,
        hora: horaTrat,
        tanque: id,
        tipo: `${tipoRegistro} (Total ahora: ${countVal} ud, ${modalDose || 0}g)`,
        dosis: modalDose || "-",
      };

      setTratamientos((prev) => [nuevoTrat, ...prev]);

      if (isCloudConnected) {
        guardarTratamientoEnNube(nuevoTrat, "ajuste de censo");
      }
    }

    if (isCloudConnected) {
      try {
        await syncInventarioNube({
          id: id,
          grupo: grupo,
          count: countVal,
          dose: modalDose,
          type: modalType,
          obs: finalObs,
          last_date: modalLastDate,
          peso_medio: modalPesoMedio,
          muestras: muestrasVal,
        });
      } catch (err) {
        console.error("Error al guardar celda en la nube:", err);
      }
    }

    setSelectedCell(null);
  };

  const actualizarBiomasa = (nuevosLotes) => {
    setBiomasaLotes(nuevosLotes);
    let totalUds = 0;
    let totalGramos = 0;

    nuevosLotes.forEach((l) => {
      const m1 = parseFloat(l.m1) || 0;
      const m2 = parseFloat(l.m2) || 0;
      const m3 = parseFloat(l.m3) || 0;
      const gramos = parseFloat(l.gramosTotal) || 0;

      const muestrasList = [m1, m2, m3].filter((m) => m > 0);
      const numMuestras = muestrasList.length;
      if (numMuestras > 0 && gramos > 0) {
        const sumaMuestras = muestrasList.reduce((a, b) => a + b, 0);
        const pesoMedioPor10 = sumaMuestras / numMuestras;
        const pesoMedioUnidad = pesoMedioPor10 / 10;
        const udsCalculadas = Math.round(gramos / pesoMedioUnidad);

        totalUds += udsCalculadas;
        totalGramos += gramos;
      }
    });

    if (totalUds > 0) {
      setModalCount(totalUds);
      setModalDose(totalGramos.toString());
      setModalPesoMedio((totalGramos / totalUds).toFixed(4));
    } else {
      setModalCount(0);
      setModalDose("");
      setModalPesoMedio("");
    }
  };

  const handleLoteChange = (id, field, value) => {
    const nuevosLotes = biomasaLotes.map((l) =>
      l.id === id ? { ...l, [field]: value } : l,
    );
    actualizarBiomasa(nuevosLotes);
  };

  const addLote = () => {
    const nuevosLotes = [
      ...biomasaLotes,
      {
        id: Date.now(),
        m1: "",
        m2: "",
        m3: "",
        gramosTotal: "",
        origenE: "",
        origenF: "",
        origenC: "",
        trasladado: false,
      },
    ];
    actualizarBiomasa(nuevosLotes);
  };

  const removeLote = (id) => {
    const nuevosLotes = biomasaLotes.filter((l) => l.id !== id);
    actualizarBiomasa(nuevosLotes);
  };

  // Vaciar celda de la cuadrícula por completo
  const vaciarCelda = async () => {
    if (!selectedCell) return;
    if (
      window.confirm(
        "¿Seguro que deseas vaciar por completo esta celda? Se borrarán sus unidades y datos.",
      )
    ) {
      const { id: rawId } = selectedCell.cell;
      const id = normalizarId(rawId);
      const grupo = selectedCell.grupo;

      const newData = { ...data };
      newData[grupo] = newData[grupo].map((item) => {
        const cId = normalizarId(item.id).toLowerCase();
        if (cId === id.toLowerCase()) {
          return {
            ...item,
            id: id,
            count: 0,
            dose: "",
            type: "",
            obs: "",
            lastDate: "",
            pesoMedio: "",
            muestras: "",
          };
        }
        return item;
      });
      setData(newData);

      if (isCloudConnected) {
        try {
          await syncInventarioNube({
            id: id,
            grupo: grupo,
            count: 0,
            dose: "",
            type: "",
            obs: "",
            last_date: "",
            peso_medio: "",
            muestras: "",
          });
        } catch (err) {
          console.error("Error al vaciar celda en la nube:", err);
        }
      }

      setSelectedCell(null);
    }
  };

  // Registrar baja desde el modal
  const ejecutarBajaModal = async () => {
    if (!selectedCell || isProcessing) return;
    setIsProcessing(true);
    const { id } = selectedCell.cell;
    const grupo = selectedCell.grupo;
    const cant = parseInt(modalBajaCant, 10);
    if (isNaN(cant) || cant <= 0) {
      setIsProcessing(false);
      return;
    }

    await registrarBajasEspecial(grupo, id, cant, {
      sexo: modalBajaSexo || null,
      preserveFields: { type: modalType, dose: modalDose },
    });

    // Descontar del subgrupo correspondiente si hay sexo seleccionado
    if (modalBajaSexo && modalSubgrupos.length > 0) {
      let restante = cant;
      const actualizados = modalSubgrupos.map(sg => {
        if (sg.sexo === modalBajaSexo && restante > 0) {
          const deducir = Math.min(restante, sg.cantidad || 0);
          restante -= deducir;
          return { ...sg, cantidad: sg.cantidad - deducir };
        }
        return sg;
      }).filter(sg => sg.cantidad > 0);
      setModalSubgrupos(actualizados);
    }

    // Actualizar censo total en el modal
    const nuevoCenso = Math.max(0, modalCount - cant);
    setModalCount(nuevoCenso);
    setModalBajaCant("1");
    setModalBajaSexo("");
    setIsProcessing(false);
  };

  const registrarSalidaEspecial = async (
    grupo,
    rawId,
    cantidadStr,
    destinoStr,
    tipoSalida,
  ) => {
    const id = normalizarId(rawId);
    const cantidad = parseInt(cantidadStr, 10);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const itemAfectado = data[grupo].find(
      (item) => normalizarId(item.id) === id,
    );
    if (!itemAfectado || itemAfectado.count < cantidad) {
      alert(
        "No hay suficientes unidades en este tanque/celda para registrar esa cantidad de salida.",
      );
      return;
    }

    const nuevoCount = itemAfectado.count - cantidad;

    // Actualizar censo local
    const newData = { ...data };
    const extrasSalida =
      nuevoCount <= 0
        ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
        : {};
    newData[grupo] = newData[grupo].map((item) => {
      const cId = normalizarId(item.id);
      if (cId === id)
        return { ...item, id: id, count: nuevoCount, ...extrasSalida };
      return item;
    });
    setData(newData);

    // Guardar en la nube (solo tabla bajas — sin dual-write a tratamientos)
    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: id, grupo: grupo, count: nuevoCount });
        await guardarBajaEnNube({
          tanqueId: id, grupo, cantidad: cantidad,
          categoria: "Salida", tipoSalida, destino: destinoStr,
          loteIdLocal: itemAfectado.lote_id,
        });
      } catch (err) {
        console.error("Error al guardar salida en la nube:", err);
        setCloudSaveError(`Error al guardar salida: ${err.message}`);
      }
    }
  };

  const ejecutarSalidaIndustriaModal = async () => {
    if (!selectedCell || isProcessing) return;
    setIsProcessing(true);
    const { id } = selectedCell.cell;
    const grupo = selectedCell.grupo;
    const cant = parseInt(modalSalidaCant, 10);
    if (isNaN(cant) || cant <= 0) {
      setIsProcessing(false);
      return;
    }

    await registrarSalidaEspecial(
      grupo,
      id,
      cant,
      modalRegaDestino,
      modalTipoSalida,
    );

    // Actualizar censo local en el modal
    const nuevoCenso = Math.max(0, modalCount - cant);
    setModalCount(nuevoCenso);
    setModalSalidaCant("1");
    setModalRegaDestino("");
    setIsProcessing(false);
  };

  // Aplicar tratamiento rápido desde el modal
  const ejecutarTratamientoModal = async () => {
    if (!selectedCell) return;
    const { id } = selectedCell.cell;
    if (!modalTratTipo) {
      alert("Por favor, escribe el tipo de alimento o tratamiento.");
      return;
    }

    const numInd = modalTratCategoria === "medicamento" ? parseInt(modalTratNumIndividuos) || 1 : 1;
    const dosisTexto = numInd > 1 ? `${numInd}×${modalTratDosis}` : modalTratDosis;
    const notasConInd = numInd > 1
      ? `${modalTratNotas ? modalTratNotas + " | " : ""}${numInd} individuos tratados`
      : modalTratNotas;

    await aplicarTratamiento(id, modalTratTipo, dosisTexto, {
      categoria: modalTratCategoria,
      frecuencia: modalTratFrecuencia,
      numDosis: modalTratNumDosis,
      numTomas: modalTratCategoria === "alimento" ? (modalTratNumTomas || "1") : undefined,
      notas: notasConInd,
    });

    setModalType(modalTratTipo);
    setModalDose((prev) => prev || dosisTexto);
    const hoy = new Date().toISOString().split("T")[0];
    setModalLastDate(hoy);

    alert("✅ " + (modalTratCategoria === "alimento" ? "Alimentación" : modalTratCategoria === "mantenimiento" ? "Mantenimiento" : "Tratamiento") + " registrado correctamente.");
    // Limpiar campos del formulario
    setModalTratTipo("");
    setModalTratDosis("");
    setModalTratCategoria("alimento");
    setModalTratFrecuencia("");
    setModalTratNumDosis("");
    setModalTratNotas("");
    setModalTratNumIndividuos("1");
    setMostrarTratExpandido(false);
  };

  if (!selectedCell) return null;

  return (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "880px", width: "95vw" }}
          >
            <h2
              className="widget-title"
              style={{
                borderLeftWidth: "6px",
                marginBottom: "1rem",
                paddingLeft: "0.8rem",
              }}
            >
              🎛️ Celda: {selectedCell.cell.id} (
              {parseCellId(selectedCell.cell.id)
                ? `Fila ${parseCellId(selectedCell.cell.id).fila}, Col. ${parseCellId(selectedCell.cell.id).columna}`
                : ""}
              )
            </h2>

            {selectedCell.grupo === "incubadoras" && (
              <div
                style={{
                  background: "#fdfefe",
                  padding: "1rem",
                  borderRadius: "12px",
                  marginBottom: "1.2rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                  <h3 style={{ fontSize: "1rem", color: "var(--oliva)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                    🥚 Puestas en Incubación
                  </h3>
                  <button
                    onClick={() => initModalPuestaDesdeInc(selectedCell.cell.id)}
                    style={{ background: "var(--oliva)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 12px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}>
                    ➕ Añadir Puesta
                  </button>
                </div>
                {puestas.filter(p => p.destino === selectedCell.cell.id).length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#888", margin: 0, fontStyle: "italic" }}>
                    No hay puestas activas registradas en esta incubadora.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {puestas.filter(p => p.destino === selectedCell.cell.id).map(p => (
                      <div
                        key={p.id}
                        style={{
                          background: "#fff",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.82rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                            <span>📅 <strong>{p.fecha}</strong>{p.hora && ` (${p.hora})`}</span>
                            <span>📍 Origen: <strong>{p.tanque}</strong></span>
                            {p.tipo_puesta && <span style={{ background: "#eaf4ea", color: "#27ae60", borderRadius: "4px", padding: "1px 6px" }}>{p.tipo_puesta}</span>}
                            {p.estado && <span style={{ background: p.estado === "Buena" ? "#eaf4ea" : p.estado === "Regular" ? "#fef9e7" : "#fdecea", color: p.estado === "Buena" ? "#27ae60" : p.estado === "Regular" ? "#e67e22" : "#c0392b", borderRadius: "4px", padding: "1px 6px" }}>● {p.estado}</span>}
                            {p.huevos && <span style={{ color: "#555" }}>🥚 {p.huevos} huevos</span>}
                          </div>
                          {p.obs && <div style={{ color: "#777", fontStyle: "italic", fontSize: "0.78rem" }}>💬 {p.obs}</div>}
                        </div>
                        <button
                          className="btn-baja"
                          style={{
                            padding: "2px 6px",
                            fontSize: "0.75rem",
                            background: "transparent",
                            color: "#c23616",
                            border: "1px solid #c23616",
                            width: "auto"
                          }}
                          onClick={async () => {
                            if (window.confirm("¿Seguro que deseas eliminar esta puesta de la incubadora?")) {
                              setPuestas(prev => prev.filter(item => item.id !== p.id));
                              // Si está en la nube, borrarla
                              if (isCloudConnected) {
                                fetch(`${cloudConfig.url}/rest/v1/puestas?id=eq.${p.id}`, {
                                  method: "DELETE",
                                  headers: obtenerCabeceras()
                                }).catch(console.error);
                              }
                            }
                          }}
                        >
                          🗑️ Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCell.grupo === "renacuajos" ||
            selectedCell.grupo === "metamorfoseadas" ? (
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "1rem",
                  borderRadius: "12px",
                  marginBottom: "1.2rem",
                  border: "1px solid #e9ecef",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    color: "#495057",
                    marginBottom: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>⚖️ Calculadora de Biomasa (Lotes)</span>
                  <button
                    className="btn-trat"
                    onClick={addLote}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.8rem",
                      background: "var(--pistacho)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    + Añadir Lote
                  </button>
                </h3>

                {biomasaLotes.map((lote, index) => (
                  <div
                    key={lote.id}
                    style={{
                      background: "#fff",
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid #dee2e6",
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <strong
                        style={{ fontSize: "0.85rem", color: "var(--oliva)" }}
                      >
                        Lote {index + 1}{" "}
                        {lote._isPreloaded ? "(Censo Anterior)" : ""}
                      </strong>
                      {biomasaLotes.length > 1 && (
                        <button
                          onClick={() => removeLote(lote.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#dc3545",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          ❌ Quitar
                        </button>
                      )}
                    </div>

                    {lote._isPreloaded ? (
                      <div
                        style={{
                          padding: "0.5rem",
                          background: "#f8f9fa",
                          borderRadius: "4px",
                          color: "#555",
                          fontSize: "0.9rem",
                        }}
                      >
                        <div
                          style={{
                            marginBottom: "8px",
                            fontStyle: "italic",
                            fontSize: "0.8rem",
                          }}
                        >
                          Datos base de este tanque. Para nuevas biometrías,
                          pulsa en "+ Añadir Lote".
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontWeight: "bold",
                          }}
                        >
                          <span>Gramos: {lote.gramosTotal}g</span>
                          <span>
                            Unidades:{" "}
                            {Math.round(
                              parseFloat(lote.gramosTotal) /
                                (parseFloat(lote.m1) / 10),
                            )}{" "}
                            ud
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "0.5rem",
                            marginBottom: "0.8rem",
                          }}
                        >
                          <div className="input-group">
                            <label style={{ fontSize: "0.75rem" }}>
                              Muestra 1 (10ud) - g
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={lote.m1}
                              onChange={(e) =>
                                handleLoteChange(lote.id, "m1", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label style={{ fontSize: "0.75rem" }}>
                              Muestra 2 (10ud) - g
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={lote.m2}
                              onChange={(e) =>
                                handleLoteChange(lote.id, "m2", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label style={{ fontSize: "0.75rem" }}>
                              Muestra 3 (10ud) - g
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={lote.m3}
                              onChange={(e) =>
                                handleLoteChange(lote.id, "m3", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr",
                            gap: "0.5rem",
                          }}
                        >
                          <div className="input-group">
                            <label style={{ fontSize: "0.75rem" }}>
                              Gramos totales (Lote)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={lote.gramosTotal}
                              onChange={(e) =>
                                handleLoteChange(
                                  lote.id,
                                  "gramosTotal",
                                  e.target.value,
                                )
                              }
                              style={{ fontWeight: "bold" }}
                            />
                          </div>
                          <div
                            className="input-group"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "flex-end",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#6c757d",
                                marginBottom: "4px",
                              }}
                            >
                              Unidades Calc.
                            </div>
                            <div
                              style={{
                                background: "#e9ecef",
                                padding: "0.4rem",
                                borderRadius: "4px",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontSize: "0.9rem",
                              }}
                            >
                              {(() => {
                                const num = [
                                  parseFloat(lote.m1),
                                  parseFloat(lote.m2),
                                  parseFloat(lote.m3),
                                ].filter((m) => m > 0);
                                const gt = parseFloat(lote.gramosTotal);
                                if (num.length > 0 && gt > 0) {
                                  const sum = num.reduce((a, b) => a + b, 0);
                                  const pm1 = sum / num.length / 10;
                                  return Math.round(gt / pm1) + " ud";
                                }
                                return "-";
                              })()}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #f0f7eb 0%, #e2ebd5 100%)",
                    padding: "1.2rem",
                    borderRadius: "12px",
                    border: "1px solid #c8d8b6",
                    display: "flex",
                    justifyContent: "space-around",
                    alignItems: "center",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#555",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Total Unidades
                    </div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        color: "var(--oliva)",
                        fontWeight: "900",
                        marginTop: "4px",
                      }}
                    >
                      {modalCount || 0}{" "}
                      <span style={{ fontSize: "0.9rem", color: "#777" }}>
                        ud
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "2px",
                      height: "40px",
                      background: "rgba(200, 216, 182, 0.6)",
                    }}
                  ></div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#555",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Gramos Totales
                    </div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        color: "var(--oliva)",
                        fontWeight: "900",
                        marginTop: "4px",
                      }}
                    >
                      {modalDose || 0}
                      <span style={{ fontSize: "0.9rem", color: "#777" }}>
                        g
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "2px",
                      height: "40px",
                      background: "rgba(200, 216, 182, 0.6)",
                    }}
                  ></div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#555",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Media Global
                    </div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        color: "var(--oliva)",
                        fontWeight: "900",
                        marginTop: "4px",
                      }}
                    >
                      {modalPesoMedio
                        ? modalPesoMedio
                        : modalCount > 0 && parseFloat(modalDose) > 0
                          ? (
                              parseFloat(modalDose) / parseInt(modalCount, 10)
                            ).toFixed(4)
                          : 0}
                      <span style={{ fontSize: "0.9rem", color: "#777" }}>
                        g
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedCell.grupo === "invernadero" ? (
              <>
                <div
                  style={{
                    background: "#e8f8f5",
                    padding: "1.2rem",
                    borderRadius: "12px",
                    marginBottom: "1.2rem",
                    border: "2px solid #a3e4d7",
                  }}
                >
                  <h3 style={{ fontSize: "1.1rem", color: "#117a65", marginTop: 0, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    🧪 Parámetros del Agua
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                    <div className="input-group">
                      <label>pH</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="14"
                        value={modalPh}
                        onChange={(e) => setModalPh(e.target.value)}
                        placeholder="ej: 7.5"
                      />
                    </div>
                    <div className="input-group">
                      <label>Nitratos (NO3) - mg/L</label>
                      <input
                        type="number"
                        value={modalNo3}
                        onChange={(e) => setModalNo3(e.target.value)}
                        placeholder="ej: 10"
                      />
                    </div>
                    <div className="input-group">
                      <label>Nitritos (NO2) - mg/L</label>
                      <input
                        type="number"
                        step="0.01"
                        value={modalNo2}
                        onChange={(e) => setModalNo2(e.target.value)}
                        placeholder="ej: 0.1"
                      />
                    </div>
                  </div>
                  
                  <div className="input-group" style={{ marginTop: "1rem" }}>
                    <label>Aireación</label>
                    <select
                      value={modalAireacion}
                      onChange={(e) => setModalAireacion(e.target.value)}
                      style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", width: "100%", fontSize: "0.9rem" }}
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="💨 Aireación Activa">💨 Aireación Activa</option>
                      <option value="🛑 Sin Aireación (Apagada)">🛑 Sin Aireación (Apagada)</option>
                      <option value="⏱️ Aireación Intermitente (Cada tanto)">⏱️ Aireación Intermitente (Cada tanto)</option>
                    </select>
                  </div>
                </div>

                {selectedCell.cell.id.startsWith("Termoarcilla-") && (
                  <div
                    style={{
                      background: "#fff",
                      padding: "1rem",
                      borderRadius: "12px",
                      marginBottom: "1.2rem",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <h3 style={{ fontSize: "1rem", color: "#27ae60", marginTop: 0, marginBottom: "0.5rem" }}>
                      📋 Receta Química de Inicio Rápida (1000 Litros)
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.8rem 0" }}>
                      Proporciones indicadas para la preparación química del agua verde en esta piscina:
                    </p>
                    <div style={{ background: "#f9fcf8", padding: "0.8rem", borderRadius: "6px", borderLeft: "4px solid #27ae60", fontSize: "0.85rem", lineHeight: "1.5" }}>
                      <strong>Solución 1:</strong> Mezclar en agua (proporción 1000L): 200g Fosfato Monopotásico, 373g Sulfato de Magnesio, 350g Nitrato de Potasio, 45g Micro. <br/>
                      <strong>Solución 2:</strong> 700g Nitrato de Calcio. <br/>
                      <strong>Aplicación:</strong> Lavar con lejía/agua. Añadir Solución 1, luego Solución 2, airear y al 2º día inocular agua verde.
                    </div>
                  </div>
                )}

                {/* ── SEGUIMIENTO DEL PROCESO DE AGUA VERDE ── */}
                {selectedCell.cell.id.startsWith("Termoarcilla-") && (
                  <div style={{ background: "#f0faf4", padding: "1rem", borderRadius: "12px", marginBottom: "1.2rem", border: "2px solid #82c99a" }}>
                    <h3 style={{ fontSize: "1rem", color: "#1a7a40", marginTop: 0, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      📅 Seguimiento del Proceso de Agua Verde
                    </h3>

                    {/* Fecha de inicio y fase */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                      <div className="input-group">
                        <label>📆 Fecha de Inicio del Proceso</label>
                        <input
                          type="date"
                          value={modalFechaInicio}
                          onChange={(e) => setModalFechaInicio(e.target.value)}
                          style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.9rem" }}
                        />
                        {!modalFechaInicio && (
                          <button
                            onClick={() => setModalFechaInicio(new Date().toISOString().slice(0, 10))}
                            style={{ marginTop: "4px", fontSize: "0.75rem", background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer" }}
                          >
                            🕐 Usar hoy como inicio
                          </button>
                        )}
                      </div>
                      <div className="input-group">
                        <label>🌿 Fase Actual del Proceso</label>
                        <select
                          value={modalFaseAguaVerde}
                          onChange={(e) => setModalFaseAguaVerde(e.target.value)}
                          style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.85rem" }}
                        >
                          <option value="Fase 1: Preparación">🧹 Fase 1: Preparación (Lavado y química inicial)</option>
                          <option value="Fase 2: Inoculación">💧 Fase 2: Inoculación (Añadir agua verde)</option>
                          <option value="Fase 3: Crecimiento">🌱 Fase 3: En crecimiento (Ajustes y aireación)</option>
                          <option value="Fase 4: Lista para uso">✅ Fase 4: Lista para usar</option>
                          <option value="Fase 5: Reinicio">🔄 Fase 5: Reinicio / Vaciado y limpieza</option>
                        </select>
                      </div>
                    </div>

                    {/* Indicador de días desde inicio */}
                    {modalFechaInicio && (
                      <div style={{ background: "white", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "1rem", border: "1px solid #c3e6cb", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem" }}>
                        <span style={{ fontSize: "1.2rem" }}>⏱️</span>
                        <span>
                          Días desde el inicio:{" "}
                          <strong style={{ color: "#1a7a40" }}>
                            {Math.max(0, Math.floor((new Date() - new Date(modalFechaInicio)) / (1000 * 60 * 60 * 24)))} días
                          </strong>
                          {" "} — Fase: <strong style={{ color: "#2980b9" }}>{modalFaseAguaVerde}</strong>
                        </span>
                      </div>
                    )}

                    {/* Añadir ingrediente */}
                    <div style={{ background: "white", borderRadius: "10px", padding: "0.8rem", marginBottom: "1rem", border: "1px solid #d4edda" }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#1a7a40", margin: "0 0 0.6rem 0" }}>
                        ➕ Registrar Adición de Ingrediente
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.6rem", alignItems: "end" }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: "0.78rem" }}>Ingrediente</label>
                          <select
                            value={modalIngredienteAdicionar}
                            onChange={(e) => setModalIngredienteAdicionar(e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.82rem" }}
                          >
                            <option value="Fosfato Monopotásico">Fosfato Monopotásico (Sol. 1)</option>
                            <option value="Sulfato de Magnesio">Sulfato de Magnesio (Sol. 1)</option>
                            <option value="Nitrato de Potasio">Nitrato de Potasio (Sol. 1)</option>
                            <option value="Micro (oligoelementos)">Micro / Oligoelementos (Sol. 1)</option>
                            <option value="Nitrato de Calcio">Nitrato de Calcio (Sol. 2)</option>
                            <option value="Agua verde (inoculación)">💧 Agua verde (inoculación)</option>
                            <option value="Corrector pH (ácido)">⬇️ Corrector pH (ácido)</option>
                            <option value="Corrector pH (base)">⬆️ Corrector pH (base)</option>
                            <option value="Otro">Otro ingrediente</option>
                          </select>
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: "0.78rem" }}>Cantidad (g / ml / L)</label>
                          <input
                            type="text"
                            value={modalCantAdicionar}
                            onChange={(e) => setModalCantAdicionar(e.target.value)}
                            placeholder="ej: 200g"
                            style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (!modalCantAdicionar.trim()) return;
                            // Crear nueva adición con fecha y hora actuales
                            const nuevaAdicion = {
                              fecha: new Date().toISOString().slice(0, 10),
                              hora: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
                              ingrediente: modalIngredienteAdicionar,
                              cantidad: modalCantAdicionar.trim(),
                            };
                            setModalAdiciones([...modalAdiciones, nuevaAdicion]);
                            setModalCantAdicionar("");
                          }}
                          style={{
                            background: "#27ae60",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            padding: "0.5rem 1rem",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ✅ Añadir
                        </button>
                      </div>
                    </div>

                    {/* Historial de adiciones */}
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#1a7a40", margin: "0 0 0.5rem 0" }}>
                        📜 Historial de Ingredientes Añadidos ({modalAdiciones.length})
                      </p>
                      {modalAdiciones.length === 0 ? (
                        <div style={{ background: "white", borderRadius: "8px", padding: "0.8rem", textAlign: "center", color: "#888", fontSize: "0.82rem", border: "1px dashed #ccc" }}>
                          Aún no se ha registrado ningún ingrediente. Úsalo para ir anotando lo que añades.
                        </div>
                      ) : (
                        <div style={{ maxHeight: "200px", overflowY: "auto", background: "white", borderRadius: "8px", border: "1px solid #d4edda" }}>
                          {[...modalAdiciones].reverse().map((adicion, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.5rem 0.8rem",
                                borderBottom: idx < modalAdiciones.length - 1 ? "1px solid #f0f0f0" : "none",
                                fontSize: "0.82rem",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: "bold", color: "#1a7a40" }}>{adicion.ingrediente}</span>
                                <span style={{ color: "#2980b9", marginLeft: "6px" }}>— {adicion.cantidad}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ color: "#888", fontSize: "0.78rem" }}>
                                  📅 {adicion.fecha} {adicion.hora && `🕐 ${adicion.hora}`}
                                </span>
                                <button
                                  onClick={() => {
                                    // Eliminar la adición (índice invertido por el reverse)
                                    const idxReal = modalAdiciones.length - 1 - idx;
                                    setModalAdiciones(modalAdiciones.filter((_, i) => i !== idxReal));
                                  }}
                                  title="Eliminar este registro"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#e74c3c",
                                    cursor: "pointer",
                                    fontSize: "0.9rem",
                                    padding: "2px",
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    marginBottom: "1.2rem",
                  }}
                >
                  <div className="input-group">
                    <label>Unidades (ud)</label>
                    <input
                      type="number"
                      value={modalCount}
                      onChange={(e) =>
                        setModalCount(
                          e.target.value === ""
                            ? ""
                            : parseInt(e.target.value, 10),
                        )
                      }
                      style={{ fontSize: "1rem", fontWeight: "bold" }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Peso Total (g)</label>
                    <input
                      type="text"
                      value={modalDose}
                      onChange={(e) => setModalDose(e.target.value)}
                      placeholder="ej: 90"
                      style={{ fontSize: "1rem", fontWeight: "bold" }}
                    />
                  </div>
                </div>

                {modalCount > 0 && parseFloat(modalDose) > 0 && (
                  <div
                    style={{
                      background: "#f5f9f2",
                      padding: "0.6rem",
                      borderRadius: "8px",
                      border: "1px solid #e2ebd5",
                      marginBottom: "1.2rem",
                      textAlign: "center",
                      fontSize: "0.85rem",
                    }}
                  >
                    Peso medio por Unidad (g×Ud):{" "}
                    <strong>
                      {(parseFloat(modalDose) / modalCount).toFixed(4)} g/ud
                    </strong>
                  </div>
                )}
              </>
            )}
            
            {selectedCell.grupo !== "invernadero" && selectedCell.grupo !== "incubadoras" && (
              <div
                style={{
                  background: "#fff",
                  padding: "1rem",
                  borderRadius: "12px",
                  marginBottom: "1.2rem",
                  border: "1px solid #e9ecef",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    color: "var(--rojo)",
                    marginBottom: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>💕 Subgrupos de Animales</span>
                  <button
                    onClick={() => {
                      const id = `sub_${Date.now()}`;
                      setModalSubgrupos([...modalSubgrupos, { id, cantidad: 1, sexo: "Macho", estado: "Ninguno", fecha: "" }]);
                      if (selectedCell.grupo !== "renacuajos" && selectedCell.grupo !== "metamorfoseadas") {
                        setModalCount(modalCount + 1);
                      }
                    }}
                    style={{ background: "#e2ebd5", color: "var(--oliva)", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}
                  >
                    + Añadir Grupo
                  </button>
                </h3>
                
                {modalSubgrupos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "1rem", color: "#999", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No hay subgrupos definidos en esta celda.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    {modalSubgrupos.map((sg, index) => (
                      <div key={sg.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr auto", gap: "0.5rem", alignItems: "center", background: "#f8f9fa", padding: "0.6rem", borderRadius: "8px", border: "1px solid #e9ecef" }}>
                        <input
                          type="number"
                          min="1"
                          value={sg.cantidad}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const diff = val - sg.cantidad;
                            const newSubgrupos = [...modalSubgrupos];
                            newSubgrupos[index].cantidad = val;
                            setModalSubgrupos(newSubgrupos);
                            if (selectedCell.grupo !== "renacuajos" && selectedCell.grupo !== "metamorfoseadas") {
                              setModalCount(modalCount + diff);
                            }
                          }}
                          style={{ padding: "0.4rem", width: "100%", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                          title="Cantidad"
                        />
                        <select
                          value={sg.sexo}
                          onChange={(e) => {
                            const newSubgrupos = [...modalSubgrupos];
                            newSubgrupos[index].sexo = e.target.value;
                            setModalSubgrupos(newSubgrupos);
                          }}
                          style={{ padding: "0.4rem", width: "100%", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                        >
                          <option value="Macho">♂ Macho</option>
                          <option value="Hembra">♀ Hembra</option>
                          <option value="Indet">❓ Indet/Juv</option>
                        </select>
                        <select
                          value={sg.estado}
                          onChange={(e) => {
                            const newSubgrupos = [...modalSubgrupos];
                            newSubgrupos[index].estado = e.target.value;
                            setModalSubgrupos(newSubgrupos);
                          }}
                          style={{ padding: "0.4rem", width: "100%", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                        >
                          <option value="Ninguno">Normal</option>
                          <option value="Preparación">Preparación</option>
                          <option value="Inducción">Inducción</option>
                          <option value="Hembra con puesta">H. Puesta</option>
                          <option value="Descanso">Descanso</option>
                          <option value="Pre-Brumación">Pre-Brumación</option>
                          <option value="Brumación">Brumación</option>
                          <option value="Post-Brumación">Post-Brumación</option>
                        </select>
                        <input
                          type="date"
                          value={sg.fecha}
                          onChange={(e) => {
                            const newSubgrupos = [...modalSubgrupos];
                            newSubgrupos[index].fecha = e.target.value;
                            setModalSubgrupos(newSubgrupos);
                          }}
                          style={{ padding: "0.4rem", width: "100%", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                          title="Fecha de inicio del estado"
                        />
                        <button
                          onClick={() => {
                            const newSubgrupos = modalSubgrupos.filter(g => g.id !== sg.id);
                            setModalSubgrupos(newSubgrupos);
                            if (selectedCell.grupo !== "renacuajos" && selectedCell.grupo !== "metamorfoseadas") {
                              setModalCount(modalCount - sg.cantidad);
                            }
                          }}
                          style={{ background: "transparent", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "1.2rem", padding: "0 0.2rem" }}
                          title="Quitar"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.2rem",
              }}
            >
              <div className="input-group">
                <label>{selectedCell.grupo === "incubadoras" ? "Estado de incubación" : "Fase / Estado"}</label>
                {selectedCell.grupo !== "incubadoras" ? (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                      {[
                        "Recién eclosionado","Renacuajo S","Renacuajo M",
                        "2 patas","4 patas","Ranita con cola",
                        "Recién metamorf.","Iniciación","Juvenil",
                        "Engorde","Reproductora","Cuarentena","Observación","Vacío"
                      ].map(fase => (
                        <button key={fase} type="button"
                          onClick={() => setModalType(modalType === fase ? "" : fase)}
                          style={{
                            padding: "0.2rem 0.55rem", fontSize: "0.75rem", borderRadius: "10px", cursor: "pointer",
                            border: modalType === fase ? "2px solid var(--oliva)" : "1px solid #ccc",
                            background: modalType === fase ? "var(--pistacho)" : "white",
                            color: modalType === fase ? "white" : "#555",
                            fontWeight: modalType === fase ? "bold" : "normal",
                          }}
                        >{fase}</button>
                      ))}
                    </div>
                    <input type="text" value={modalType}
                      onChange={e => setModalType(e.target.value)}
                      placeholder="O escribe libremente (Gosner 25, etc.)"
                      style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem", boxSizing: "border-box" }}
                    />
                  </div>
                ) : (
                  <input type="text" value={modalType}
                    onChange={e => setModalType(e.target.value)}
                    placeholder="Fase eclosión, Calidad media..."
                  />
                )}
              </div>

              <div className="input-group">
                <label>Fecha de actualización</label>
                <input
                  type="date"
                  value={modalLastDate}
                  onChange={(e) => setModalLastDate(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: "1.2rem" }}>
              <label>{selectedCell.grupo === "incubadoras" ? "Notas de incubación" : "Observaciones / Notas de desarrollo"}</label>
              <textarea
                value={modalObs}
                onChange={(e) => setModalObs(e.target.value)}
                placeholder={selectedCell.grupo === "incubadoras" ? "Observaciones de eclosión, calidad de la puesta..." : "Observaciones de alimentación, limpieza o crecimiento..."}
              />
            </div>

            {/* Acciones Rápidas (Bajas y Alimento/Tratamientos) */}
            {selectedCell.grupo !== "invernadero" && selectedCell.grupo !== "incubadoras" && (
              <div
                style={{
                  background: "#fcfdfd",
                  border: "1px solid #eee",
                  padding: "1rem",
                  borderRadius: "12px",
                  marginBottom: "1.2rem",
                }}
              >
                <h4
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--oliva)",
                    textTransform: "uppercase",
                    marginBottom: "0.8rem",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "4px",
                  }}
                >
                  Acciones de Control Diario
                </h4>

                {/* Registro de Bajas — requiere animales presentes */}
                {selectedCell.cell.count > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1rem",
                    alignItems: "flex-end",
                  }}
                >
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Bajas a registrar en esta celda</label>
                    <input
                      type="number"
                      value={modalBajaCant}
                      onChange={(e) => setModalBajaCant(e.target.value)}
                      min="1"
                      max={modalCount}
                    />
                  </div>
                  {modalSubgrupos.some(sg => sg.sexo && sg.sexo !== "Desconocido" && sg.cantidad > 0) && (
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>Sexo de las bajas</label>
                      <select value={modalBajaSexo} onChange={e => setModalBajaSexo(e.target.value)} style={{ padding: "0.4rem" }}>
                        <option value="">Sin especificar</option>
                        {[...new Set(modalSubgrupos.filter(sg => sg.sexo && sg.cantidad > 0).map(sg => sg.sexo))].map(s => {
                          const total = modalSubgrupos.filter(sg => sg.sexo === s).reduce((a, sg) => a + (sg.cantidad || 0), 0);
                          return <option key={s} value={s}>{s} ({total} ud)</option>;
                        })}
                      </select>
                    </div>
                  )}
                  <button className="btn-baja" onClick={ejecutarBajaModal}>
                    💀 Registrar Bajas
                  </button>
                </div>
                )}

                {/* Registro de Salida a Industria / SANDACH — requiere animales presentes */}
                {selectedCell.cell.count > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1rem",
                    alignItems: "flex-end",
                    background: "#fdfdf5",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0d0",
                  }}
                >
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Tipo de Salida</label>
                    <select
                      value={modalTipoSalida}
                      onChange={(e) => setModalTipoSalida(e.target.value)}
                      style={{ padding: "0.4rem" }}
                    >
                      <option value="REGA">
                        REGA (Industria / Sacrificio)
                      </option>
                      <option value="SANDACH">SANDACH</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Destino (Opcional)</label>
                    <input
                      type="text"
                      placeholder={
                        modalTipoSalida === "REGA"
                          ? "Ej. ES123456789012"
                          : "Empresa SANDACH"
                      }
                      value={modalRegaDestino}
                      onChange={(e) => setModalRegaDestino(e.target.value)}
                    />
                  </div>
                  <div className="input-group" style={{ width: "80px" }}>
                    <label>Cant.</label>
                    <input
                      type="number"
                      value={modalSalidaCant}
                      onChange={(e) => setModalSalidaCant(e.target.value)}
                      min="1"
                      max={modalCount}
                    />
                  </div>
                  <button
                    className="btn-baja"
                    style={{ background: "#808000" }}
                    onClick={ejecutarSalidaIndustriaModal}
                  >
                    Registrar Salida
                  </button>
                </div>
                )}

                {/* Registro de Alimentación / Tratamientos — PARAMETRIZADO (siempre disponible, incluso sin animales: limpieza/desinfección) */}
                <div style={{ background: "#f8f9fa", borderRadius: "10px", padding: "0.8rem", border: "1px solid #e0e0e0" }}>
                  
                  {/* Selector de categoría */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
                    {[
                      { val: "alimento",    emoji: "🌿", label: "Alimento" },
                      { val: "medicamento", emoji: "💊", label: "Medicamento" },
                      { val: "preventivo",  emoji: "🛡️", label: "Preventivo" },
                      { val: "mantenimiento", emoji: "🧹", label: "Mantenimiento" },
                    ].map(({ val, emoji, label }) => (
                      <button
                        key={val}
                        onClick={() => setModalTratCategoria(val)}
                        style={{
                          flex: 1,
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: modalTratCategoria === val ? "2px solid #27ae60" : "1px solid #ccc",
                          background: modalTratCategoria === val ? "#e8f8f0" : "white",
                          fontWeight: modalTratCategoria === val ? "bold" : "normal",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          color: modalTratCategoria === val ? "#1a7a40" : "#555",
                        }}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>

                  {/* Chips predefinidos desde el almacén */}
                  {(() => {
                    const CHIPS_ALIMENTO = ["Calcio carbonato", "Asticot", "Vitaminas", "Micro-pellets"];
                    const CHIPS_TRAT = ["Ganadexil", "Levamisol", "Sal (desparasitación)", "Inducción hormonal", "Frío (baño)"];
                    const CHIPS_MANTENIMIENTO = ["Desinfección general", "Limpieza de filtros", "Cambio de agua completo", "Secado y aireación", "Revisión de instalación"];
                    const chipsAlmacen = inventario.map(i => i.nombre).filter(Boolean);
                    const chipsBase = modalTratCategoria === "alimento" ? CHIPS_ALIMENTO
                      : modalTratCategoria === "mantenimiento" ? CHIPS_MANTENIMIENTO
                      : CHIPS_TRAT;
                    const chips = [...new Set([...chipsAlmacen, ...chipsBase])];
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.7rem" }}>
                        {chips.map(chip => (
                          <button
                            key={chip}
                            onClick={() => setModalTratTipo(chip)}
                            style={{
                              padding: "0.2rem 0.6rem",
                              borderRadius: "12px",
                              border: modalTratTipo === chip ? "2px solid #27ae60" : "1px solid #ccc",
                              background: modalTratTipo === chip ? "#e8f8f0" : "#f8f9fa",
                              color: modalTratTipo === chip ? "#1a7a40" : "#555",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: modalTratTipo === chip ? "bold" : "normal",
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Nombre y dosis — fila principal */}
                  <div style={{ display: "grid", gridTemplateColumns: modalTratCategoria === "alimento" ? "2fr 1fr 80px" : modalTratCategoria === "medicamento" ? "2fr 1fr 80px" : "2fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "0.78rem" }}>
                        {modalTratCategoria === "alimento" ? "🌿 Nombre del Alimento"
                          : modalTratCategoria === "mantenimiento" ? "🧹 Acción de mantenimiento"
                          : "💊 Nombre del Medicamento / Tratamiento"}
                      </label>
                      <input
                        type="text"
                        placeholder={modalTratCategoria === "alimento" ? "Spirulina, Micro-pellets, Sal..."
                          : modalTratCategoria === "mantenimiento" ? "Desinfección, limpieza de filtros..."
                          : "Veterelin, Ganadexil, Levamisol..."}
                        value={modalTratTipo}
                        onChange={(e) => setModalTratTipo(e.target.value)}
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "0.78rem" }}>
                        {modalTratCategoria === "alimento" ? "Gramos / toma"
                          : modalTratCategoria === "mantenimiento" ? "Producto usado (opcional)"
                          : "Dosis por individuo"}
                      </label>
                      <input
                        type="text"
                        placeholder={modalTratCategoria === "alimento" ? "ej: 5g" : "0.5ml, 2ml..."}
                        value={modalTratDosis}
                        onChange={(e) => setModalTratDosis(e.target.value)}
                      />
                    </div>
                    {modalTratCategoria === "alimento" && (
                      <div className="input-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: "0.78rem" }}>Tomas/día</label>
                        <select
                          value={modalTratNumTomas}
                          onChange={e => setModalTratNumTomas(e.target.value)}
                          style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.85rem" }}
                        >
                          {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×/día</option>)}
                        </select>
                      </div>
                    )}
                    {modalTratCategoria === "medicamento" && (
                      <div className="input-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: "0.78rem" }}>Nº indiv.</label>
                        <input
                          type="number"
                          min="1"
                          value={modalTratNumIndividuos}
                          onChange={e => setModalTratNumIndividuos(e.target.value || "1")}
                          style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.85rem", textAlign: "center" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Resumen de dosis total si hay varios individuos */}
                  {modalTratCategoria === "medicamento" && parseInt(modalTratNumIndividuos) > 1 && modalTratDosis && (
                    <div style={{ background: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: "6px", padding: "0.4rem 0.7rem", fontSize: "0.78rem", color: "#e65100", marginBottom: "0.5rem" }}>
                      💊 Total administrado: <strong>{modalTratNumIndividuos} individuos × {modalTratDosis}</strong> = {modalTratNumIndividuos} dosis
                    </div>
                  )}

                  {/* Resumen de ración diaria si hay tomas > 1 */}
                  {modalTratCategoria === "alimento" && parseInt(modalTratNumTomas) > 1 && modalTratDosis && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.4rem 0.7rem", fontSize: "0.78rem", color: "#166534", marginBottom: "0.5rem" }}>
                      📊 Total diario estimado: <strong>{parseInt(modalTratNumTomas)} tomas × {modalTratDosis}</strong>
                    </div>
                  )}

                  {/* Botón para expandir opciones avanzadas */}
                  <button
                    onClick={() => setMostrarTratExpandido(!mostrarTratExpandido)}
                    style={{ background: "none", border: "none", color: "#2980b9", cursor: "pointer", fontSize: "0.8rem", padding: "2px 0", marginBottom: "0.5rem" }}
                  >
                    {mostrarTratExpandido ? "▲ Ocultar opciones de pauta" : "▼ + Añadir frecuencia y pauta (opcional)"}
                  </button>

                  {/* Opciones avanzadas expandibles */}
                  {mostrarTratExpandido && (
                    <div style={{ background: "white", borderRadius: "8px", padding: "0.7rem", border: "1px solid #d4edda", marginBottom: "0.5rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.5rem" }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: "0.78rem" }}>🕐 Frecuencia de aplicación</label>
                          <select
                            value={modalTratFrecuencia}
                            onChange={(e) => setModalTratFrecuencia(e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.82rem" }}
                          >
                            <option value="">-- Sin pauta definida --</option>
                            <option value="1 vez al día">1 vez al día</option>
                            <option value="2 veces al día (cada 12h)">2 veces al día (cada 12h)</option>
                            <option value="3 veces al día (cada 8h)">3 veces al día (cada 8h)</option>
                            <option value="Cada 6 horas">Cada 6 horas</option>
                            <option value="Cada 48 horas (día por medio)">Cada 48 horas (día por medio)</option>
                            <option value="1 vez por semana">1 vez por semana</option>
                            <option value="Dosis única">Dosis única (una sola vez)</option>
                            <option value="Según necesidad">Según necesidad (a demanda)</option>
                          </select>
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: "0.78rem" }}>📋 Nº total de dosis del ciclo</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="ej: 3 (= 3 días de tratamiento)"
                            value={modalTratNumDosis}
                            onChange={(e) => setModalTratNumDosis(e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.85rem" }}
                          />
                        </div>
                      </div>

                      {/* Resumen visual de la pauta si hay datos */}
                      {modalTratFrecuencia && modalTratNumDosis && (
                        <div style={{ background: "#e8f8f0", padding: "0.5rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", color: "#1a7a40", border: "1px solid #c3e6cb" }}>
                          📅 Pauta: <strong>{modalTratDosis || "dosis"}</strong> de <strong>{modalTratTipo || "producto"}</strong>,{" "}
                          <strong>{modalTratFrecuencia}</strong>, durante{" "}
                          <strong>
                            {modalTratFrecuencia.includes("semana") 
                              ? `${modalTratNumDosis} semana(s)` 
                              : modalTratFrecuencia === "Dosis única" 
                                ? "1 sola aplicación"
                                : `${modalTratNumDosis} aplicación(es)`}
                          </strong>
                        </div>
                      )}

                      <div className="input-group" style={{ margin: "0.5rem 0 0 0" }}>
                        <label style={{ fontSize: "0.78rem" }}>📝 Notas clínicas / Motivo</label>
                        <textarea
                          rows={2}
                          placeholder="Ej: Se observan individuos con síntomas de hongos, se aplica sal de forma preventiva..."
                          value={modalTratNotas}
                          onChange={(e) => setModalTratNotas(e.target.value)}
                          style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%", fontSize: "0.82rem", resize: "vertical" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Botón de aplicar */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn-trat"
                      onClick={ejecutarTratamientoModal}
                      style={{ width: "auto", padding: "0.5rem 1.5rem" }}
                    >
                      {modalTratCategoria === "alimento" ? "🌿 Registrar Alimento"
                        : modalTratCategoria === "mantenimiento" ? "🧹 Registrar Mantenimiento"
                        : "💊 Registrar Tratamiento"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── HISTORIAL DE TRATAMIENTOS DE ESTE RACEWAY ─────────── */}
            {selectedCell.grupo !== "incubadoras" && selectedCell.grupo !== "invernadero" && (() => {
              const cellId = normalizarId(selectedCell.cell.id);
              const histTrat = tratamientos
                .filter(t => {
                  const tid = normalizarId(t.tanque || "");
                  return tid === cellId && !esEventoNoTratamiento(t);
                })
                .slice(0, 8);
              if (histTrat.length === 0) return null;
              return (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "8px", padding: "0.7rem 0.9rem" }}>
                    <h4 style={{ margin: "0 0 0.6rem 0", fontSize: "0.88rem", color: "#444", display: "flex", alignItems: "center", gap: "6px" }}>
                      📋 Tratamientos Registrados
                      <span style={{ fontSize: "0.72rem", color: "#888", fontWeight: "normal" }}>(últimos {histTrat.length})</span>
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {histTrat.map(t => {
                        const esAlim = (t.categoria || t.tipo || "").toLowerCase().includes("aliment") || (t.tipo || "").toLowerCase().includes("aliment");
                        const esMed = (t.categoria || t.tipo || "").toLowerCase().includes("medicament") || (t.categoria || t.tipo || "").toLowerCase().includes("antibi") || (t.categoria || t.tipo || "").toLowerCase().includes("tratamiento");
                        const esMant = (t.categoria || "").toLowerCase().includes("mantenimiento");
                        const chipColor = esMant ? { bg: "#eef2f5", color: "#34495e" } : esAlim ? { bg: "#e8f8f0", color: "#1a7a40" } : esMed ? { bg: "#fdecea", color: "#c0392b" } : { bg: "#eaf0ff", color: "#2c5282" };
                        return (
                          <div key={t.id} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: "6px", padding: "0.4rem 0.7rem", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ color: "#888", flexShrink: 0 }}>📅 {t.fecha}{t.hora ? ` (${t.hora})` : ""}</span>
                              <span style={{ background: chipColor.bg, color: chipColor.color, borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem", fontWeight: "bold" }}>
                                {t.categoria || (esAlim ? "Alimento" : esMed ? "Medicamento" : "Preventivo")}
                              </span>
                              <span style={{ fontWeight: "600", color: "#333" }}>{t.tipo?.replace(/^[^:]+:\s*/, "").replace(/\s*\(.*\)$/, "")}</span>
                              {t.dosis && t.dosis !== "-" && <span style={{ color: "#666" }}>· {t.dosis}</span>}
                            </div>
                            {(t.notas || t.frecuencia) && (
                              <div style={{ color: "#777", fontSize: "0.74rem", fontStyle: "italic" }}>
                                {t.frecuencia && <span>⏱ {t.frecuencia} </span>}
                                {t.notas && <span>💬 {t.notas}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── SECCIÓN: PLANES DE RACEWAY ─────────────────────────── */}
            {selectedCell.grupo !== "incubadoras" && selectedCell.grupo !== "invernadero" && (
              <div style={{ marginBottom: "1rem" }}>
                <button
                  onClick={() => setPlanesExpanded(v => !v)}
                  style={{
                    width: "100%", textAlign: "left", background: planesExpanded ? "#f0f9f0" : "#f8f9fa",
                    border: "1px solid #ddd", borderRadius: "8px", padding: "0.6rem 1rem",
                    cursor: "pointer", fontWeight: "600", fontSize: "0.9rem", color: "var(--oliva)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <span>📋 Planes de Raceway</span>
                  <span style={{ fontSize: "0.75rem", color: "#888" }}>
                    {(() => {
                      const cellId = normalizarId(selectedCell.cell.id);
                      const np = planesAlimentacion[cellId]?.items?.length || 0;
                      const nt = planesTratamiento[cellId]?.items?.length || 0;
                      return `${np} alim · ${nt} trat · ${planesExpanded ? "▲" : "▼"}`;
                    })()}
                  </span>
                </button>

                {planesExpanded && (() => {
                  const cellId = normalizarId(selectedCell.cell.id);
                  const planAlim = planesAlimentacion[cellId] || { items: [], porcentajeBiomasa: false, notas: "" };
                  const planTrat = planesTratamiento[cellId] || { items: [] };

                  const saveAlim = (newPlan) => {
                    setPlanesAlimentacion(prev => ({ ...prev, [cellId]: newPlan }));
                  };
                  const saveTrat = (newPlan) => {
                    setPlanesTratamiento(prev => ({ ...prev, [cellId]: newPlan }));
                  };

                  return (
                    <div style={{ border: "1px solid #ddd", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "1rem", background: "#fafffe" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

                        {/* ─── PLAN DE ALIMENTACIÓN ─── */}
                        <div>
                          <h4 style={{ margin: "0 0 0.5rem 0", color: "#27ae60", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "5px" }}>
                            🌿 Plan de Alimentación
                          </h4>

                          {/* Biomasa actual + ICF estimado */}
                          {(() => {
                            const cnt = parseInt(selectedCell.cell.count, 10) || 0;
                            const pm = parseFloat(selectedCell.cell.pesoMedio || selectedCell.cell.peso_medio) || 0;
                            const biomasaG = cnt * pm;
                            // ICF estimado: g alimento últimos 7d / biomasa actual
                            const ahora = new Date(); ahora.setHours(0,0,0,0);
                            const hace7 = new Date(ahora); hace7.setDate(ahora.getDate() - 7);
                            let gAlim7d = 0;
                            registrosAlimentacion.filter(r => normalizarId(r.tanqueId || r.tanque) === cellId).forEach(r => {
                              const p = (r.fecha || "").split("/");
                              const f = p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(r.fecha);
                              if (!isNaN(f) && f >= hace7) {
                                (r.items || []).forEach(it => { gAlim7d += parseFloat(it.gramos) || 0; });
                              }
                            });
                            const icf = biomasaG > 0 && gAlim7d > 0 ? (gAlim7d / biomasaG).toFixed(2) : null;
                            if (biomasaG === 0) return null;
                            return (
                              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.4rem 0.7rem", fontSize: "0.75rem", color: "#166534", marginBottom: "0.6rem", display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
                                <span>⚖️ Biomasa: <strong>{(biomasaG/1000).toFixed(2)} kg</strong> ({cnt} ud × {pm}g)</span>
                                {icf && <span>📈 ICF estimado 7d: <strong>{icf}</strong> g alim/g biomasa</span>}
                                {!icf && <span style={{ opacity: 0.6 }}>Sin registros de alimentación esta semana</span>}
                              </div>
                            );
                          })()}

                          {/* Modo: gramos fijos o % biomasa */}
                          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            {["fijos", "biomasa"].map(modo => (
                              <button key={modo}
                                onClick={() => saveAlim({ ...planAlim, modo })}
                                style={{
                                  flex: 1, padding: "0.25rem", fontSize: "0.75rem", borderRadius: "6px", cursor: "pointer",
                                  border: (planAlim.modo || "fijos") === modo ? "2px solid #27ae60" : "1px solid #ccc",
                                  background: (planAlim.modo || "fijos") === modo ? "#e8f8f0" : "white",
                                  color: (planAlim.modo || "fijos") === modo ? "#1a7a40" : "#555",
                                  fontWeight: (planAlim.modo || "fijos") === modo ? "bold" : "normal",
                                }}
                              >
                                {modo === "fijos" ? "⚖️ Gramos fijos" : "📊 % Biomasa"}
                              </button>
                            ))}
                          </div>

                          {/* Frecuencia + Nº de tomas + resumen */}
                          <div style={{ marginBottom: "0.5rem" }}>
                            <label style={{ fontSize: "0.72rem", color: "#888", display: "block", marginBottom: "2px" }}>Frecuencia de alimentación</label>
                            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                              {["Diario","Días alternos","Lun-Mié-Vie","Mar-Jue-Sáb","Solo laborables","Personalizado"].map(op => (
                                <button key={op}
                                  onClick={() => saveAlim({ ...planAlim, frecuencia: op })}
                                  style={{
                                    padding: "0.2rem 0.55rem", fontSize: "0.72rem", borderRadius: "10px", cursor: "pointer",
                                    border: (planAlim.frecuencia || "Diario") === op ? "2px solid #27ae60" : "1px solid #ccc",
                                    background: (planAlim.frecuencia || "Diario") === op ? "#e8f8f0" : "white",
                                    color: (planAlim.frecuencia || "Diario") === op ? "#1a7a40" : "#555",
                                    fontWeight: (planAlim.frecuencia || "Diario") === op ? "bold" : "normal",
                                  }}
                                >{op}</button>
                              ))}
                            </div>
                            {(planAlim.frecuencia === "Personalizado") && (
                              <input type="text" value={planAlim.frecuenciaCustom || ""}
                                onChange={e => saveAlim({ ...planAlim, frecuenciaCustom: e.target.value })}
                                placeholder="Ej: Lunes, jueves y domingos..."
                                style={{ marginTop: "0.3rem", width: "100%", padding: "0.3rem 0.5rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                              />
                            )}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.5rem" }}>
                            <div>
                              <label style={{ fontSize: "0.72rem", color: "#888", display: "block", marginBottom: "2px" }}>Tomas por día</label>
                              <select
                                value={planAlim.tomasAl_dia || "1"}
                                onChange={e => saveAlim({ ...planAlim, tomasAl_dia: e.target.value })}
                                style={{ width: "100%", padding: "0.3rem 0.5rem", fontSize: "0.8rem", borderRadius: "4px", border: "1px solid #ccc" }}
                              >
                                {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n} toma{n > 1 ? "s" : ""}/día</option>)}
                              </select>
                            </div>
                            {(() => {
                              const cnt = parseInt(selectedCell.cell.count, 10) || 0;
                              const pm = parseFloat(selectedCell.cell.pesoMedio || selectedCell.cell.peso_medio) || 0;
                              const biomasaG = cnt * pm;
                              const tomas = parseInt(planAlim.tomasAl_dia || 1);
                              const totalDia = (planAlim.items || []).reduce((sum, it) => {
                                let g = 0;
                                if ((planAlim.modo || "fijos") === "biomasa" && biomasaG > 0) {
                                  g = (biomasaG * (parseFloat(it.cantidad) || 0)) / 100;
                                } else {
                                  g = parseFloat(it.cantidad) || 0;
                                }
                                return sum + g * tomas;
                              }, 0);
                              if (totalDia === 0) return <div />;
                              return (
                                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: "#f0fdf4", borderRadius: "6px", padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "#166534" }}>
                                  <span>Total/día: <strong>{totalDia.toFixed(1)}g</strong></span>
                                  <span style={{ opacity: 0.8 }}>{tomas} toma{tomas > 1 ? "s" : ""} × {(totalDia/tomas).toFixed(1)}g</span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Filas de productos */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.4rem" }}>
                            {(planAlim.items || []).map((item, idx) => {
                              const cnt = parseInt(selectedCell.cell.count, 10) || 0;
                              const pm = parseFloat(selectedCell.cell.pesoMedio || selectedCell.cell.peso_medio) || 0;
                              const biomasaG = cnt * pm;
                              const esBio = (planAlim.modo || "fijos") === "biomasa";
                              const gCalc = esBio && biomasaG > 0
                                ? (biomasaG * (parseFloat(item.cantidad) || 0) / 100).toFixed(1)
                                : null;
                              return (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 90px 24px", gap: "4px", alignItems: "center" }}>
                                  <input type="text" list="grenoucerie-productos" value={item.producto || ""} placeholder="Producto..."
                                    onChange={e => { const items = [...(planAlim.items||[])]; items[idx]={...items[idx],producto:e.target.value}; saveAlim({...planAlim,items}); }}
                                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", borderRadius: "4px", border: "1px solid #ccc" }}
                                  />
                                  <div style={{ position: "relative" }}>
                                    <input type="text" value={item.cantidad || ""}
                                      placeholder={esBio ? "% bio" : "gramos"}
                                      onChange={e => { const items = [...(planAlim.items||[])]; items[idx]={...items[idx],cantidad:e.target.value}; saveAlim({...planAlim,items}); }}
                                      style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", borderRadius: "4px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }}
                                    />
                                    {esBio && gCalc && (
                                      <div style={{ fontSize: "0.65rem", color: "#27ae60", textAlign: "right", lineHeight: 1, marginTop: "1px" }}>{gCalc}g/toma</div>
                                    )}
                                  </div>
                                  <button onClick={() => { const items=(planAlim.items||[]).filter((_,i)=>i!==idx); saveAlim({...planAlim,items}); }}
                                    style={{ background:"none", border:"none", color:"#e74c3c", cursor:"pointer", fontSize:"1rem", lineHeight:1 }}>×</button>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => saveAlim({ ...planAlim, items: [...(planAlim.items||[]), { producto:"", cantidad:"" }] })}
                            style={{ fontSize: "0.78rem", background: "#e8f8f0", border: "1px dashed #2ecc71", borderRadius: "4px", padding: "0.25rem 0.6rem", cursor: "pointer", color: "#27ae60", marginBottom: "0.4rem" }}
                          >
                            + Añadir producto
                          </button>

                          <div>
                            <label style={{ fontSize: "0.72rem", color: "#888", display: "block", marginBottom: "2px" }}>Notas</label>
                            <textarea value={planAlim.notas || ""} onChange={e => saveAlim({ ...planAlim, notas: e.target.value })}
                              placeholder="Ej: solo días pares, aumentar si T>24°C..."
                              rows={2} style={{ width: "100%", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", padding: "0.3rem", resize: "vertical", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* ─── PLAN DE TRATAMIENTO ─── */}
                        <div>
                          <h4 style={{ margin: "0 0 0.7rem 0", color: "#2980b9", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "5px" }}>
                            💊 Plan de Tratamiento
                          </h4>

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.5rem" }}>
                            {(planTrat.items || []).map((item, idx) => (
                              <div key={idx} style={{ background: "#f0f6ff", borderRadius: "6px", padding: "0.4rem 0.5rem", border: "1px solid #d0e4f7" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 24px", gap: "4px", alignItems: "center", marginBottom: "3px" }}>
                                  <input
                                    type="text"
                                    value={item.producto || ""}
                                    placeholder="Producto / tratamiento..."
                                    onChange={e => {
                                      const items = [...(planTrat.items || [])];
                                      items[idx] = { ...items[idx], producto: e.target.value };
                                      saveTrat({ ...planTrat, items });
                                    }}
                                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}
                                  />
                                  <input
                                    type="text"
                                    value={item.dosis || ""}
                                    placeholder="Dosis (ej: 5ml/10L)"
                                    onChange={e => {
                                      const items = [...(planTrat.items || [])];
                                      items[idx] = { ...items[idx], dosis: e.target.value };
                                      saveTrat({ ...planTrat, items });
                                    }}
                                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}
                                  />
                                  <button
                                    onClick={() => {
                                      const items = (planTrat.items || []).filter((_, i) => i !== idx);
                                      saveTrat({ ...planTrat, items });
                                    }}
                                    style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
                                  >×</button>
                                </div>
                                <input
                                  type="text"
                                  value={item.frecuencia || ""}
                                  placeholder="Frecuencia / pauta (ej: cada 15 días, preventivo mensual...)"
                                  onChange={e => {
                                    const items = [...(planTrat.items || [])];
                                    items[idx] = { ...items[idx], frecuencia: e.target.value };
                                    saveTrat({ ...planTrat, items });
                                  }}
                                  style={{ width: "100%", padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                                />
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => saveTrat({ ...planTrat, items: [...(planTrat.items || []), { producto: "", dosis: "", frecuencia: "" }] })}
                            style={{ fontSize: "0.78rem", background: "#e8f2fc", border: "1px dashed #3498db", borderRadius: "4px", padding: "0.25rem 0.6rem", cursor: "pointer", color: "#2980b9" }}
                          >
                            + Añadir tratamiento
                          </button>
                        </div>

                      </div>
                      <div style={{ marginTop: "0.7rem", fontSize: "0.72rem", color: "#aaa", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                        Los cambios en los planes se guardan automáticamente al modificar cada campo.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Botones de Pie de Modal */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem",
                borderTop: "1px solid #eee",
                paddingTop: "1rem",
              }}
            >
              <button
                className="btn-baja"
                style={{ background: "#7f8c8d" }}
                onClick={() => setSelectedCell(null)}
              >
                Cerrar
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {((selectedCell.cell.count > 0 && selectedCell.grupo !== "invernadero") || (selectedCell.grupo === "incubadoras" && puestas.some(p => normalizarId(p.destino) === normalizarId(selectedCell.cell.id)))) && (
                  <button className="btn-baja" onClick={vaciarCelda}>
                    🗑️ Vaciar Celda
                  </button>
                )}

                {((selectedCell.cell.count > 0 && selectedCell.grupo !== "invernadero") || (selectedCell.grupo === "incubadoras" && puestas.some(p => normalizarId(p.destino) === normalizarId(selectedCell.cell.id)))) && (
                  <button
                    style={{
                      background: "#0984e3",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      padding: "0.4rem 1rem",
                    }}
                    onClick={() => {
                      setTransferenciaActiva({
                        cell: selectedCell.cell,
                        grupo: selectedCell.grupo,
                      });
                      setSelectedCell(null);
                    }}
                  >
                    🔄 Trasladar
                  </button>
                )}

                {(selectedCell.grupo === "adultas" ||
                  selectedCell.grupo === "naveVerde" ||
                  selectedCell.grupo === "reproduccion") && (
                  <button
                    className="btn-puesta"
                    onClick={() => {
                      registrarPuesta(selectedCell.cell.id, selectedCell.grupo);
                      setSelectedCell(null);
                    }}
                  >
                    🐸 + Puesta
                  </button>
                )}

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {!(modalObs && modalObs.includes("[BLOQUEADO")) && (
                    <select
                      value={modalLockReason}
                      onChange={(e) => setModalLockReason(e.target.value)}
                      style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #ccc" }}
                    >
                      <option value="Revisar">Revisar</option>
                      <option value="Desinfectar">🧴 Desinfectar</option>
                      <option value="Bajar">Bajar</option>
                      <option value="Dejar como está">Dejar como está</option>
                      <option value="Reparación">Reparación</option>
                      <option value="Otros">Otros...</option>
                    </select>
                  )}
                  {modalObs && modalObs.includes("[BLOQUEADO") && (
                    <span style={{
                      fontSize: "0.78rem", fontWeight: "bold", padding: "0.3rem 0.6rem", borderRadius: "4px",
                      background: lockIcon(modalObs) === "🧴" ? "#e8f4fd" : lockIcon(modalObs) === "🔧" ? "#fdf0e0" : "#fdecea",
                      color: lockIcon(modalObs) === "🧴" ? "#0984e3" : lockIcon(modalObs) === "🔧" ? "#d35400" : "#c23616",
                    }}>
                      {lockIcon(modalObs)} {(modalObs.match(/\[BLOQUEADO(?:[:-]?\s*(.*?))?\]/) || [])[1] || "Bloqueado"}
                    </span>
                  )}
                  <button
                    style={{
                      background:
                        modalObs && modalObs.includes("[BLOQUEADO")
                          ? "#e1b12c"
                          : "#c23616",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      padding: "0.4rem 1rem",
                    }}
                    onClick={toggleLock}
                  >
                    {modalObs && modalObs.includes("[BLOQUEADO")
                      ? "🔓 Desbloquear"
                      : "🔒 Bloquear"}
                  </button>
                </div>

                <button className="btn-puesta" onClick={guardarCambiosCelda}>
                  💾 Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}

export default CellModal;
