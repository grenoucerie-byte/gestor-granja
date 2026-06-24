import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTratamientos } from "./useTratamientos";

const makeDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const baseDeps = (tratamientos = []) => ({
  isCloudConnected: false,
  cloudConfig: { url: "", key: "" },
  obtenerCabeceras: () => ({}),
  setCloudSaveError: vi.fn(),
  tratamientos,
  setTratamientos: vi.fn(),
  bulkTratSelectedTanks: [],
  setBulkTratSelectedTanks: vi.fn(),
  bulkTratCategoria: "Desparasitación",
  bulkTratProducto: "",
  setBulkTratProducto: vi.fn(),
  bulkTratDosis: "",
  setBulkTratDosis: vi.fn(),
  bulkTratTiempo: "",
  setBulkTratTiempo: vi.fn(),
  bulkTratFecha: "",
});

describe("useTratamientos — alarmas2aDosis", () => {
  it("returns empty when no treatments", () => {
    const { result } = renderHook(() => useTratamientos(baseDeps([])));
    expect(result.current.alarmas2aDosis).toEqual([]);
    expect(result.current.alarmasDesparasitacion).toEqual([]);
  });

  it("returns empty for non-desparasitacion treatments", () => {
    const trats = [
      { id: 1, tanque: "2.1.1", tipo: "Spirulina", dosis: "5g", fecha: makeDate(6) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toEqual([]);
  });

  it("generates alarm for levamisol after 5+ days", () => {
    const trats = [
      { id: 1, tanque: "UCI-Cen-5", tipo: "Levamisol 10%", dosis: "1ml/L", fecha: makeDate(6) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toHaveLength(1);
    expect(result.current.alarmas2aDosis[0].tanqueId).toBe("UCI-Cen-5");
    expect(result.current.alarmas2aDosis[0].producto).toBe("LEVAMISOL");
    expect(result.current.alarmas2aDosis[0].diasPasados).toBe(6);
  });

  it("generates alarm for sal treatment", () => {
    const trats = [
      { id: 1, tanque: "2.4.10", tipo: "Sal 1g/L", dosis: "1g", fecha: makeDate(8) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toHaveLength(1);
    expect(result.current.alarmas2aDosis[0].producto).toBe("SAL");
    expect(result.current.alarmas2aDosis[0].vencida).toBe(true);
  });

  it("generates alarm for desparasitacion category", () => {
    const trats = [
      { id: 1, tanque: "2.1.1", tipo: "Producto X", dosis: "5ml", fecha: makeDate(6), categoria: "Desparasitación Externa" },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toHaveLength(1);
  });

  it("no alarm if treatment too recent (<5 days)", () => {
    const trats = [
      { id: 1, tanque: "UCI-Cen-5", tipo: "Levamisol", dosis: "1ml", fecha: makeDate(3) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toEqual([]);
  });

  it("no alarm if treatment too old (>14 days)", () => {
    const trats = [
      { id: 1, tanque: "UCI-Cen-5", tipo: "Levamisol", dosis: "1ml", fecha: makeDate(15) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toEqual([]);
  });

  it("no alarm if 2nd dose already given (3-12 days apart)", () => {
    const trats = [
      { id: 1, tanque: "UCI-Cen-5", tipo: "Levamisol", dosis: "1ml", fecha: makeDate(6) },
      { id: 2, tanque: "UCI-Cen-5", tipo: "Levamisol", dosis: "1ml", fecha: makeDate(13) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toEqual([]);
  });

  it("ignores bajas/traslados in alarm calculation", () => {
    const trats = [
      { id: 1, tanque: "2.1.1", tipo: "Baja registrada", dosis: "1", fecha: makeDate(6) },
      { id: 2, tanque: "2.1.1", tipo: "Traslado a 2.1.2", dosis: "5", fecha: makeDate(6) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmas2aDosis).toEqual([]);
  });

  it("alarmasDesparasitacion contains tanque IDs", () => {
    const trats = [
      { id: 1, tanque: "UCI-Cen-5", tipo: "Levamisol 10%", dosis: "1ml", fecha: makeDate(6) },
      { id: 2, tanque: "2.4.10", tipo: "Sal 1g/L", dosis: "1g", fecha: makeDate(8) },
    ];
    const { result } = renderHook(() => useTratamientos(baseDeps(trats)));
    expect(result.current.alarmasDesparasitacion).toContain("UCI-Cen-5");
    expect(result.current.alarmasDesparasitacion).toContain("2.4.10");
  });
});

describe("useTratamientos — aplicarTratamiento", () => {
  it("calls setTratamientos with new treatment", async () => {
    const setTratamientos = vi.fn();
    const deps = { ...baseDeps(), setTratamientos };
    const { result } = renderHook(() => useTratamientos(deps));

    await act(async () => {
      await result.current.aplicarTratamiento("2.1.1", "Levamisol", "1ml/L", { categoria: "medicamento" });
    });

    expect(setTratamientos).toHaveBeenCalledTimes(1);
    const updater = setTratamientos.mock.calls[0][0];
    const newList = updater([]);
    expect(newList).toHaveLength(1);
    expect(newList[0].tanque).toBe("2.1.1");
    expect(newList[0].tipo).toBe("Levamisol");
    expect(newList[0].dosis).toBe("1ml/L");
    expect(newList[0].categoria).toBe("medicamento");
  });

  it("does not call fetch when offline", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const deps = { ...baseDeps(), isCloudConnected: false };
    const { result } = renderHook(() => useTratamientos(deps));

    await act(async () => {
      await result.current.aplicarTratamiento("2.1.1", "Sal", "1g");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
