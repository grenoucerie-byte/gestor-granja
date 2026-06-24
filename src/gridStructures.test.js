import { describe, it, expect } from "vitest";
import {
  generarCeldasIncubadoras, asegurarEstructurasIncubadoras,
  generarCeldasGrid, asegurarEstructurasRenacuajos,
  generarCeldasAdultas, asegurarEstructurasAdultas,
  generarCeldasUCI, asegurarEstructurasNaveVerde,
  DEFAULT_DATA,
} from "./gridStructures";

describe("DEFAULT_DATA", () => {
  it("has all expected groups", () => {
    const groups = Object.keys(DEFAULT_DATA);
    expect(groups).toContain("adultas");
    expect(groups).toContain("naveVerde");
    expect(groups).toContain("incubadoras");
    expect(groups).toContain("renacuajos");
    expect(groups).toContain("metamorfoseadas");
    expect(groups).toContain("reproduccion");
    expect(groups).toContain("brumacion");
    expect(groups).toContain("invernadero");
  });
  it("each group is a non-empty array", () => {
    Object.values(DEFAULT_DATA).forEach(arr => {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThan(0);
    });
  });
  it("each cell has id and count", () => {
    Object.values(DEFAULT_DATA).forEach(arr => {
      arr.forEach(cell => {
        expect(cell).toHaveProperty("id");
        expect(cell).toHaveProperty("count");
      });
    });
  });
});

describe("generarCeldasIncubadoras", () => {
  it("generates 6 incubators", () => {
    const cells = generarCeldasIncubadoras();
    expect(cells).toHaveLength(6);
    expect(cells[0].id).toBe("INC-1");
    expect(cells[5].id).toBe("INC-6");
  });
  it("all start at count 0", () => {
    const cells = generarCeldasIncubadoras();
    cells.forEach(c => expect(c.count).toBe(0));
  });
});

describe("asegurarEstructurasIncubadoras", () => {
  it("fills missing incubators from empty list", () => {
    const result = asegurarEstructurasIncubadoras([]);
    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.some(c => c.id === "INC-1")).toBe(true);
  });
  it("preserves existing data", () => {
    const existing = [{ id: "INC-1", count: 42, type: "fértiles", obs: "", dose: "" }];
    const result = asegurarEstructurasIncubadoras(existing);
    const inc1 = result.find(c => c.id === "INC-1");
    expect(inc1.count).toBe(42);
    expect(inc1.type).toBe("fértiles");
  });
  it("detects corrupt IDs", () => {
    const corruptos = [];
    const existing = [{ id: '" INC-1 "', count: 10, grupo: "incubadoras" }];
    asegurarEstructurasIncubadoras(existing, corruptos);
    expect(corruptos.length).toBeGreaterThan(0);
    expect(corruptos[0].id).toBe('" INC-1 "');
  });
  it("normalizes bare numbers to INC-N", () => {
    const result = asegurarEstructurasIncubadoras([{ id: "3", count: 5 }]);
    expect(result.some(c => c.id === "INC-3" && c.count === 5)).toBe(true);
  });
});

describe("asegurarEstructurasAdultas", () => {
  it("creates default adultas from empty", () => {
    const result = asegurarEstructurasAdultas({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
  it("preserves existing adultas data", () => {
    const existing = {
      adultas: [{ id: "2.1.1", grupo: "adultas", count: 100, type: "", dose: "", obs: "" }],
    };
    const result = asegurarEstructurasAdultas(existing);
    const cell = result.find(c => c.id === "2.1.1");
    expect(cell).toBeDefined();
    expect(cell.count).toBe(100);
  });
});

describe("asegurarEstructurasNaveVerde", () => {
  it("creates default UCI cells from empty", () => {
    const result = asegurarEstructurasNaveVerde([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.some(c => c.id.startsWith("UCI-"))).toBe(true);
  });
});

describe("asegurarEstructurasRenacuajos", () => {
  it("creates grid structure from empty", () => {
    const result = asegurarEstructurasRenacuajos([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(c => c.id.startsWith("E1-"))).toBe(true);
  });
});
