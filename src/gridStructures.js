import { normalizarId } from "./utils";

export const generarCeldasIncubadoras = () => {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `INC-${i + 1}`,
    count: 0,
    type: "",
    obs: "",
    lastDate: "",
    dose: "",
  }));
};

export const asegurarEstructurasIncubadoras = (incList, corruptosAccumulator) => {
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

export const generarCeldasGrid = () => {
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

export const asegurarEstructurasRenacuajos = (
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

export const generarCeldasMetamorfoseadas = () => {
  const list = [];
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

export const asegurarEstructurasMetamorfoseadas = (metaList, corruptosAccumulator) => {
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

export const generarCeldasReproduccion = () => {
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

export const asegurarEstructurasReproduccion = (reproList, corruptosAccumulator) => {
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
      uniqueMap[item.id] = item;
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

export const generarCeldasAdultas = () => {
  const list = [];
  const blocks = [
    { name: "Bloque 1", left: [2.1, 2.2, 2.3], right: [5.1, 5.2, 5.3] },
    { name: "Bloque 2", left: [2.4, 2.5, 2.6], right: [5.4, 5.5, 5.6] },
    { name: "Bloque 3", left: [3.1, 3.2, 3.3], right: [6.1, 6.2, 6.3] },
    { name: "Bloque 4", left: [3.4, 3.5, 3.6], right: [6.4, 6.5, 6.6] },
  ];

  blocks.forEach((block) => {
    for (let p = 3; p >= 1; p--) {
      const idx = p - 1;
      const leftPrefix = block.left[idx];
      const rightPrefix = block.right[idx];

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

export const asegurarEstructurasAdultas = (dataLocal, corruptosAccumulator) => {
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


export const generarCeldasUCI = () => {
  const list = [];

  for (let i = 1; i <= 10; i++)
    list.push({
      id: `UCI-Izq-${i}`,
      count: 0,
      lastDate: "",
      type: "",
      dose: "",
      obs: "Nave Verde",
    });

  for (let i = 1; i <= 10; i++)
    list.push({
      id: `UCI-Cen-${i}`,
      count: 0,
      lastDate: "",
      type: "",
      dose: "",
      obs: "Nave Verde",
    });

  list.push({
    id: `UCI-Der-1`,
    count: 0,
    lastDate: "",
    type: "",
    dose: "",
    obs: "Nave Verde",
  });

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

export const asegurarEstructurasNaveVerde = (naveVerdeList, corruptosAccumulator) => {
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

  list.forEach((item) => {
    item.id = (item.id || "").trim();

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
    else if (item.id === "RW-13") {
      item.id = "UCI-Der-1";
    }
    else if (/^RW-([1-9]|10)$/.test(item.id)) {
      const num = item.id.match(/^RW-(\d+)$/)[1];
      item.id = `UCI-Cen-${num}`;
    }
  });

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

export const generarCeldasBrumacion = () => {
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

export const asegurarEstructurasBrumacion = (data = []) => {
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

export const generarCeldasInvernadero = () => [
  { id: "Termoarcilla-1", count: 0, lastDate: "", type: "", dose: "", obs: "Piscina Agua Verde 1", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Termoarcilla-2", count: 0, lastDate: "", type: "", dose: "", obs: "Piscina Agua Verde 2", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Charca-Grande", count: 0, lastDate: "", type: "", dose: "", obs: "Charca Cría Daphnia (Grande)", ph: "", no3: "", no2: "", aireacion: "" },
  { id: "Charca-Pequeña", count: 0, lastDate: "", type: "", dose: "", obs: "Charca Cría Daphnia (Pequeña)", ph: "", no3: "", no2: "", aireacion: "" }
];

export const asegurarEstructurasInvernadero = (data = []) => {
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

export const DEFAULT_DATA = {
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
