import { describe, it, expect } from "vitest";
import {
  normalizarId, lockIcon, lockClass,
  parseSubgrupos, serializeSubgrupos,
  normalizarFecha, parseCellId, parseFechaTrat,
  esEventoNoTratamiento,
  evaluarSemaforoClinico, construirBloqueSemaforo, extraerSemaforoDeNotas,
  construirNotaPeso, extraerPesoDeNotas,
} from "./utils";

describe("normalizarId", () => {
  it("removes quotes and spaces", () => {
    expect(normalizarId('" 2.4.10 "')).toBe("2.4.10");
  });
  it("keeps alphanumeric, dots and dashes", () => {
    expect(normalizarId("UCI-Cen-5")).toBe("UCI-Cen-5");
  });
  it("returns empty for null/undefined", () => {
    expect(normalizarId(null)).toBe("");
    expect(normalizarId(undefined)).toBe("");
  });
});

describe("lockIcon", () => {
  it("returns empty when not blocked", () => {
    expect(lockIcon("normal obs")).toBe("");
    expect(lockIcon("")).toBe("");
    expect(lockIcon(null)).toBe("");
  });
  it("returns sanitize icon for desinfectar", () => {
    expect(lockIcon("[BLOQUEADO: Desinfectar]")).toBe("🧴");
  });
  it("returns wrench for reparar", () => {
    expect(lockIcon("[BLOQUEADO: Reparación]")).toBe("🔧");
  });
  it("returns lock for generic block", () => {
    expect(lockIcon("[BLOQUEADO: Revisar]")).toBe("🔒");
  });
});

describe("lockClass", () => {
  it("returns empty when not blocked", () => {
    expect(lockClass("")).toBe("");
  });
  it("returns desinfectar class", () => {
    expect(lockClass("[BLOQUEADO: Desinfectar]")).toBe("locked desinfectar");
  });
  it("returns reparar class", () => {
    expect(lockClass("[BLOQUEADO: Reparación]")).toBe("locked reparar");
  });
  it("returns generic locked class", () => {
    expect(lockClass("[BLOQUEADO: Revisar]")).toBe("locked");
  });
});

describe("parseSubgrupos / serializeSubgrupos", () => {
  it("returns empty for null", () => {
    expect(parseSubgrupos(null)).toEqual({ subgrupos: [], comentario: "" });
  });
  it("returns comment only when no sex symbols", () => {
    expect(parseSubgrupos("normal text")).toEqual({ subgrupos: [], comentario: "normal text" });
  });
  it("parses a single subgroup", () => {
    const result = parseSubgrupos("10♂[Ninguno](24/06/2026)");
    expect(result.subgrupos).toHaveLength(1);
    expect(result.subgrupos[0].cantidad).toBe(10);
    expect(result.subgrupos[0].sexo).toBe("Macho");
  });
  it("parses multiple subgroups with comment", () => {
    const input = "5♂[Ninguno]() | 3♀[Activo](01/01/2026) || notas extras";
    const result = parseSubgrupos(input);
    expect(result.subgrupos).toHaveLength(2);
    expect(result.comentario).toBe("notas extras");
  });
  it("round-trips through serialize", () => {
    const original = "10♂[Ninguno](24/06/2026) | 5♀[Activo]() || comentario";
    const parsed = parseSubgrupos(original);
    const serialized = serializeSubgrupos(parsed.subgrupos, parsed.comentario);
    const reparsed = parseSubgrupos(serialized);
    expect(reparsed.subgrupos).toHaveLength(2);
    expect(reparsed.subgrupos[0].cantidad).toBe(10);
    expect(reparsed.subgrupos[1].cantidad).toBe(5);
    expect(reparsed.comentario).toBe("comentario");
  });
});

describe("normalizarFecha", () => {
  it("converts YYYY-MM-DD to D/M/YYYY", () => {
    expect(normalizarFecha("2026-06-24")).toBe("24/6/2026");
  });
  it("preserves DD/MM/YYYY format", () => {
    expect(normalizarFecha("24/6/2026")).toBe("24/6/2026");
  });
  it("returns empty for null", () => {
    expect(normalizarFecha("")).toBe("");
    expect(normalizarFecha(null)).toBe("");
  });
});

describe("parseCellId", () => {
  it("parses grid cell IDs", () => {
    expect(parseCellId("E1-F2-C3")).toEqual({ estructura: "1", fila: "2", columna: "3" });
  });
  it("returns null for non-grid IDs", () => {
    expect(parseCellId("UCI-Cen-5")).toBeNull();
  });
});

describe("parseFechaTrat", () => {
  it("parses DD/MM/YYYY", () => {
    const d = parseFechaTrat("24/6/2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(24);
  });
  it("parses YYYY-MM-DD", () => {
    const d = parseFechaTrat("2026-06-24");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(24);
  });
  it("returns null for invalid", () => {
    expect(parseFechaTrat("")).toBeNull();
    expect(parseFechaTrat(null)).toBeNull();
    expect(parseFechaTrat("invalid")).toBeNull();
  });
});

describe("esEventoNoTratamiento", () => {
  it("detects baja", () => {
    expect(esEventoNoTratamiento({ tipo: "Baja registrada" })).toBe(true);
    expect(esEventoNoTratamiento({ tipo: "Baja (Macho)" })).toBe(true);
  });
  it("detects traslado", () => {
    expect(esEventoNoTratamiento({ tipo: "Traslado a 2.4.10" })).toBe(true);
  });
  it("detects salida", () => {
    expect(esEventoNoTratamiento({ tipo: "Salida REGA" })).toBe(true);
  });
  it("rejects normal treatments", () => {
    expect(esEventoNoTratamiento({ tipo: "Levamisol 10%" })).toBe(false);
    expect(esEventoNoTratamiento({ tipo: "Sal 1g/L" })).toBe(false);
  });
  it("handles empty/null tipo", () => {
    expect(esEventoNoTratamiento({ tipo: "" })).toBe(false);
    expect(esEventoNoTratamiento({})).toBe(false);
  });
});

describe("semaforo clinico", () => {
  it("marca NEGRO con signos neurologicos y caquexia", () => {
    const r = evaluarSemaforoClinico({
      bajasSemana: "3",
      ojosVelados: "2",
      rojeces: "0",
      caquexia: "1",
      circulos: "1",
      distension: "0",
      letargo: "1",
      empeoran: "1",
      tipoLote: "silvestre",
    });
    expect(r.nivel).toBe("NEGRO");
    expect(r.severidad).toBe("Alta");
    expect(r.score).toBeGreaterThanOrEqual(8);
  });

  it("construye y relee el bloque de notas del semaforo", () => {
    const form = {
      bajasSemana: "1",
      ojosVelados: "2",
      rojeces: "0",
      caquexia: "0",
      circulos: "0",
      distension: "0",
      letargo: "0",
      empeoran: "0",
      tipoLote: "silvestre",
    };
    const evalRes = evaluarSemaforoClinico(form);
    const bloque = construirBloqueSemaforo(form, evalRes);
    const parsed = extraerSemaforoDeNotas(`nota previa\n\n${bloque}`);
    expect(parsed.nivel).toBe(evalRes.nivel);
    expect(parsed.score).toBe(String(evalRes.score));
    expect(parsed.lote).toBe("silvestre");
    expect(parsed.ganadexil