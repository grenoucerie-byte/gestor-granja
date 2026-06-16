import React, { useState, useEffect } from "react";
import "./index.css";
import ReportesExportar from "./components/ReportesExportar";

// Función para normalizar los identificadores de celdas (elimina comillas y limpia espacios)
const normalizarId = (id) => {
  if (!id) return "";
  return String(id).replace(/[^a-zA-Z0-9\-\.]/g, "");
};

// Parsear y serializar desglose de subgrupos (sexo, estado, fechas)
const parseSubgrupos = (obs) => {
  if (!obs) return { subgrupos: [], comentario: "" };
  let parts = String(obs).split("||");
  let subData = parts[0].trim();
  let comentario = parts.slice(1).join("||").trim();
  
  if (!subData.includes("♂") && !subData.includes("♀") && !subData.includes("❓")) {
    // Legacy obs or just comment
    return { subgrupos: [], comentario: obs.trim() };
  }

  const subgrupos = [];
  const tokens = subData.split("|").map(t => t.trim()).filter(Boolean);
  
  tokens.forEach((token, index) => {
    const match = token.match(/^(\d+)([♂♀❓])\[(.*?)\]\((.*?)\)$/);
    if (match) {
      const sexoMap = { "♂": "Macho", "♀": "Hembra", "❓": "Indet" };
      subgrupos.push({
        id: `sub_${Date.now()}_${index}`,
        cantidad: parseInt(match[1], 10),
        sexo: sexoMap[match[2]],
        estado: match[3] || "Ninguno",
        fecha: match[4] || ""
      });
    }
  });

  return { subgrupos, comentario };
};

const serializeSubgrupos = (subgrupos, comentario) => {
  if (!subgrupos || subgrupos.length === 0) return comentario || "";
  
  const sexoMap = { "Macho": "♂", "Hembra": "♀", "Indet": "❓" };
  const tokens = subgrupos.map(sg => {
    return `${sg.cantidad}${sexoMap[sg.sexo] || "❓"}[${sg.estado || "Ninguno"}](${sg.fecha || ""})`;
  });

  let str = tokens.join(" | ");
  if (comentario && comentario.trim().length > 0) {
    str += " || " + comentario.trim();
  }
  return str;
};

// Generar celdas de incubadoras
const generarCeldasIncubadoras = () => {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `INC-${i + 1}`,
    count: 0,
    type: "",
    obs: "",
    lastDate: "",
    dose: "",
  }));
};

const asegurarEstructurasIncubadoras = (incList, corruptosAccumulator) => {
  const rawList = [...(incList || [])];
  const list = rawList.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      let cleanId = normalizarId(origId);
      if (/^\d+$/.test(cleanId)) {
        cleanId = "INC-" + cleanId;
      }
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "incubadoras",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });

  const gridCells = generarCeldasIncubadoras();
  const uniqueMap = {};
  list.forEach((item) => {
    if (item.id) {
      if (!uniqueMap[item.id]) {
        uniqueMap[item.id] = item;
      } else {
        uniqueMap[item.id] = item;
      }
    }
  });

  const cleanList = Object.values(uniqueMap);
  gridCells.forEach((cell) => {
    if (!uniqueMap[cell.id]) {
      cleanList.push(cell);
    }
  });

  return cleanList.sort((a, b) => {
    const numA = parseInt(a.id.split("-")[1], 10) || 0;
    const numB = parseInt(b.id.split("-")[1], 10) || 0;
    return numA - numB;
  });
};

// Generar celdas de cuadrícula (7 filas x 9 columnas) para las 4 estructuras
const generarCeldasGrid = () => {
  const list = [];
  for (let e = 1; e <= 4; e++) {
    for (let f = 7; f >= 1; f--) {
      for (let c = 1; c <= 9; c++) {
        const id = `E${e}-F${f}-C${c}`;
        let count = 0;
        let dose = "";
        let type = "";
        let obs = "";
        let lastDate = "";

        // Datos por defecto precargados de Excel (Estructura 2)
        if (id === "E2-F7-C1") {
          count = 300;
          dose = "90";
          type = "Completo";
          obs = "Cargado de Excel";
          lastDate = "2026-05-19";
        } else if (id === "E2-F6-C1") {
          count = 287;
          dose = "121";
          type = "Completo";
          obs = "Cargado de Excel";
          lastDate = "2026-05-19";
        }
        let pesoMedio = "";
        let muestras = "";
        list.push({
          id,
          count,
          lastDate,
          type,
          dose,
          obs,
          pesoMedio,
          muestras,
        });
      }
    }
  }
  return list;
};

// Asegurar la inicialización correcta de las 252 celdas de cuadrícula en el listado cargado
const asegurarEstructurasRenacuajos = (
  renacuajosList,
  corruptosAccumulator,
) => {
  const rawList = [...(renacuajosList || [])];
  const list = rawList.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      const cleanId = normalizarId(origId);
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "renacuajos",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });

  const gridCells = generarCeldasGrid();
  const uniqueMap = {};
  list.forEach((item) => {
    if (item.id) {
      if (!uniqueMap[item.id]) {
        uniqueMap[item.id] = item;
      } else {
        uniqueMap[item.id] = item;
      }
    }
  });

  const cleanList = Object.values(uniqueMap);
  gridCells.forEach((cell) => {
    if (!uniqueMap[cell.id]) {
      cleanList.push(cell);
    }
  });

  return cleanList;
};

// Generar celdas de metamorfoseadas (120 raceways en total)
const generarCeldasMetamorfoseadas = () => {
  const list = [];
  // Bloque Trasero (Pisos 1, 2, 3)
  for (let piso = 3; piso >= 1; piso--) {
    for (let r = 10; r >= 1; r--)
      list.push({
        id: `1.${piso}.${r}`,
        count: 0,
        lastDate: "",
        type: "",
        dose: "",
        obs: "Bloque Trasero",
      });
    for (let r = 1; r <= 10; r++)
      list.push({
        id: `4.${piso}.${r}`,
        count: 0,
        lastDate: "",
        type: "",
        dose: "",
        obs: "Bloque Trasero",
      });
  }
  // Bloque Delantero (Pisos 4, 5, 6 -> 1, 2, 3)
  for (let piso = 6; piso >= 4; piso--) {
    for (let r = 10; r >= 1; r--)
      list.push({
        id: `1.${piso}.${r}`,
        count: 0,
        lastDate: "",
        type: "",
        dose: "",
        obs: "Bloque Delantero",
      });
    for (let r = 1; r <= 10; r++)
      list.push({
        id: `4.${piso}.${r}`,
        count: 0,
        lastDate: "",
        type: "",
        dose: "",
        obs: "Bloque Delantero",
      });
  }
  return list;
};

const asegurarEstructurasMetamorfoseadas = (metaList, corruptosAccumulator) => {
  const rawList = [...(metaList || [])];
  const list = rawList.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      const cleanId = normalizarId(origId);
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "metamorfoseadas",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });

  const cleanList = list.filter((item) => /^[14]\.[1-6]\.\d+$/.test(item.id));
  const uniqueMap = {};
  cleanList.forEach((item) => {
    if (item.id) {
      if (!uniqueMap[item.id]) {
        uniqueMap[item.id] = item;
      } else {
        uniqueMap[item.id] = item;
      }
    }
  });

  const deduplicatedList = Object.values(uniqueMap);
  const gridCells = generarCeldasMetamorfoseadas();
  gridCells.forEach((cell) => {
    if (!uniqueMap[cell.id]) {
      deduplicatedList.push(cell);
    }
  });

  return deduplicatedList;
};

// Generar celdas de reproducción (2 tanques aislados, 3 carros móviles)
const generarCeldasReproduccion = () => {
  return [
    { id: "Repro-T1", count: 0, lastDate: "", type: "", dose: "", obs: "Tanque Aislado 1" },
    { id: "Repro-T2", count: 0, lastDate: "", type: "", dose: "", obs: "Tanque Aislado 2" },
    { id: "Carro-M1", count: 0, lastDate: "", type: "", dose: "", obs: "Carro Móvil 1" },
    { id: "Carro-M2", count: 0, lastDate: "", type: "", dose: "", obs: "Carro Móvil 2" },
    { id: "Carro-M3", count: 0, lastDate: "", type: "", dose: "", obs: "Carro Móvil 3" },
    { id: "Lab-1", count: 0, lastDate: "", type: "", dose: "", obs: "Laboratorio Ex-Situ (Mesa 1)" },
    { id: "Lab-2", count: 0, lastDate: "", type: "", dose: "", obs: "Laboratorio Ex-Situ (Mesa 2)" },
    { id: "Lab-3", count: 0, lastDate: "", type: "", dose: "", obs: "Laboratorio Ex-Situ (Mesa 3)" },
    { id: "Lab-Obs1", count: 0, lastDate: "", type: "", dose: "", obs: "Laboratorio - Observación 1" },
    { id: "Lab-Obs2", count: 0, lastDate: "", type: "", dose: "", obs: "Laboratorio - Observación 2" },
  ];
};

const asegurarEstructurasReproduccion = (reproList, corruptosAccumulator) => {
  const rawList = [...(reproList || [])];
  const list = rawList.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      const cleanId = normalizarId(origId);
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "reproduccion",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });

  const uniqueMap = {};
  list.forEach((item) => {
    if (item.id) {
      uniqueMap[item.id] = item; // Siempre el último (overwrite)
    }
  });

  const deduplicatedList = Object.values(uniqueMap);
  const gridCells = generarCeldasReproduccion();
  gridCells.forEach((cell) => {
    if (!uniqueMap[cell.id]) {
      deduplicatedList.push(cell);
    }
  });

  return deduplicatedList;
};

// Generar celdas de ranas adultas (240 raceways en total, 8 estructuras)
const generarCeldasAdultas = () => {
  const list = [];
  const blocks = [
    { name: "Bloque 1", left: [2.1, 2.2, 2.3], right: [5.1, 5.2, 5.3] },
    { name: "Bloque 2", left: [2.4, 2.5, 2.6], right: [5.4, 5.5, 5.6] },
    { name: "Bloque 3", left: [3.1, 3.2, 3.3], right: [6.1, 6.2, 6.3] },
    { name: "Bloque 4", left: [3.4, 3.5, 3.6], right: [6.4, 6.5, 6.6] },
  ];

  blocks.forEach((block) => {
    // Piso 3 (Alto), 2 (Medio), 1 (Bajo)
    for (let p = 3; p >= 1; p--) {
      const idx = p - 1;
      const leftPrefix = block.left[idx];
      const rightPrefix = block.right[idx];

      // Izquierda (10 -> 1)
      for (let r = 10; r >= 1; r--) {
        list.push({
          id: `${leftPrefix}.${r}`,
          count: 0,
          lastDate: "",
          type: "",
          dose: "",
          obs: block.name,
        });
      }
      // Derecha (1 -> 10)
      for (let r = 1; r <= 10; r++) {
        list.push({
          id: `${rightPrefix}.${r}`,
          count: 0,
          lastDate: "",
          type: "",
          dose: "",
          obs: block.name,
        });
      }
    }
  });

  return list;
};

const asegurarEstructurasAdultas = (dataLocal, corruptosAccumulator) => {
  let mergedAdultas = [];
  if (dataLocal && dataLocal.adultas) {
    mergedAdultas = [...dataLocal.adultas];
  } else if (dataLocal) {
    const g31 = dataLocal.grupo31 || [];
    const g24 = dataLocal.grupo24 || [];
    const g21 = dataLocal.grupo21 || [];
    mergedAdultas = [...g31, ...g24, ...g21];
  }

  const list = mergedAdultas.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      const cleanId = normalizarId(origId);
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "adultas",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });

  const cleanList = list.filter((item) =>
    /^([2356]\.[1-6])\.\d+$/.test(item.id),
  );
  const uniqueMap = {};
  cleanList.forEach((item) => {
    if (item.id) {
      if (!uniqueMap[item.id]) {
        uniqueMap[item.id] = item;
      } else {
        uniqueMap[item.id] = item;
      }
    }
  });

  const deduplicatedList = Object.values(uniqueMap);
  const gridCells = generarCeldasAdultas();

  gridCells.forEach((cell) => {
    if (!uniqueMap[cell.id]) {
      deduplicatedList.push(cell);
    }
  });

  return deduplicatedList;
};

// Normalizar formato de fecha para comparaciones seguras (D/M/YYYY)
const normalizarFecha = (fechaStr) => {
  if (!fechaStr) return "";
  const matchYMD = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchYMD) {
    return `${parseInt(matchYMD[3], 10)}/${parseInt(matchYMD[2], 10)}/${matchYMD[1]}`;
  }
  const matchDMY = fechaStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchDMY) {
    return `${parseInt(matchDMY[1], 10)}/${parseInt(matchDMY[2], 10)}/${matchDMY[3]}`;
  }
  return fechaStr;
};

// Obtener fecha de hoy normalizada
const getFechaHoyNorm = () => {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// Obtener fecha de ayer normalizada
const getFechaAyerNorm = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// Analizar ID de la celda de cuadrícula
const parseCellId = (id) => {
  const match = id.match(/^E(\d+)-F(\d+)-C(\d+)$/);
  if (match) {
    return {
      estructura: match[1],
      fila: match[2],
      columna: match[3],
    };
  }
  return null;
};

// Generar celdas para la Nave Verde (UCI)
const generarCeldasUCI = () => {
  const list = [];

  // Izquierda (1 a 10)
  for (let i = 1; i <= 10; i++)
    list.push({
      id: `UCI-Izq-${i}`,
      count: 0,
      lastDate: "",
      type: "",
      dose: "",
      obs: "Nave Verde",
    });

  // Centro (1 a 10)
  for (let i = 1; i <= 10; i++)
    list.push({
      id: `UCI-Cen-${i}`,
      count: 0,
      lastDate: "",
      type: "",
      dose: "",
      obs: "Nave Verde",
    });

  // Derecha (1)
  list.push({
    id: `UCI-Der-1`,
    count: 0,
    lastDate: "",
    type: "",
    dose: "",
    obs: "Nave Verde",
  });

  // Corrales (2)
  list.push({
    id: `Corral-1`,
    count: 0,
    lastDate: "",
    type: "",
    dose: "",
    obs: "Nave Verde",
  });
  list.push({
    id: `Corral-2`,
    count: 0,
    lastDate: "",
    type: "",
    dose: "",
    obs: "Nave Verde",
  });

  // Caja Blanca
  list.push({
    id: `Caja-Blanca`,
    count: 0,
    lastDate: "",
    type: "",
    dose: "",
    obs: "Nave Verde",
  });

  return list;
};

const asegurarEstructurasNaveVerde = (naveVerdeList, corruptosAccumulator) => {
  // Clonado profundo rápido para evitar mutar el estado accidentalmente
  const rawList = JSON.parse(JSON.stringify(naveVerdeList || []));
  const list = rawList.map((item) => {
    if (item && item.id) {
      const origId = item.id;
      const cleanId = normalizarId(origId);
      if (origId !== cleanId) {
        if (corruptosAccumulator) {
          corruptosAccumulator.push({
            id: origId,
            grupo: item.grupo || "naveVerde",
          });
        }
        item.id = cleanId;
      }
    }
    return item;
  });
  const gridCells = generarCeldasUCI();

  // Migración desde formato antiguo RW-1...RW-14
  list.forEach((item) => {
    item.id = (item.id || "").trim(); // Limpieza de espacios

    // Migración Izquierda (los que tengan "termoarcilla" en obs)
    if (
      (item.obs || "").toLowerCase().includes("termoarcilla") &&
      /^RW-\d+$/.test(item.id)
    ) {
      const numMatch = item.id.match(/^RW-(\d+)$/);
      if (numMatch) {
        const idx = numMatch[1];
        item.id = `UCI-Izq-${idx <= 10 ? idx : 1}`;
      }
    }
    // Migración RW-13 a UCI-Der-1
    else if (item.id === "RW-13") {
      item.id = "UCI-Der-1";
    }
    // Migración RW-1 a RW-10 a UCI-Cen-1 a 10
    else if (/^RW-([1-9]|10)$/.test(item.id)) {
      const num = item.id.match(/^RW-(\d+)$/)[1];
      item.id = `UCI-Cen-${num}`;
    }
  });

  // Filtrar y deduplicar agresivamente
  const uniqueMap = {};
  list.forEach((item) => {
    if (
      item.id.startsWith("UCI-") ||
      item.id.startsWith("Corral-") ||
      item.id === "Caja-Blanca"
    ) {
      const key = normalizarId(item.id).toLowerCase();
      if (!uniqueMap[key]) {
        uniqueMap[key] = item;
      } else {
        uniqueMap[key] = item;
      }
    }
  });

  const cleanList = Object.values(uniqueMap);

  gridCells.forEach((cell) => {
    const key = normalizarId(cell.id).toLowerCase();
    if (!uniqueMap[key]) {
      cleanList.push(cell);
      uniqueMap[key] = cell;
    }
  });

  return cleanList;
};

// Generar celdas de Brumación (10 Cajas Móviles)
const generarCeldasBrumacion = () => {
  const cajas = [];
  for (let i = 1; i <= 10; i++) {
    cajas.push({
      id: `Bruma-Caja-${i}`,
      count: 0,
      dose: "",
      type: "",
      obs: "",
      lastDate: "",
      pesoMedio: 0,
    });
  }
  return cajas;
};

const asegurarEstructurasBrumacion = (data = []) => {
  const currentMap = {};
  if (Array.isArray(data)) {
    data.forEach((c) => {
      currentMap[c.id] = c;
    });
  }
  
  const defaultCeldas = generarCeldasBrumacion();
  const list = defaultCeldas.map((dCell) => {
    return currentMap[dCell.id] ? { ...dCell, ...currentMap[dCell.id] } : dCell;
  });
  return list;
};

const generarCeldasInvernadero = () => [
  { id: "Termoarcilla-1", count: 0, lastDate: "", type: "", dose: "", obs: "Piscina Agua Verde 1", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Termoarcilla-2", count: 0, lastDate: "", type: "", dose: "", obs: "Piscina Agua Verde 2", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Charca-Grande", count: 0, lastDate: "", type: "", dose: "", obs: "Charca Cría Daphnia (Grande)", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Charca-Pequeña", count: 0, lastDate: "", type: "", dose: "", obs: "Charca Cría Daphnia (Pequeña)", ph: "", no3: "", no2: "", aireacion: "" }
];

const asegurarEstructurasInvernadero = (data = []) => {
  const currentMap = {};
  if (Array.isArray(data)) {
    data.forEach((c) => {
      let extra = {};
      try { if (c.muestras) extra = JSON.parse(c.muestras); } catch(e) {}
      currentMap[c.id] = { 
        ...c, 
        ph: extra.ph || "", 
        no3: extra.no3 || "", 
        no2: extra.no2 || "", 
        aireacion: extra.aireacion || "",
        fechaInicio: extra.fechaInicio || "",
        fase: extra.fase || "Fase 1: Preparación",
        adiciones: extra.adiciones || []
      };
    });
  }
  const defaultCeldas = generarCeldasInvernadero();
  const list = defaultCeldas.map((dCell) => {
    return currentMap[dCell.id] ? { ...dCell, ...currentMap[dCell.id] } : dCell;
  });
  return list;
};

// Población por defecto para la primera inicialización o en caso de base de datos vacía
const DEFAULT_DATA = {
  naveVerde: asegurarEstructurasNaveVerde(),
  incubadoras: generarCeldasIncubadoras(),
  renacuajos: generarCeldasGrid(),
  metamorfoseadas: generarCeldasMetamorfoseadas(),
  reproduccion: asegurarEstructurasReproduccion(),
  brumacion: asegurarEstructurasBrumacion(),
  invernadero: asegurarEstructurasInvernadero(),
  adultas: asegurarEstructurasAdultas({
    grupo31: [
      {
        id: "3.1.6",
        count: 41,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "3.1.7",
        count: 40,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "3.1.8",
        count: 31,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "3.1.9",
        count: 27,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "3.1.10",
        count: 22,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
    ],
    grupo24: [
      {
        id: "2.4.7",
        count: 11,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.4.8",
        count: 58,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.4.9",
        count: 33,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.4.10",
        count: 40,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
    ],
    grupo21: [
      {
        id: "2.1.2",
        count: 20,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.3",
        count: 34,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.4",
        count: 41,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.5",
        count: 30,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.6",
        count: 28,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.7",
        count: 27,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.8",
        count: 47,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.9",
        count: 57,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
      {
        id: "2.1.10",
        count: 22,
        lastDate: "2026-05-15",
        type: "Ganadexil",
        dose: "0,0125",
        obs: "",
      },
    ],
  }),
};

// Métrica de densidad recomendada por tipo de población
const OBTENER_DATOS_DENSIDAD = (grupo, id, count) => {
  let maxRecomendado = 500;
  let factorArea = 10; // metros cuadrados por defecto para raceways
  let unidad = "ranas/m²";
  let esGrid = false;

  if (grupo === "adultas") {
    maxRecomendado = 500;
    factorArea = 10;
    unidad = "ranas/m²";
  } else if (grupo === "naveVerde") {
    maxRecomendado = 200;
    factorArea = 10;
    unidad = "ranas/m²";
  } else if (grupo === "renacuajos") {
    esGrid = /^E\d-F\d-C\d+/.test(id);
    if (esGrid) {
      maxRecomendado = 300; // Capacidad máxima objetivo por celda de cuadrícula
      factorArea = 1;
      unidad = "ud";
    } else {
      maxRecomendado = 300;
      factorArea = 200; // litros
      unidad = "renac./L";
    }
  } else if (grupo === "metamorfoseadas") {
    maxRecomendado = 500;
    factorArea = 2; // metros cuadrados
    unidad = "ranitas/m²";
  }

  const total = parseInt(count, 10) || 0;
  const valorDensidad = esGrid ? total : (total / factorArea).toFixed(1);
  const maxDensidad = esGrid
    ? maxRecomendado
    : (maxRecomendado / factorArea).toFixed(1);
  const porcentaje = Math.min(Math.round((total / maxRecomendado) * 100), 200);

  let estado = "normal";
  if (porcentaje > 100) {
    estado = "peligro";
  } else if (porcentaje > 80) {
    estado = "advertencia";
  }

  return {
    actual: valorDensidad,
    maxima: maxDensidad,
    unidad,
    porcentaje,
    estado,
  };
};

function App() {
  // Pestaña activa del gestor
  const [activeTab, setActiveTab] = useState("dashboard");

  // Calculadora Invernadero
  const [invernaderoLiters, setInvernaderoLiters] = useState(1000);

  // Pestaña activa de la estructura de renacuajos (1 a 4)
  const [activeEstructura, setActiveEstructura] = useState(1);

  // Estados para la estructura 3D de Metamorfoseadas
  const [activeMetamorfosisBloque, setActiveMetamorfosisBloque] =
    useState("Trasero");
  const [activeMetamorfosisPiso, setActiveMetamorfosisPiso] = useState(1);
  const [activeAdultasBloque, setActiveAdultasBloque] = useState(1);
  const [activeAdultasPiso, setActiveAdultasPiso] = useState(1);

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

  const [cloudConfig, setCloudConfig] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_cloud_config");
    return saved ? JSON.parse(saved) : { url: "", key: "" };
  });

  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState(null); // { msg, detail } si falla un POST
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
  const [modalBajaCant, setModalBajaCant] = useState("1");
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
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

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
  });
  const [pesajeForm, setPesajeForm] = useState({
    gramosTotales: "",
    m1: "",
    m2: "",
    m3: "",
    motivo: "",
  });

  // ─── Sync de planes a Supabase ────────────────────────────────────────────
  const syncPlanesNube = async (tipo, datos) => {
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
  };

  const cargarPlanesDesdeNube = async () => {
    if (!isCloudConnected || !cloudConfig.url) return;
    try {
      const res = await fetch(`${cloudConfig.url}/rest/v1/configuracion?id=in.(planes_alimentacion,planes_tratamiento,planes_fase)`, {
        headers: obtenerCabeceras(),
      });
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach(row => {
        if (!row.datos) return;
        if (row.id === "planes_alimentacion") setPlanesAlimentacion(prev => ({ ...row.datos, ...prev }));
        if (row.id === "planes_tratamiento") setPlanesTratamiento(prev => ({ ...row.datos, ...prev }));
        if (row.id === "planes_fase") setPlanesFase(prev => ({ ...row.datos, ...prev }));
      });
    } catch (e) {
      console.warn("Error al cargar planes desde nube:", e);
    }
  };

  const syncInventarioNube = async (item) => {
    if (!isCloudConnected) return;
    const tabla = item.grupo ? "censos" : "inventario";
    
    // Filtrar columnas para evitar error 400 por campos inexistentes
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
          muestras: item.muestras || null
        }
      : item;

    try {
      const res = await fetch(`${cloudConfig.url}/rest/v1/${tabla}`, {
        method: "POST",
        headers: {
          ...obtenerCabeceras(),
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Error al sincronizar en la nube (${res.status}):`, errorText);
        if (errorText.includes("column") && (errorText.includes("muestras") || errorText.includes("peso_medio"))) {
          alert(
            "⚠️ ATENCIÓN: Faltan las columnas de guardado especial en tu base de datos de Supabase.\n\n" +
            "Para solucionarlo, por favor ve al panel de Supabase -> SQL Editor, crea una nueva consulta (New Query), pega el siguiente texto y pulsa RUN:\n\n" +
            "ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS muestras text;\n" +
            "ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS peso_medio text;\n\n" +
            "Una vez hecho esto, los datos del Invernadero y la biomasa se guardarán correctamente."
          );
        } else {
          // Mostrar alert detallado temporalmente para diagnosticar qué falla en la base de datos
          alert(`⚠️ Error de base de datos Supabase:\n\n${errorText}\n\nPor favor, dime qué dice este mensaje.`);
        }
      }
    } catch (err) {
      console.error(`Error al sincronizar ${tabla} en la nube:`, err);
      alert("⚠️ Error de conexión: No se pudo conectar con el servidor de la nube. Comprueba tu conexión a internet.");
    }
  };

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
      } catch (err) {
        console.error("Error al registrar traslado en la nube", err);
        setCloudSaveError(`Error al registrar traslado: ${err.message}`);
      }
    }

    setModalTrasladoEstandar(null);
    setTransferenciaActiva(null);
    setIsProcessing(false);
  };

  const aplicarTratamientoMasivo = async () => {
    if (bulkTratSelectedTanks.length === 0) return alert('Selecciona al menos un tanque.');
    if (!bulkTratProducto) return alert('Escribe el producto o tratamiento.');

    const horaTrat = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    // Parse bulkTratFecha (YYYY-MM-DD) to DD/MM/YYYY
    let fechaFormat = new Date().toLocaleDateString('es-ES');
    if (bulkTratFecha) {
      const [yyyy, mm, dd] = bulkTratFecha.split('-');
      fechaFormat = `${dd}/${mm}/${yyyy}`;
    }
    const fechaTrat = fechaFormat;

    const nuevosTrats = bulkTratSelectedTanks.map((tanqueId, index) => ({
      id: Date.now() + index,
      fecha: fechaTrat,
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
  };

  const renderIncidencias = () => {
    const abiertas = incidencias.filter((i) => i.estado !== "Cerrada");
    const cerradas = incidencias.filter((i) => i.estado === "Cerrada");

    const colorSeveridad = (sev) => {
      if (sev === "Alta") return { bg: "#fdecea", color: "#c0392b", border: "#f5b7b1" };
      if (sev === "Baja") return { bg: "#eaf4ea", color: "#27ae60", border: "#a9dfbf" };
      return { bg: "#fef9e7", color: "#d68910", border: "#f9e79f" }; // Media
    };

    const handleAbrir = async () => {
      const ok = await abrirIncidencia(incidenciaForm);
      if (ok) {
        setIncidenciaForm({
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
      }
    };

    const Card = ({ inc }) => {
      const sev = colorSeveridad(inc.severidad);
      const cerrando = incidenciaCerrarId === inc.id;
      return (
        <div style={{
          background: "#fff", border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.color}`,
          borderRadius: "8px", padding: "0.9rem 1.1rem", marginBottom: "0.8rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ fontSize: "0.95rem" }}>🦠 {inc.agente_causante}</strong>
                <span style={{ background: sev.bg, color: sev.color, borderRadius: "4px", padding: "1px 7px", fontSize: "0.72rem", fontWeight: "bold" }}>
                  {inc.severidad}
                </span>
                <span style={{
                  background: inc.estado === "Cerrada" ? "#eaf4ea" : "#fdecea",
                  color: inc.estado === "Cerrada" ? "#27ae60" : "#c0392b",
                  borderRadius: "4px", padding: "1px 7px", fontSize: "0.72rem",
                }}>
                  {inc.estado === "Cerrada" ? "✅ Cerrada" : "🔴 Abierta"}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: "4px" }}>
                📅 Inicio: <strong>{inc.fecha_inicio}</strong>
                {inc.fecha_cierre && <> · Cierre: <strong>{inc.fecha_cierre}</strong></>}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#333", marginBottom: "4px" }}>
                📍 Raceways afectados: <strong>{inc.raceways_afectados}</strong>
              </div>
              {inc.tratamiento_aplicado && (
                <div style={{ fontSize: "0.82rem", color: "#333", marginBottom: "4px" }}>
                  💊 Tratamiento: {inc.tratamiento_aplicado}
                </div>
              )}
              {inc.notas && (
                <div style={{ fontSize: "0.78rem", color: "#777", fontStyle: "italic" }}>
                  💬 {inc.notas}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {inc.estado !== "Cerrada" && !cerrando && (
                <button onClick={() => { setIncidenciaCerrarId(inc.id); setIncidenciaNotasCierre(""); }}
                  style={{ background: "var(--oliva)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}>
                  Cerrar incidencia
                </button>
              )}
              <button onClick={() => { if (window.confirm("¿Borrar esta incidencia definitivamente?")) borrarIncidencia(inc.id); }}
                style={{ background: "#f5f5f5", color: "#888", border: "1px solid #ddd", borderRadius: "6px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}>
                Borrar
              </button>
            </div>
          </div>
          {cerrando && (
            <div style={{ marginTop: "0.7rem", paddingTop: "0.7rem", borderTop: "1px solid #eee" }}>
              <textarea
                placeholder="Notas de cierre (opcional): resultado, evolución, lecciones..."
                value={incidenciaNotasCierre}
                onChange={(e) => setIncidenciaNotasCierre(e.target.value)}
                style={{ width: "100%", minHeight: "60px", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  onClick={async () => {
                    await cerrarIncidencia(inc.id, incidenciaNotasCierre);
                    setIncidenciaCerrarId(null);
                    setIncidenciaNotasCierre("");
                  }}
                  style={{ background: "var(--rojo-alerta)", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}
                >
                  ✅ Confirmar cierre
                </button>
                <button onClick={() => setIncidenciaCerrarId(null)}
                  style={{ background: "#e9ecef", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          🚨 Control de Incidencias
        </h2>

        <div style={{ background: "#fff", padding: "1.3rem 1.5rem", borderRadius: "12px", border: "1px solid #ddd", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.9rem 0", fontSize: "1rem" }}>➕ Abrir nueva incidencia</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
            <div className="input-group">
              <label>Fecha de inicio</label>
              <input type="text" value={incidenciaForm.fechaInicio}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Severidad</label>
              <select value={incidenciaForm.severidad}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, severidad: e.target.value }))}>
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Agente causante</label>
              <input type="text" placeholder="Ej: Bacteriosis (Aeromonas sp.), hongo, parásito..."
                value={incidenciaForm.agenteCausante}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, agenteCausante: e.target.value }))} />
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Raceways afectados</label>
              <input type="text" placeholder="Ej: 2.1.3, 2.1.4, UCI-Cen-3..."
                value={incidenciaForm.racewaysAfectados}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, racewaysAfectados: e.target.value }))} />
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Tratamiento a aplicar (opcional — se registrará en cada raceway afectado)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                <select value={incidenciaForm.tratCategoria}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratCategoria: e.target.value }))}>
                  <option value="Tratamiento Antibiótico">Antibiótico</option>
                  <option value="Desparasitación Externa">Desparasit. Externa</option>
                  <option value="Desparasitación Interna">Desparasit. Interna</option>
                  <option value="Inducción Hormonal">Hormonal</option>
                  <option value="Preventivo">Preventivo</option>
                  <option value="Alimento">Alimento</option>
                </select>
                <input type="text" placeholder="Producto (Ej: Ganadexil)"
                  value={incidenciaForm.tratProducto}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratProducto: e.target.value }))} />
                <input type="text" placeholder="Dosis (Ej: 2ml/L)"
                  value={incidenciaForm.tratDosis}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratDosis: e.target.value }))} />
                <input type="text" placeholder="Frecuencia (Ej: 24h x 3d)"
                  value={incidenciaForm.tratFrecuencia}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratFrecuencia: e.target.value }))} />
              </div>
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Notas</label>
              <textarea value={incidenciaForm.notas}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, notas: e.target.value }))}
                style={{ minHeight: "60px", resize: "vertical" }} />
            </div>
          </div>
          <button className="btn-guardar" onClick={handleAbrir} style={{ marginTop: "1rem" }}>
            🚨 Abrir Incidencia
          </button>
        </div>

        <h3 style={{ fontSize: "1rem", color: "var(--rojo-alerta)" }}>
          🔴 Incidencias Abiertas ({abiertas.length})
        </h3>
        {abiertas.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>Sin incidencias abiertas.</p>
        ) : (
          abiertas.map((inc) => <Card key={inc.id} inc={inc} />)
        )}

        {cerradas.length > 0 && (
          <>
            <h3 style={{ fontSize: "1rem", color: "#888", marginTop: "1.5rem" }}>
              ✅ Incidencias Cerradas ({cerradas.length})
            </h3>
            {cerradas.map((inc) => <Card key={inc.id} inc={inc} />)}
          </>
        )}
      </div>
    );
  };

  const renderTratamientosMasivos = () => {
    let allTanks = [];
    Object.keys(data).forEach(grupo => {
      data[grupo].forEach(cell => {
        if (cell.count > 0) allTanks.push({ ...cell, grupoNombre: grupo });
      });
    });
    allTanks.sort((a, b) => a.id.localeCompare(b.id));

    const toggleTank = (id) => {
      if (bulkTratSelectedTanks.includes(id))
        setBulkTratSelectedTanks(bulkTratSelectedTanks.filter(t => t !== id));
      else
        setBulkTratSelectedTanks([...bulkTratSelectedTanks, id]);
    };

    const CHIPS_TRAT = ["Ganadexil (antibiótico)", "Levamisol (desparasit.)", "Sal (desparasit.)", "Inducción hormonal", "Frío (baño)", "Vitaminas", "Calcio"];
    const chipsAlmacen = inventario ? inventario.map(i => i.nombre).filter(Boolean) : [];
    const chips = [...new Set([...chipsAlmacen, ...CHIPS_TRAT])].slice(0, 14);

    const cargarPlanTratamiento = () => {
      const productosEncontrados = new Set();
      bulkTratSelectedTanks.forEach(tanqueId => {
        const plan = planesTratamiento[tanqueId];
        if (plan?.items?.length) {
          const primer = plan.items.find(it => it.producto && !productosEncontrados.has(it.producto));
          if (primer) {
            productosEncontrados.add(primer.producto);
            setBulkTratProducto(primer.producto);
            if (primer.dosis) setBulkTratDosis(primer.dosis);
            if (primer.frecuencia) setBulkTratTiempo(primer.frecuencia);
          }
        }
      });
      if (productosEncontrados.size === 0) alert("Ninguno de los tanques seleccionados tiene un plan de tratamiento definido.");
    };

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          💊 Panel de Tratamientos Masivos
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem" }}>
          {/* Lista de Tanques */}
          <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
              <h3 style={{ margin: 0 }}>Raceways con animales</h3>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button onClick={() => setBulkTratSelectedTanks(alarmasDesparasitacion.filter(id => allTanks.some(t => t.id === id)))}
                  style={{ background: "#ffdddd", color: "#cc0000", border: "1px solid #ff9999", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  ⚠️ Alarmas
                </button>
                <button onClick={() => setBulkTratSelectedTanks(allTanks.map(t => t.id))}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Todos
                </button>
                <button onClick={() => setBulkTratSelectedTanks([])}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Ninguno
                </button>
              </div>
            </div>
            <div style={{ maxHeight: "460px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {allTanks.map(t => {
                const tienePlan = !!(planesTratamiento[t.id]?.items?.length);
                const planResumen = tienePlan ? planesTratamiento[t.id].items.map(i => i.producto).filter(Boolean).join(", ") : null;
                const seleccionado = bulkTratSelectedTanks.includes(t.id);
                const esAlarma = alarmasDesparasitacion.includes(t.id);
                return (
                  <label key={t.id} style={{
                    display: "flex", alignItems: "center", padding: "0.5rem 0.8rem",
                    borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                    background: seleccionado ? "#fff3e0" : esAlarma ? "#fff8f8" : "transparent",
                    borderLeft: esAlarma ? "3px solid #e74c3c" : "3px solid transparent",
                  }}>
                    <input type="checkbox" checked={seleccionado} onChange={() => toggleTank(t.id)}
                      style={{ marginRight: "0.7rem", width: "16px", height: "16px" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{t.id}</span>
                        <span style={{ color: "#888", fontSize: "0.78rem" }}>{t.grupoNombre} · {t.count} ud</span>
                        {t.type && <span style={{ fontSize: "0.7rem", background: "#e8f5e9", color: "#2e7d32", borderRadius: "8px", padding: "0 5px" }}>{t.type}</span>}
                      </div>
                      {tienePlan && <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "1px" }}>💊 {planResumen}</div>}
                      {esAlarma && <div style={{ fontSize: "0.72rem", color: "#e74c3c", fontWeight: "bold" }}>⚠️ 2ª dosis pendiente</div>}
                    </div>
                  </label>
                );
              })}
              {allTanks.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: "2rem" }}>No hay tanques con animales.</p>}
            </div>
          </div>

          {/* Formulario */}
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd", height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Configurar tratamiento</h3>
              <button onClick={cargarPlanTratamiento} disabled={bulkTratSelectedTanks.length === 0}
                style={{ background: "#28a745", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", opacity: bulkTratSelectedTanks.length === 0 ? 0.5 : 1 }}>
                📋 Cargar plan
              </button>
            </div>

            {/* Chips rápidos */}
            <div style={{ marginBottom: "0.9rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#666", display: "block", marginBottom: "0.35rem" }}>Añadir rápido:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {chips.map(chip => (
                  <button key={chip} onClick={() => setBulkTratProducto(chip)}
                    style={{ background: bulkTratProducto === chip ? "#d5f5e3" : "#f0f0f0", border: bulkTratProducto === chip ? "1px solid #27ae60" : "1px solid #ccc", padding: "0.2rem 0.55rem", borderRadius: "12px", cursor: "pointer", fontSize: "0.75rem", color: bulkTratProducto === chip ? "#1a5c30" : "#555" }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Categoría</label>
              <select value={bulkTratCategoria} onChange={e => setBulkTratCategoria(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}>
                <option value="Desparasitación Externa">Desparasitación Externa</option>
                <option value="Desparasitación Interna">Desparasitación Interna</option>
                <option value="Tratamiento Antibiótico">Tratamiento Antibiótico</option>
                <option value="Suplemento / Vitaminas">Suplemento / Vitaminas</option>
                <option value="Alimentación Especial">Alimentación Especial</option>
                <option value="Otro Tratamiento">Otro Tratamiento</option>
              </select>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Producto / Tipo</label>
              <input type="text" value={bulkTratProducto} onChange={e => setBulkTratProducto(e.target.value)}
                placeholder="Ej. Ganadexil, Levamisol..."
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Dosis</label>
              <input type="text" value={bulkTratDosis} onChange={e => setBulkTratDosis(e.target.value)}
                placeholder="Ej. 0,1ml/L"
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Fecha</label>
              <input type="date" value={bulkTratFecha} onChange={e => setBulkTratFecha(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc" }} />
            </div>

            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Observación / Pauta</label>
              <input type="text" value={bulkTratTiempo} onChange={e => setBulkTratTiempo(e.target.value)}
                placeholder="Ej. Baño 24h, 2ª dosis en 7 días..."
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <button onClick={aplicarTratamientoMasivo} disabled={bulkTratSelectedTanks.length === 0}
              style={{ width: "100%", padding: "0.9rem", background: "#28a745", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer", opacity: bulkTratSelectedTanks.length === 0 ? 0.5 : 1 }}>
              💊 Aplicar a {bulkTratSelectedTanks.length} tanque(s)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Funciones del sistema de Alimentación ─────────────────────────────────

  // Registrar raciones para múltiples tanques a la vez
  const registrarAlimentacionMasiva = () => {
    if (bulkAlimSelectedTanks.length === 0) return alert("Selecciona al menos un tanque.");
    const itemsValidos = bulkAlimItems.filter(i => i.producto.trim() !== "");
    if (itemsValidos.length === 0) return alert("Añade al menos un alimento con producto.");

    const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const [yyyy, mm, dd] = bulkAlimFecha.split("-");
    const fechaFormat = `${dd}/${mm}/${yyyy}`;

    const batchId = Date.now();
    const nuevosRegistros = [];
    bulkAlimSelectedTanks.forEach(tanqueId => {
      let grupoTanque = "adultas";
      Object.keys(data).forEach(g => {
        if (data[g].some(c => c.id === tanqueId)) grupoTanque = g;
      });
      itemsValidos.forEach(item => {
        const gramosPorToma = parseFloat(item.gramosPorToma || item.gramos) || 0;
        const tomasItem = parseInt(item.tomas) || 1;
        nuevosRegistros.push({
          id: batchId + Math.random(),
          batchId,
          fecha: fechaFormat,
          hora,
          tanqueId,
          grupo: grupoTanque,
          producto: item.producto.trim(),
          gramosPorToma,
          tomas: tomasItem,
          gramos: gramosPorToma * tomasItem,
        });
      });
    });

    const actualizados = [...nuevosRegistros, ...registrosAlimentacion].slice(0, 500);
    setRegistrosAlimentacion(actualizados);

    if (isCloudConnected && cloudConfig.url) {
      nuevosRegistros.forEach(reg => {
        fetch(`${cloudConfig.url}/rest/v1/alimentacion`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ ...reg, id: Math.floor(reg.id) }),
        }).catch(e => console.warn("Error al guardar alimentación en nube:", e));
      });
    }

    const totalG = nuevosRegistros.reduce((s, r) => s + r.gramos, 0) / bulkAlimSelectedTanks.length;
    alert(`✅ Registro diario guardado — ${bulkAlimSelectedTanks.length} tanque(s) · ${totalG.toFixed(1)}g/tanque.`);
    setBulkAlimItems([{ producto: "", gramosPorToma: "", tomas: "1" }]);
    setBulkAlimSelectedTanks([]);
  };

  // Registrar ración individual desde el modal de celda
  const registrarAlimentacionIndividual = () => {
    if (!selectedCell) return;
    const itemsValidos = modalAlimItems.filter(i => i.producto.trim() !== "");
    if (itemsValidos.length === 0) return alert("Añade al menos un alimento.");

    const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const fechaHoy = new Date().toLocaleDateString("es-ES");
    const tanqueId = selectedCell.cell.id;
    const grupoTanque = selectedCell.grupo;

    const nuevosRegistros = itemsValidos.map(item => ({
      id: Date.now() + Math.random(),
      fecha: fechaHoy,
      hora,
      tanqueId,
      grupo: grupoTanque,
      producto: item.producto.trim(),
      gramos: parseFloat(item.gramos) || 0,
    }));

    const actualizados = [...nuevosRegistros, ...registrosAlimentacion].slice(0, 500);
    setRegistrosAlimentacion(actualizados);

    // Sincronizar con Supabase si está conectado
    if (isCloudConnected && cloudConfig.url) {
      nuevosRegistros.forEach(reg => {
        fetch(`${cloudConfig.url}/rest/v1/alimentacion`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ ...reg, id: Math.floor(reg.id) }),
        }).catch(e => console.warn("Error al guardar alimentación en nube:", e));
      });
    }

    alert(`✅ Alimentación registrada para ${tanqueId}.`);
    setModalAlimItems([{ producto: "", gramos: "" }]);
  };

  // Cargar el plan de alimentación de un tanque en el formulario individual
  const cargarPlanEnFormulario = (tanqueId, setter) => {
    const plan = planesAlimentacion[tanqueId];
    if (!plan || !plan.items || plan.items.length === 0) return;
    // Si tiene % de biomasa, calculamos los gramos reales
    let tankData = null;
    Object.keys(data).forEach(g => {
      const found = data[g].find(c => c.id === tanqueId);
      if (found) tankData = found;
    });
    const items = plan.items.map(item => {
      let gramos = item.gramos || 0;
      if (plan.porcentajeBiomasa && tankData && tankData.pesoMedio && tankData.count) {
        const biomasaTotal = parseFloat(tankData.pesoMedio) * tankData.count;
        gramos = ((plan.porcentajeBiomasa / 100) * biomasaTotal).toFixed(1);
      }
      return { producto: item.producto, gramos: String(gramos) };
    });
    setter(items);
  };

  // Cargar plan para todos los tanques seleccionados en alimentación masiva
  // Prioridad: 1) plan individual del raceway  2) plan de fase (cell.type)  3) nada
  const cargarPlanMasivo = () => {
    const items = [];
    const planesEncontrados = new Set();
    let usandoFase = false;

    bulkAlimSelectedTanks.forEach(tanqueId => {
      // Buscar datos del tanque
      let tankData = null;
      Object.keys(data).forEach(g => {
        const found = data[g].find(c => c.id === tanqueId);
        if (found) tankData = found;
      });

      // Resolución de plan: individual > fase > nada
      const planIndividual = planesAlimentacion[tanqueId];
      const fase = tankData?.type;
      const planFase = fase ? planesFase[fase] : null;
      const plan = (planIndividual?.items?.length) ? planIndividual : planFase;
      if (!plan?.items?.length) return;
      if (!planIndividual?.items?.length && planFase?.items?.length) usandoFase = true;

      plan.items.forEach(item => {
        if (!planesEncontrados.has(item.producto)) {
          planesEncontrados.add(item.producto);
          let gramos = item.cantidad || item.gramosPorToma || item.gramos || 0;
          if ((plan.modo || "fijos") === "biomasa" && tankData && (tankData.pesoMedio || tankData.peso_medio) && tankData.count) {
            const pm = parseFloat(tankData.pesoMedio || tankData.peso_medio);
            const biomasaTotal = pm * parseInt(tankData.count);
            gramos = ((parseFloat(item.cantidad) || 0) / 100 * biomasaTotal).toFixed(1);
          }
          items.push({
            producto: item.producto,
            gramosPorToma: String(gramos),
            tomas: String(item.tomas || plan.tomasAl_dia || 1),
          });
        }
      });
    });

    if (items.length === 0) return alert("Ninguno de los tanques seleccionados tiene plan individual ni plan de fase definido.");
    setBulkAlimItems(items);
    if (usandoFase) {
      // Pequeño aviso no bloqueante
      setTimeout(() => {}, 0); // placeholder — podría mostrarse en UI
    }
  };

  // Función que renderiza el Tab completo de Alimentación masiva
  const renderAlimentacion = () => {
    const productosAlmacen = inventario ? inventario.map(i => i.nombre).filter(Boolean) : [];
    const chipsBase = ["Micro-pellets", "Spirulina", "Calcio carbonato", "Asticot", "Vitaminas", "Alimento vivo"];
    const chipsPreset = [...new Set([...productosAlmacen, ...chipsBase])].slice(0, 12);

    let allTanks = [];
    Object.keys(data).forEach(grupo => {
      data[grupo].forEach(cell => {
        if (cell.count > 0) allTanks.push({ ...cell, grupoNombre: grupo });
      });
    });
    allTanks.sort((a, b) => a.id.localeCompare(b.id));

    // Calcular qué tanques tocan hoy según su frecuencia
    const diasSemana = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const hoyDia = new Date().getDay(); // 0=Dom, 1=Lun...
    const tocaHoy = (tanqueId) => {
      // Plan individual > plan de fase > asumir diario
      const planIndividual = planesAlimentacion[tanqueId];
      const tankCell = allTanks.find(t => t.id === tanqueId);
      const planFaseActual = tankCell?.type ? planesFase[tankCell.type] : null;
      const frec = planIndividual?.frecuencia || planFaseActual?.frecuencia || "Diario";
      if (frec === "Diario") return true;
      if (frec === "Días alternos") {
        const d = new Date(); const inicio = new Date(d.getFullYear(),0,0);
        const diaAnyo = Math.floor((d - inicio) / 86400000);
        return diaAnyo % 2 === 0;
      }
      if (frec === "Lun-Mié-Vie") return [1,3,5].includes(hoyDia);
      if (frec === "Mar-Jue-Sáb") return [2,4,6].includes(hoyDia);
      if (frec === "Solo laborables") return hoyDia >= 1 && hoyDia <= 5;
      return true;
    };

    // Últimos 30 registros de alimentación
    const ultimos30 = registrosAlimentacion.slice(0, 30);

    // Total consumido hoy
    const hoy = new Date().toLocaleDateString("es-ES");
    const consumoHoy = registrosAlimentacion
      .filter(r => r.fecha === hoy)
      .reduce((acc, r) => acc + (r.gramos || 0), 0);

    const FASES = ["Recién eclosionado","Renacuajo S","Renacuajo M","2 patas","4 patas","Ranita con cola","Recién metamorf.","Iniciación","Juvenil","Engorde","Reproductora"];
    const savePlanFase = (fase, nuevoplan) => setPlanesFase(prev => ({ ...prev, [fase]: nuevoplan }));
    const deletePlanFase = (fase) => setPlanesFase(prev => { const n = { ...prev }; delete n[fase]; return n; });

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          🌿 Panel de Alimentación
        </h2>

        {/* ── PLANES POR FASE ── */}
        <div style={{ marginBottom: "1.5rem", background: "#f8fff8", border: "1px solid #c8e6c9", borderRadius: "12px", overflow: "hidden" }}>
          <button
            onClick={() => setPlanesFaseExpanded(v => !v)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.2rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold", color: "#2e7d32" }}
          >
            <span>📋 Planes de alimentación por fase biológica</span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <span style={{ fontWeight: "normal", fontSize: "0.8rem", color: "#666" }}>
                {Object.keys(planesFase).length} fase(s) definida(s) · heredado por raceways sin plan propio
              </span>
              {planesFaseExpanded ? "▲" : "▼"}
            </span>
          </button>

          {planesFaseExpanded && (
            <div style={{ padding: "0 1.2rem 1.2rem 1.2rem" }}>
              {/* Chips para añadir fase */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                {FASES.filter(f => !planesFase[f]).map(fase => (
                  <button key={fase}
                    onClick={() => { savePlanFase(fase, { items: [{ producto: "", cantidad: "", tomas: "1" }], frecuencia: "Diario", modo: "fijos", notas: "" }); setEditandoFase(fase); }}
                    style={{ padding: "0.25rem 0.7rem", fontSize: "0.78rem", borderRadius: "10px", cursor: "pointer", border: "1px dashed #81c784", background: "white", color: "#388e3c" }}>
                    + {fase}
                  </button>
                ))}
                {FASES.every(f => planesFase[f]) && <span style={{ fontSize: "0.8rem", color: "#888" }}>Todas las fases tienen plan definido.</span>}
              </div>

              {/* Cards de fases definidas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {Object.entries(planesFase).map(([fase, plan]) => {
                  const editando = editandoFase === fase;
                  // Contar cuántos raceways usan este plan de fase
                  let usando = 0;
                  Object.values(data).forEach(grupo => grupo.forEach(cell => {
                    if (cell.type === fase && !planesAlimentacion[cell.id]?.items?.length) usando++;
                  }));
                  return (
                    <div key={fase} style={{ background: "white", border: editando ? "2px solid #27ae60" : "1px solid #c8e6c9", borderRadius: "10px", overflow: "hidden" }}>
                      {/* Header de la card */}
                      <div style={{ background: editando ? "#e8f5e9" : "#f1f8f1", padding: "0.6rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#1b5e20" }}>{fase}</span>
                          <span style={{ fontSize: "0.75rem", color: "#666", marginLeft: "0.6rem" }}>
                            {usando > 0 ? `${usando} raceway(s) la usan` : "sin raceways aún"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button onClick={() => setEditandoFase(editando ? null : fase)}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid #aaa", background: "white", cursor: "pointer" }}>
                            {editando ? "✓ Cerrar" : "✏️ Editar"}
                          </button>
                          <button onClick={() => { deletePlanFase(fase); if (editandoFase === fase) setEditandoFase(null); }}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid #e57373", background: "white", color: "#c62828", cursor: "pointer" }}>
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Resumen cuando está cerrado */}
                      {!editando && (
                        <div style={{ padding: "0.5rem 0.9rem", fontSize: "0.78rem", color: "#444" }}>
                          <div>{(plan.items || []).filter(i => i.producto).map(i => `${i.producto}${i.cantidad ? ` ${i.cantidad}${plan.modo === "biomasa" ? "% bio" : "g/toma"}` : ""}`).join(" · ") || <span style={{ color: "#bbb" }}>Sin productos</span>}</div>
                          <div style={{ color: "#888", marginTop: "2px" }}>{plan.frecuencia || "Diario"} · {plan.tomasAl_dia || 1} toma(s)/día</div>
                        </div>
                      )}

                      {/* Editor expandido */}
                      {editando && (
                        <div style={{ padding: "0.8rem 0.9rem" }}>
                          {/* Modo */}
                          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
                            {["fijos","biomasa"].map(modo => (
                              <button key={modo} onClick={() => savePlanFase(fase, { ...plan, modo })}
                                style={{ flex: 1, padding: "0.25rem", fontSize: "0.72rem", borderRadius: "6px", cursor: "pointer",
                                  border: (plan.modo||"fijos") === modo ? "2px solid #27ae60" : "1px solid #ccc",
                                  background: (plan.modo||"fijos") === modo ? "#e8f8f0" : "white",
                                  fontWeight: (plan.modo||"fijos") === modo ? "bold" : "normal", color: (plan.modo||"fijos") === modo ? "#1a7a40" : "#555" }}>
                                {modo === "fijos" ? "⚖️ Gramos fijos" : "📊 % Biomasa"}
                              </button>
                            ))}
                          </div>
                          {/* Frecuencia + tomas */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "0.4rem", marginBottom: "0.5rem" }}>
                            <select value={plan.frecuencia || "Diario"} onChange={e => savePlanFase(fase, { ...plan, frecuencia: e.target.value })}
                              style={{ padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                              {["Diario","Días alternos","Lun-Mié-Vie","Mar-Jue-Sáb","Solo laborables"].map(f => <option key={f}>{f}</option>)}
                            </select>
                            <select value={plan.tomasAl_dia || "1"} onChange={e => savePlanFase(fase, { ...plan, tomasAl_dia: e.target.value })}
                              style={{ padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                              {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×/día</option>)}
                            </select>
                          </div>
                          {/* Productos */}
                          {(plan.items || []).map((item, idx) => (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 75px 50px 22px", gap: "3px", marginBottom: "4px", alignItems: "center" }}>
                              <input type="text" value={item.producto || ""} placeholder="Producto..."
                                onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], producto: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                style={{ padding: "0.3rem 0.4rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }} />
                              <input type="text" value={item.cantidad || ""} placeholder={plan.modo === "biomasa" ? "%" : "g/toma"}
                                onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], cantidad: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                style={{ padding: "0.3rem 0.4rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", textAlign: "right" }} />
                              <select value={item.tomas || "1"} onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], tomas: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                style={{ padding: "0.3rem 0.2rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                                {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×</option>)}
                              </select>
                              <button onClick={() => { const items = (plan.items||[]).filter((_,i) => i !== idx); savePlanFase(fase, { ...plan, items }); }}
                                style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "0.9rem" }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => savePlanFase(fase, { ...plan, items: [...(plan.items||[]), { producto: "", cantidad: "", tomas: "1" }] })}
                            style={{ fontSize: "0.75rem", background: "#e8f8f0", border: "1px dashed #2ecc71", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#27ae60", marginTop: "3px", width: "100%" }}>
                            + Añadir producto
                          </button>
                          <textarea value={plan.notas || ""} onChange={e => savePlanFase(fase, { ...plan, notas: e.target.value })}
                            placeholder="Notas..." rows={2}
                            style={{ width: "100%", marginTop: "0.4rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #ccc", padding: "0.3rem", resize: "vertical", boxSizing: "border-box" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem" }}>

          {/* ── Columna izquierda: Lista de tanques ── */}
          <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h3 style={{ margin: 0 }}>Raceways con animales</h3>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => setBulkAlimSelectedTanks(allTanks.filter(t => tocaHoy(t.id)).map(t => t.id))}
                  style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", padding: "0.3rem 0.7rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", color: "#2e7d32", fontWeight: "bold" }}>
                  ✅ Los de hoy
                </button>
                <button onClick={() => setBulkAlimSelectedTanks(allTanks.map(t => t.id))}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Todos
                </button>
                <button onClick={() => setBulkAlimSelectedTanks([])}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Ninguno
                </button>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#999", margin: "0 0 0.7rem 0" }}>
              {diasSemana[hoyDia]} — {allTanks.filter(t => tocaHoy(t.id)).length} tanque(s) según plan de hoy
            </p>
            <div style={{ maxHeight: "440px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {allTanks.map(t => {
                const plan = planesAlimentacion[t.id];
                const tienePlan = !!(plan?.items?.length);
                const frecuencia = plan?.frecuencia || (tienePlan ? "Diario" : null);
                const tomas = plan?.tomasAl_dia || "1";
                const esHoy = tocaHoy(t.id);
                const seleccionado = bulkAlimSelectedTanks.includes(t.id);
                return (
                  <label key={t.id} style={{
                    display: "flex", alignItems: "center", padding: "0.5rem 0.8rem",
                    borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                    background: seleccionado ? "#e8f8f0" : esHoy && tienePlan ? "#fffde7" : "transparent",
                    borderLeft: esHoy && tienePlan ? "3px solid #f9a825" : "3px solid transparent",
                  }}>
                    <input type="checkbox"
                      checked={seleccionado}
                      onChange={() => {
                        if (seleccionado)
                          setBulkAlimSelectedTanks(bulkAlimSelectedTanks.filter(id => id !== t.id));
                        else
                          setBulkAlimSelectedTanks([...bulkAlimSelectedTanks, t.id]);
                      }}
                      style={{ marginRight: "0.7rem", width: "16px", height: "16px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{t.id}</span>
                        <span style={{ color: "#888", fontSize: "0.78rem" }}>{t.grupoNombre} · {t.count} ud</span>
                      </div>
                      {tienePlan && (
                        <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "1px" }}>
                          📋 {frecuencia} · {tomas} toma{parseInt(tomas)>1?"s":""}/día
                          {plan?.modo === "biomasa" && " · % biomasa"}
                        </div>
                      )}
                      {!tienePlan && (() => {
                        const planF = t.type ? planesFase[t.type] : null;
                        if (planF?.items?.length) return (
                          <div style={{ fontSize: "0.72rem", color: "#2e7d32", marginTop: "1px" }}>
                            🌿 Plan de fase: {t.type}
                          </div>
                        );
                        return <div style={{ fontSize: "0.72rem", color: "#bbb" }}>Sin plan definido</div>;
                      })()}
                    </div>
                    {esHoy && tienePlan && !seleccionado && (
                      <span style={{ fontSize: "0.7rem", color: "#f9a825", fontWeight: "bold", flexShrink: 0 }}>HOY</span>
                    )}
                  </label>
                );
              })}
              {allTanks.length === 0 && <p style={{ textAlign: "center", color: "#aaa", padding: "2rem" }}>No hay tanques activos.</p>}
            </div>
          </div>

          {/* ── Columna derecha: Registro diario ── */}
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Registro diario</h3>
                <p style={{ margin: "0.1rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>Un registro por día · engloba todas las tomas</p>
              </div>
              <button
                onClick={cargarPlanMasivo}
                disabled={bulkAlimSelectedTanks.length === 0}
                style={{ background: "#28a745", color: "white", border: "none", padding: "0.4rem 0.9rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", opacity: bulkAlimSelectedTanks.length === 0 ? 0.5 : 1 }}>
                📋 Cargar plan
              </button>
            </div>

            {/* Fecha */}
            <div style={{ margin: "0.9rem 0 1rem 0" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.4rem", fontSize: "0.85rem" }}>Fecha del registro</label>
              <input type="date" value={bulkAlimFecha}
                onChange={e => setBulkAlimFecha(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc" }} />
            </div>

            {/* Chips de presets */}
            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#666", marginBottom: "0.35rem" }}>Añadir alimento rápido:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {chipsPreset.map(chip => (
                  <button key={chip}
                    onClick={() => setBulkAlimItems(prev => {
                      const yaEsta = prev.some(i => i.producto === chip);
                      if (yaEsta) return prev;
                      return [...prev.filter(i => i.producto !== ""), { producto: chip, gramosPorToma: "" }];
                    })}
                    style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", padding: "0.2rem 0.55rem", borderRadius: "12px", cursor: "pointer", fontSize: "0.76rem", color: "#2e7d32" }}>
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Filas de alimento: producto + g/toma + nº tomas + total */}
            <div style={{ marginBottom: "0.8rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 70px 55px 24px", gap: "0.3rem", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.71rem", color: "#888", paddingLeft: "2px" }}>Producto</span>
                <span style={{ fontSize: "0.71rem", color: "#888", textAlign: "center" }}>g/toma</span>
                <span style={{ fontSize: "0.71rem", color: "#888", textAlign: "center" }}>tomas</span>
                <span style={{ fontSize: "0.71rem", color: "#27ae60", textAlign: "right" }}>total</span>
                <span />
              </div>
              {bulkAlimItems.map((item, idx) => {
                const gToma = parseFloat(item.gramosPorToma || item.gramos) || 0;
                const tomas = parseInt(item.tomas || 1);
                const totalDia = gToma * tomas;
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 65px 70px 55px 24px", gap: "0.3rem", marginBottom: "0.35rem", alignItems: "center" }}>
                    <input type="text" placeholder="Producto..."
                      value={item.producto}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, producto: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.83rem" }} />
                    <input type="number" placeholder="g"
                      value={item.gramosPorToma ?? ""}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, gramosPorToma: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.4rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.83rem", textAlign: "right" }} />
                    <select
                      value={item.tomas || "1"}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, tomas: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.3rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.8rem" }}>
                      {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×</option>)}
                    </select>
                    <div style={{ background: totalDia > 0 ? "#e8f8f0" : "#f5f5f5", borderRadius: "4px", padding: "0.4rem 0.3rem", fontSize: "0.8rem", color: "#27ae60", fontWeight: "bold", textAlign: "right" }}>
                      {totalDia > 0 ? `${totalDia.toFixed(1)}g` : "—"}
                    </div>
                    <button onClick={() => setBulkAlimItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                      style={{ background: "#ff7675", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", height: "30px", lineHeight: "30px" }}>×</button>
                  </div>
                );
              })}
              <button onClick={() => setBulkAlimItems(prev => [...prev, { producto: "", gramosPorToma: "", tomas: "1" }])}
                style={{ background: "transparent", border: "1px dashed #aaa", width: "100%", padding: "0.35rem", borderRadius: "6px", cursor: "pointer", color: "#666", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                + Añadir alimento
              </button>
            </div>

            {/* Resumen total del día */}
            {(() => {
              const totalDia = bulkAlimItems.reduce((s, it) => s + (parseFloat(it.gramosPorToma) || 0) * (parseInt(it.tomas) || 1), 0);
              if (totalDia === 0) return null;
              return (
                <div style={{ background: "#e8f8f0", border: "1px solid #b2dfdb", borderRadius: "6px", padding: "0.5rem 0.8rem", fontSize: "0.82rem", color: "#1b5e20", marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>📊 Total consumo diario:</span>
                    <strong>{totalDia.toFixed(1)} g/día</strong>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#388e3c", marginTop: "0.2rem" }}>
                    {bulkAlimItems.filter(it => it.producto && it.gramosPorToma).map((it, i) => (
                      <span key={i} style={{ marginRight: "0.8rem" }}>
                        {it.producto}: {((parseFloat(it.gramosPorToma)||0)*(parseInt(it.tomas)||1)).toFixed(1)}g ({it.tomas||1}×{parseFloat(it.gramosPorToma)||0}g)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Botón registrar */}
            <button
              onClick={registrarAlimentacionMasiva}
              disabled={bulkAlimSelectedTanks.length === 0}
              style={{ width: "100%", padding: "0.9rem", background: "var(--pistacho)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer", opacity: bulkAlimSelectedTanks.length === 0 ? 0.5 : 1 }}>
              🌿 Guardar registro diario — {bulkAlimSelectedTanks.length} tanque(s)
            </button>

            {/* Resumen consumo hoy */}
            {consumoHoy > 0 && (
              <div style={{ marginTop: "1rem", background: "#e8f5e9", padding: "0.6rem 1rem", borderRadius: "8px", fontSize: "0.85rem", color: "#2e7d32" }}>
                🌿 Consumo hoy: <strong>{consumoHoy.toFixed(1)} g</strong> registrados
              </div>
            )}
          </div>
        </div>

        {/* ── Historial agrupado por registro diario ── */}
        {registrosAlimentacion.length > 0 && (() => {
          // Agrupar por batchId (registros nuevos) o por fecha+tanqueId+hora (registros legacy)
          const grupos = [];
          const vistos = new Map();
          registrosAlimentacion.forEach(r => {
            const clave = r.batchId ? `batch_${r.batchId}_${r.tanqueId}` : `${r.fecha}_${r.tanqueId}_${r.hora}`;
            if (!vistos.has(clave)) {
              vistos.set(clave, { fecha: r.fecha, hora: r.hora, tanqueId: r.tanqueId, grupo: r.grupo, items: [], totalG: 0 });
              grupos.push(vistos.get(clave));
            }
            const g = vistos.get(clave);
            g.items.push({ producto: r.producto, gramosPorToma: r.gramosPorToma || r.gramos, tomas: r.tomas || 1, total: r.gramos });
            g.totalG += r.gramos || 0;
          });
          // Ordenar por fecha desc (ya vienen ordenados del state pero por si acaso)
          const ultimos = grupos.slice(0, 50);
          // Agrupar filas por fecha para mostrar separador
          return (
            <div style={{ marginTop: "2rem", background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
              <h3 style={{ color: "var(--oliva)", marginBottom: "1rem" }}>📋 Historial de registros diarios</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {ultimos.map((g, i) => {
                  const esNuevoDia = i === 0 || ultimos[i-1].fecha !== g.fecha;
                  return (
                    <div key={i}>
                      {esNuevoDia && (
                        <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#888", padding: "0.4rem 0", borderTop: i > 0 ? "1px solid #eee" : "none", marginTop: i > 0 ? "0.3rem" : 0 }}>
                          {g.fecha}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr auto", gap: "0.5rem", alignItems: "start", padding: "0.45rem 0.6rem", borderRadius: "6px", background: i % 2 === 0 ? "#fafafa" : "white", border: "1px solid #f0f0f0" }}>
                        {/* Tanque */}
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "var(--oliva)" }}>{g.tanqueId}</div>
                          <div style={{ fontSize: "0.7rem", color: "#aaa" }}>{g.hora}</div>
                        </div>
                        {/* Productos */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
                          {g.items.map((it, j) => (
                            <span key={j} style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: "10px", padding: "0.15rem 0.55rem", fontSize: "0.76rem" }}>
                              {it.producto}
                              {it.gramosPorToma ? ` ${it.gramosPorToma}g` : ""}
                              {it.tomas > 1 ? ` ×${it.tomas}` : ""}
                              {it.tomas > 1 ? ` = ${it.total}g` : "g"}
                            </span>
                          ))}
                        </div>
                        {/* Total */}
                        <div style={{ textAlign: "right", fontWeight: "bold", fontSize: "0.85rem", color: "#27ae60", whiteSpace: "nowrap" }}>
                          {g.totalG.toFixed(1)} g
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
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
      setModalBajaCant("1");
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

  const obtenerCabeceras = () => {
    return {
      apikey: cloudConfig.key,
      Authorization: `Bearer ${cloudConfig.key}`,
      "Content-Type": "application/json",
    };
  };

  // Guarda un registro en `tratamientos` (bajas, traslados, etc.) y muestra
  // un error visible si Supabase lo rechaza, en vez de fallar en silencio.
  const guardarTratamientoEnNube = async (payload, etiqueta = "movimiento") => {
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
  };

  const cargarDatosDeLaNube = async (configOverride = null) => {
    const config = configOverride || cloudConfig;
    if (!config.url || !config.key) return;
    setIsSyncing(true);
    try {
      // 1. Cargar censos desde tabla plana (estructura original compatible con el script de restauración)
      const resCensos = await fetch(`${config.url}/rest/v1/censos?select=*`, {
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
        },
      });
      if (!resCensos.ok) throw new Error("Error al obtener censos");
      const censosNubeRaw = await resCensos.json();
      
      // La tabla censos ya tiene la estructura plana que necesita la app:
      // id, grupo, count, last_date, type, dose, obs
      const censosNube = censosNubeRaw.map(c => ({
        id: c.id || '',
        grupo: c.grupo || 'adultas',
        count: c.count || 0,
        lastDate: c.last_date || '',
        type: c.type || '',
        dose: c.dose || '',
        obs: c.obs || '',
        pesoMedio: c.peso_medio !== undefined && c.peso_medio !== null ? String(c.peso_medio) : '',
        muestras: c.muestras || ''
      }));

      // 2. Cargar puestas
      const resPuestas = await fetch(
        `${config.url}/rest/v1/puestas?select=*&order=id.desc`,
        {
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
          },
        },
      );
      if (!resPuestas.ok) throw new Error("Error al obtener puestas");
      const puestasNube = await resPuestas.json();

      // 3. Cargar tratamientos
      const resTratamientos = await fetch(
        `${config.url}/rest/v1/tratamientos?select=*&order=id.desc`,
        {
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
          },
        },
      );
      if (!resTratamientos.ok) throw new Error("Error al obtener tratamientos");
      const tratNube = await resTratamientos.json();

      // 3b. Cargar incidencias (try/catch separado por si la tabla aún no existe)
      let incidenciasNube = [];
      try {
        const resIncidencias = await fetch(
          `${config.url}/rest/v1/incidencias?select=*&order=id.desc`,
          { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
        );
        if (resIncidencias.ok) incidenciasNube = await resIncidencias.json();
      } catch (err) {
        console.log("Error al cargar incidencias. Probablemente la tabla no exista aún.", err);
      }

      // 4. Cargar inventario (Con try/catch separado por si la tabla aún no existe)
      try {
        const resInv = await fetch(
          `${config.url}/rest/v1/inventario?select=*`,
          {
            headers: {
              apikey: config.key,
              Authorization: `Bearer ${config.key}`,
            },
          },
        );
        if (resInv.ok) {
          const invNube = await resInv.json();
          if (invNube && invNube.length > 0) {
            setInventario(invNube);
          } else if (inventario && inventario.length > 0) {
            // Subir inventario local a la nube si la nube está vacía
            fetch(`${config.url}/rest/v1/inventario`, {
              method: "POST",
              headers: {
                apikey: config.key,
                Authorization: `Bearer ${config.key}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates",
              },
              body: JSON.stringify(inventario),
            }).catch((e) => console.error("Error al subir inventario local:", e));
          }
        }
      } catch (err) {
        console.log("Tabla de inventario no encontrada o error", err);
      }

      // Reconstruir estructura de data
      const adultasNube = censosNube.filter(
        (c) =>
          c.grupo === "adultas" ||
          c.grupo === "grupo31" ||
          c.grupo === "grupo24" ||
          c.grupo === "grupo21",
      );

      const corruptos = [];
      const nuevaData = {
        adultas: asegurarEstructurasAdultas(
          { adultas: adultasNube },
          corruptos,
        ),
        naveVerde: asegurarEstructurasNaveVerde(
          censosNube.filter((c) => c.grupo === "naveVerde"),
          corruptos,
        ),
        incubadoras: asegurarEstructurasIncubadoras(
          censosNube.filter((c) => c.grupo === "incubadoras"),
          corruptos,
        ),
        renacuajos: asegurarEstructurasRenacuajos(
          censosNube.filter((c) => c.grupo === "renacuajos"),
          corruptos,
        ),
        metamorfoseadas: asegurarEstructurasMetamorfoseadas(
          censosNube.filter((c) => c.grupo === "metamorfoseadas"),
          corruptos,
        ),
        reproduccion: asegurarEstructurasReproduccion(
          censosNube.filter((c) => c.grupo === "reproduccion"),
          corruptos,
        ),
        brumacion: asegurarEstructurasBrumacion(
          censosNube.filter((c) => c.grupo === "brumacion"),
        ),
        invernadero: asegurarEstructurasInvernadero(
          censosNube.filter((c) => c.grupo === "invernadero"),
        ),
      };

      // Si hay registros corruptos (IDs con comillas/espacios), eliminarlos silenciosamente de la base de datos de la nube
      if (corruptos.length > 0) {
        console.log(
          "Registros corruptos identificados para eliminación en Supabase:",
          corruptos,
        );
        // Hacemos el DELETE asíncronamente en segundo plano
        (async () => {
          for (const item of corruptos) {
            try {
              const urlDelete = `${config.url}/rest/v1/censos?id=eq.${encodeURIComponent(item.id)}`;
              const response = await fetch(urlDelete, {
                method: "DELETE",
                headers: {
                  apikey: config.key,
                  Authorization: `Bearer ${config.key}`,
                },
              });
              if (response.ok) {
                console.log(
                  `Registro corrupto eliminado con éxito de Supabase: ${item.id}`,
                );
              } else {
                console.warn(
                  `Respuesta de eliminación fallida para ${item.id}:`,
                  response.status,
                );
              }
            } catch (err) {
              console.error(
                `Error al intentar eliminar registro corrupto ${item.id} en la nube:`,
                err,
              );
            }
          }
        })();
      }

      // Rellenar grupos vacíos si no existen en la nube pero sí en local
      Object.keys(DEFAULT_DATA).forEach((k) => {
        if (!nuevaData[k] || nuevaData[k].length === 0) {
          nuevaData[k] = DEFAULT_DATA[k];
        }
      });

      // Si las tablas están vacías en la nube, pero tenemos datos locales, ofrecer subirlos
      const censoTotalLocal =
        calcularCensoGrupo(data.adultas) +
        calcularCensoGrupo(data.naveVerde) +
        calcularCensoGrupo(data.renacuajos) +
        calcularCensoGrupo(data.metamorfoseadas);

      if (
        censosNube.length === 0 &&
        (puestas.length > 0 || tratamientos.length > 0 || censoTotalLocal > 0)
      ) {
        if (
          window.confirm(
            "La base de datos en la nube está vacía. ¿Quieres subir tus datos locales actuales a la nube para no perderlos?",
          )
        ) {
          await subirDatosLocalesALaNube(config);
          setIsCloudConnected(true);
          return;
        }
      }

      // Actualizar estados locales con los de la nube
      // MERGE: conservar entradas locales que aún no llegaron a la nube (por id)
      setData(nuevaData);
      setPuestas(prev => {
        const nubeIds = new Set(puestasNube.map(p => String(p.id)));
        const soloLocales = prev.filter(p => !nubeIds.has(String(p.id)));
        return [...puestasNube, ...soloLocales];
      });
      setTratamientos(prev => {
        const nubeIds = new Set(tratNube.map(t => String(t.id)));
        const soloLocales = prev.filter(t => !nubeIds.has(String(t.id)));
        return [...tratNube, ...soloLocales];
      });
      setIncidencias(prev => {
        const nubeIds = new Set(incidenciasNube.map(i => String(i.id)));
        const soloLocales = prev.filter(i => !nubeIds.has(String(i.id)));
        return [...incidenciasNube, ...soloLocales];
      });
      setIsCloudConnected(true);
      cargarPlanesDesdeNube();
    } catch (err) {
      console.error(err);
      setIsCloudConnected(false);
      alert(
        "No se pudo conectar a la base de datos de la nube. Detalle del error:\n\n" + (err.message || err) + "\n\nComprueba la URL y la Anon Key."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const subirDatosLocalesALaNube = async (config) => {
    setIsSyncing(true);
    try {
      const headers = {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      };

      // Subir censos (optimizado para evitar filas vacías de cuadrícula innecesarias)
      const filasCensos = [];
      Object.keys(data).forEach((grupo) => {
        data[grupo].forEach((item) => {
          const cleanId = normalizarId(item.id);
          const esGrid =
            grupo === "renacuajos" && /^E\d-F\d-C\d+/.test(cleanId);
          if (!esGrid || item.count > 0 || item.obs || item.type || item.dose) {
            filasCensos.push({
              id: cleanId,
              grupo: grupo,
              count: parseInt(item.count, 10) || 0,
              last_date: item.lastDate || "",
              type: item.type || "",
              dose: item.dose || "",
              obs: item.obs || "",
            });
          }
        });
      });

      if (filasCensos.length > 0) {
        await fetch(`${config.url}/rest/v1/censos`, {
          method: "POST",
          headers,
          body: JSON.stringify(filasCensos),
        });
      }

      // Subir puestas
      if (puestas.length > 0) {
        await fetch(`${config.url}/rest/v1/puestas`, {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(
            puestas.map((p) => ({
              id: p.id,
              fecha: p.fecha,
              hora: p.hora,
              tanque: p.tanque,
              grupo: p.grupo,
              destino: p.destino || null,
              huevos: p.huevos || null,
              tipo_puesta: p.tipo_puesta || null,
              estado: p.estado || null,
              obs: p.obs || null,
            })),
          ),
        });
      }

      // Subir inventario
      try {
        if (inventario.length > 0) {
          await fetch(`${config.url}/rest/v1/inventario`, {
            method: "POST",
            headers,
            body: JSON.stringify(inventario),
          });
        }
      } catch (err) {
        console.log(
          "Error al subir inventario. Probablemente la tabla no exista aún.",
          err,
        );
      }

      // Subir tratamientos (incluye log de bajas)
      if (tratamientos.length > 0) {
        await fetch(`${config.url}/rest/v1/tratamientos`, {
          method: "POST",
          headers,
          body: JSON.stringify(
            tratamientos.map((t) => ({
              id: t.id,
              fecha: t.fecha,
              hora: t.hora,
              tanque: t.tanque,
              tipo: t.tipo,
              dosis: t.dosis,
            })),
          ),
        });
      }

      alert("Datos locales migrados a la nube con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al migrar los datos locales.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (cloudConfig.url && cloudConfig.key) {
      cargarDatosDeLaNube();
      cargarPlanesDesdeNube();
    }
  }, []);

  // Auto-refresco cada 60s cuando hay conexión activa
  useEffect(() => {
    if (!isCloudConnected) return;
    const intervalo = setInterval(() => {
      cargarDatosDeLaNube();
    }, 60000);
    return () => clearInterval(intervalo);
  }, [isCloudConnected]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_data", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_puestas", JSON.stringify(puestas));
  }, [puestas]);

  useEffect(() => {
    localStorage.setItem(
      "grenoucerie_tratamientos",
      JSON.stringify(tratamientos),
    );
  }, [tratamientos]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_incidencias", JSON.stringify(incidencias));
  }, [incidencias]);

  useEffect(() => {
    localStorage.setItem("grenoucerie_inventario", JSON.stringify(inventario));
  }, [inventario]);

  // Persistencia de alimentación en localStorage
  useEffect(() => {
    localStorage.setItem("grenoucerie_alimentacion", JSON.stringify(registrosAlimentacion));
  }, [registrosAlimentacion]);

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

  // Registro de bajas especiales con historial detallado
  const registrarBajasEspecial = async (grupo, rawId, cantidadStr) => {
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

    // Registrar evento de baja en el historial (se guarda en tabla tratamientos con tipo = 'Baja')
    const nuevaBajaEvent = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString("es-ES"),
      hora: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      tanque: id,
      tipo: "Baja",
      dosis: String(cantidad),
    };
    setTratamientos((prev) => [nuevaBajaEvent, ...prev]);

    // Guardar en la nube si está conectado
    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: id, grupo: grupo, count: nuevoCount });
        await guardarTratamientoEnNube(nuevaBajaEvent, "baja");
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

  const aplicarTratamiento = async (id, tipo, dosis, extras = {}) => {
    const nuevoTrat = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: new Date().toLocaleDateString("es-ES"),
      hora: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      tanque: id,
      tipo: tipo,
      dosis: dosis,
      // Nuevos campos parametrizados
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
            id: nuevoTrat.id,
            fecha: nuevoTrat.fecha,
            hora: nuevoTrat.hora,
            tanque: nuevoTrat.tanque,
            tipo: nuevoTrat.tipo,
            dosis: nuevoTrat.dosis,
            categoria: nuevoTrat.categoria,
            frecuencia: nuevoTrat.frecuencia,
            num_dosis: nuevoTrat.numDosis,
            notas: nuevoTrat.notas,
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

  const updateField = async (grupo, id, field, value) => {
    const itemAfectado = data[grupo].find((item) => item.id === id);
    if (!itemAfectado) return;

    let extraUpdates = {};
    if (field === "type" && value !== "" && !itemAfectado.lastDate) {
      const hoy = new Date().toISOString().split("T")[0];
      extraUpdates.lastDate = hoy;
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
    csvContenido += "Fecha;Hora;Tanque;Cantidad de Bajas\n";
    tratamientos
      .filter((t) => t.tipo === "Baja")
      .forEach((t) => {
        csvContenido += `${t.fecha || ""};${t.hora || ""};${t.tanque || ""};${t.dosis || ""}\n`;
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

  // Cálculo de bajas diarias (Hoy y Ayer) con formato robusto
  const obtenerBajasPorFecha = (fechaNorm) => {
    return tratamientos
      .filter(
        (t) => t.tipo === "Baja" && normalizarFecha(t.fecha) === fechaNorm,
      )
      .reduce((sum, curr) => sum + (parseInt(curr.dosis, 10) || 0), 0);
  };

  const hoyNorm = getFechaHoyNorm();
  const ayerNorm = getFechaAyerNorm();

  const bajasHoy = obtenerBajasPorFecha(hoyNorm);
  const bajasAyer = obtenerBajasPorFecha(ayerNorm);

  const pctBajasHoy =
    censoTotal > 0 || bajasHoy > 0
      ? ((bajasHoy / (censoTotal + bajasHoy)) * 100).toFixed(2)
      : "0.00";

  const pctBajasAyer =
    censoTotal > 0 || bajasAyer > 0
      ? ((bajasAyer / (censoTotal + bajasHoy + bajasAyer)) * 100).toFixed(2)
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

    await registrarBajasEspecial(grupo, id, cant);

    // Actualizar censo local en el modal
    const nuevoCenso = Math.max(0, modalCount - cant);
    setModalCount(nuevoCenso);
    setModalBajaCant("1");
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

    // Registrar evento de salida en el historial (se guarda en tabla tratamientos con tipo = 'Salida a Industria/SANDACH')
    const nuevaSalidaEvent = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString("es-ES"),
      hora: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      tanque: id,
      tipo:
        "Salida " +
        tipoSalida +
        " - Destino: " +
        (destinoStr || "No especificado"),
      dosis: String(cantidad),
    };
    setTratamientos((prev) => [nuevaSalidaEvent, ...prev]);

    // Guardar en la nube si está conectado
    if (isCloudConnected) {
      try {
        await syncInventarioNube({ id: id, grupo: grupo, count: nuevoCount });
        await guardarTratamientoEnNube(nuevaSalidaEvent, "salida");
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

    await aplicarTratamiento(id, modalTratTipo, modalTratDosis, {
      categoria: modalTratCategoria,
      frecuencia: modalTratFrecuencia,
      numDosis: modalTratNumDosis,
      numTomas: modalTratCategoria === "alimento" ? (modalTratNumTomas || "1") : undefined,
      notas: modalTratNotas,
    });

    setModalType(modalTratTipo);
    setModalDose((prev) => prev || modalTratDosis);
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

  // Renderizar la cuadrícula interactiva de 7x9 para renacuajos
  const renderMetamorfoseadasGrid = () => {
    const pisoEstructuraIzquierda =
      activeMetamorfosisBloque === "Trasero"
        ? activeMetamorfosisPiso
        : activeMetamorfosisPiso + 3;
    const pisoEstructuraDerecha =
      activeMetamorfosisBloque === "Trasero"
        ? activeMetamorfosisPiso
        : activeMetamorfosisPiso + 3;

    const celdasIzquierda = [];
    for (let r = 10; r >= 1; r--) {
      const id = `1.${pisoEstructuraIzquierda}.${r}`;
      celdasIzquierda.push(
        data.metamorfoseadas.find((c) => c.id === id) || { id, count: 0 },
      );
    }

    const celdasDerecha = [];
    for (let r = 1; r <= 10; r++) {
      const id = `4.${pisoEstructuraDerecha}.${r}`;
      celdasDerecha.push(
        data.metamorfoseadas.find((c) => c.id === id) || { id, count: 0 },
      );
    }

    return (
      <div className="metamorfosis-container group-section">
        <h2 className="group-title">🐸 Estructura de Recién Metamorfoseadas</h2>

        <div className="estructura-tabs" style={{ marginBottom: "10px" }}>
          <button
            className={`estructura-tab-btn ${activeMetamorfosisBloque === "Trasero" ? "active" : ""}`}
            onClick={() => setActiveMetamorfosisBloque("Trasero")}
          >
            Bloque Trasero (1 y 4)
          </button>
          <button
            className={`estructura-tab-btn ${activeMetamorfosisBloque === "Delantero" ? "active" : ""}`}
            onClick={() => setActiveMetamorfosisBloque("Delantero")}
          >
            Bloque Delantero (1 y 4 Frente)
          </button>
        </div>

        <div className="estructura-tabs" style={{ gap: "5px" }}>
          <button
            className={`estructura-tab-btn ${activeMetamorfosisPiso === 1 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveMetamorfosisPiso(1)}
          >
            Piso 1 (Abajo)
          </button>
          <button
            className={`estructura-tab-btn ${activeMetamorfosisPiso === 2 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveMetamorfosisPiso(2)}
          >
            Piso 2 (Medio)
          </button>
          <button
            className={`estructura-tab-btn ${activeMetamorfosisPiso === 3 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveMetamorfosisPiso(3)}
          >
            Piso 3 (Alto)
          </button>
        </div>

        <div className="pasillo-central-layout">
          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              Estructura 1{" "}
              {activeMetamorfosisBloque === "Delantero" ? "(Frente)" : ""}
            </h4>
            {celdasIzquierda.map((cell) => {
              const dens = OBTENER_DATOS_DENSIDAD(
                "metamorfoseadas",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                  onClick={() => {
                    handleCellClick(cell, "metamorfoseadas");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pasillo-visual">
            <div className="pasillo-text">
              P<br />A<br />S<br />I<br />L<br />L<br />O
            </div>
          </div>

          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              Estructura 4{" "}
              {activeMetamorfosisBloque === "Delantero" ? "(Frente)" : ""}
            </h4>
            {celdasDerecha.map((cell) => {
              const dens = OBTENER_DATOS_DENSIDAD(
                "metamorfoseadas",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                  onClick={() => {
                    handleCellClick(cell, "metamorfoseadas");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderUCIGrid = () => {
    // Helper para deduplicar visualmente
    const forceUnique = (arr) => {
      const map = {};
      arr.forEach((c) => {
        const key = normalizarId(c.id).toLowerCase();
        if (!map[key]) map[key] = c;
        else if (parseInt(c.count || 0) > parseInt(map[key].count || 0))
          map[key] = c;
      });
      return Object.values(map);
    };

    const izq = forceUnique(
      data.naveVerde.filter((c) => c.id.startsWith("UCI-Izq-")),
    ).sort(
      (a, b) => parseInt(b.id.split("-")[2]) - parseInt(a.id.split("-")[2]),
    );
    const cen = forceUnique(
      data.naveVerde.filter((c) => c.id.startsWith("UCI-Cen-")),
    ).sort(
      (a, b) => parseInt(b.id.split("-")[2]) - parseInt(a.id.split("-")[2]),
    );
    const der = data.naveVerde.find((c) => c.id === "UCI-Der-1");
    const corrales = forceUnique(
      data.naveVerde.filter((c) => c.id.startsWith("Corral-")),
    ).sort();
    const caja = data.naveVerde.find((c) => c.id === "Caja-Blanca");

    return (
      <div
        className="metamorfosis-container group-section"
        style={{ marginTop: "3rem" }}
      >
        <h2 className="group-title">
          🏥 Nave Verde (Unidad de Cuidados Intensivos)
        </h2>

        <div className="uci-layout">
          {/* Columna Izquierda */}
          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              Izquierda (Termoarcilla)
            </h4>
            {(() => {
              const rendered = new Set();
              return izq.map((cell) => {
                if (rendered.has(cell.id)) return null;
                rendered.add(cell.id);
                const dens = OBTENER_DATOS_DENSIDAD(
                  "naveVerde",
                  cell.id,
                  cell.count,
                );
                return (
                  <div
                    key={cell.id}
                    className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                    onClick={() => {
                      handleCellClick(cell, "naveVerde");
                    }}
                  >
                    <div className="cell-id">
                      {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                    </div>
                    <div className="cell-count">
                      {cell.count > 0 ? `${cell.count} ud` : "-"}
                    </div>
                    {cell.type && <div className="cell-fase">{cell.type}</div>}
                    {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                      <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Bloque Central de Corrales */}
          <div className="uci-corrales">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "#666",
                fontSize: "0.8rem",
              }}
            >
              Suelo
            </h4>
            {corrales.map((cell) => {
              const dens = OBTENER_DATOS_DENSIDAD(
                "naveVerde",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} corral-cell ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                  onClick={() => {
                    handleCellClick(cell, "naveVerde");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Columna Central */}
          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              Centrales
            </h4>
            {(() => {
              const rendered = new Set();
              return cen.map((cell) => {
                if (rendered.has(cell.id)) return null;
                rendered.add(cell.id);
                const dens = OBTENER_DATOS_DENSIDAD(
                  "naveVerde",
                  cell.id,
                  cell.count,
                );
                return (
                  <div
                    key={cell.id}
                    className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                    onClick={() => {
                      handleCellClick(cell, "naveVerde");
                    }}
                  >
                    <div className="cell-id">
                      {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                    </div>
                    <div className="cell-count">
                      {cell.count > 0 ? `${cell.count} ud` : "-"}
                    </div>
                    {cell.type && <div className="cell-fase">{cell.type}</div>}
                    {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                      <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Columna Derecha / Caja Blanca */}
          <div className="uci-right-col">
            <div className="raceways-col" style={{ marginBottom: "2rem" }}>
              <h4
                style={{
                  textAlign: "center",
                  marginBottom: "10px",
                  color: "var(--oliva)",
                  fontSize: "0.9rem",
                }}
              >
                Derecha (Sal)
              </h4>
              {der &&
                (() => {
                  const dens = OBTENER_DATOS_DENSIDAD(
                    "naveVerde",
                    der.id,
                    der.count,
                  );
                  return (
                    <div
                      key={der.id}
                      className={`grid-cell ${dens.estado} ${der?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                      onClick={() => {
                        handleCellClick(der, "naveVerde");
                      }}
                    >
                      <div className="cell-id">
                        {der.id} {der?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                      </div>
                      <div className="cell-count">
                        {der.count > 0 ? `${der.count} ud` : "-"}
                      </div>
                      {der.type && <div className="cell-fase">{der.type}</div>}
                      {(der.pesoMedio || der.peso_medio) && der.count > 0 && (
                        <div className="cell-meta-preview"><span>~{der.pesoMedio || der.peso_medio}g</span></div>
                      )}
                    </div>
                  );
                })()}
            </div>

            <div className="raceways-col">
              <h4
                style={{
                  textAlign: "center",
                  marginBottom: "10px",
                  color: "#666",
                  fontSize: "0.8rem",
                }}
              >
                Independiente
              </h4>
              {caja &&
                (() => {
                  const dens = OBTENER_DATOS_DENSIDAD(
                    "naveVerde",
                    caja.id,
                    caja.count,
                  );
                  return (
                    <div
                      key={caja.id}
                      className={`grid-cell ${dens.estado} caja-blanca ${caja?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                      onClick={() => {
                        handleCellClick(caja, "naveVerde");
                      }}
                    >
                      <div className="cell-id">{caja.id.replace("-", " ")}</div>
                      <div className="cell-count">
                        {caja.count > 0 ? `${caja.count} ud` : "-"}
                      </div>
                      {caja.type && <div className="cell-fase">{caja.type}</div>}
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReproduccionGrid = () => {
    return (
      <div className="adultas-container group-section" style={{ borderTopColor: "#ff6b81" }}>
        <h2 className="group-title" style={{ color: "#ff6b81" }}>💕 Área de Reproducción</h2>
        
        <div className="pasillo-central-layout" style={{ marginTop: "2rem" }}>
          <div className="raceways-col">
            <h4 style={{ textAlign: "center", marginBottom: "10px", color: "#ff6b81", fontSize: "1rem" }}>Tanques Aislados</h4>
            {data.reproduccion
              .filter(c => c.id.startsWith("Repro-"))
              .map(cell => {
                const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
                return (
                  <div
                    key={cell.id}
                    className={`grid-cell ${dens.estado}`}
                    onClick={() => handleCellClick(cell, "reproduccion")}
                    style={{ borderLeft: "4px solid #ff6b81", padding: "1.5rem" }}
                  >
                    <div className="cell-id">{cell.id}</div>
                    <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                    {cell.type && <div className="cell-fase">{cell.type}</div>}
                    {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                  </div>
                );
              })}
          </div>

          <div className="pasillo">PASILLO CENTRAL</div>

          <div className="raceways-col">
            <h4 style={{ textAlign: "center", marginBottom: "10px", color: "#ff6b81", fontSize: "1rem" }}>Carros Móviles</h4>
            {data.reproduccion
              .filter(c => c.id.startsWith("Carro-"))
              .map(cell => {
                const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
                return (
                  <div
                    key={cell.id}
                    className={`grid-cell ${dens.estado}`}
                    onClick={() => handleCellClick(cell, "reproduccion")}
                    style={{ borderLeft: "4px solid #ff6b81", padding: "1.5rem" }}
                  >
                    <div className="cell-id">{cell.id}</div>
                    <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                    {cell.type && <div className="cell-fase">{cell.type}</div>}
                    {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  const renderLaboratorioGrid = () => {
    return (
      <div className="adultas-container group-section" style={{ borderTopColor: "#9b59b6" }}>
        <h2 className="group-title" style={{ color: "#9b59b6" }}>🔬 Laboratorio Ex-Situ</h2>
        <div style={{ padding: "1rem", maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap" }}>
          {data.reproduccion
            .filter(c => c.id.startsWith("Lab-"))
            .map(cell => {
              const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado}`}
                  onClick={() => handleCellClick(cell, "reproduccion")}
                  style={{ borderLeft: "4px solid #9b59b6", padding: "1.5rem", minWidth: "250px" }}
                >
                  <div className="cell-id">{cell.id}</div>
                  <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {cell.obs && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "8px" }}>{cell.obs}</div>}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  const renderInvernaderoGrid = () => {
    const factor = invernaderoLiters / 1000;
    
    return (
      <div className="adultas-container group-section" style={{ borderTopColor: "#27ae60" }}>
        <h2 className="group-title" style={{ color: "#27ae60" }}>🪴 Invernadero (Agua Verde y Daphnia)</h2>
        
        <div style={{ padding: "1rem", maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
          {/* Piscinas Agua Verde */}
          <div style={{ background: "#e8f8f5", padding: "1.5rem", borderRadius: "12px", border: "2px solid #a3e4d7", flex: "1", minWidth: "300px" }}>
            <h3 style={{ color: "#117a65", textAlign: "center", marginBottom: "1rem" }}>🌊 Piscinas Termoarcilla (Agua Verde)</h3>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              {data.invernadero
                .filter(c => c.id.startsWith("Termoarcilla-"))
                .map(cell => (
                  <div
                    key={cell.id}
                    className="grid-cell normal"
                    onClick={() => handleCellClick(cell, "invernadero")}
                    style={{ borderLeft: "4px solid #1abc9c", padding: "1rem", flex: "1", background: "white" }}
                  >
                    <div className="cell-id">{cell.id}</div>
                    {cell.ph && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>pH: {cell.ph}</div>}
                    {cell.no3 && <div style={{ fontSize: "0.8rem", color: "#666" }}>NO3: {cell.no3}</div>}
                    {cell.no2 && <div style={{ fontSize: "0.8rem", color: "#666" }}>NO2: {cell.no2}</div>}
                    {cell.aireacion && <div style={{ fontSize: "0.8rem", color: "#3498db", fontWeight: "bold" }}>{cell.aireacion}</div>}
                  </div>
                ))}
            </div>
          </div>

          {/* Charcas Daphnia */}
          <div style={{ background: "#fef9e7", padding: "1.5rem", borderRadius: "12px", border: "2px solid #f9e79f", flex: "1", minWidth: "300px" }}>
            <h3 style={{ color: "#b7950b", textAlign: "center", marginBottom: "1rem" }}>🦐 Charcas (Cría Daphnia)</h3>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexDirection: "column" }}>
              {data.invernadero
                .filter(c => c.id.startsWith("Charca-"))
                .map(cell => (
                  <div
                    key={cell.id}
                    className="grid-cell normal"
                    onClick={() => handleCellClick(cell, "invernadero")}
                    style={{ borderLeft: "4px solid #f1c40f", padding: "1rem", background: "white" }}
                  >
                    <div className="cell-id">{cell.id}</div>
                    {cell.obs && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Calculadora Agua Verde */}
        <div style={{ background: "#f0f8ff", border: "2px solid #b3d4ff", borderRadius: "12px", padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
          <h3 style={{ textAlign: "center", color: "#0056b3", marginBottom: "1rem" }}>🧮 Calculadora de Agua Verde</h3>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
            <label style={{ fontWeight: "bold", color: "#333" }}>Litros a preparar:</label>
            <input
              type="number"
              className="modal-input"
              style={{ width: "120px", margin: 0 }}
              value={invernaderoLiters}
              onChange={(e) => setInvernaderoLiters(e.target.value)}
            />
            <span>L</span>
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid #ddd", minWidth: "250px", flex: "1" }}>
              <h4 style={{ color: "#27ae60", borderBottom: "2px solid #27ae60", paddingBottom: "5px" }}>🧪 Solución 1</h4>
              <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.8" }}>
                <li>💧 <strong>Agua:</strong> {(5 * factor).toFixed(1)} Lt</li>
                <li>🧪 <strong>Fosfato Monopotásico:</strong> {(200 * factor).toFixed(0)} gr</li>
                <li>🧂 <strong>Sulfato de Magnesio:</strong> {(373 * factor).toFixed(0)} gr</li>
                <li>🌿 <strong>Nitrato de Potasio:</strong> {(350 * factor).toFixed(0)} gr</li>
                <li>🔬 <strong>Micro:</strong> {(45 * factor).toFixed(0)} gr</li>
              </ul>
            </div>

            <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid #ddd", minWidth: "250px", flex: "1" }}>
              <h4 style={{ color: "#2980b9", borderBottom: "2px solid #2980b9", paddingBottom: "5px" }}>🧪 Solución 2</h4>
              <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.8" }}>
                <li>💧 <strong>Agua:</strong> {(2 * factor).toFixed(1)} Lt</li>
                <li>🦴 <strong>Nitrato de Calcio:</strong> {(700 * factor).toFixed(0)} gr</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: "2rem", background: "#fff3cd", padding: "1rem", borderRadius: "8px", borderLeft: "4px solid #ffc107" }}>
            <h4 style={{ color: "#856404", marginTop: 0 }}>📝 Aplicación Paso a Paso</h4>
            <ol style={{ margin: 0, color: "#555", paddingLeft: "1.5rem" }}>
              <li>Lavar bien el raceway con solución de lejía y posteriormente con agua.</li>
              <li>Mezclar la <strong>Solución 1</strong> en los {invernaderoLiters} litros de agua y mezclar bien.</li>
              <li>Añadir posteriormente la <strong>Solución 2</strong>.</li>
              <li>Colocar aireación.</li>
              <li>Al segundo día colocar inóculo de agua verde.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  };

  const renderBrumacionGrid = () => {
    return (
      <div style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ background: "#f0f8ff", border: "2px solid #b3d4ff", borderRadius: "12px", padding: "1.5rem" }}>
          <h3 style={{ textAlign: "center", color: "#0056b3", marginBottom: "1.5rem", fontSize: "1.4rem" }}>
            ❄️ Vitrina Expositora de Brumación
          </h3>
          
          <div style={{ background: "#e6f2ff", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px dashed #99c2ff" }}>
            <h4 style={{ color: "#004085", marginBottom: "1rem", textAlign: "center" }}>Área Superior (Frio Positivo / Fotoperiodo)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
              {data.brumacion && data.brumacion.slice(0, 5).map((cell) => {
                const bg = selectedCell && selectedCell.cell.id === cell.id ? "#ffeeba" : "#ffffff";
                const border = cell.count > 0 ? "2px solid #0056b3" : "1px solid #ccc";
                return (
                  <div
                    key={cell.id}
                    onClick={() => handleCellClick(cell, "brumacion")}
                    style={{
                      background: bg,
                      border: border,
                      padding: "10px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                      minHeight: "80px",
                    }}
                  >
                    <div style={{ fontWeight: "bold", color: "#004085", marginBottom: "5px" }}>{cell.id}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: cell.count > 0 ? "#28a745" : "#ccc" }}>{cell.count} ud</div>
                    {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div style={{ background: "#343a40", padding: "1rem", borderRadius: "8px", border: "1px solid #1d2124" }}>
            <h4 style={{ color: "#f8f9fa", marginBottom: "1rem", textAlign: "center" }}>Área Inferior (Oscuridad y Frío)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
              {data.brumacion && data.brumacion.slice(5, 10).map((cell) => {
                const bg = selectedCell && selectedCell.cell.id === cell.id ? "#ffeeba" : "#495057";
                const border = cell.count > 0 ? "2px solid #17a2b8" : "1px solid #6c757d";
                return (
                  <div
                    key={cell.id}
                    onClick={() => handleCellClick(cell, "brumacion")}
                    style={{
                      background: bg,
                      border: border,
                      padding: "10px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      minHeight: "80px",
                    }}
                  >
                    <div style={{ fontWeight: "bold", color: "#f8f9fa", marginBottom: "5px" }}>{cell.id}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: cell.count > 0 ? "#17a2b8" : "#adb5bd" }}>{cell.count} ud</div>
                    {cell.obs && <div style={{ fontSize: "0.7rem", color: "#ced4da", marginTop: "4px" }}>{cell.obs}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdultasGrid = () => {
    const blocksConfig = [
      { left: [2.1, 2.2, 2.3], right: [5.1, 5.2, 5.3] },
      { left: [2.4, 2.5, 2.6], right: [5.4, 5.5, 5.6] },
      { left: [3.1, 3.2, 3.3], right: [6.1, 6.2, 6.3] },
      { left: [3.4, 3.5, 3.6], right: [6.4, 6.5, 6.6] },
    ];

    const currentBlock = blocksConfig[activeAdultasBloque - 1] || blocksConfig[0];
    const leftPrefix = currentBlock.left[activeAdultasPiso - 1];
    const rightPrefix = currentBlock.right[activeAdultasPiso - 1];

    const celdasIzquierda = [];
    for (let r = 10; r >= 1; r--) {
      const id = `${leftPrefix}.${r}`;
      celdasIzquierda.push(
        data.adultas.find((c) => c.id === id) || { id, count: 0 },
      );
    }

    const celdasDerecha = [];
    for (let r = 1; r <= 10; r++) {
      const id = `${rightPrefix}.${r}`;
      celdasDerecha.push(
        data.adultas.find((c) => c.id === id) || { id, count: 0 },
      );
    }

    return (
      <div
        className="metamorfosis-container group-section"
        style={{ marginBottom: "2rem" }}
      >
        <h2 className="group-title">🐸 Estructura de Ranas Adultas</h2>

        <div
          className="estructura-tabs"
          style={{ marginBottom: "10px", gap: "5px", flexWrap: "wrap" }}
        >
          {[
            { id: 1, label: "Estructura 2 (Izq-1)" },
            { id: 2, label: "Estructura 3 (Izq-2)" },
            { id: 3, label: "Estructura 5 (Der-1)" },
            { id: 4, label: "Estructura 6 (Der-2)" }
          ].map((est) => (
            <button
              key={est.id}
              className={`estructura-tab-btn ${activeAdultasBloque === est.id ? "active" : ""}`}
              style={{ padding: "0.5rem 0.8rem" }}
              onClick={() => setActiveAdultasBloque(est.id)}
            >
              {est.label}
            </button>
          ))}
        </div>

        <div className="estructura-tabs" style={{ gap: "5px" }}>
          <button
            className={`estructura-tab-btn ${activeAdultasPiso === 1 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveAdultasPiso(1)}
          >
            Piso Bajo
          </button>
          <button
            className={`estructura-tab-btn ${activeAdultasPiso === 2 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveAdultasPiso(2)}
          >
            Piso Medio
          </button>
          <button
            className={`estructura-tab-btn ${activeAdultasPiso === 3 ? "active" : ""}`}
            style={{ padding: "0.4rem 1rem" }}
            onClick={() => setActiveAdultasPiso(3)}
          >
            Piso Superior
          </button>
        </div>

        <div className="pasillo-central-layout">
          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              {leftPrefix} · Cuadrante 1 · {activeAdultasPiso === 1 ? "Piso Bajo" : activeAdultasPiso === 2 ? "Piso Medio" : "Piso Superior"}
            </h4>
            {celdasIzquierda.map((cell) => {
              const dens = OBTENER_DATOS_DENSIDAD(
                "adultas",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                  onClick={() => {
                    handleCellClick(cell, "adultas");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pasillo-visual">
            <div className="pasillo-text">
              P<br />A<br />S<br />I<br />L<br />L<br />O
            </div>
          </div>

          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              {rightPrefix} · Cuadrante 2 · {activeAdultasPiso === 1 ? "Piso Bajo" : activeAdultasPiso === 2 ? "Piso Medio" : "Piso Superior"}
            </h4>
            {celdasDerecha.map((cell) => {
              const dens = OBTENER_DATOS_DENSIDAD(
                "adultas",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${cell?.obs?.includes("[BLOQUEADO") ? "locked" : ""}`}
                  onClick={() => {
                    handleCellClick(cell, "adultas");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGridEstructura = () => {
    const filas = ["F7", "F6", "F5", "F4", "F3", "F2", "F1"];
    const columnas = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];

    return (
      <div className="grid-wrapper">
        <div className="grid-cols-label">
          <div></div>
          {columnas.map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        {filas.map((fila) => (
          <div key={fila} className="grid-row-container">
            <div className="grid-row-label">{fila}</div>

            {columnas.map((col) => {
              const cellId = `E${activeEstructura}-${fila}-${col}`;
              const cell = data.renacuajos.find((c) => c.id === cellId) || {
                id: cellId,
                count: 0,
                lastDate: "",
                type: "",
                dose: "",
                obs: "",
              };
              const dens = OBTENER_DATOS_DENSIDAD(
                "renacuajos",
                cell.id,
                cell.count,
              );
              const esOcupada = cell.count > 0;
              const gVal = parseFloat(cell.dose) || 0;
              const ratioVal =
                esOcupada && gVal > 0 ? (gVal / cell.count).toFixed(3) : null;

              let cellClass = "grid-cell";
              const isLocked = cell?.obs?.includes("[BLOQUEADO");
              const lockMatch = cell?.obs?.match(/\[BLOQUEADO(?:[:-]?\s*(.*?))?\]/);
              const lockReason = lockMatch && lockMatch[1] ? lockMatch[1] : "Bloqueado";
              
              if (isLocked) {
                cellClass += " locked";
                if (lockReason.toLowerCase().includes("repara")) {
                  cellClass += " reparar";
                }
              }
              
              if (esOcupada) {
                cellClass += " occupied";
                if (dens.estado === "advertencia")
                  cellClass += " density-warning";
                if (dens.estado === "peligro") cellClass += " density-danger";
              }

              let capacityColor = "#27ae60";
              let capacityText = `Disp: ${300 - cell.count}`;
              if (300 - cell.count === 0) {
                capacityColor = "#e67e22";
                capacityText = "COMPLETO";
              } else if (300 - cell.count < 0) {
                capacityColor = "#e74c3c";
                capacityText = `Exc: ${Math.abs(300 - cell.count)}`;
              }

              return (
                <div
                  key={cellId}
                  className={cellClass}
                  onClick={() => handleCellClick(cell, "renacuajos")}
                  title={
                    esOcupada
                      ? `Celda ${fila}-${col}: ${cell.count} ud., ${gVal}g, Estado: ${cell.type || "Ninguno"}`
                      : `Celda ${fila}-${col} (Haga clic para poblar)`
                  }
                >
                  <span className="grid-cell-id">
                    {fila}-{col} {isLocked && (lockReason.toLowerCase().includes("repara") ? "🔧" : "🔒")}
                  </span>
                  {isLocked && (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "#fff",
                        background: lockReason.toLowerCase().includes("repara") ? "#d35400" : "#c23616",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        marginTop: "2px",
                        marginBottom: "2px",
                        textAlign: "center",
                        display: "block",
                      }}
                    >
                      {lockReason.toLowerCase().includes("repara") ? "🔧 REPARAR" : lockReason}
                    </span>
                  )}
                  {esOcupada ? (
                    <>
                      <span className="grid-cell-count">
                        {cell.count}{" "}
                        <span style={{ fontSize: "0.6rem" }}>ud</span>
                      </span>
                      {gVal > 0 && (
                        <span className="grid-cell-weight">{gVal}g</span>
                      )}
                      {ratioVal && (
                        <span className="grid-cell-ratio">{ratioVal} g/u</span>
                      )}
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: capacityColor,
                          fontWeight: "bold",
                          marginTop: "2px",
                        }}
                      >
                        {capacityText}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="grid-cell-empty">+</span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "#27ae60",
                          fontWeight: "bold",
                          marginTop: "2px",
                        }}
                      >
                        Libres: 300
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Logica de Alarma de Desparasitacion
  const obtenerAlarmasTratamientos = () => {
    const alarmas = [];
    const hoy = new Date();
    
    // Buscar tratamientos de desparasitacion externa (primera dosis)
    const desparasitaciones = tratamientos.filter(t => 
      t.tipo && t.tipo.toLowerCase().includes("desparasita") && t.tipo.toLowerCase().includes("externa")
    );
    
    // Agrupar por tanque y fecha
    const tratsPorTanque = {};
    desparasitaciones.forEach(t => {
      if (!tratsPorTanque[t.tanque]) tratsPorTanque[t.tanque] = [];
      tratsPorTanque[t.tanque].push(t);
    });

    Object.keys(tratsPorTanque).forEach(tanqueId => {
      // Ordenar por fecha descendente
      const trats = tratsPorTanque[tanqueId].sort((a, b) => {
        const [dA, mA, yA] = a.fecha.split('/');
        const [dB, mB, yB] = b.fecha.split('/');
        return new Date(yB, mB - 1, dB) - new Date(yA, mA - 1, dA);
      });

      if (trats.length > 0) {
        const ultimoTrat = trats[0];
        const [d, m, y] = ultimoTrat.fecha.split('/');
        const fechaUltimo = new Date(y, m - 1, d);
        const diasPasados = Math.floor((hoy - fechaUltimo) / (1000 * 60 * 60 * 24));
        
        // Si hace entre 6 y 8 dias que se dio una desparasitacion
        if (diasPasados >= 6 && diasPasados <= 8) {
          alarmas.push(tanqueId);
        }
      }
    });

    return alarmas;
  };

  const alarmasDesparasitacion = obtenerAlarmasTratamientos() || [];

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

    tratamientos.forEach(t => {
      const fecha = parseFecha(t.fecha);
      if (fecha >= hace7Dias) {
        const tipo = (t.tipo || "").toLowerCase();
        const isHoy = fecha >= hoyDate;
        
        if (t.tipo === "Baja") {
          const val = parseInt(t.dosis, 10) || 0;
          bajasSemana += val;
          if (isHoy) bajasHoy += val;
        } else if (
          !tipo.includes("traslado") && 
          !tipo.includes("salida") && 
          !tipo.includes("ajuste") &&
          !tipo.includes("ingreso") &&
          !tipo.includes("actualizaci") &&
          t.tipo !== "Baja"
        ) {
          tratamientosSemana++;
          if (isHoy) tratamientosHoy++;
        }
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
        <button
          className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          📊 Tablero de Mando
        </button>
        <button
          className={`nav-btn ${activeTab === "adultos" ? "active" : ""}`}
          onClick={() => setActiveTab("adultos")}
        >
          🐸 Ranas Adultas
        </button>
        <button
          className={`nav-btn ${activeTab === "reproduccion" ? "active" : ""}`}
          onClick={() => setActiveTab("reproduccion")}
        >
          💕 Reproducción
        </button>
        <button
          className={`nav-btn ${activeTab === "laboratorio" ? "active" : ""}`}
          onClick={() => setActiveTab("laboratorio")}
        >
          🔬 Laboratorio
        </button>
        <button
          className={`nav-btn ${activeTab === "invernadero" ? "active" : ""}`}
          onClick={() => setActiveTab("invernadero")}
        >
          🪴 Invernadero
        </button>
        <button
          className={`nav-btn ${activeTab === "brumacion" ? "active" : ""}`}
          onClick={() => setActiveTab("brumacion")}
        >
          ❄️ Brumación
        </button>
        <button
          className={`nav-btn ${activeTab === "incubadoras" ? "active" : ""}`}
          onClick={() => setActiveTab("incubadoras")}
        >
          🥚 Incubadoras
        </button>
        <button
          className={`nav-btn ${activeTab === "tratamientos" ? "active" : ""}`}
          onClick={() => setActiveTab("tratamientos")}
        >
          💊 Tratamientos
        </button>
        <button
          className={`nav-btn ${activeTab === "incidencias" ? "active" : ""}`}
          onClick={() => setActiveTab("incidencias")}
          style={activeTab === "incidencias" ? {} : (incidencias.some(i => i.estado !== "Cerrada") ? { background: "#fdecea", color: "#c0392b" } : {})}
        >
          🚨 Incidencias{incidencias.filter(i => i.estado !== "Cerrada").length > 0 ? ` (${incidencias.filter(i => i.estado !== "Cerrada").length})` : ""}
        </button>
        <button
          className={`nav-btn ${activeTab === "renacuajos" ? "active" : ""}`}
          onClick={() => setActiveTab("renacuajos")}
        >
          🦠 Renacuajos
        </button>
        <button
          className={`nav-btn ${activeTab === "historial" ? "active" : ""}`}
          onClick={() => setActiveTab("historial")}
        >
          📋 Historiales y Reportes
        </button>
        <button
          className={`nav-btn ${activeTab === "reportes" ? "active" : ""}`}
          onClick={() => setActiveTab("reportes")}
        >
          📈 Exportar Excel
        </button>
        <button
          className={`nav-btn ${activeTab === "alimentacion" ? "active" : ""}`}
          onClick={() => setActiveTab("alimentacion")}
          style={activeTab === "alimentacion" ? {} : { background: "#e8f5e9", color: "#2e7d32" }}
        >
          🌿 Alimentación
        </button>
        <button
          className={`nav-btn ${activeTab === "inventario" ? "active" : ""}`}
          onClick={() => setActiveTab("inventario")}
        >
          📦 Almacén
        </button>
        <button
          className={`nav-btn ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          ⚙️ Ajustes de Nube
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
          {renderReproduccionGrid()}
        </div>
      )}

      {activeTab === "laboratorio" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderLaboratorioGrid()}
        </div>
      )}

      {activeTab === "invernadero" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderInvernaderoGrid()}
        </div>
      )}

      {activeTab === "brumacion" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderBrumacionGrid()}
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
            <div style={{ textAlign: "center", flex: "1 1 90px" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: "#f1c40f" }}>{resumen.puestasSemana}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>🥚 puestas / 7d</div>
              {resumen.puestasHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#f1c40f", marginTop: "2px" }}>+{resumen.puestasHoy} hoy</div>}
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Bajas */}
            <div style={{ textAlign: "center", flex: "1 1 90px" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: bajasHoy > 0 ? "#e74c3c" : "#aaa" }}>{bajasHoy}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>💀 bajas hoy</div>
              {bajasHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#e74c3c", marginTop: "2px" }}>{pctBajasHoy}% censo · ayer {bajasAyer}</div>}
            </div>

            <div style={{ width: "1px", height: "44px", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {/* Tratamientos */}
            <div style={{ textAlign: "center", flex: "1 1 90px" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: "800", lineHeight: 1, color: "#3498db" }}>{resumen.tratamientosSemana}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.65, textTransform: "uppercase", marginTop: "2px" }}>💊 trat. / 7d</div>
              {resumen.tratamientosHoy > 0 && <div style={{ fontSize: "0.6rem", color: "#3498db", marginTop: "2px" }}>+{resumen.tratamientosHoy} hoy</div>}
            </div>
          </div>

          {/* ── 2. FRANJA DE ALERTAS (sólo visible si hay algo) ─────── */}
          {(() => {
            const alertas = [];

            // Alarma 2ª dosis desparasitación
            if (alarmasDesparasitacion.length > 0) {
              alertas.push({
                nivel: "critico",
                icono: "💉",
                texto: `2ª dosis requerida: ${alarmasDesparasitacion.join(", ")}`,
              });
            }

            // Mortalidad por raceway — dos ventanas de tiempo
            const hace48h = new Date(); hace48h.setDate(hace48h.getDate() - 2);
            const hace5d  = new Date(); hace5d.setDate(hace5d.getDate() - 5);
            const bajas48h = {}, bajas5d = {};
            tratamientos.forEach(t => {
              if (t.tipo === "Baja") {
                const parts = (t.fecha || "").split("/");
                const f = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date(t.fecha);
                if (isNaN(f)) return;
                const cant = parseInt(t.dosis, 10) || 0;
                if (f >= hace48h) bajas48h[t.tanque] = (bajas48h[t.tanque] || 0) + cant;
                if (f >= hace5d)  bajas5d[t.tanque]  = (bajas5d[t.tanque]  || 0) + cant;
              }
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

          {/* ── 4. ACTIVIDAD RECIENTE (2 columnas) ───────────────────── */}
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
                items={tratamientos.filter((t) => {
                  const tipo = (t.tipo || "").toLowerCase();
                  return !(
                    tipo.includes("baja") || tipo.includes("traslado") ||
                    tipo.includes("salida") || tipo.includes("ajuste") ||
                    tipo.includes("ingreso") || tipo.includes("actualizaci")
                  );
                })}
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
          {(() => {
            const renderedIds = new Set();
            return renderAdultasGrid(renderedIds);
          })()}

          {renderUCIGrid()}
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
                        {cell?.obs?.includes("[BLOQUEADO") ? "🔒" : ""}
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
            {(() => {
              const renderedIds = new Set();
              return renderGridEstructura(renderedIds);
            })()}
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
          {renderMetamorfoseadasGrid()}
        </div>
      )}

      {/* Sección 4: Historiales y Reportes Completos */}
            {activeTab === "tratamientos" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderTratamientosMasivos()}
        </div>
      )}

      {activeTab === "incidencias" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderIncidencias()}
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
              items={tratamientos.filter((t) => {
                const tipo = (t.tipo || "").toLowerCase();
                return !(
                  tipo.includes("baja") || 
                  tipo.includes("traslado") || 
                  tipo.includes("salida") || 
                  tipo.includes("ajuste") ||
                  tipo.includes("ingreso") ||
                  tipo.includes("actualizaci")
                );
              })}
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
              items={tratamientos.filter((t) => {
                const tipo = (t.tipo || "").toLowerCase();
                return (
                  tipo.includes("baja") || 
                  tipo.includes("traslado") || 
                  tipo.includes("salida") || 
                  tipo.includes("ajuste") ||
                  tipo.includes("ingreso") ||
                  tipo.includes("actualizaci")
                );
              })}
              onBorrar={(id) =>
                borrarItem(tratamientos, setTratamientos, id, "tratamiento")
              }
              isPuesta={false}
            />
          </div>
        </div>
      )}


      {activeTab === "alimentacion" && (
        <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
          {renderAlimentacion()}
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
                  <div style={{ display: "grid", gridTemplateColumns: modalTratCategoria === "alimento" ? "2fr 1fr 80px" : "2fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
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
                          : "Nombre del producto..."}
                        value={modalTratTipo}
                        onChange={(e) => setModalTratTipo(e.target.value)}
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "0.78rem" }}>
                        {modalTratCategoria === "alimento" ? "Gramos / toma"
                          : modalTratCategoria === "mantenimiento" ? "Producto usado (opcional)"
                          : "Dosis por aplicación"}
                      </label>
                      <input
                        type="text"
                        placeholder={modalTratCategoria === "alimento" ? "ej: 5g" : "5g, 2ml..."}
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
                  </div>

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
                  const tipo = (t.tipo || "").toLowerCase();
                  // excluir bajas, salidas, ajustes de censo
                  return tid === cellId && !(
                    tipo.includes("baja") || tipo.includes("salida") ||
                    tipo.includes("ajuste") || tipo.includes("ingreso") || tipo.includes("actualizaci")
                  );
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
                                  <input type="text" value={item.producto || ""} placeholder="Producto..."
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

function Section({ title, items, grupo, onBaja, onPuesta, onTrat, onUpdate }) {
  if (!items || items.length === 0) return null;
  return (
    <div
      className="group-section"
      style={{ animation: "fadeIn 0.25s ease-out" }}
    >
      <h2 className="group-title">{title}</h2>
      <div className="structure-grid">
        {items.map((item) => (
          <div key={item.id} className="structure-card extended">
            <div className="card-top">
              <span className="id-badge">{item.id}</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <input
                  type="number"
                  value={item.count}
                  onChange={(e) =>
                    onUpdate(
                      item.id,
                      "count",
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10) || 0,
                    )
                  }
                  style={{
                    width: "65px",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    textAlign: "center",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#666",
                    fontWeight: "bold",
                  }}
                >
                  ud.
                </span>
              </div>
              <div className="btn-group">
                {onPuesta && (
                  <button
                    className="btn-puesta"
                    onClick={() => onPuesta(item.id)}
                    title="Registrar puesta de huevos"
                  >
                    + Puesta
                  </button>
                )}
                <button
                  className="btn-trat"
                  onClick={() => onTrat(item.id, item.type, item.dose)}
                  title="Aplicar un tratamiento"
                >
                  Tratar
                </button>
                <button
                  className="btn-baja"
                  onClick={() => onBaja(item.id)}
                  title="Registrar baja de un individuo"
                >
                  Baja
                </button>
              </div>
            </div>

            {/* Ficha técnica y cálculo de densidad */}
            {(() => {
              const dens = OBTENER_DATOS_DENSIDAD(grupo, item.id, item.count);
              return (
                <div
                  style={{
                    padding: "0.2rem 0.5rem",
                    background: "#fcfdfc",
                    borderRadius: "8px",
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                      fontSize: "0.8rem",
                      color: "#555",
                    }}
                  >
                    <span>
                      Densidad: <strong>{dens.actual}</strong> / {dens.maxima}{" "}
                      <span style={{ fontSize: "0.7rem", color: "#888" }}>
                        {dens.unidad}
                      </span>
                    </span>
                    <span
                      className={`density-badge ${dens.estado}`}
                      style={{ fontSize: "0.7rem" }}
                    >
                      {dens.porcentaje}% cap.
                    </span>
                  </div>
                  <div className="progress-bg" style={{ height: "6px" }}>
                    <div
                      className={`progress-bar ${dens.estado}`}
                      style={{ width: `${Math.min(dens.porcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="card-fields three-cols">
              <div className="input-group">
                <label>Último Trat.</label>
                <input
                  type="date"
                  value={item.lastDate || ""}
                  onChange={(e) =>
                    onUpdate(item.id, "lastDate", e.target.value)
                  }
                />
              </div>
              <div className="input-group">
                <label>Tratamiento / Alimento</label>
                {grupo === "renacuajos" || grupo === "metamorfoseadas" ? (
                  <input
                    type="text"
                    value={item.type || ""}
                    onChange={(e) => onUpdate(item.id, "type", e.target.value)}
                    placeholder="Alimento/Sal..."
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      fontSize: "0.85rem",
                    }}
                  />
                ) : (
                  <select
                    value={item.type || ""}
                    onChange={(e) => onUpdate(item.id, "type", e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      height: "28px",
                    }}
                  >
                    <option value="">Ninguno</option>
                    <option value="Sal">Sal</option>
                    <option value="Antibiótico/Ganadexil">
                      Antibiótico/Ganadexil
                    </option>
                    <option value="Levamisol">Levamisol</option>
                  </select>
                )}
              </div>
              <div className="input-group">
                <label>Dosis / Fase</label>
                <input
                  type="text"
                  value={item.dose || ""}
                  onChange={(e) => onUpdate(item.id, "dose", e.target.value)}
                  placeholder="ej: 0.0125 / 5g"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableHistory({ items, onBorrar, isPuesta, isDashboard = false }) {
  const [filtro, setFiltro] = useState("");
  const [expandido, setExpandido] = useState(false);

  if (items.length === 0)
    return (
      <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>
        Aún no hay registros.
      </p>
    );

  const filtrados = items.filter(
    (p) =>
      (p.fecha || "").includes(filtro) ||
      (p.tanque || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (p.tipo || "").toLowerCase().includes(filtro.toLowerCase()),
  );

  const limite = isDashboard ? 3 : expandido ? filtrados.length : 3;
  const mostrados = filtrados.slice(0, limite);

  const emojiCat = (cat = "") => {
    const c = cat.toLowerCase();
    if (c.includes("antibi") || c.includes("medicament")) return "💊";
    if (c.includes("preventiv") || c.includes("vitamina") || c.includes("suplemento")) return "🛡️";
    if (c.includes("desparasit")) return "🧴";
    if (c.includes("hormona") || c.includes("induccion") || c.includes("inducción")) return "💉";
    if (c.includes("mantenimiento") || c.includes("limpieza") || c.includes("desinfec")) return "🧹";
    if (c.includes("aliment") || c === "alimento") return "🌿";
    return "💊";
  };
  const chipCat = (cat = "") => {
    const c = cat.toLowerCase();
    if (c.includes("antibi") || c.includes("medicament")) return { bg: "#fdecea", color: "#c0392b" };
    if (c.includes("desparasit")) return { bg: "#f0e6ff", color: "#6c3483" };
    if (c.includes("hormona") || c.includes("induccion") || c.includes("inducción")) return { bg: "#fef9e7", color: "#d4ac0d" };
    if (c.includes("preventiv") || c.includes("vitamina") || c.includes("suplemento")) return { bg: "#eaf3fb", color: "#1a5276" };
    if (c.includes("mantenimiento") || c.includes("limpieza") || c.includes("desinfec")) return { bg: "#eef2f5", color: "#34495e" };
    return { bg: "#e8f8f0", color: "#1a7a40" }; // alimento
  };

  return (
    <div>
      {!isDashboard && (
        <div
          style={{
            marginBottom: "1rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="🔍 Buscar por fecha o tanque..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              flex: 1,
            }}
          />
          <button
            className="btn-guardar"
            onClick={() => setExpandido(!expandido)}
            style={{ padding: "0.5rem 1rem" }}
          >
            {expandido ? "Colapsar (Ver 3)" : "Ver Todos"}
          </button>
        </div>
      )}
      <table className="history-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tanque</th>
            {isPuesta ? (
              <th>Detalles</th>
            ) : (
              <>
                <th>Categoría / Tratamiento</th>
                <th>Dosis</th>
                {!isDashboard && <th>Frecuencia / Pauta</th>}
              </>
            )}
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {mostrados.map((p) => (
            <React.Fragment key={p.id}>
              <tr>
                <td>{p.fecha}</td>
                <td>{p.hora}</td>
                <td>
                  <span
                    className="id-badge"
                    style={{ padding: "0.1rem 0.5rem", fontSize: "0.8rem" }}
                  >
                    {p.tanque}
                  </span>
                </td>
                {isPuesta ? (
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                      {p.destino && (
                        <span style={{ fontSize: "0.78rem", color: "#555" }}>📦 {p.destino}</span>
                      )}
                      {p.tipo_puesta && (
                        <span style={{ background: "#eaf0ff", color: "#2c5282", borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem" }}>{p.tipo_puesta}</span>
                      )}
                      {p.estado && (
                        <span style={{
                          background: p.estado === "Buena" ? "#eaf4ea" : p.estado === "Regular" ? "#fef9e7" : "#fdecea",
                          color: p.estado === "Buena" ? "#27ae60" : p.estado === "Regular" ? "#e67e22" : "#c0392b",
                          borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem"
                        }}>● {p.estado}</span>
                      )}
                      {p.huevos && (
                        <span style={{ color: "#555", fontSize: "0.78rem" }}>🥚 {p.huevos}</span>
                      )}
                      {!p.destino && !p.tipo_puesta && !p.estado && !p.huevos && (
                        <span style={{ color: "#888" }}>{p.grupo || "—"}</span>
                      )}
                    </div>
                  </td>
                ) : (
                  <>
                    <td>
                      {p.tipo === "Baja" ? (
                        <span style={{ fontWeight: "bold", color: "var(--rojo-alerta)" }}>💀 Baja registrada</span>
                      ) : (() => {
                        let cat = p.categoria || "";
                        let producto = p.tipo || "";
                        // Old masivo format: "Categoría: Producto (pauta)" → split
                        if (!cat && producto.includes(":")) {
                          const idx = producto.indexOf(":");
                          cat = producto.slice(0, idx).trim();
                          producto = producto.slice(idx + 1).trim();
                        }
                        const chip = chipCat(cat);
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                            {cat && (
                              <span style={{ background: chip.bg, color: chip.color, borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem", fontWeight: "500", whiteSpace: "nowrap" }}>
                                {emojiCat(cat)} {cat}
                              </span>
                            )}
                            <span style={{ fontSize: "0.85rem" }}>{producto || "—"}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td>{p.dosis || "—"}</td>
                    {!isDashboard && (
                      <td style={{ fontSize: "0.78rem", color: "#555" }}>
                        {p.frecuencia ? (
                          <span>
                            🕐 {p.frecuencia}
                            {p.numDosis ? <strong> × {p.numDosis} dosis</strong> : ""}
                          </span>
                        ) : (
                          <span style={{ color: "#bbb" }}>—</span>
                        )}
                      </td>
                    )}
                  </>
                )}
                <td>
                  <button
                    className="btn-baja-mini"
                    onClick={() =>
                      onBorrar(p.id, isPuesta ? "puesta" : "tratamiento")
                    }
                  >
                    Borrar
                  </button>
                </td>
              </tr>
              {/* Observaciones de puesta */}
              {!isDashboard && isPuesta && p.obs && (
                <tr style={{ background: "#fffef0" }}>
                  <td colSpan={5} style={{ fontSize: "0.78rem", color: "#7f6a00", paddingLeft: "2.5rem", paddingTop: "2px", paddingBottom: "6px", borderTop: "none", fontStyle: "italic" }}>
                    💬 {p.obs}
                  </td>
                </tr>
              )}
              {/* Notas clínicas de tratamiento */}
              {!isDashboard && !isPuesta && p.notas && (
                <tr style={{ background: "#fffef0" }}>
                  <td
                    colSpan={7}
                    style={{
                      fontSize: "0.78rem",
                      color: "#7f6a00",
                      paddingLeft: "2.5rem",
                      paddingTop: "2px",
                      paddingBottom: "6px",
                      borderTop: "none",
                      fontStyle: "italic",
                    }}
                  >
                    📝 {p.notas}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {filtrados.length === 0 && (
            <tr>
              <td colSpan={isPuesta ? 5 : isDashboard ? 6 : 7} style={{ textAlign: "center", color: "#888" }}>
                No hay resultados para la búsqueda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
