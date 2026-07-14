import * as XLSX from "xlsx";

// Importador del Excel "Control de Bañeras" que comparte la persona que
// lleva el día a día de los renacuajos. El archivo sigue siempre el mismo
// patrón (una hoja por Estructura, 7 filas x 9 columnas, 4 datos por celda):
//
//   Fila "FILA 7"  | Gramos Totales  | <valor C1> | <valor C2> | ...
//                  | Media (g/ud)    | <valor C1> | <valor C2> | ...
//                  | Unidades (Auto) | <valor C1> | <valor C2> | ...
//                  | Estado          | <valor C1> | <valor C2> | ...
//   Fila "FILA 6"  | ...
//
// Se mapea 1:1 con las celdas E{estructura}-F{fila}-C{columna} que ya usa
// gestor-granja para la cuadrícula de renacuajos.

const CONCEPTO_A_CAMPO = {
  "gramos totales": "dose",
  "media (g/ud)": "pesoMedio",
  "unidades (auto)": "count",
  "estado": "obs",
};

const NUM_COLUMNAS = 9;

// Lee el workbook (ArrayBuffer) y devuelve un mapa id -> { count, dose, pesoMedio, obs }.
// Es intencionadamente "todo o nada" por celda: si una hoja/fila del Excel
// trae una celda vacía, se traduce a "" / 0 (no se deja el campo sin tocar),
// porque el Excel es la fuente de verdad en cada importación.
export const parsearExcelRenacuajos = (arrayBuffer) => {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const actualizaciones = {};

  wb.SheetNames.forEach((sheetName) => {
    const mEst = sheetName.match(/Estructura\s*(\d+)/i);
    if (!mEst) return;
    const estructura = mEst[1];

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    let filaActual = null;
    rows.forEach((row) => {
      const colA = String(row[0] || "").trim();
      const mFila = colA.match(/FILA\s*(\d+)/i);
      if (mFila) filaActual = mFila[1];
      if (!filaActual) return;

      const concepto = String(row[1] || "").trim().toLowerCase();
      const campo = CONCEPTO_A_CAMPO[concepto];
      if (!campo) return;

      for (let col = 1; col <= NUM_COLUMNAS; col++) {
        const valor = row[1 + col];
        const id = `E${estructura}-F${filaActual}-C${col}`;
        if (!actualizaciones[id]) actualizaciones[id] = {};

        if (campo === "count") {
          actualizaciones[id][campo] = parseInt(valor, 10) || 0;
        } else if (campo === "obs") {
          actualizaciones[id][campo] = valor ? String(valor).trim() : "";
        } else {
          // dose, pesoMedio: se guardan como texto, igual que ya hace el
          // resto de la app (compatibles con parseFloat cuando haga falta).
          actualizaciones[id][campo] =
            valor === "" || valor === undefined || valor === null
              ? ""
              : String(valor);
        }
      }
    });
  });

  return actualizaciones;
};

// Aplica el mapa de actualizaciones sobre la lista actual de renacuajos,
// sobrescribiendo count/dose/pesoMedio/obs de las celdas presentes en el
// Excel. Las celdas que no aparecen en el mapa (por ejemplo si el Excel no
// trae una Estructura completa) se dejan tal cual.
export const aplicarActualizacionesRenacuajos = (renacuajosList, actualizaciones) => {
  return (renacuajosList || []).map((item) => {
    const upd = actualizaciones[item.id];
    if (!upd) return item;
    return {
      ...item,
      count: upd.count !== undefined ? upd.count : item.count,
      dose: upd.dose !== undefined ? upd.dose : item.dose,
      pesoMedio: upd.pesoMedio !== undefined ? upd.pesoMedio : item.pesoMedio,
      obs: upd.obs !== undefined ? upd.obs : item.obs,
    };
  });
};
