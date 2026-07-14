import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsearExcelRenacuajos, aplicarActualizacionesRenacuajos } from "./importRenacuajos";

// Construye un workbook en memoria con la misma forma que el Excel real
// ("Control de Bañeras"), para no depender de un archivo externo.
const construirWorkbookPrueba = (hojas) => {
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, filas]) => {
    const ws = XLSX.utils.aoa_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf;
};

const filasEstructura1 = [
  ["📊 CONTROL DE BAÑERAS - ESTRUCTURA 1"],
  ["ESTRUCTURA", "CONCEPTO", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"],
  ["FILA 7", "Gramos Totales", 90, 30, "", "", "", "", "", "", ""],
  ["", "Media (g/ud)", 0.3, 0.1, "", "", "", "", "", "", ""],
  ["", "Unidades (Auto)", 300, 300, 0, 0, 0, 0, 0, 0, 0],
  ["", "Estado", "Dejar", "", "", "Bajar", "", "", "", "", ""],
  ["FILA 6", "Gramos Totales", "", "", "", "", "", "", "", "", ""],
  ["", "Media (g/ud)", "", "", "", "", "", "", "", "", ""],
  ["", "Unidades (Auto)", 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ["", "Estado", "", "", "", "", "", "", "", "", ""],
];

describe("parsearExcelRenacuajos", () => {
  it("mapea cada columna Cn de una FILA a la celda E{est}-F{fila}-C{n}", () => {
    const buf = construirWorkbookPrueba({ "Estructura 1": filasEstructura1 });
    const resultado = parsearExcelRenacuajos(buf);

    expect(resultado["E1-F7-C1"]).toEqual({
      dose: "90",
      pesoMedio: "0.3",
      count: 300,
      obs: "Dejar",
    });
    expect(resultado["E1-F7-C2"].count).toBe(300);
    expect(resultado["E1-F7-C4"].obs).toBe("Bajar");
  });

  it("celdas vacías se traducen a count 0 y texto vacío, no se omiten", () => {
    const buf = construirWorkbookPrueba({ "Estructura 1": filasEstructura1 });
    const resultado = parsearExcelRenacuajos(buf);

    expect(resultado["E1-F6-C1"]).toEqual({
      dose: "",
      pesoMedio: "",
      count: 0,
      obs: "",
    });
  });

  it("ignora hojas que no se llaman Estructura N", () => {
    const buf = construirWorkbookPrueba({ "Notas": [["hola", "mundo"]] });
    const resultado = parsearExcelRenacuajos(buf);
    expect(Object.keys(resultado)).toHaveLength(0);
  });

  it("distingue estructuras distintas aunque la fila/columna coincidan", () => {
    const buf = construirWorkbookPrueba({
      "Estructura 1": filasEstructura1,
      "Estructura 2": filasEstructura1,
    });
    const resultado = parsearExcelRenacuajos(buf);
    expect(resultado["E1-F7-C1"].count).toBe(300);
    expect(resultado["E2-F7-C1"].count).toBe(300);
    expect(Object.keys(resultado).length).toBeGreaterThan(9);
  });
});

describe("aplicarActualizacionesRenacuajos", () => {
  it("sobrescribe count/dose/pesoMedio/obs de las celdas presentes en el mapa", () => {
    const lista = [
      { id: "E1-F7-C1", count: 1, dose: "1", pesoMedio: "1", obs: "viejo", grupo: "renacuajos" },
      { id: "E1-F7-C2", count: 2, dose: "2", pesoMedio: "2", obs: "sin tocar", grupo: "renacuajos" },
    ];
    const actualizaciones = {
      "E1-F7-C1": { count: 300, dose: "90", pesoMedio: "0.3", obs: "Dejar" },
    };
    const resultado = aplicarActualizacionesRenacuajos(lista, actualizaciones);

    expect(resultado[0]).toEqual({
      id: "E1-F7-C1", count: 300, dose: "90", pesoMedio: "0.3", obs: "Dejar", grupo: "renacuajos",
    });
    // La celda que no aparece en el Excel importado se deja intacta.
    expect(resultado[1]).toEqual(lista[1]);
  });

  it("no falla con lista vacía o nula", () => {
    expect(aplicarActualizacionesRenacuajos([], {})).toEqual([]);
    expect(aplicarActualizacionesRenacuajos(null, {})).toEqual([]);
  });
});
