import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import ReportesExportar from "./components/ReportesExportar";
import Section from "./components/Section";
import TableHistory from "./components/TableHistory";
import { UCIGrid, ReproduccionGrid, LaboratorioGrid, InvernaderoGrid, BrumacionGrid, AdultasGrid, MetamorfoseadasGrid, GridEstructura } from "./components/Grids";
import IncidenciasPanel from "./components/IncidenciasPanel";
import TratamientosMasivos from "./components/TratamientosMasivos";
import AlimentacionPanel from "./components/AlimentacionPanel";
import DashboardMetricas from "./components/DashboardMetricas";
import { PRODUCTOS_DEFAULT, PLANES_FASE_DEFAULT, AREAS_PIZARRA, OBTENER_DATOS_DENSIDAD } from "./constants";
import { normalizarId, lockIcon, lockClass, parseSubgrupos, serializeSubgrupos, normalizarFecha, getFechaHoyNorm, getFechaAyerNorm, parseCellId, esEventoNoTratamiento } from "./utils";
import { useSupabase } from "./hooks/useSupabase";
import { usePizarra } from "./hooks/usePizarra";
import { useLotes } from "./hooks/useLotes";
import { useCloudSync } from "./hooks/useCloudSync";
import { useTratamientos } from "./hooks/useTratamientos";
import {
  generarCeldasIncubadoras, asegurarEstructurasIncubadoras,
  generarCeldasGrid, asegurarEstructurasRenacuajos,
  generarCeldasMetamorfoseadas, asegurarEstructurasMetamorfoseadas,
  generarCeldasReproduccion, asegurarEstructurasReproduccion,
  generarCeldasAdultas, asegurarEstructurasAdultas,
  generarCeldasUCI, asegurarEstructurasNaveVerde,
  generarCeldasBrumacion, asegurarEstructurasBrumacion,
  generarCeldasInvernadero, asegurarEstructurasInvernadero,
  DEFAULT_DATA,
} from "./gridStructures";

function App() {
  const { cloudConfig, setCloudConfig, isCloudConnected, setIsCloudConnected, isSyncing, setIsSyncing, cloudSaveError, setCloudSaveError, ubicacionIdCacheRef, headers: obtenerCabeceras, sbFetch } = useSupabase();
  const { resolverUbicacionId, obtenerOCrearLote, actualizarLoteIdEnCenso, moverLoteCompleto, crearLoteHijoEnDestino, procesarTrasladoLote } = useLotes({ sbFetch, ubicacionIdCacheRef });

  // Pestaña activa del gestor
  const [activeTab, setActiveTab] = useState("dashboard");

  // Pestaña activa de la estructura de renacuajos (1 a 4)
  const [activeEstructura, setActiveEstructura] = useState(1);

  // Celda seleccionada para el modal
  const [selectedCell, setSelectedCell] = useState(null);

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_data");

    const migrateDate = (dateStr) => {
      if (!dateStr) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      const match = dateStr.match(/^(\d{2})\/(\d{2})$/);
      if (match) {
        return `2026-${match[2]}-${match[1]}`;
      }
      return dateStr;
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrar fechas
      Object.keys(parsed).forEach((groupKey) => {
        if (Array.isArray(parsed[groupKey])) {
          parsed[groupKey] = parsed[groupKey].map((item) => ({
            ...item,
            lastDate: migrateDate(item.lastDate),
          }));
        }
      });

      // Asegurar que las nuevas secciones existan localmente
      parsed.adultas = asegurarEstructurasAdultas(parsed);
      parsed.naveVerde = asegurarEstructurasNaveVerde(parsed.naveVerde);

      if (!parsed.renacuajos) {
        parsed.renacuajos = DEFAULT_DATA.renacuajos;
      } else {
        // Asegurar que contenga las celdas de cuadrícula
        parsed.renacuajos = asegurarEstructurasRenacuajos(parsed.renacuajos);
      }

      if (!parsed.metamorfoseadas) {
        parsed.metamorfoseadas = DEFAULT_DATA.metamorfoseadas;
      } else {
        parsed.metamorfoseadas = asegurarEstructurasMetamorfoseadas(
          parsed.metamorfoseadas,
        );
      }

      if (!parsed.reproduccion) {
        parsed.reproduccion = DEFAULT_DATA.reproduccion;
      } else {
        parsed.reproduccion = asegurarEstructurasReproduccion(parsed.reproduccion);
      }

      if (!parsed.brumacion) {
        parsed.brumacion = DEFAULT_DATA.brumacion;
      } else {
        parsed.brumacion = asegurarEstructurasBrumacion(parsed.brumacion);
      }

      if (!parsed.invernadero) {
        parsed.invernadero = DEFAULT_DATA.invernadero;
      } else {
        parsed.invernadero = asegurarEstructurasInvernadero(parsed.invernadero);
      }

      // Cleanup de grupos viejos para no engordar el localStorage innecesariamente
      delete parsed.grupo31;
      delete parsed.grupo24;
      delete parsed.grupo21;

      return parsed;
    }
    return DEFAULT_DATA;
  });

  const [puestas, setPuestas] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_puestas");
    return saved ? JSON.parse(saved) : [];
  });

  const [tratamientos, setTratamientos] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_tratamientos");
    return saved ? JSON.parse(saved) : [];
  });

  const [incidencias, setIncidencias] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_incidencias");
    return saved ? JSON.parse(saved) : [];
  });

  // Bajas cargadas desde la tabla normalizada `bajas` en Supabase
  const [bajasCloud, setBajasCloud] = useState([]);

  const { notasPizarra, setNotasPizarra, showFormNota, setShowFormNota, formNota, setFormNota, guardarNotaPizarra, togglePinNota, borrarNotaPizarra } = usePizarra({ isCloudConnected, sbFetch, setCloudSaveError });

  const [inventario, setInventario] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_inventario");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            nombre: "Spirulina en polvo",
            stock: 500,
            unidad: "g",
            min_stock: 100,
          },
          {
            id: 2,
            nombre: "Micro-pellets 1mm",
            stock: 5.5,
            unidad: "kg",
            min_stock: 2,
          },
        ];
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalText, setImportModalText] = useState("");
  const [importDestino, setImportDestino] = useState("renacuajos");

  // Estados locales para el modal de edicin de celda
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
  // Nuevos campos de parametrización de tratamientos
  const [modalTratCategoria, setModalTratCategoria] = useState("alimento"); // "alimento" | "medicamento" | "preventivo"
  const [modalTratFrecuencia, setModalTratFrecuencia] = useState("");        // ej: "Cada 8 horas", "1 vez al día"
  const [modalTratNumDosis, setModalTratNumDosis] = useState("");            // nº total de dosis del ciclo
  const [modalTratNumTomas, setModalTratNumTomas] = useState("1");           // nº de tomas/día (alimento)
  const [modalTratNotas, setModalTratNotas] = useState("");                  // observaciones clínicas
  const [mostrarTratExpandido, setMostrarTratExpandido] = useState(false);   // expandir / colapsar opciones
  const [modalTratNumIndividuos, setModalTratNumIndividuos] = useState("1");
  const [modalBajaCant, setModalBajaCant] = useState("1");
  const [modalBajaSexo, setModalBajaSexo] = useState("");
  const [modalSalidaCant, setModalSalidaCant] = useState("1");
  const [modalRegaDestino, setModalRegaDestino] = useState("");
  const [modalTipoSalida, setModalTipoSalida] = useState("REGA");

  // Modal de registro de puesta
  const [modalPuestaData, setModalPuestaData] = useState(null); // null = cerrado
  const initModalPuesta = (cellId, grupo) => setModalPuestaData({
    cellId, grupo,
    cantPuestas: "1",
    cantHuevos: "",
    tipoPuesta: "Natural",
    estado: "Buena",
    fecha: new Date().toLocaleDateString("es-ES"),
    incubadora: "INC-1",
    obs: "",
    desdeIncubadora: false,
  });
  const initModalPuestaDesdeInc = (incubadoraId) => setModalPuestaData({
    cellId: "",           // el usuario escribe el tanque de origen
    grupo: "adultas",
    cantPuestas: "1",
    cantHuevos: "",
    tipoPuesta: "Natural",
    estado: "Buena",
    fecha: new Date().toLocaleDateString("es-ES"),
    incubadora: incubadoraId,
    obs: "",
    desdeIncubadora: true,  // bloquea la incubadora y muestra campo tanque origen
  });

  // Estados para Tratamientos Masivos
  const [bulkTratSelectedTanks, setBulkTratSelectedTanks] = useState([]);
  const [bulkTratCategoria, setBulkTratCategoria] = useState("Desparasitación Externa");
  const [bulkTratProducto, setBulkTratProducto] = useState("");
  const [bulkTratDosis, setBulkTratDosis] = useState("");
  const [bulkTratTiempo, setBulkTratTiempo] = useState("");
  const [bulkTratFecha, setBulkTratFecha] = useState(new Date().toISOString().split("T")[0]);

  // Estados para Control de Incidencias
  const [incidenciaForm, setIncidenciaForm] = useState({
    fechaInicio: new Date().toLocaleDateString("es-ES"),
    agenteCausante: "",
    racewaysAfectados: "",
    tratCategoria: "Tratamiento Antibiótico",
    tratProducto: "",
    tratDosis: "",
    tratFrecuencia: "",
    severidad: "Media",
    notas: "",
  });
  const [incidenciaCerrarId, setIncidenciaCerrarId] = useState(null);
  const [incidenciaNotasCierre, setIncidenciaNotasCierre] = useState("");

  // ─── Estados del sistema de Alimentación ───────────────────────────────────
  // Registros históricos de alimentación: { id, fecha, hora, tanqueId, grupo, items:[{producto,gramos}] }
  const [registrosAlimentacion, setRegistrosAlimentacion] = useState(() => {
    try {
      const saved = localStorage.getItem("grenoucerie_alimentacion");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Planes de alimentación por tanque: { tanqueId: { items:[{producto,gramos}], porcentajeBiomasa, notas } }
  const [planesAlimentacion, setPlanesAlimentacion] = useState(() => {
    try {
      const saved = localStorage.getItem("grenoucerie_planes_alimentacion");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Planes de tratamiento por tanque: { tanqueId: { items:[{producto, dosis, frecuencia, notas}] } }
  const [planesTratamiento, setPlanesTratamiento] = useState(() => {
    try {
      const saved = localStorage.getItem("grenoucerie_planes_tratamiento");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Planes de alimentación por fase biológica: { "Engorde": { items, frecuencia, modo, tomasAl_dia, notas } }
  const [planesFase, setPlanesFase] = useState(() => {
    try {
      const saved = localStorage.getItem("grenoucerie_planes_fase");
      const parsed = saved ? JSON.parse(saved) : null;
      return (parsed && Object.keys(parsed).length > 0) ? parsed : { ...PLANES_FASE_DEFAULT };
    } catch { return { ...PLANES_FASE_DEFAULT }; }
  });

  const [productosDisponibles, setProductosDisponibles] = useState(() => {
    try {
      const saved = localStorage.getItem("grenoucerie_productos");
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed?.length ? parsed : [...PRODUCTOS_DEFAULT];
    } catch { return [...PRODUCTOS_DEFAULT]; }
  });
  const [nuevoProd, setNuevoProd] = useState("");

  // Estado para secciones expandibles de planes en el modal de celda
  const [planesExpanded, setPlanesExpanded] = useState(false);
  const [planesFaseExpanded, setPlanesFaseExpanded] = useState(false);
  const [editandoFase, setEditandoFase] = useState(null); // fase actualmente en edición

  // Estados del formulario de alimentación masiva
  const [bulkAlimSelectedTanks, setBulkAlimSelectedTanks] = useState([]);
  const [bulkAlimItems, setBulkAlimItems] = useState([{ producto: "", gramos: "" }]);
  const [bulkAlimFecha, setBulkAlimFecha] = useState(new Date().toISOString().split("T")[0]);
  const [bulkAlimTomas, setBulkAlimTomas] = useState("1");

  // Estados del formulario de alimentación individual (modal de celda)
  const [modalAlimItems, setModalAlimItems] = useState([{ producto: "", gramos: "" }]);

  // Estado para Traslado de Raceways
  const [transferenciaActiva, setTransferenciaActiva] = useState(null);
  const [modalPesajeActivo, setModalPesajeActivo] = useState(null);
  const [modalTrasladoEstandar, setModalTrasladoEstandar] = useState(null);
  const [trasladoForm, setTrasladoForm] = useState({
    cantidad: 1,
    motivo: "",
    copiarTratamiento: true,
    copiarAlimentacion: true,
    sexo: "",
  });
  const [pesajeForm, setPesajeForm] = useState({
    gramosTotales: "",
    m1: "",
    m2: "",
    m3: "",
    motivo: "",
  });

  // ─── Cloud Sync Hook ─────────────────────────────────────────────────────────
  const { syncInventarioNube, guardarTratamientoEnNube, guardarBajaEnNube, syncPlanesNube, cargarPlanesDesdeNube, cargarDatosDeLaNube, subirDatosLocalesALaNube } = useCloudSync({
    cloudConfig, isCloudConnected, setIsCloudConnected,
    setIsSyncing, setCloudSaveError,
    headers: obtenerCabeceras,
    data, puestas, tratamientos, incidencias, inventario,
    registrosAlimentacion, planesAlimentacion, planesTratamiento, planesFase, productosDisponibles,
    setData, setPuestas, setTratamientos, setIncidencias,
    setBajasCloud, setNotasPizarra, setInventario,
    setPlanesAlimentacion, setPlanesTratamiento, setPlanesFase, setProductosDisponibles,
    setRegistrosAlimentacion,
    obtenerOCrearLote,
  });

  const { aplicarTratamiento, aplicarTratamientoMasivo, alarmas2aDosis, alarmasDesparasitacion } = useTratamientos({
    isCloudConnected, cloudConfig, obtenerCabeceras, setCloudSaveError,
    tratamientos, setTratamientos,
    bulkTratSelectedTanks, setBulkTratSelectedTanks,
    bulkTratCategoria, bulkTratProducto, setBulkTratProducto,
    bulkTratDosis, setBulkTratDosis, bulkTratTiempo, setBulkTratTiempo,
    bulkTratFecha,
  });

  const ejecutarTraslado = async (rawDestinoCell, destinoGrupo) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const { cell: rawOrigenCell, grupo: origenGrupo } = transferenciaActiva;
    const origenCell = { ...rawOrigenCell, id: normalizarId(rawOrigenCell.id) };
    const destinoCell = {
      ...rawDestinoCell,
      id: normalizarId(rawDestinoCell.id),
    };

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
      alert(
        "El tanque de origen está BLOQUEADO. No puedes trasladar ranas desde él.",
      );
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }
    const itemDestinoTest = data[destinoGrupo]?.find(
      (i) => normalizarId(i.id).toLowerCase() === normalizarId(destinoCell.id).toLowerCase(),
    );
    if (
      itemDestinoTest &&
      itemDestinoTest.obs &&
      itemDestinoTest.obs.includes("[BLOQUEADO")
    ) {
      alert(
        "El tanque de destino está BLOQUEADO. No puedes trasladar ranas hacia él.",
      );
      setTransferenciaActiva(null);
      setIsProcessing(false);
      return;
    }

    if (origenGrupo === "renacuajos" || origenGrupo === "metamorfoseadas") {
      setModalPesajeActivo({
        origenCell,
        origenGrupo,
        destinoCell,
        destinoGrupo,
      });
      setPesajeForm({ gramosTotales: "", m1: "", m2: "", m3: "", motivo: "" });
    } else {
      setModalTrasladoEstandar({
        origenCell,
        origenGrupo,
        destinoCell,
        destinoGrupo,
      });
      setTrasladoForm({
        cantidad: 1,
        motivo: "",
        copiarTratamiento: true,
        copiarAlimentacion: true,
        sexo: "",
      });
    }
    setTransferenciaActiva(null);
    setIsProcessing(false);
  };

  const confirmarTrasladoConPesaje = async () => {
    if (!modalPesajeActivo || isProcessing) return;
    setIsProcessing(true);
    const { origenCell, origenGrupo, destinoCell, destinoGrupo } =
      modalPesajeActivo;
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
      alert(
        "Por favor, ingresa al menos una muestra para calcular el peso medio.",
      );
      setIsProcessing(false);
      return;
    }

    // Calcular peso medio
    const sumaMuestras = muestrasList.reduce((a, b) => a + b, 0);
    const pesoMedioPor10 = sumaMuestras / muestrasList.length;
    const pesoMedioUnidad = pesoMedioPor10 / 10; // porque son muestras de 10
    const cant = Math.round(gTotales / pesoMedioUnidad);

    if (cant <= 0) {
      alert(
        "El cálculo de unidades dio 0. Revisa las muestras y los gramos totales.",
      );
      setIsProcessing(false);
      return;
    }

    // Buscar origen y destino reales en el censo (normalizando IDs)
    const cleanOrigenId = normalizarId(origenCell.id);
    const cleanDestinoId = normalizarId(destinoCell.id);

    const itemOrigen = data[origenGrupo]?.find(
      (i) => normalizarId(i.id) === cleanOrigenId,
    );
    if (!itemOrigen || itemOrigen.count < cant) {
      alert(
        `No hay suficientes unidades en el origen (${itemOrigen ? itemOrigen.count : 0} uds disponibles) para cubrir las ${cant} unidades calculadas por el pesaje (${gTotales}g).`,
      );
      setIsProcessing(false);
      return;
    }

    const nuevoCountOrigen = itemOrigen.count - cant;
    const itemDestino = data[destinoGrupo]?.find(
      (i) => normalizarId(i.id) === cleanDestinoId,
    ) || { id: cleanDestinoId, count: 0 };
    const nuevoCountDestino = itemDestino.count + cant;

    // Actualizar censo local
    const newData = { ...data };

    const actualizarLista = (
      grupo,
      idBuscado,
      nuevoCount,
      itemBase,
      isOrigen,
    ) => {
      let modificado = false;
      const extras =
        isOrigen && nuevoCount <= 0
          ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
          : {};
      let list = newData[grupo].map((item) => {
        const cId = normalizarId(item.id);
        if (cId.toLowerCase() === idBuscado.toLowerCase()) {
          modificado = true;
          return {
            ...item,
            id: idBuscado,
            count: nuevoCount,
            lastDate: getFechaHoyNorm(),
            ...extras,
          };
        }
        return item;
      });
      if (!modificado) {
        list.push({
          ...itemBase,
          id: idBuscado,
          count: nuevoCount,
          lastDate: getFechaHoyNorm(),
          ...extras,
        });
      }
      newData[grupo] = list;
    };

    actualizarLista(
      origenGrupo,
      cleanOrigenId,
      nuevoCountOrigen,
      itemOrigen,
      true,
    );
    actualizarLista(
      destinoGrupo,
      cleanDestinoId,
      nuevoCountDestino,
      itemDestino,
      false,
    );

    setData(newData);

    // Registro de historial con el detalle del pesaje
    const horaTrat = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const fechaTrat = new Date().toLocaleDateString("es-ES");
    const detallePesaje = ` (${gTotales}g, Peso medio: ${pesoMedioUnidad.toFixed(3)}g/ud${motivo ? `, Motivo: ${motivo}` : ""})`;

    const movOrigen = {
      id: Date.now(),
      fecha: fechaTrat,
      hora: horaTrat,
      tanque: cleanOrigenId,
      tipo: `Traslado a ${cleanDestinoId}${detallePesaje}`,
      dosis: String(cant),
    };

    const movDestino = {
      id: Date.now() + 1,
      fecha: fechaTrat,
      hora: horaTrat,
      tanque: cleanDestinoId,
      tipo: `Traslado desde ${cleanOrigenId}${detallePesaje}`,
      dosis: String(cant),
    };

    setTratamientos((prev) => [movOrigen, movDestino, ...prev]);
    setModalPesajeActivo(null);
    setIsProcessing(false);

    // Guardar en la nube si está conectado
    if (isCloudConnected) {
      try {
        await syncInventarioNube({
          id: cleanOrigenId,
          grupo: origenGrupo,
          count: nuevoCountOrigen,
          last_date: getFechaHoyNorm(),
        });
        await syncInventarioNube({
          id: cleanDestinoId,
          grupo: destinoGrupo,
          count: nuevoCountDestino,
          last_date: getFechaHoyNorm(),
        });

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
  };

  const confirmarTrasladoEstandar = async () => {
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

    // Actualizar censo local
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
        newData[destinoGrupo].push({
          id: idDestinoExacto,
          count: nuevoCountDestino,
          ...extrasDestino
        });
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
        newData[destinoGrupo].push({
          id: idDestinoExacto,
          count: nuevoCountDestino,
          ...extrasDestino
        });
      }
    }

    // Descontar del subgrupo sexado en origen si se especificó sexo
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

    // Copiar plan de alimentación si aplica
    if (copiarAlimentacion && planesAlimentacion && planesAlimentacion[idOrigenExacto]) {
      const newPlanes = { ...planesAlimentacion };
      newPlanes[idDestinoExacto] = JSON.parse(JSON.stringify(planesAlimentacion[idOrigenExacto]));
      if (nuevoCountOrigen <= 0) {
        delete newPlanes[idOrigenExacto];
      }
      setPlanesAlimentacion(newPlanes);
    } else if (nuevoCountOrigen <= 0 && planesAlimentacion && planesAlimentacion[idOrigenExacto]) {
      const newPlanes = { ...planesAlimentacion };
      delete newPlanes[idOrigenExacto];
      setPlanesAlimentacion(newPlanes);
    }

    // Registrar historial
    const horaTrat = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const fechaTrat = new Date().toLocaleDateString("es-ES");

    const sufijoMotivo = motivo && motivo.trim() !== ""
      ? ` (Motivo: ${motivo.trim()})`
      : "";

    const movOrigen = {
      id: Date.now(),
      fecha: fechaTrat,
      hora: horaTrat,
      tanque: idOrigenExacto,
      tipo: `Traslado a ${idDestinoExacto}${sufijoMotivo}`,
      dosis: String(cant),
    };
    const movDestino = {
      id: Date.now() + 1,
      fecha: fechaTrat,
      hora: horaTrat,
      tanque: idDestinoExacto,
      tipo: `Traslado desde ${idOrigenExacto}${sufijoMotivo}`,
      dosis: String(cant),
    };

    setTratamientos((prev) => [movOrigen, movDestino, ...prev]);

    // Sincronizar en la nube
    if (isCloudConnected) {
      try {
        await syncInventarioNube({
          id: idOrigenExacto,
          grupo: origenGrupo,
          count: nuevoCountOrigen,
          last_date: getFechaHoyNorm(),
          ...extrasOrigen
        });
        await syncInventarioNube({
          id: idDestinoExacto,
          grupo: destinoGrupo,
          count: nuevoCountDestino,
          last_date: getFechaHoyNorm(),
          ...extrasDestino
        });

        await guardarTratamientoEnNube(movOrigen, "traslado");
        await guardarTratamientoEnNube(movDestino, "traslado");

        // Si el destino ya tenía animales de otro lote, no se puede fusionar
        // de forma fiable con el modelo actual (un lote activo por ubicación);
        // se omite la parte normalizada y se deja constancia en consola.
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
  };



  const handleCellClick = (cell, grupo) => {
    if (transferenciaActiva) {
      ejecutarTraslado(cell, grupo);
    } else {
      setSelectedCell({ cell, grupo });
    }
  };


  // Nuevos estados para Biomasa (Renacuajos)
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



  // Registro de bajas especiales con historial detallado
  const registrarBajasEspecial = async (grupo, rawId, cantidadStr, { sexo = null } = {}) => {
    const id = normalizarId(rawId);
    const cantidad = parseInt(cantidadStr, 10);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const itemAfectado = data[grupo].find(
      (item) => normalizarId(item.id) === id,
    );
    if (!itemAfectado || itemAfectado.count < cantidad) {
      alert(
        "No hay suficientes unidades en este tanque/celda para registrar esa cantidad de bajas.",
      );
      return;
    }

    const nuevoCount = itemAfectado.count - cantidad;

    // Actualizar censo local
    const newData = { ...data };
    const extrasBaja =
      nuevoCount <= 0
        ? { type: "", dose: "", obs: "", muestras: "", pesoMedio: "" }
        : {};
    newData[grupo] = newData[grupo].map((item) => {
      const cId = normalizarId(item.id).toLowerCase();
      if (cId === id.toLowerCase())
        return { ...item, id: id, count: nuevoCount, ...extrasBaja };
      return item;
    });
    setData(newData);

    // Mantener bajasCloud sincronizado localmente
    const hoyISO = new Date().toISOString().split("T")[0];
    const horaISO = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    setBajasCloud((prev) => [{ id: Date.now(), fecha: hoyISO, hora: horaISO, tanque_id: id, cantidad, causa: null, sexo: sexo || null, lote_id: itemAfectado.lote_id || null }, ...prev]);

    // Guardar en la nube (solo tabla bajas — sin dual-write a tratamientos)
    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: id, grupo: grupo, count: nuevoCount });
        await guardarBajaEnNube({
          tanqueId: id, grupo, cantidad: cantidad,
          categoria: "Mortalidad",
          loteIdLocal: itemAfectado.lote_id,
          sexo,
        });
      } catch (err) {
        console.error("Error al guardar baja en la nube:", err);
        setCloudSaveError(`Error al guardar baja: ${err.message}`);
      }
    }
  };
  // Mantener compatibilidad con botones simples de baja
  const registrarBaja = async (grupo, id) => {
    const cantPrompt = window.prompt("¿Cuántas bajas deseas registrar?", "1");
    if (cantPrompt === null) return;
    await registrarBajasEspecial(grupo, id, cantPrompt);
  };

  // Abre el modal de registro de puesta (sustituye los window.prompt en cadena)
  const registrarPuesta = (id, nombreGrupo) => {
    initModalPuesta(id, nombreGrupo);
  };

  // Confirma y guarda la puesta desde el modal
  const confirmarPuesta = async () => {
    if (!modalPuestaData) return;
    const { cellId, grupo, cantPuestas, cantHuevos, tipoPuesta, estado, fecha, incubadora, obs } = modalPuestaData;

    const cant = parseInt(cantPuestas, 10);
    if (isNaN(cant) || cant <= 0) return alert("Indica un número válido de puestas.");

    let incSeleccionada = incubadora ? incubadora.toUpperCase().trim() : null;
    if (incSeleccionada === "" || incSeleccionada === "SIN ASIGNAR") incSeleccionada = null;
    if (incSeleccionada && /^\d+$/.test(incSeleccionada)) incSeleccionada = "INC-" + incSeleccionada;

    const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const timestampBase = Date.now();
    const nuevasPuestas = [];
    for (let i = 0; i < cant; i++) {
      nuevasPuestas.push({
        id: timestampBase + i,
        fecha,
        hora,
        tanque: cellId,
        grupo,
        destino: incSeleccionada || "Sin asignar",
        huevos: cantHuevos ? parseInt(cantHuevos, 10) : null,
        tipo_puesta: tipoPuesta || "Natural",
        estado: estado || "Buena",
        obs: obs || "",
      });
    }

    setPuestas((prev) => [...nuevasPuestas, ...prev]);
    setModalPuestaData(null);

    if (incSeleccionada) {
      setData((prevData) => {
        const newData = { ...prevData };
        if (newData.incubadoras) {
          newData.incubadoras = newData.incubadoras.map((inc) =>
            inc.id === incSeleccionada
              ? { ...inc, count: (inc.count || 0) + cant }
              : inc,
          );
        }
        return newData;
      });
    }

    if (isCloudConnected) {
      try {
        const payload = nuevasPuestas.map((p) => ({
          id: p.id, fecha: p.fecha, hora: p.hora,
          tanque: p.tanque, grupo: p.grupo, destino: p.destino,
          huevos: p.huevos, tipo_puesta: p.tipo_puesta, estado: p.estado, obs: p.obs,
        }));
        const res = await fetch(`${cloudConfig.url}/rest/v1/puestas`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = errBody.message || errBody.hint || errBody.details || "Error desconocido";
          console.error("Supabase puestas error:", res.status, errBody);
          setCloudSaveError(`Error al guardar puesta (${res.status}): ${msg}`);
        } else {
          setCloudSaveError(null);
          if (incSeleccionada) {
            const currentInc = data.incubadoras?.find((i) => i.id === incSeleccionada);
            const newCount = (currentInc ? currentInc.count : 0) + cant;
            await syncInventarioNube({ id: incSeleccionada, grupo: "incubadoras", count: newCount });
          }
        }
      } catch (err) {
        console.error("Error al sincronizar puestas", err);
        setCloudSaveError(`Error de red al guardar puesta: ${err.message}`);
      }
    }
  };


  const borrarItem = async (lista, setLista, id, tipoHistorial) => {
    setLista(lista.filter((p) => p.id !== id));

    if (isCloudConnected) {
      try {
        const tabla = tipoHistorial === "puesta" ? "puestas" : "tratamientos";
        await fetch(`${cloudConfig.url}/rest/v1/${tabla}?id=eq.${id}`, {
          method: "DELETE",
          headers: obtenerCabeceras(),
        });
      } catch (err) {
        console.error(`Error al borrar ${tipoHistorial} en la nube:`, err);
      }
    }
  };

  // ─── Control de Incidencias (bacteriosis y otros brotes sanitarios) ──────
  const abrirIncidencia = async (form) => {
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

    // Aplicar el tratamiento, si se indicó, a cada raceway afectado.
    // Esto crea registros reales en `tratamientos`, visibles en el historial
    // de cada raceway y en Historiales y Reportes — no solo en la incidencia.
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
  };

  const actualizarIncidencia = async (id, cambios) => {
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
  };

  const cerrarIncidencia = async (id, notasCierre, tratamientoFinal) => {
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
  };

  const borrarIncidencia = async (id) => {
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
  };

  const borrarBajaCloud = async (bajaId) => {
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
  };


  const updateField = async (grupo, id, field, value) => {
    const itemAfectado = data[grupo].find((item) => item.id === id);
    if (!itemAfectado) return;

    let extraUpdates = {};
    if (field === "type") {
      const hoy = new Date().toISOString().split("T")[0];
      if (value !== "" && !itemAfectado.lastDate) extraUpdates.lastDate = hoy;
      extraUpdates.fechaFase = value !== "" ? hoy : "";
    }

    const newData = { ...data };
    newData[grupo] = newData[grupo].map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value, ...extraUpdates };
      }
      return item;
    });
    setData(newData);

    if (isCloudConnected) {
      const dbField = field === "lastDate" ? "last_date" : field;
      const bodyUpdate = { [dbField]: value };
      if (extraUpdates.lastDate) {
        bodyUpdate.last_date = extraUpdates.lastDate;
      }
      if (extraUpdates.fechaFase !== undefined) {
        bodyUpdate.fecha_fase = extraUpdates.fechaFase || null;
      }
      try {
        await syncInventarioNube({ id: id, grupo: grupo, ...bodyUpdate });
      } catch (err) {
        console.error("Error al actualizar campo en la nube:", err);
      }
    }
  };

  const exportarDatos = () => {
    const exportObj = {
      data,
      puestas,
      tratamientos,
      version: "2.1",
      fechaExportacion: new Date().toLocaleDateString("es-ES"),
    };
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `copia_seguridad_grenoucerie_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportarExcel = () => {
    let csvContenido = "\uFEFF"; // BOM UTF-8

    csvContenido += "SECCIÓN: CENSO DE RANAS ADULTAS\n";
    csvContenido +=
      "Grupo;ID Tanque;Cantidad;Último Tratamiento;Tipo de Tratamiento;Dosis;Observaciones;Densidad;% Capacidad\n";
    const gruposAdultos = [
      { nombre: "Cuadrícula Adultas", clave: "adultas" },
      { nombre: "Nave Verde (Observación)", clave: "naveVerde" },
    ];
    gruposAdultos.forEach((g) => {
      if (data[g.clave]) {
        data[g.clave].forEach((item) => {
          const dens = OBTENER_DATOS_DENSIDAD(g.clave, item.id, item.count);
          const obs = (item.obs || "").replace(/"/g, '""');
          csvContenido += `${g.nombre};${item.id};${item.count};${item.lastDate || ""};${item.type || ""};${item.dose || ""};"${obs}";${dens.actual};${dens.porcentaje}%\n`;
        });
      }
    });

    csvContenido += "\n\n";

    // 2. SECCIÓN: ESTRUCTURAS DE RENACUAJOS (GRID)
    csvContenido += "SECCIÓN: ESTRUCTURAS DE RENACUAJOS (CUADRÍCULA)\n";
    csvContenido +=
      "Estructura;Fila;Columna;Celda;Cantidad (ud);Peso Total (g);Gramos/Unidad (g*Ud);Estado/Fase;Observaciones;Última Fecha\n";
    const celdasActivas = data.renacuajos.filter(
      (item) => /^E\d-F\d-C\d+/.test(item.id) && item.count > 0,
    );
    celdasActivas.forEach((cell) => {
      const parts = parseCellId(cell.id);
      const est = parts ? `Estructura ${parts.estructura}` : "Desconocida";
      const fila = parts ? `F${parts.fila}` : "";
      const col = parts ? `C${parts.columna}` : "";
      const gVal = parseFloat(cell.dose) || 0;
      const ratioVal =
        cell.count > 0 && gVal > 0 ? (gVal / cell.count).toFixed(4) : "0";
      const obs = (cell.obs || "").replace(/"/g, '""');

      csvContenido += `${est};${fila};${col};${cell.id};${cell.count};${cell.dose || ""};${ratioVal};${cell.type || ""};"${obs}";${cell.lastDate || ""}\n`;
    });

    // 3. SECCIÓN: METAMORFOSEADAS Y OTROS TANQUES
    csvContenido += "\nSECCIÓN: CONTENEDORES DE METAMORFOSIS Y OTROS\n";
    csvContenido +=
      "Población;ID Tanque;Cantidad;Último Tratamiento;Tipo de Tratamiento/Alimento;Dosis/Fase;Observaciones;Densidad;% Capacidad\n";

    if (data.metamorfoseadas) {
      data.metamorfoseadas.forEach((item) => {
        const dens = OBTENER_DATOS_DENSIDAD(
          "metamorfoseadas",
          item.id,
          item.count,
        );
        const obs = (item.obs || "").replace(/"/g, '""');
        csvContenido += `Recién Metamorfoseadas;${item.id};${item.count};${item.lastDate || ""};${item.type || ""};${item.dose || ""};"${obs}";${dens.actual};${dens.porcentaje}%\n`;
      });
    }

    const renacuajosLegacy = data.renacuajos.filter(
      (item) => !/^E\d-F\d-C\d+/.test(item.id),
    );
    renacuajosLegacy.forEach((item) => {
      const dens = OBTENER_DATOS_DENSIDAD("renacuajos", item.id, item.count);
      const obs = (item.obs || "").replace(/"/g, '""');
      csvContenido += `Renacuajos (Legacy);${item.id};${item.count};${item.lastDate || ""};${item.type || ""};${item.dose || ""};"${obs}";${dens.actual};${dens.porcentaje}%\n`;
    });

    csvContenido += "\n\n";

    // 4. SECCIÓN: HISTORIAL DE PUESTAS
    csvContenido += "SECCIÓN: HISTORIAL DE PUESTAS\n";
    csvContenido += "Fecha;Hora;Tanque;Grupo;Destino (Incubadora);Tipo Puesta;Estado;Huevos;Observaciones\n";
    puestas.forEach((p) => {
      csvContenido += `${p.fecha || ""};${p.hora || ""};${p.tanque || ""};${p.grupo || ""};${p.destino || ""};${p.tipo_puesta || ""};${p.estado || ""};${p.huevos || ""};${(p.obs || "").replace(/;/g, ",")}\n`;
    });

    csvContenido += "\n\n";

    // 5. SECCIÓN: HISTORIAL DE TRATAMIENTOS
    csvContenido += "SECCIÓN: HISTORIAL DE TRATAMIENTOS (MÉDICOS)\n";
    csvContenido += "Fecha;Hora;Tanque;Tipo de Tratamiento;Dosis\n";
    tratamientos
      .filter((t) => t.tipo !== "Baja")
      .forEach((t) => {
        csvContenido += `${t.fecha || ""};${t.hora || ""};${t.tanque || ""};${t.tipo || ""};${t.dosis || ""}\n`;
      });

    csvContenido += "\n\n";

    // 6. SECCIÓN: HISTORIAL DE BAJAS
    csvContenido += "SECCIÓN: HISTORIAL DE BAJAS (MORTALIDAD)\n";
    csvContenido += "Fecha;Tanque;Cantidad;Sexo;Causa\n";
    bajasCloud.forEach((b) => {
      csvContenido += `${b.fecha || ""};${b.tanque_id || ""};${b.cantidad || ""};${b.sexo || ""};${b.causa || ""}\n`;
    });

    const blob = new Blob([csvContenido], { type: "text/csv;charset=utf-8;" });
    const enlaceDescarga = document.createElement("a");
    const url = URL.createObjectURL(blob);
    enlaceDescarga.setAttribute("href", url);
    enlaceDescarga.setAttribute(
      "download",
      `datos_granja_grenoucerie_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click();
    document.body.removeChild(enlaceDescarga);
  };


  const ejecutarImportacionOperario = async () => {
    if (!importModalText) return;
    try {
      const parsedData = JSON.parse(importModalText);
      if (!parsedData.db || !parsedData.tags) throw new Error("Formato incorrecto");

      let nuevosCensos = [...(data[importDestino] || [])];
      let cambios = 0;

      for (const [estId, filas] of Object.entries(parsedData.db)) {
        for (const [filaId, cajas] of Object.entries(filas)) {
          const fNum = filaId.replace("F", "");
          for (const [cajaId, cajaData] of Object.entries(cajas)) {
            const cNum = cajaId.replace("C", "");
            const tanqueId = importDestino === "renacuajos" 
                             ? `E${estId}-F${fNum}-C${cNum}`
                             : `${estId}.${fNum}.${cNum}`;
            const tagKey = `E${estId}-F${fNum}-C${cNum}`;
            
            const etiquetas = parsedData.tags[tagKey] || [];
            const tagStr = etiquetas.length > 0 ? `[${etiquetas[0].toUpperCase()}] ` : "";

            let count = 0;
            let obs = "";
            let dose = "";
            let pesoMedio = "";

            if (cajaData) {
               count = Math.round(cajaData.ud || 0);
               dose = cajaData.g ? cajaData.g.toString() : "";
               pesoMedio = cajaData.mediaPond ? cajaData.mediaPond.toString() : "";
               obs = tagStr.trim();
            } else if (etiquetas.includes("vacia")) {
               count = 0;
               obs = "";
               dose = "";
               pesoMedio = "";
            } else {
               continue;
            }

            const index = nuevosCensos.findIndex(c => c.id === tanqueId);
            const nuevoRegistro = { id: tanqueId, grupo: importDestino, count, obs, dose, pesoMedio };
            
            if (index >= 0) {
              nuevosCensos[index] = nuevoRegistro;
            } else {
              nuevosCensos.push(nuevoRegistro);
            }

            if (isCloudConnected) {
               await syncInventarioNube(nuevoRegistro);
            }
            cambios++;
          }
        }
      }

      setData({ ...data, [importDestino]: nuevosCensos });
      alert(`¡Éxito! Se han importado y actualizado ${cambios} tanques de ${importDestino} automáticamente.`);
      setShowImportModal(false);
      setImportModalText("");
    } catch (err) {
      alert("Error interno: " + err.message);
      console.error(err);
    }
  };

  const importarDatos = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.data) {
          if (
            window.confirm(
              "¿Estás seguro de que quieres restaurar esta copia de seguridad? Se reemplazarán todos los datos actuales.",
            )
          ) {
            if (!parsed.data.renacuajos) {
              parsed.data.renacuajos = DEFAULT_DATA.renacuajos;
            } else {
              parsed.data.renacuajos = asegurarEstructurasRenacuajos(
                parsed.data.renacuajos,
              );
            }
            if (!parsed.data.metamorfoseadas)
              parsed.data.metamorfoseadas = DEFAULT_DATA.metamorfoseadas;

            setData(parsed.data);
            setPuestas(parsed.puestas || []);
            setTratamientos(parsed.tratamientos || []);
            alert("¡Copia de seguridad restaurada con éxito!");
          }
        } else {
          alert("El archivo seleccionado no tiene el formato correcto.");
        }
      } catch (err) {
        alert(
          "Error al leer el archivo. Asegúrate de que es un archivo .json válido.",
        );
      }
    };
    e.target.value = null; // reset input
  };

  // Ayudantes de cálculo de censo
  const calcularCensoGrupo = (grupoArr) => {
    if (!grupoArr) return 0;
    return grupoArr.reduce(
      (acc, curr) => acc + (parseInt(curr.count, 10) || 0),
      0,
    );
  };

  const censoAdultos =
    calcularCensoGrupo(data.adultas) + calcularCensoGrupo(data.naveVerde);
  const censoRenacuajos = calcularCensoGrupo(data.renacuajos);
  const censoMetamorfoseadas = calcularCensoGrupo(data.metamorfoseadas);
  const censoTotal = censoAdultos + censoRenacuajos + censoMetamorfoseadas;

  const FASES_MORTALIDAD = ["iniciación", "juvenil", "engorde", "reproductora"];

  const esTanqueMortalidad = (tanqueId) => {
    const id = normalizarId(tanqueId).toLowerCase();
    for (const grupo of Object.keys(data)) {
      const cell = (data[grupo] || []).find(c => normalizarId(c.id).toLowerCase() === id);
      if (cell) {
        return FASES_MORTALIDAD.includes((cell.type || "").toLowerCase());
      }
    }
    return false;
  };

  const censoMortalidad = (() => {
    let total = 0;
    for (const grupo of Object.keys(data)) {
      (data[grupo] || []).forEach(cell => {
        if (FASES_MORTALIDAD.includes((cell.type || "").toLowerCase())) {
          total += parseInt(cell.count, 10) || 0;
        }
      });
    }
    return total;
  })();

  const obtenerBajasPorFecha = (fechaNorm) => {
    return bajasCloud
      .filter((b) => normalizarFecha(b.fecha) === fechaNorm)
      .reduce((sum, b) => sum + (parseInt(b.cantidad, 10) || 0), 0);
  };

  const obtenerBajasMortalidadPorFecha = (fechaNorm) => {
    return bajasCloud
      .filter((b) => normalizarFecha(b.fecha) === fechaNorm && esTanqueMortalidad(b.tanque_id))
      .reduce((sum, b) => sum + (parseInt(b.cantidad, 10) || 0), 0);
  };

  const hoyNorm = getFechaHoyNorm();
  const ayerNorm = getFechaAyerNorm();

  const bajasHoy = obtenerBajasPorFecha(hoyNorm);
  const bajasAyer = obtenerBajasPorFecha(ayerNorm);

  const bajasMortHoy = obtenerBajasMortalidadPorFecha(hoyNorm);
  const bajasMortAyer = obtenerBajasMortalidadPorFecha(ayerNorm);

  const pctBajasHoy =
    censoMortalidad > 0 || bajasMortHoy > 0
      ? ((bajasMortHoy / (censoMortalidad + bajasMortHoy)) * 100).toFixed(2)
      : "0.00";

  const pctBajasAyer =
    censoMortalidad > 0 || bajasMortAyer > 0
      ? ((bajasMortAyer / (censoMortalidad + bajasMortHoy + bajasMortAyer)) * 100).toFixed(2)
      : "0.00";

  // Configuración de alertas de estado de salud general
  let saludEstado = "excelente";
  let saludMensaje =
    "💚 Excelente: Mortalidad dentro del límite normal (menor a 0.5%).";
  const rateHoy = parseFloat(pctBajasHoy);

  if (rateHoy >= 1.5) {
    saludEstado = "critico";
    saludMensaje =
      "🚨 Alerta Crítica: Alta mortalidad detectada hoy. ¡Revisar tanques y aplicar tratamientos!";
  } else if (rateHoy >= 0.5) {
    saludEstado = "advertencia";
    saludMensaje =
      "⚠️ Alerta Preventiva: Mortalidad moderada. Se recomienda vigilar parámetros y limpieza.";
  }

  // Lista plana de todos los tanques ordenados por sobredensidad
  const obtenerListaTanquesDensidad = () => {
    const lista = [];
    const nombresGrupos = {
      adultas: "Cuadrícula Adultas",
      naveVerde: "Nave Verde (Observación)",
      incubadoras: "Incubadoras (Hatchery)",
      renacuajos: "Cuadrícula Renacuajos",
      metamorfoseadas: "Contenedor Metamorfosis",
    };

    Object.keys(data).forEach((grupoKey) => {
      data[grupoKey].forEach((item) => {
        if (item.count > 0) {
          const dens = OBTENER_DATOS_DENSIDAD(grupoKey, item.id, item.count);
          lista.push({
            id: item.id,
            nombreGrupo: nombresGrupos[grupoKey] || grupoKey,
            grupoKey: grupoKey,
            count: item.count,
            ...dens,
          });
        }
      });
    });

    return lista.sort((a, b) => b.porcentaje - a.porcentaje);
  };

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

    await registrarBajasEspecial(grupo, id, cant, { sexo: modalBajaSexo || null });

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

  // Separar celdas de cuadrícula y tanques legacy
  const celdasEstructura = data.renacuajos.filter((item) =>
    /^E\d-F\d-C\d+/.test(item.id),
  );
  const celdasEstructuraActiva = celdasEstructura.filter((item) =>
    item.id.startsWith(`E${activeEstructura}-`),
  );
  const renacuajosLegacy = data.renacuajos.filter(
    (item) => !/^E\d-F\d-C\d+/.test(item.id),
  );


  // --- CALCULOS PARA RESUMEN GLOBAL ---
  const getResumenGlobal = () => {
    let poblacionTotal = 0;
    Object.keys(data).forEach(grupo => {
      data[grupo].forEach(cell => {
        poblacionTotal += parseInt(cell.count, 10) || 0;
      });
    });

    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    
    const hoyDate = new Date();
    hoyDate.setHours(0,0,0,0);
    
    let bajasSemana = 0; let bajasHoy = 0;
    let tratamientosSemana = 0; let tratamientosHoy = 0;
    let puestasSemana = 0; let puestasHoy = 0;

    const parseFecha = (fechaStr) => {
      if (!fechaStr) return new Date(0);
      const parts = fechaStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return new Date(fechaStr);
    };

    bajasCloud.forEach(b => {
      const fecha = parseFecha(b.fecha);
      if (fecha >= hace7Dias) {
        const val = b.cantidad || 0;
        bajasSemana += val;
        if (fecha >= hoyDate) bajasHoy += val;
      }
    });

    tratamientos.forEach(t => {
      const fecha = parseFecha(t.fecha);
      if (fecha >= hace7Dias && !esEventoNoTratamiento(t)) {
        tratamientosSemana++;
        if (fecha >= hoyDate) tratamientosHoy++;
      }
    });

    puestas.forEach(p => {
      const fecha = parseFecha(p.fecha);
      if (fecha >= hace7Dias) {
        puestasSemana++;
        if (fecha >= hoyDate) puestasHoy++;
      }
    });

    return { poblacionTotal, bajasSemana, bajasHoy, tratamientosSemana, tratamientosHoy, puestasSemana, puestasHoy };
  };

  const resumen = getResumenGlobal();

  return (
    <div className="app-container">
      {transferenciaActiva && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1000,
            background: "#0984e3",
            color: "white",
            padding: "15px",
            textAlign: "center",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <strong style={{ fontSize: "1.1rem" }}>
            🔄 Modo Traslado Activo
          </strong>
          <p style={{ margin: "5px 0" }}>
            Estás trasladando ranas desde el raceway{" "}
            <strong>{transferenciaActiva.cell.id}</strong>.
          </p>
          <p style={{ fontSize: "0.9rem", marginBottom: "10px" }}>
            Navega por las pestañas si lo necesitas y{" "}
            <strong>haz clic en el raceway de destino</strong> para completar el
            traslado.
          </p>
          <button
            style={{
              background: "white",
              color: "#0984e3",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            onClick={() => setTransferenciaActiva(null)}
          >
            ❌ Cancelar Traslado
          </button>
        </div>
      )}
      <header>
        <h1>Grenoucerie Control</h1>
        <p>Centro de Gestión Sanitaria, Reproductiva y de Tratamientos</p>

        <div className="backup-controls">
          <button
            className={`btn-backup ${isCloudConnected ? "connected" : ""}`}
            onClick={() => setActiveTab("config")}
            title="Configurar conexión en la nube"
          >
            {isCloudConnected ? "☁️ Nube Sincronizada" : "☁️ Conectar Nube"}
          </button>

          <button
            className="btn-backup"
            onClick={exportarDatos}
            title="Descargar copia de seguridad en tu PC"
          >
            📥 Exportar Copia (JSON)
          </button>
          <button
            className="btn-backup"
            onClick={exportarExcel}
            title="Exportar datos a Excel (CSV)"
          >
            📊 Exportar a Excel (CSV)
          </button>
          <button
            className="btn-backup"
            title="Importar Triado de Renacuajos"
            onClick={() => setShowImportModal(true)}
          >
            📥 Importar Triado
          </button>
          
          <label
            className="btn-backup"
            title="Cargar copia de seguridad"
            style={{ cursor: "pointer" }}
          >
            📤 Importar Copia
            <input
              type="file"
              accept=".json"
              onChange={importarDatos}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </header>
      {/* Modal de Importación de Operario */}
      {showImportModal && (
        <div className="modal-overlay" style={{ display: "flex", zIndex: 10000 }}>
          <div className="modal-content" style={{ width: "90%", maxWidth: "600px", padding: "2rem" }}>
            <h2 style={{ color: "var(--oliva)", marginTop: 0 }}>📥 Pegar Datos del Operario</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Pega aquí todo el código que te ha pasado el operario. Este recuadro no tiene límite de tamaño.
            </p>
            <textarea
              value={importModalText}
              onChange={(e) => setImportModalText(e.target.value)}
              placeholder='Ejemplo: {"v":1,"db":{"1":...'
              style={{
                width: "100%",
                height: "200px",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontFamily: "monospace",
                marginBottom: "1.5rem"
              }}
            />
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Destino de los datos:</label>
              <select 
                value={importDestino}
                onChange={(e) => setImportDestino(e.target.value)}
                style={{
                  width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid #ccc"
                }}
              >
                <option value="renacuajos">Renacuajos</option>
                <option value="metamorfoseadas">Metamorfoseadas</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button 
                className="btn-rojo"
                onClick={() => { setShowImportModal(false); setImportModalText(""); }}
              >
                Cancelar
              </button>
              <button 
                className="btn-verde"
                onClick={ejecutarImportacionOperario}
              >
                Procesar e Importar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Menú de Pestañas Superior */}
      <nav className="navbar">
        <button className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
          📊 Tablero de Mando
        </button>

        {/* ── NAVE CRÍA ── */}
        <span style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", padding: "0 0.3rem", alignSelf: "center", letterSpacing: "1px" }}>Nave Cría</span>
        <button className={`nav-btn ${activeTab === "adultos" ? "active" : ""}`} onClick={() => setActiveTab("adultos")}>
          🐸 Adultas
        </button>
        <button className={`nav-btn ${activeTab === "renacuajos" ? "active" : ""}`} onClick={() => setActiveTab("renacuajos")}>
          🦠 Renacuajos
        </button>
        <button className={`nav-btn ${activeTab === "incubadoras" ? "active" : ""}`} onClick={() => setActiveTab("incubadoras")}>
          🥚 Incubadoras
        </button>
        <button className={`nav-btn ${activeTab === "reproduccion" ? "active" : ""}`} onClick={() => setActiveTab("reproduccion")}>
          💕 Reproducción
        </button>

        {/* ── ADJUNTAS (Labo + Bruma) ── */}
        <span style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", padding: "0 0.3rem", alignSelf: "center", letterSpacing: "1px" }}>Adjuntas</span>
        <button className={`nav-btn ${activeTab === "laboratorio" ? "active" : ""}`} onClick={() => setActiveTab("laboratorio")}>
          🔬 Laboratorio
        </button>
        <button className={`nav-btn ${activeTab === "brumacion" ? "active" : ""}`} onClick={() => setActiveTab("brumacion")}>
          ❄️ Brumación
        </button>

        {/* ── NAVE VERDE ── */}
        <span style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", padding: "0 0.3rem", alignSelf: "center", letterSpacing: "1px" }}>Nave Verde</span>
        <button className={`nav-btn ${activeTab === "uci" ? "active" : ""}`} onClick={() => setActiveTab("uci")}>
          🏥 UCI
        </button>

        {/* ── INVERNADERO ── */}
        <span style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", padding: "0 0.3rem", alignSelf: "center", letterSpacing: "1px" }}>Invernadero</span>
        <button className={`nav-btn ${activeTab === "invernadero" ? "active" : ""}`} onClick={() => setActiveTab("invernadero")}>
          🪴 Invernadero
        </button>

        {/* ── GESTIÓN ── */}
        <span style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", padding: "0 0.3rem", alignSelf: "center", letterSpacing: "1px" }}>Gestión</span>
        <button className={`nav-btn ${activeTab === "tratamientos" ? "active" : ""}`} onClick={() => setActiveTab("tratamientos")}>
          💊 Tratamientos
        </button>
        <button
          className={`nav-btn ${activeTab === "incidencias" ? "active" : ""}`}
          onClick={() => setActiveTab("incidencias")}
          style={activeTab === "incidencias" ? {} : (incidencias.some(i => i.estado !== "Cerrada") ? { background: "#fdecea", color: "#c0392b" } : {})}
        >
          🚨 Incidencias{incidencias.filter(i => i.estado !== "Cerrada").length > 0 ? ` (${incidencias.filter(i => i.estado !== "Cerrada").length})` : ""}
        </button>
        <button className={`nav-btn ${activeTab === "alimentacion" ? "active" : ""}`} onClick={() => setActiveTab("alimentacion")}
          style={activeTab === "alimentacion" ? {} : { background: "#e8f5e9", color: "#2e7d32" }}>
          🌿 Alimentación
        </button>
        <button className={`nav-btn ${activeTab === "historial" ? "active" : ""}`} onClick={() => setActiveTab("historial")}>
          📋 Historiales
        </button>
        <button className={`nav-btn ${activeTab === "reportes" ? "active" : ""}`} onClick={() => setActiveTab("reportes")}>
          📈 Exportar
        </button>
        <button className={`nav-btn ${activeTab === "inventario" ? "active" : ""}`} onClick={() => setActiveTab("inventario")}>
          📦 Almacén
        </button>
        <button className={`nav-btn ${activeTab === "config" ? "active" : ""}`} onClick={() => setActiveTab("config")}>
          ⚙️ Nube
        </button>

        {/* Indicador de estado de nube siempre visible */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto", padding: "0 0.8rem" }}>
          {isCloudConnected ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#27ae60", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "#27ae60", fontWeight: "bold" }}>Nube OK</span>
              <button
                onClick={() => cargarDatosDeLaNube()}
                disabled={isSyncing}
                title="Refrescar datos desde la nube"
                style={{ background: "none", border: "1px solid #27ae60", color: "#27ae60", borderRadius: "6px", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.72rem", opacity: isSyncing ? 0.5 : 1 }}>
                {isSyncing ? "..." : "🔄"}
              </button>
            </>
          ) : (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e74c3c", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "#e74c3c", fontWeight: "bold" }}>Sin nube</span>
              <button
                onClick={() => setActiveTab("config")}
                style={{ background: "none", border: "1px solid #e74c3c", color: "#e74c3c", borderRadius: "6px", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.72rem" }}>
                Conectar
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Toast de error de nube */}
      {cloudSaveError && (
        <div style={{
          position: "fixed", top: "56px", left: "50%", transform: "translateX(-50%)",
          background: "#c0392b", color: "#fff", padding: "0.6rem 1.2rem",
          borderRadius: "8px", zIndex: 9999, fontSize: "0.85rem",
          boxShadow: "0 3px 12px rgba(0,0,0,0.25)", maxWidth: "90vw",
          display: "flex", alignItems: "center", gap: "0.8rem",
        }}>
          <span>⚠️ {cloudSaveError}</span>
          <button onClick={() => setCloudSaveError(null)}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.6)", color: "#fff", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", fontSize: "0.8rem" }}>
            ✕
          </button>
        </div>
      )}

      {/* Sección 1: Tablero de Mando (Dashboard) */}
      {activeTab === "reportes" && (
        <ReportesExportar
          data={data}
          tratamientos={tratamientos}
          puestas={puestas}
          inventario={inventario}
        />
      )}

      {activeTab === "reproduccion" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <ReproduccionGrid data={data.reproduccion} handleCellClick={handleCellClick} />
        </div>
      )}

      {activeTab === "laboratorio" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <LaboratorioGrid data={data.reproduccion} handleCellClick={handleCellClick} />
        </div>
      )}

      {activeTab === "invernadero" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <InvernaderoGrid data={data.invernadero} handleCellClick={handleCellClick} />
        </div>
      )}

      {activeTab === "brumacion" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <BrumacionGrid data={data.brumacion} handleCellClick={handleCellClick} selectedCell={selectedCell} />
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>

          {/* ── 1. HERO BANNER ────────────────────────────────────────── */}
          <div style={{
            background: "linear-gradient(135deg, #2b322b 0%, #3e4a3e 100%)",
            color: "white",
            padding: "1.2rem 1.5rem",
            borderRadius: "14px",
            marginBottom: "1rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.8rem",
          }}>
            {/* Píldora de estado */}
            <div style={{
              background: saludEstado === "excelente" ? "rgba(46,204,113,0.22)" : saludEstado === "advertencia" ? "rgba(243,156,18,0.22)" : "rgba(231,76,60,0.22)",
              border: `2px solid ${saludEstado === "excelente" ? "#2ecc71" : saludEstado === "advertencia" ? "#f39c12" : "#e74c3c"}`,
              borderRadius: "10px", padding: "0.5rem 1rem",
              display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0,
            }}>
              <span style={{ fontSize: "1.5rem" }}>{saludEstado === "excelente" ? "🟢" : saludEstado === "advertencia" ? "⚠️" : "🚨"}</span>
              <div>
                <div style={{ fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 }}>Estado</div>
                <div style={{ fontSize: "0.9rem", fontWeight: "700" }}>
                  {saludEstado === "excelente" ? "Todo bien" : saludEstado === "advertencia" ? "Precaución" : "Alerta crítica"}
                </div>
              </div>
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Población total */}
            <div style={{ textAlign: "center", flex: "1 1 110px" }}>
              <div style={{ fontSize: "2rem", fontWeight: "900", lineHeight: 1, color: "var(--pistacho)" }}>{censoTotal.toLocaleString()}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>🐸 total</div>
              <div style={{ fontSize: "0.6rem", opacity: 0.5, marginTop: "2px" }}>{censoAdultos} ad · {censoMetamorfoseadas} ran · {censoRenacuajos} ren</div>
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Puestas */}
            <div onClick={() => setActiveTab("incubadoras")} style={{ textAlign: "center", flex: "1 1 90px", cursor: "pointer", borderRadius: "8px", padding: "0.3rem", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: "#f1c40f" }}>{resumen.puestasSemana}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>🥚 puestas / 7d</div>
              {resumen.puestasHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#f1c40f", marginTop: "2px" }}>+{resumen.puestasHoy} hoy</div>}
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Bajas */}
            <div onClick={() => setActiveTab("historial")} style={{ textAlign: "center", flex: "1 1 90px", cursor: "pointer", borderRadius: "8px", padding: "0.3rem", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: bajasHoy > 0 ? "#e74c3c" : "#aaa" }}>{bajasHoy}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>💀 bajas hoy</div>
              {bajasHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#e74c3c", marginTop: "2px" }}>{pctBajasHoy}% censo · ayer {bajasAyer}</div>}
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Tratamientos */}
            <div onClick={() => setActiveTab("tratamientos")} style={{ textAlign: "center", flex: "1 1 90px", cursor: "pointer", borderRadius: "8px", padding: "0.3rem", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: "#3498db" }}>{resumen.tratamientosSemana}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>💊 trat. / 7d</div>
              {resumen.tratamientosHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#3498db", marginTop: "2px" }}>+{resumen.tratamientosHoy} hoy</div>}
            </div>
          </div>

          {/* ── 1b. PIZARRA DE COMUNICACIÓN ──────────────────────── */}
          <div style={{
            background: "#fff",
            borderRadius: "14px",
            padding: "1rem 1.2rem",
            marginBottom: "1rem",
            borderLeft: "6px solid var(--oliva)",
            boxShadow: "var(--sombra)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--oliva)" }}>📋 Pizarra de Comunicación</h3>
              <button
                className="btn-puesta"
                onClick={() => setShowFormNota(!showFormNota)}
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
              >
                {showFormNota ? "✕ Cerrar" : "+ Nueva Nota"}
              </button>
            </div>

            {showFormNota && (
              <div style={{
                background: "#f8f9fa",
                borderRadius: "10px",
                padding: "0.8rem",
                marginBottom: "0.8rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={formNota.autor}
                    onChange={(e) => setFormNota({ ...formNota, autor: e.target.value })}
                    style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", flex: "1 1 120px", fontSize: "0.85rem" }}
                  />
                  <select
                    value={formNota.area}
                    onChange={(e) => setFormNota({ ...formNota, area: e.target.value })}
                    style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                  >
                    {AREAS_PIZARRA.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={formNota.prioridad}
                    onChange={(e) => setFormNota({ ...formNota, prioridad: e.target.value })}
                    style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                  >
                    <option value="normal">Normal</option>
                    <option value="importante">Importante</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <textarea
                  placeholder="Escribe tu mensaje para el equipo..."
                  value={formNota.texto}
                  onChange={(e) => setFormNota({ ...formNota, texto: e.target.value })}
                  rows={2}
                  style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem", resize: "vertical" }}
                />
                <button
                  className="btn-guardar"
                  onClick={guardarNotaPizarra}
                  style={{ alignSelf: "flex-end", padding: "0.4rem 1.2rem", fontSize: "0.85rem" }}
                >
                  Publicar
                </button>
              </div>
            )}

            {notasPizarra.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                Sin notas. Deja un mensaje para el equipo.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "280px", overflowY: "auto" }}>
                {[...notasPizarra]
                  .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    const prioOrder = { urgente: 0, importante: 1, normal: 2 };
                    const pa = prioOrder[a.prioridad] ?? 2;
                    const pb = prioOrder[b.prioridad] ?? 2;
                    if (pa !== pb) return pa - pb;
                    return new Date(b.created_at) - new Date(a.created_at);
                  })
                  .map(nota => {
                    const bgColor = nota.prioridad === "urgente" ? "#fdecea" : nota.prioridad === "importante" ? "#fef9e7" : "#f8f9fa";
                    const borderColor = nota.prioridad === "urgente" ? "#e74c3c" : nota.prioridad === "importante" ? "#f39c12" : "#ddd";
                    const prioIcon = nota.prioridad === "urgente" ? "🔴" : nota.prioridad === "importante" ? "🟡" : "";
                    const fechaNota = nota.created_at ? new Date(nota.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <div key={nota.id} style={{
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "8px",
                        padding: "0.5rem 0.7rem",
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "flex-start",
                        position: "relative",
                      }}>
                        {nota.pinned && <span style={{ position: "absolute", top: "-6px", right: "6px", fontSize: "0.7rem" }}>📌</span>}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                            {prioIcon && <span style={{ fontSize: "0.65rem" }}>{prioIcon}</span>}
                            <span style={{
                              background: "var(--oliva)",
                              color: "white",
                              borderRadius: "4px",
                              padding: "1px 6px",
                              fontSize: "0.65rem",
                              fontWeight: "600",
                            }}>{nota.area}</span>
                            <span style={{ fontSize: "0.7rem", color: "#888" }}>{nota.autor} · {fechaNota}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#333", whiteSpace: "pre-wrap" }}>{nota.texto}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
                          <button
                            onClick={() => togglePinNota(nota.id)}
                            title={nota.pinned ? "Desfijar" : "Fijar"}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: "2px" }}
                          >{nota.pinned ? "📌" : "📍"}</button>
                          <button
                            onClick={() => { if (window.confirm("¿Borrar esta nota?")) borrarNotaPizarra(nota.id); }}
                            title="Borrar"
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: "2px" }}
                          >🗑️</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── 2. FRANJA DE ALERTAS (sólo visible si hay algo) ─────── */}
          {(() => {
            const alertas = [];

            // Alarma 2ª dosis
            const vencidas2a = alarmas2aDosis.filter(a => a.vencida);
            const proximas2a = alarmas2aDosis.filter(a => !a.vencida);
            if (vencidas2a.length > 0) {
              alertas.push({
                nivel: "critico",
                icono: "🔴",
                texto: `2ª dosis VENCIDA: ${vencidas2a.map(a => `${a.tanqueId} (${a.producto}, hace ${Math.abs(a.diasParaVencer)}d)`).join(", ")}`,
              });
            }
            if (proximas2a.length > 0) {
              alertas.push({
                nivel: "advertencia",
                icono: "💉",
                texto: `2ª dosis próxima: ${proximas2a.map(a => `${a.tanqueId} (${a.producto}, en ${a.diasParaVencer}d)`).join(", ")}`,
              });
            }

            // Mortalidad por raceway — dos ventanas de tiempo
            const hace48h = new Date(); hace48h.setDate(hace48h.getDate() - 2);
            const hace5d  = new Date(); hace5d.setDate(hace5d.getDate() - 5);
            const bajas48h = {}, bajas5d = {};
            bajasCloud.forEach(b => {
              const f = new Date(b.fecha);
              if (isNaN(f)) return;
              const cant = b.cantidad || 0;
              const tanque = b.tanque_id || "";
              if (f >= hace48h) bajas48h[tanque] = (bajas48h[tanque] || 0) + cant;
              if (f >= hace5d)  bajas5d[tanque]  = (bajas5d[tanque]  || 0) + cant;
            });
            const getPoblacion = (tanqueId) => {
              let vivo = 0;
              Object.keys(data).forEach(gk => {
                const c = data[gk].find(item => normalizarId(item.id).toLowerCase() === tanqueId.toLowerCase());
                if (c) vivo = parseInt(c.count, 10) || 0;
              });
              return vivo;
            };
            // Crítico: ≥5% en 5 días
            const criticos5d = Object.entries(bajas5d).filter(([id, cant]) => {
              const vivo = getPoblacion(id);
              return vivo > 0 && (cant / (vivo + cant)) * 100 >= 5;
            }).map(([id, cant]) => {
              const vivo = getPoblacion(id);
              return `${id} (${((cant/(vivo+cant))*100).toFixed(1)}%)`;
            });
            // Aviso: ≥3% en 48h (solo si no ya en crítico)
            const criticosIds = new Set(Object.entries(bajas5d).filter(([id, cant]) => {
              const vivo = getPoblacion(id); return vivo > 0 && (cant / (vivo + cant)) * 100 >= 5;
            }).map(([id]) => id));
            const aviso48h = Object.entries(bajas48h).filter(([id, cant]) => {
              if (criticosIds.has(id)) return false;
              const vivo = getPoblacion(id);
              return vivo > 0 && (cant / (vivo + cant)) * 100 >= 3;
            }).map(([id, cant]) => {
              const vivo = getPoblacion(id);
              return `${id} (${((cant/(vivo+cant))*100).toFixed(1)}%)`;
            });
            if (criticos5d.length > 0) {
              alertas.push({ nivel: "critico", icono: "💀", texto: `Mortalidad ≥5% en 5d: ${criticos5d.join(", ")}` });
            }
            if (aviso48h.length > 0) {
              alertas.push({ nivel: "advertencia", icono: "⚠️", texto: `Mortalidad ≥3% en 48h: ${aviso48h.join(", ")}` });
            }

            // Carencia vigente
            const SUSTANCIAS_CARENCIA = [
              { clave: "GANADEXIL", dias: 14 }, { clave: "LEVAMISOL", dias: 7 },
              { clave: "HORMONA", dias: 7 }, { clave: "HCG", dias: 7 }, { clave: "LHRH", dias: 7 },
            ];
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const tanquesEnCarencia = new Set();
            tratamientos.forEach(t => {
              const tipoUp = (t.tipo || "").toUpperCase();
              SUSTANCIAS_CARENCIA.forEach(s => {
                if (tipoUp.includes(s.clave)) {
                  const parts = (t.fecha || "").split("/");
                  const fTrat = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date(t.fecha);
                  if (!isNaN(fTrat)) {
                    const finCarencia = new Date(fTrat); finCarencia.setDate(finCarencia.getDate() + s.dias);
                    if (finCarencia >= hoy) tanquesEnCarencia.add(t.tanque);
                  }
                }
              });
            });
            if (tanquesEnCarencia.size > 0) {
              alertas.push({ nivel: "aviso", icono: "⏳", texto: `Carencia vigente: ${[...tanquesEnCarencia].join(", ")}` });
            }

            if (alertas.length === 0) return null;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                {alertas.map((a, i) => (
                  <div key={i} style={{
                    background: a.nivel === "critico" ? "#fff1f0" : "#fffbe6",
                    borderLeft: `4px solid ${a.nivel === "critico" ? "#e74c3c" : "#f39c12"}`,
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: a.nivel === "critico" ? "#c0392b" : "#7d6608",
                    display: "flex", alignItems: "center", gap: "0.5rem",
                  }}>
                    <span style={{ fontSize: "1rem" }}>{a.icono}</span> {a.texto}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── 3. CUATRO TARJETAS DE ESTADO RÁPIDO ─────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.8rem",
            marginBottom: "1rem",
          }}>

            {/* Tarjeta: Incubadoras */}
            {(() => {
              const incubadoras = data.incubadoras || [];
              const activas = incubadoras.filter(i => i.count > 0);
              return (
                <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.2rem", boxShadow: "var(--sombra)", border: "1px solid #eee" }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem", fontWeight: "600" }}>🥚 Incubadoras</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "900", color: activas.length > 0 ? "var(--oliva)" : "#aaa", lineHeight: 1 }}>
                    {activas.length}<span style={{ fontSize: "1rem", fontWeight: "400", color: "#aaa" }}>/{incubadoras.length}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.4rem" }}>
                    {activas.length === 0 ? "Todas vacías" : `en uso: ${activas.map(i => i.id).join(", ")}`}
                  </div>
                  {/* Mini-grid visual */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "0.6rem" }}>
                    {incubadoras.map(i => (
                      <div key={i.id} style={{
                        width: "18px", height: "18px", borderRadius: "3px",
                        background: i.count > 0 ? "var(--pistacho)" : "#eee",
                        title: i.id,
                      }} title={i.id} />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Tarjeta: UCI / Cuarentena */}
            {(() => {
              const uci = (data.naveVerde || []).filter(c => c.id.startsWith("UCI-") && c.count > 0);
              return (
                <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.2rem", boxShadow: "var(--sombra)", border: `1px solid ${uci.length > 0 ? "#e67e22" : "#eee"}` }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem", fontWeight: "600" }}>🏥 UCI / Cuarentena</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "900", color: uci.length > 0 ? "#e67e22" : "#aaa", lineHeight: 1 }}>
                    {uci.length === 0 ? "—" : uci.reduce((s, c) => s + (parseInt(c.count,10)||0), 0)}
                    {uci.length > 0 && <span style={{ fontSize: "0.8rem", fontWeight: "400", color: "#aaa" }}> anim.</span>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.4rem" }}>
                    {uci.length === 0 ? "UCI libre" : uci.map(c => `${c.id} (${c.count})`).join(" · ")}
                  </div>
                </div>
              );
            })()}

            {/* Tarjeta: Bloqueos */}
            {(() => {
              const bloqueos = [];
              Object.keys(data).forEach(gk => {
                data[gk].forEach(cell => {
                  if (cell.obs?.includes("[BLOQUEADO")) {
                    const m = cell.obs.match(/\[BLOQUEADO:\s*([^\]]+)\]/);
                    const esRep = cell.obs.includes("Reparaci") || cell.obs.includes("MANTENIMIENTO");
                    bloqueos.push({ id: cell.id, motivo: m ? m[1] : "—", esRep });
                  }
                });
              });
              return (
                <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.2rem", boxShadow: "var(--sombra)", border: `1px solid ${bloqueos.length > 0 ? "#f1c40f" : "#eee"}` }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem", fontWeight: "600" }}>🔒 Bloqueos</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "900", color: bloqueos.length > 0 ? "#d35400" : "#aaa", lineHeight: 1 }}>{bloqueos.length || "—"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "0.4rem" }}>
                    {bloqueos.length === 0
                      ? <span style={{ fontSize: "0.75rem", color: "#888" }}>Sin tanques bloqueados</span>
                      : bloqueos.slice(0, 4).map(b => (
                          <span key={b.id} style={{ fontSize: "0.72rem", color: "#666" }}>
                            {b.esRep ? "🔧" : "🔒"} {b.id} — {b.motivo}
                          </span>
                        ))
                    }
                    {bloqueos.length > 4 && <span style={{ fontSize: "0.7rem", color: "#aaa" }}>+{bloqueos.length - 4} más</span>}
                  </div>
                </div>
              );
            })()}

            {/* Tarjeta: Almacén semáforo compacto */}
            {(() => {
              const criticos = inventario.filter(i => (parseFloat(i.stock)||0) <= (parseFloat(i.min_stock)||1));
              const precaucion = inventario.filter(i => {
                const s = parseFloat(i.stock)||0, m = parseFloat(i.min_stock)||1;
                return s > m && s <= m * 1.5;
              });
              return (
                <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.2rem", boxShadow: "var(--sombra)", border: `1px solid ${criticos.length > 0 ? "#e74c3c" : "#eee"}` }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem", fontWeight: "600" }}>📦 Almacén</div>
                  <div style={{ display: "flex", gap: "0.8rem", alignItems: "baseline" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: "900", color: criticos.length > 0 ? "#e74c3c" : "#aaa", lineHeight: 1 }}>{criticos.length}</div>
                      <div style={{ fontSize: "0.6rem", color: "#e74c3c" }}>crítico</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: "900", color: precaucion.length > 0 ? "#f39c12" : "#aaa", lineHeight: 1 }}>{precaucion.length}</div>
                      <div style={{ fontSize: "0.6rem", color: "#f39c12" }}>precaución</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: "900", color: "#2ecc71", lineHeight: 1 }}>{inventario.length - criticos.length - precaucion.length}</div>
                      <div style={{ fontSize: "0.6rem", color: "#2ecc71" }}>ok</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "0.5rem" }}>
                    {criticos.slice(0, 3).map(i => (
                      <span key={i.id} style={{ fontSize: "0.72rem", color: "#e74c3c" }}>🔴 {i.nombre} ({i.stock} {i.unidad})</span>
                    ))}
                    {precaucion.slice(0, 2).map(i => (
                      <span key={i.id} style={{ fontSize: "0.72rem", color: "#f39c12" }}>🟡 {i.nombre} ({i.stock} {i.unidad})</span>
                    ))}
                    {inventario.length === 0 && <span style={{ fontSize: "0.75rem", color: "#aaa" }}>Sin stock registrado</span>}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── 4. MÉTRICAS OPERATIVAS ───────────────────────────────── */}
          <DashboardMetricas
            bajasCloud={bajasCloud} tratamientos={tratamientos} data={data}
            planesFase={planesFase} registrosAlimentacion={registrosAlimentacion}
          />

          {/* ── 5. ACTIVIDAD RECIENTE (2 columnas) ───────────────────── */}
          <div className="recent-grid">
            <div className="recent-card">
              <h3>🥚 Últimas Puestas</h3>
              <TableHistory
                items={puestas}
                onBorrar={(id) => borrarItem(puestas, setPuestas, id, "puesta")}
                isPuesta={true}
                isDashboard={true}
              />
            </div>
            <div className="recent-card">
              <h3>🩺 Últimos Tratamientos</h3>
              <TableHistory
                items={tratamientos.filter((t) => !esEventoNoTratamiento(t))}
                onBorrar={(id) => borrarItem(tratamientos, setTratamientos, id, "tratamiento")}
                isPuesta={false}
                isDashboard={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sección 2: Censo de Ranas Adultas */}
      {activeTab === "adultos" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <AdultasGrid data={data.adultas} handleCellClick={handleCellClick} />
        </div>
      )}

      {/* Sección UCI / Nave Verde */}
      {activeTab === "uci" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <UCIGrid data={data.naveVerde} handleCellClick={handleCellClick} planesFase={planesFase} />
        </div>
      )}

      {/* Sección Incubadoras */}
      {activeTab === "incubadoras" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <div
            style={{
              marginBottom: "1.5rem",
              background: "var(--blanco)",
              padding: "1.5rem",
              borderRadius: "15px",
              borderLeft: "6px solid var(--oliva)",
              boxShadow: "var(--sombra)",
            }}
          >
            <h3
              style={{
                color: "var(--oliva)",
                marginBottom: "1rem",
                borderBottom: "2px solid var(--pistacho)",
                paddingBottom: "0.5rem",
              }}
            >
              🥚 Incubadoras (Hatchery)
            </h3>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#555",
                marginBottom: "1rem",
              }}
            >
              Aquí se visualizan las puestas depositadas. Al eclosionar, haz
              clic en una incubadora y dale a "Trasladar" para pasar los
              renacuajos a un raceway y calcular su biomasa.
            </p>
            <div className="grid-metamorfosis">
              {data.incubadoras &&
                data.incubadoras.map((cell) => {
                  const isSelected = selectedCell?.cell.id === cell.id;
                  const isTransferOrigen =
                    transferenciaActiva?.cell.id === cell.id;
                  
                  // Obtener puestas asignadas a esta incubadora
                  const puestasEnInc = puestas.filter(p => p.destino === cell.id);
                  const numPuestas = puestasEnInc.length;
                  const tanquesOrigen = [...new Set(puestasEnInc.map(p => p.tanque))];
                  const numTanques = tanquesOrigen.length;

                  return (
                    <div
                      key={cell.id}
                      className={`cell meta-cell ${isSelected ? "selected" : ""} ${isTransferOrigen ? "transfer-origen" : ""} ${transferenciaActiva && !isTransferOrigen ? "transfer-destino" : ""}`}
                      onClick={() => handleCellClick(cell, "incubadoras")}
                    >
                      <div className="cell-id">
                        {cell.id}{" "}
                        {lockIcon(cell?.obs)}
                      </div>
                      <div
                        className="cell-count"
                        style={{
                          fontSize: "1.2rem",
                          color: numPuestas > 0 ? "var(--oliva)" : "#ccc",
                          fontWeight: "bold",
                          marginTop: "8px",
                        }}
                      >
                        {numPuestas > 0 ? (
                          <span>
                            🥚 {numPuestas} {numPuestas === 1 ? "puesta" : "puestas"}
                            <div style={{ fontSize: "0.8rem", color: "#666", fontWeight: "normal", marginTop: "4px" }}>
                              {numTanques} {numTanques === 1 ? "tanque" : "tanques"} origen
                            </div>
                          </span>
                        ) : (
                          "Vacía"
                        )}
                      </div>
                      {cell.type && (
                        <div
                          className="cell-type"
                          style={{
                            background: "#ffeaa7",
                            color: "#d35400",
                            padding: "2px 5px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            marginTop: "5px",
                          }}
                        >
                          {cell.type}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Sección 3: Renacuajos */}
      {activeTab === "renacuajos" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <div
            style={{
              marginBottom: "1.5rem",
              background: "var(--blanco)",
              padding: "1.5rem",
              borderRadius: "15px",
              borderLeft: "6px solid var(--oliva)",
              boxShadow: "var(--sombra)",
            }}
          >
            <h3 style={{ color: "var(--oliva)", marginBottom: "0.5rem" }}>
              ℹ️ Control de Estructuras (Renacuajos y Crecimiento)
            </h3>
            <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: "1.4" }}>
              Utilice las cuadrículas interactivas a continuación para gestionar
              el inventario y pesos en las 4 Estructuras de contenedores (7
              filas x 9 columnas). Haga clic en cualquier celda para añadir
              censo, registrar pesos, aplicar alimento/sal, o apuntar
              observaciones de desarrollo (Gosner).
            </p>
          </div>

          <div className="group-section">
            <h2 className="group-title">
              🥚 Cuadrícula de Contenedores de Renacuajos
            </h2>

            {/* Navegación por Estructura */}
            <div className="estructura-tabs">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  className={`estructura-tab-btn ${activeEstructura === num ? "active" : ""}`}
                  onClick={() => setActiveEstructura(num)}
                >
                  🏢 Estructura {num}
                </button>
              ))}
            </div>

            {/* Renderizado de la cuadrícula interactiva */}
            <GridEstructura data={data.renacuajos} handleCellClick={handleCellClick} activeEstructura={activeEstructura} planesFase={planesFase} />
          </div>

          {/* Sección de Tanques Legacy */}
          {renacuajosLegacy.length > 0 && (
            <div style={{ marginTop: "2rem" }}>
              <Section
                title="⚠️ Otros Tanques de Renacuajos (Legacy / Históricos)"
                items={renacuajosLegacy}
                grupo="renacuajos"
                onBaja={(id) => registrarBaja("renacuajos", id)}
                onTrat={(id, tipo, dosis) =>
                  aplicarTratamiento(id, tipo, dosis)
                }
                onUpdate={(id, field, val) =>
                  updateField("renacuajos", id, field, val)
                }
              />
            </div>
          )}

          {/* Sección de Metamorfoseadas (Grid Visual) */}
          <MetamorfoseadasGrid data={data.metamorfoseadas} handleCellClick={handleCellClick} planesFase={planesFase} />
        </div>
      )}

      {/* Sección 4: Historiales y Reportes Completos */}
            {activeTab === "tratamientos" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <TratamientosMasivos
            data={data}
            bulkTratSelectedTanks={bulkTratSelectedTanks} setBulkTratSelectedTanks={setBulkTratSelectedTanks}
            bulkTratCategoria={bulkTratCategoria} setBulkTratCategoria={setBulkTratCategoria}
            bulkTratProducto={bulkTratProducto} setBulkTratProducto={setBulkTratProducto}
            bulkTratDosis={bulkTratDosis} setBulkTratDosis={setBulkTratDosis}
            bulkTratTiempo={bulkTratTiempo} setBulkTratTiempo={setBulkTratTiempo}
            bulkTratFecha={bulkTratFecha} setBulkTratFecha={setBulkTratFecha}
            alarmasDesparasitacion={alarmasDesparasitacion} alarmas2aDosis={alarmas2aDosis}
            aplicarTratamientoMasivo={aplicarTratamientoMasivo}
            planesTratamiento={planesTratamiento} inventario={inventario}
          />
        </div>
      )}

      {activeTab === "incidencias" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <IncidenciasPanel
            incidencias={incidencias} incidenciaForm={incidenciaForm} setIncidenciaForm={setIncidenciaForm}
            incidenciaCerrarId={incidenciaCerrarId} setIncidenciaCerrarId={setIncidenciaCerrarId}
            incidenciaNotasCierre={incidenciaNotasCierre} setIncidenciaNotasCierre={setIncidenciaNotasCierre}
            abrirIncidencia={abrirIncidencia} cerrarIncidencia={cerrarIncidencia}
            borrarIncidencia={borrarIncidencia} actualizarIncidencia={actualizarIncidencia} data={data}
          />
        </div>
      )}

      {activeTab === "historial" && (
        <div
          className="tab-content history-sections"
          style={{ animation: "fadeIn 0.3s ease" }}
        >
          <div className="group-section history">
            <h2 className="group-title">🥚 Histórico de Puestas</h2>
            <TableHistory
              items={puestas}
              onBorrar={(id) => borrarItem(puestas, setPuestas, id, "puesta")}
              isPuesta={true}
            />
          </div>

          <div className="group-section history">
            <h2 className="group-title">
              💊 Histórico de Tratamientos Médicos
            </h2>
            <TableHistory
              items={tratamientos.filter((t) => !esEventoNoTratamiento(t))}
              onBorrar={(id) =>
                borrarItem(tratamientos, setTratamientos, id, "tratamiento")
              }
              isPuesta={false}
            />
          </div>

          <div
            className="group-section history"
            style={{ gridColumn: "span 2" }}
          >
            <h2
              className="group-title"
              style={{ borderColor: "var(--rojo-alerta)" }}
            >
              💀 Histórico de Movimientos (Bajas, Traslados y Salidas)
            </h2>
            <TableHistory
              items={(() => {
                const movLegacy = tratamientos.filter((t) => esEventoNoTratamiento(t) && !(t.tipo || "").toLowerCase().includes("baja"));
                const bajasItems = bajasCloud.length > 0
                  ? bajasCloud.map((b) => ({
                      id: `baja-cloud-${b.id}`,
                      _bajaId: b.id,
                      fecha: normalizarFecha(b.fecha),
                      hora: b.hora || "",
                      tanque: b.tanque_id || (b.sexo ? `${b.sexo}` : "—"),
                      tipo: `Baja${b.sexo ? " (" + b.sexo + ")" : ""}${b.causa ? " — " + b.causa : ""}`,
                      dosis: String(b.cantidad || 0),
                    }))
                  : tratamientos.filter((t) => (t.tipo || "").toLowerCase().includes("baja"));
                const toSortable = (f) => {
                  if (!f) return "";
                  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : f;
                };
                return [...bajasItems, ...movLegacy].sort((a, b) => toSortable(b.fecha).localeCompare(toSortable(a.fecha)));
              })()}
              onBorrar={(id) => {
                if (typeof id === "string" && id.startsWith("baja-cloud-")) {
                  const bajaId = parseInt(id.replace("baja-cloud-", ""), 10);
                  if (window.confirm("¿Borrar esta baja?")) borrarBajaCloud(bajaId);
                } else {
                  borrarItem(tratamientos, setTratamientos, id, "tratamiento");
                }
              }}
              isPuesta={false}
            />
          </div>
        </div>
      )}


      {activeTab === "alimentacion" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <AlimentacionPanel
            data={data} planesAlimentacion={planesAlimentacion} setPlanesAlimentacion={setPlanesAlimentacion}
            planesFase={planesFase} setPlanesFase={setPlanesFase}
            editandoFase={editandoFase} setEditandoFase={setEditandoFase}
            productosDisponibles={productosDisponibles} setProductosDisponibles={setProductosDisponibles}
            nuevoProd={nuevoProd} setNuevoProd={setNuevoProd}
            registrosAlimentacion={registrosAlimentacion} setRegistrosAlimentacion={setRegistrosAlimentacion}
            planesExpanded={planesExpanded} setPlanesExpanded={setPlanesExpanded}
            planesFaseExpanded={planesFaseExpanded} setPlanesFaseExpanded={setPlanesFaseExpanded}
            bulkAlimSelectedTanks={bulkAlimSelectedTanks} setBulkAlimSelectedTanks={setBulkAlimSelectedTanks}
            bulkAlimItems={bulkAlimItems} setBulkAlimItems={setBulkAlimItems}
            bulkAlimFecha={bulkAlimFecha} setBulkAlimFecha={setBulkAlimFecha}
            bulkAlimTomas={bulkAlimTomas} setBulkAlimTomas={setBulkAlimTomas}
            isCloudConnected={isCloudConnected} guardarPlanesEnNube={syncPlanesNube}
            cloudConfig={cloudConfig} obtenerCabeceras={obtenerCabeceras} inventario={inventario}
          />
        </div>
      )}

      {/* Sección 5: Inventario */}
      {activeTab === "inventario" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              background: "var(--blanco)",
              padding: "1.5rem",
              borderRadius: "15px",
              borderLeft: "6px solid var(--oliva)",
              boxShadow: "var(--sombra)",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <h3 style={{ color: "var(--oliva)", marginBottom: "0.5rem" }}>
                📦 Control de Almacén e Inventario (V2)
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                Gestiona el stock de piensos, spirulina y complementos.
              </p>
            </div>
            <button
              className="btn-puesta"
              onClick={() => {
                const nombre = window.prompt("Nombre del producto:");
                if (!nombre) return;
                const unidad = window.prompt(
                  "Unidad de medida (ej. kg, g, sacos):",
                  "kg",
                );
                if (!unidad) return;
                const minStockStr = window.prompt(
                  "Aviso de stock bajo (cantidad mínima):",
                  "2",
                );
                const minStock = parseFloat(minStockStr) || 0;

                const caducidad = window.prompt(
                  "Fecha de caducidad (opcional, formato libre ej. 12/2026):",
                  "",
                );
                const newItem = {
                  id: Date.now(),
                  nombre,
                  stock: 0,
                  unidad,
                  min_stock: minStock,
                  caducidad,
                };
                const newInv = [...inventario, newItem];
                setInventario(newInv);
                syncInventarioNube(newItem);
              }}
            >
              + Añadir Producto
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {inventario.map((item) => {
              const stockBajo = item.stock <= (item.min_stock || 0);
              return (
                <div
                  key={item.id}
                  style={{
                    background: "#fff",
                    padding: "1.5rem",
                    borderRadius: "12px",
                    border: `2px solid ${stockBajo ? "var(--rojo-alerta)" : "#eee"}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    position: "relative",
                  }}
                >
                  {stockBajo && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-10px",
                        right: "-10px",
                        background: "var(--rojo-alerta)",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: "bold",
                      }}
                    >
                      ⚠️ Stock Bajo
                    </div>
                  )}
                  <h4
                    style={{
                      margin: "0 0 1rem 0",
                      color: "#333",
                      fontSize: "1.1rem",
                    }}
                  >
                    {item.nombre}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "2.5rem",
                          fontWeight: "bold",
                          color: stockBajo
                            ? "var(--rojo-alerta)"
                            : "var(--oliva)",
                          lineHeight: "1",
                        }}
                      >
                        {item.stock}
                      </span>
                      <span
                        style={{
                          fontSize: "1rem",
                          color: "#666",
                          marginLeft: "4px",
                        }}
                      >
                        {item.unidad}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                      Mínimo: {item.min_stock || 0} {item.unidad}
                    </div>
                  </div>
                  
                  {/* Lote y Caducidad */}
                  <div style={{ fontSize: "0.85rem", color: item.caducidad ? "var(--rojo-alerta)" : "#888", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff9e6", padding: "0.6rem", borderRadius: "8px", gap: "10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span>📦 Lote: <strong>{item.lote || "N/A"}</strong></span>
                      <span>⏳ Caducidad: <strong>{item.caducidad || "No especificada"}</strong></span>
                    </div>
                    <button 
                      style={{ background: "#fff", border: "1px solid #ccc", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.9rem" }} 
                      title="Editar Lote y Caducidad" 
                      onClick={() => {
                        const nuevoLote = window.prompt("Introduce el número de Lote para " + item.nombre + ":", item.lote || "");
                        if (nuevoLote === null) return;
                        const nuevaCaducidad = window.prompt("Introduce la nueva fecha de caducidad para " + item.nombre + ":", item.caducidad || "");
                        if (nuevaCaducidad === null) return;
                        
                        const newItem = { ...item, lote: nuevoLote, caducidad: nuevaCaducidad };
                        const newInv = inventario.map(i => i.id === item.id ? newItem : i);
                        setInventario(newInv);
                        syncInventarioNube(newItem);
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      style={{
                        background: "#e74c3c",
                        color: "white",
                        border: "none",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                      onClick={() => {
                        const cantStr = window.prompt(
                          `¿Cuánto vas a RESTAR de ${item.nombre}?`,
                        );
                        const cant = parseFloat(cantStr);
                        if (!cantStr || isNaN(cant) || cant <= 0) return;
                        const newItem = {
                          ...item,
                          stock: Math.max(0, item.stock - cant),
                        };
                        const newInv = inventario.map((i) =>
                          i.id === item.id ? newItem : i,
                        );
                        setInventario(newInv);
                        syncInventarioNube(newItem);
                      }}
                    >
                      - Gastar
                    </button>
                    <button
                      style={{
                        background: "var(--pistacho)",
                        color: "white",
                        border: "none",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                      onClick={() => {
                        const cantStr = window.prompt(
                          `¿Cuánto vas a AÑADIR a ${item.nombre}?`,
                        );
                        const cant = parseFloat(cantStr);
                        if (!cantStr || isNaN(cant) || cant <= 0) return;
                        const newItem = { ...item, stock: item.stock + cant };
                        const newInv = inventario.map((i) =>
                          i.id === item.id ? newItem : i,
                        );
                        setInventario(newInv);
                        syncInventarioNube(newItem);
                      }}
                    >
                      + Comprar
                    </button>
                  </div>
                  <button
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#aaa",
                      fontSize: "0.7rem",
                      width: "100%",
                      marginTop: "1rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Seguro que deseas eliminar ${item.nombre} del inventario?`,
                        )
                      ) {
                        const newInv = inventario.filter(
                          (i) => i.id !== item.id,
                        );
                        setInventario(newInv);
                        if (isCloudConnected) {
                          fetch(
                            `${cloudConfig.url}/rest/v1/inventario?id=eq.${item.id}`,
                            { method: "DELETE", headers: obtenerCabeceras() },
                          ).catch(console.error);
                        }
                      }
                    }}
                  >
                    🗑️ Borrar producto
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección 4: Configuración */}
      {activeTab === "config" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          <div className="cloud-config-container">
            <h2>☁️ Configuración de Conexión (Supabase V2)</h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#666",
                marginBottom: "1.5rem",
              }}
            >
              Vincula tu base de datos PostgreSQL compartida para sincronizar el
              censo e históricos entre tus dispositivos y los de Anabel.
            </p>

            <div className="input-group" style={{ marginBottom: "1.2rem" }}>
              <label>URL del Proyecto</label>
              <input
                type="text"
                placeholder="https://xxxxxxxx.supabase.co"
                value={cloudConfig.url}
                onChange={(e) =>
                  setCloudConfig((prev) => ({
                    ...prev,
                    url: e.target.value.trim(),
                  }))
                }
                style={{
                  padding: "10px",
                  fontSize: "0.9rem",
                  marginTop: "6px",
                }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: "1.5rem" }}>
              <label>Clave Pública de la API (Anon Key)</label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={cloudConfig.key}
                onChange={(e) =>
                  setCloudConfig((prev) => ({
                    ...prev,
                    key: e.target.value.trim(),
                  }))
                }
                style={{
                  padding: "10px",
                  fontSize: "0.9rem",
                  marginTop: "6px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.8rem",
                justifyContent: "flex-end",
              }}
            >
              {isCloudConnected ? (
                <>
                  <button
                    className="btn-baja"
                    style={{ background: "#7f8c8d" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Seguro que deseas desconectarte de la nube? Volverás a ver los datos guardados de forma local en tu ordenador.",
                        )
                      ) {
                        const empty = { url: "", key: "" };
                        setCloudConfig(empty);
                        localStorage.setItem(
                          "grenoucerie_cloud_config",
                          JSON.stringify(empty),
                        );
                        setIsCloudConnected(false);
                        window.location.reload();
                      }
                    }}
                  >
                    🔌 Desconectar Nube
                  </button>
                  <button
                    className="btn-puesta"
                    onClick={() => cargarDatosDeLaNube()}
                    disabled={isSyncing}
                  >
                    {isSyncing ? "Sincronizando..." : "🔄 Refrescar Nube"}
                  </button>
                </>
              ) : (
                <button
                  className="btn-puesta"
                  onClick={async () => {
                    if (!cloudConfig.url || !cloudConfig.key) {
                      alert(
                        "Por favor, rellena ambos campos para poder conectar.",
                      );
                      return;
                    }
                    localStorage.setItem(
                      "grenoucerie_cloud_config",
                      JSON.stringify(cloudConfig),
                    );
                    await cargarDatosDeLaNube(cloudConfig);
                  }}
                  disabled={isSyncing}
                >
                  {isSyncing ? "Conectando..." : "🔌 Guardar y Conectar"}
                </button>
              )}
            </div>

            {/* Compartir config con compañeras */}
            {isCloudConnected && (
              <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "10px", padding: "1rem", marginBottom: "1.2rem" }}>
                <strong style={{ color: "#2e7d32", display: "block", marginBottom: "0.5rem" }}>📤 Compartir configuración con otra compañera</strong>
                <p style={{ fontSize: "0.82rem", color: "#555", margin: "0 0 0.7rem 0" }}>
                  Copia este código y pégalo en el ordenador de tu compañera (Ajustes de Nube → Importar código):
                </p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <code style={{ flex: 1, background: "white", padding: "0.4rem 0.6rem", borderRadius: "6px", fontSize: "0.72rem", wordBreak: "break-all", border: "1px solid #ccc" }}>
                    {btoa(JSON.stringify({ url: cloudConfig.url, key: cloudConfig.key }))}
                  </code>
                  <button onClick={() => {
                    navigator.clipboard.writeText(btoa(JSON.stringify({ url: cloudConfig.url, key: cloudConfig.key })));
                    alert("¡Copiado! Pégalo en el ordenador de tu compañera.");
                  }} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.82rem", flexShrink: 0 }}>
                    📋 Copiar
                  </button>
                </div>
              </div>
            )}

            {/* Importar config desde código */}
            {!isCloudConnected && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: "10px", padding: "1rem", marginBottom: "1.2rem" }}>
                <strong style={{ color: "#f57f17", display: "block", marginBottom: "0.5rem" }}>📥 ¿Tienes un código de configuración?</strong>
                <p style={{ fontSize: "0.82rem", color: "#555", margin: "0 0 0.5rem 0" }}>Pega el código que te ha dado tu compañera:</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input id="import-config-input" type="text" placeholder="Pega el código aquí..."
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.82rem" }} />
                  <button onClick={() => {
                    try {
                      const codigo = document.getElementById("import-config-input").value.trim();
                      const cfg = JSON.parse(atob(codigo));
                      if (!cfg.url || !cfg.key) throw new Error();
                      setCloudConfig(cfg);
                      localStorage.setItem("grenoucerie_cloud_config", JSON.stringify(cfg));
                      alert("✅ Configuración importada. Pulsa 'Guardar y Conectar'.");
                    } catch {
                      alert("Código inválido. Pide a tu compañera que copie el código de nuevo.");
                    }
                  }} style={{ background: "#f9a825", color: "white", border: "none", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.82rem", flexShrink: 0 }}>
                    Importar
                  </button>
                </div>
              </div>
            )}

            <div className="instruction-box">
              <strong>Pasos rápidos para conectar:</strong>
              <ol>
                <li>
                  Crea un proyecto en{" "}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase.com
                  </a>
                  .
                </li>
                <li>
                  Ejecuta el script SQL que te di para crear las tablas
                  (`censos`, `puestas`, `tratamientos`).
                </li>
                <li>
                  Copia la <strong>Project URL</strong> y la{" "}
                  <strong>API Anon Key</strong> desde tu panel y pégalas aquí.
                </li>
                <li>
                  Haz clic en "Guardar y Conectar". Si la nube está vacía, te
                  ofrecerá subir tus datos locales actuales.
                </li>
              </ol>
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginTop: "1rem",
                  border: "1px solid #ddd",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--oliva)" }}>
                  NUEVO: Script SQL para Inventario
                </h4>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#666",
                    marginBottom: "0.5rem",
                  }}
                >
                  Pega esto en el SQL Editor de Supabase para activar la
                  sincronización del Almacén en la nube.
                </p>
                <code
                  style={{
                    display: "block",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.75rem",
                    color: "#d63384",
                    padding: "0.5rem",
                    background: "#fff",
                    border: "1px solid #eee",
                    borderRadius: "4px",
                  }}
                >
                  {`CREATE TABLE inventario (
  id BIGINT PRIMARY KEY,
  nombre TEXT,
  stock NUMERIC,
  unidad TEXT,
  min_stock NUMERIC
);`}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pesaje Traslado Avanzado */}
      {modalPesajeActivo && (
        <div
          className="modal-overlay"
          onClick={() => setModalPesajeActivo(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <h2
              style={{
                color: "var(--oliva)",
                borderBottom: "2px solid var(--pistacho)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              ⚖️ Traslado con Pesaje en Vivo
            </h2>
            <p
              style={{
                background: "#f8f9fa",
                padding: "0.8rem",
                borderRadius: "8px",
                fontSize: "0.9rem",
                marginBottom: "1.5rem",
              }}
            >
              <strong>Origen:</strong> Tanque {modalPesajeActivo.origenCell.id}
              <br />
              <strong>Destino:</strong> Tanque{" "}
              {modalPesajeActivo.destinoCell.id}
              {modalPesajeActivo.destinoGrupo === "renacuajos" && (
                <span
                  style={{
                    color:
                      300 - (modalPesajeActivo.destinoCell.count || 0) < 0
                        ? "var(--rojo-alerta)"
                        : "var(--oliva)",
                    marginLeft: "10px",
                    fontWeight: "bold",
                  }}
                >
                  (Libres: {300 - (modalPesajeActivo.destinoCell.count || 0)}{" "}
                  uds)
                </span>
              )}
            </p>

            <div className="input-group" style={{ marginBottom: "1.5rem" }}>
              <label>1. ¿Gramos TOTALES que vas a mover?</label>
              <input
                type="number"
                step="0.1"
                value={pesajeForm.gramosTotales}
                onChange={(e) =>
                  setPesajeForm({
                    ...pesajeForm,
                    gramosTotales: e.target.value,
                  })
                }
                placeholder="Ej: 3500"
                style={{
                  padding: "0.8rem",
                  fontSize: "1.1rem",
                  background: "#f1f9ec",
                  border: "1px solid var(--pistacho)",
                }}
              />
            </div>

            <div
              style={{
                background: "#fff",
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "12px",
                marginBottom: "1.5rem",
              }}
            >
              <h4 style={{ margin: "0 0 1rem 0" }}>
                2. Calcula el Peso Medio (Muestras de 10uds)
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.8rem",
                }}
              >
                <div className="input-group">
                  <label style={{ fontSize: "0.75rem" }}>Muestra 1 (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pesajeForm.m1}
                    onChange={(e) =>
                      setPesajeForm({ ...pesajeForm, m1: e.target.value })
                    }
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: "0.75rem" }}>Muestra 2 (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pesajeForm.m2}
                    onChange={(e) =>
                      setPesajeForm({ ...pesajeForm, m2: e.target.value })
                    }
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: "0.75rem" }}>Muestra 3 (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pesajeForm.m3}
                    onChange={(e) =>
                      setPesajeForm({ ...pesajeForm, m3: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: "1.5rem" }}>
              <label>3. Motivo (Opcional)</label>
              <input
                type="text"
                value={pesajeForm.motivo}
                onChange={(e) =>
                  setPesajeForm({ ...pesajeForm, motivo: e.target.value })
                }
                placeholder="Ej: Triaje grandes, Venta..."
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                className="btn-baja"
                onClick={() => setModalPesajeActivo(null)}
                style={{ flex: 1, background: "#e0e0e0", color: "#333" }}
              >
                Cancelar
              </button>
              <button
                className="btn-puesta"
                onClick={confirmarTrasladoConPesaje}
                style={{
                  flex: 2,
                  background: "var(--oliva)",
                  fontSize: "1.1rem",
                }}
              >
                ✓ Confirmar y Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTrasladoEstandar && (() => {
        const itemOrigen = data[modalTrasladoEstandar.origenGrupo]?.find(
          (i) => normalizarId(i.id).toLowerCase() === normalizarId(modalTrasladoEstandar.origenCell.id).toLowerCase()
        );
        const tieneTratamiento = itemOrigen && (itemOrigen.type || itemOrigen.dose || itemOrigen.obs);
        const tieneAlimentacion = !!(planesAlimentacion && planesAlimentacion[normalizarId(modalTrasladoEstandar.origenCell.id)]?.items?.length);
        const maxUds = itemOrigen ? itemOrigen.count : 0;

        return (
          <div
            className="modal-overlay"
            onClick={() => setModalTrasladoEstandar(null)}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "500px" }}
            >
              <h2
                style={{
                  color: "var(--oliva)",
                  borderBottom: "2px solid var(--pistacho)",
                  paddingBottom: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                🔄 Traslado de Ranas (UCI / Tanques)
              </h2>
              
              <p
                style={{
                  background: "#f8f9fa",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  marginBottom: "1.5rem",
                }}
              >
                <strong>Origen:</strong> Tanque {modalTrasladoEstandar.origenCell.id} (Disponibles: <strong>{maxUds}</strong> uds)<br />
                <strong>Destino:</strong> Tanque {modalTrasladoEstandar.destinoCell.id}
              </p>

              <div className="input-group" style={{ marginBottom: "1.2rem" }}>
                <label>1. ¿Cuántas unidades deseas trasladar?</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setTrasladoForm(prev => ({ ...prev, cantidad: Math.max(1, prev.cantidad - 1) }))}
                    style={{ padding: "0.5rem 1rem", fontSize: "1.2rem", cursor: "pointer", background: "#f1f9ec", border: "1px solid var(--pistacho)", borderRadius: "6px" }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxUds}
                    value={trasladoForm.cantidad}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setTrasladoForm(prev => ({ ...prev, cantidad: Math.min(maxUds, Math.max(1, val)) }));
                    }}
                    style={{
                      padding: "0.6rem",
                      fontSize: "1.1rem",
                      textAlign: "center",
                      background: "#f1f9ec",
                      border: "1px solid var(--pistacho)",
                      borderRadius: "6px",
                      flex: 1
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setTrasladoForm(prev => ({ ...prev, cantidad: Math.min(maxUds, prev.cantidad + 1) }))}
                    style={{ padding: "0.5rem 1rem", fontSize: "1.2rem", cursor: "pointer", background: "#f1f9ec", border: "1px solid var(--pistacho)", borderRadius: "6px" }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrasladoForm(prev => ({ ...prev, cantidad: maxUds }))}
                    style={{ padding: "0.5rem 0.8rem", fontSize: "0.85rem", cursor: "pointer", background: "var(--oliva)", color: "white", border: "none", borderRadius: "6px" }}
                  >
                    Todo
                  </button>
                </div>
              </div>

              {/* Selector de sexo si el origen tiene subgrupos sexados */}
              {(() => {
                const parsed = parseSubgrupos(itemOrigen?.obs || "");
                const sexos = parsed.subgrupos.filter(sg => sg.sexo && sg.sexo !== "Desconocido" && sg.cantidad > 0);
                if (sexos.length === 0) return null;
                return (
                  <div className="input-group" style={{ marginBottom: "1.2rem" }}>
                    <label>Sexo de los individuos a trasladar</label>
                    <select
                      value={trasladoForm.sexo}
                      onChange={(e) => setTrasladoForm(prev => ({ ...prev, sexo: e.target.value }))}
                      style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc", width: "100%" }}
                    >
                      <option value="">Sin especificar (mixto)</option>
                      {sexos.map(sg => (
                        <option key={sg.sexo} value={sg.sexo}>{sg.sexo} ({sg.cantidad} ud)</option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                <label>2. Motivo del traslado (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Triaje por tamaño, Desdoble, Venta..."
                  value={trasladoForm.motivo}
                  onChange={(e) => setTrasladoForm(prev => ({ ...prev, motivo: e.target.value }))}
                  style={{
                    padding: "0.6rem",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Opciones Especiales */}
              {(tieneTratamiento || tieneAlimentacion) && (
                <div style={{ background: "#f1f9ec", border: "1px solid var(--pistacho)", borderRadius: "10px", padding: "0.8rem", marginBottom: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--oliva)", fontSize: "0.9rem" }}>📋 Opciones del Traslado</h4>
                  
                  {tieneTratamiento && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer", marginBottom: tieneAlimentacion ? "0.6rem" : "0", fontWeight: "500", color: "var(--oliva)" }}>
                      <input
                        type="checkbox"
                        checked={trasladoForm.copiarTratamiento}
                        onChange={(e) => setTrasladoForm(prev => ({ ...prev, copiarTratamiento: e.target.checked }))}
                        style={{ transform: "scale(1.1)", cursor: "pointer" }}
                      />
                      Trasladar pauta de tratamiento
                    </label>
                  )}

                  {tieneAlimentacion && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer", fontWeight: "500", color: "var(--oliva)" }}>
                      <input
                        type="checkbox"
                        checked={trasladoForm.copiarAlimentacion}
                        onChange={(e) => setTrasladoForm(prev => ({ ...prev, copiarAlimentacion: e.target.checked }))}
                        style={{ transform: "scale(1.1)", cursor: "pointer" }}
                      />
                      Trasladar pauta de alimentación
                    </label>
                  )}
                </div>
              )}

              <div className="modal-actions" style={{ display: "flex", gap: "1rem" }}>
                <button
                  className="btn-baja"
                  onClick={() => setModalTrasladoEstandar(null)}
                  style={{ flex: 1, background: "#e0e0e0", color: "#333" }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-puesta"
                  onClick={confirmarTrasladoEstandar}
                  style={{
                    flex: 2,
                    background: "var(--oliva)",
                    fontSize: "1.1rem",
                  }}
                >
                  ✓ Confirmar y Mover
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal interactivo de gestión de celda individual */}
      {selectedCell && (
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
                        "Engorde","Reproductora","Vacío"
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
      )}

      {/* ── MODAL REGISTRO DE PUESTA ─────────────────────────────── */}
      {modalPuestaData && (
        <div className="modal-overlay" onClick={() => setModalPuestaData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", width: "95vw" }}>
            <h2 className="widget-title" style={{ borderLeftWidth: "6px", marginBottom: "1.2rem", paddingLeft: "0.8rem" }}>
              🥚 Registrar Puesta{modalPuestaData.desdeIncubadora ? ` — ${modalPuestaData.incubadora}` : ` — ${modalPuestaData.cellId}`}
            </h2>

            {/* Tanque de origen (solo al abrir desde incubadora) */}
            {modalPuestaData.desdeIncubadora && (
              <div className="input-group" style={{ marginBottom: "0.8rem" }}>
                <label>Tanque de origen</label>
                <input
                  type="text"
                  placeholder="Ej: 2.1.9, UCI-Cen-3..."
                  value={modalPuestaData.cellId}
                  onChange={e => setModalPuestaData(p => ({ ...p, cellId: e.target.value }))}
                  style={{ fontWeight: "bold" }}
                  autoFocus
                />
              </div>
            )}

            {/* Fila 1: Nº puestas + Nº huevos aprox */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Nº de puestas recogidas</label>
                <input
                  type="number" min="1"
                  value={modalPuestaData.cantPuestas}
                  onChange={e => setModalPuestaData(p => ({ ...p, cantPuestas: e.target.value }))}
                  style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                />
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Nº huevos aproximado</label>
                <input
                  type="number" min="0"
                  placeholder="Ej: 200"
                  value={modalPuestaData.cantHuevos}
                  onChange={e => setModalPuestaData(p => ({ ...p, cantHuevos: e.target.value }))}
                />
              </div>
            </div>

            {/* Fila 2: Tipo de puesta + Estado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Tipo de puesta</label>
                <select
                  value={modalPuestaData.tipoPuesta}
                  onChange={e => setModalPuestaData(p => ({ ...p, tipoPuesta: e.target.value }))}
                >
                  <option value="Natural">🐸 Natural</option>
                  <option value="Inducida">💉 Inducida (hormona)</option>
                  <option value="Aborto">⚠️ Aborto</option>
                  <option value="Ex situ">🧪 Ex situ</option>
                </select>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Estado de la puesta</label>
                <select
                  value={modalPuestaData.estado}
                  onChange={e => setModalPuestaData(p => ({ ...p, estado: e.target.value }))}
                >
                  <option value="Buena">🟢 Buena</option>
                  <option value="Regular">🟡 Regular</option>
                  <option value="Mala">🔴 Mala calidad</option>
                  <option value="Sin fertilizar">⚪ Sin fertilizar</option>
                  <option value="Dudosa">🟠 Dudosa</option>
                </select>
              </div>
            </div>

            {/* Fila 3: Fecha */}
            <div className="input-group" style={{ marginBottom: "0.8rem" }}>
              <label>Fecha</label>
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={modalPuestaData.fecha}
                onChange={e => setModalPuestaData(p => ({ ...p, fecha: e.target.value }))}
              />
            </div>

            {/* Fila 3: Incubadora destino */}
            <div className="input-group" style={{ marginBottom: "0.8rem" }}>
              <label>Incubadora de destino</label>
              {modalPuestaData.desdeIncubadora ? (
                <input type="text" value={modalPuestaData.incubadora} readOnly
                  style={{ background: "#f0f0f0", color: "#555", cursor: "not-allowed" }} />
              ) : (
                <select
                  value={modalPuestaData.incubadora}
                  onChange={e => setModalPuestaData(p => ({ ...p, incubadora: e.target.value }))}
                >
                  <option value="">Sin asignar</option>
                  {(data.incubadoras || []).map(inc => (
                    <option key={inc.id} value={inc.id}>
                      {inc.id}{inc.count > 0 ? ` (${inc.count} puestas)` : " — vacía"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Observaciones */}
            <div className="input-group" style={{ marginBottom: "1.2rem" }}>
              <label>Observaciones</label>
              <textarea
                rows={2}
                placeholder="Color, tamaño, pareja observada, incidencias..."
                value={modalPuestaData.obs}
                onChange={e => setModalPuestaData(p => ({ ...p, obs: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
              <button className="btn-baja" style={{ background: "#7f8c8d" }} onClick={() => setModalPuestaData(null)}>
                Cancelar
              </button>
              <button className="btn-puesta" onClick={confirmarPuesta}>
                🥚 Confirmar Puesta
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>
          Grenoucerie S.L. &copy; 2026 - Sistema de Gestión de Granja Avanzado
        </p>
      </footer>
    </div>
  );
}

export default App;
