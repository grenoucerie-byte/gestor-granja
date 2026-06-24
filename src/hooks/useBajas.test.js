import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBajas } from "./useBajas";

const makeData = () => ({
  adultas: [
    { id: "2.1.1", count: 50, type: "Levamisol", dose: "1ml", obs: "", lote_id: "lote-1" },
    { id: "2.1.2", count: 0, type: "", dose: "", obs: "" },
  ],
  naveVerde: [
    { id: "UCI-Cen-5", count: 100, type: "", dose: "", obs: "[BLOQUEADO: Desinfectar]" },
  ],
});

const baseDeps = (overrides = {}) => ({
  isCloudConnected: false,
  cloudConfig: { url: "", key: "" },
  obtenerCabeceras: () => ({}),
  setCloudSaveError: vi.fn(),
  data: makeData(),
  setData: vi.fn(),
  setBajasCloud: vi.fn(),
  syncInventarioNube: vi.fn(),
  guardarBajaEnNube: vi.fn(),
  ...overrides,
});

describe("useBajas — registrarBajasEspecial", () => {
  it("decrements count and updates data", async () => {
    const setData = vi.fn();
    const setBajasCloud = vi.fn();
    const deps = baseDeps({ setData, setBajasCloud });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "3");
    });

    expect(setData).toHaveBeenCalledTimes(1);
    const newData = setData.mock.calls[0][0];
    const cell = newData.adultas.find(c => c.id === "2.1.1");
    expect(cell.count).toBe(47);
  });

  it("adds entry to bajasCloud", async () => {
    const setBajasCloud = vi.fn();
    const deps = baseDeps({ setBajasCloud });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "1", { sexo: "Macho" });
    });

    expect(setBajasCloud).toHaveBeenCalledTimes(1);
    const updater = setBajasCloud.mock.calls[0][0];
    const newList = updater([]);
    expect(newList).toHaveLength(1);
    expect(newList[0].tanque_id).toBe("2.1.1");
    expect(newList[0].cantidad).toBe(1);
    expect(newList[0].sexo).toBe("Macho");
  });

  it("clears treatment fields when count reaches 0", async () => {
    const setData = vi.fn();
    const data = { adultas: [{ id: "2.1.1", count: 2, type: "Lev", dose: "1ml", obs: "notes", muestras: "3", pesoMedio: "5" }] };
    const deps = baseDeps({ setData, data });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "2");
    });

    const newData = setData.mock.calls[0][0];
    const cell = newData.adultas.find(c => c.id === "2.1.1");
    expect(cell.count).toBe(0);
    expect(cell.type).toBe("");
    expect(cell.dose).toBe("");
    expect(cell.obs).toBe("");
  });

  it("rejects if not enough units", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const setData = vi.fn();
    const deps = baseDeps({ setData });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "999");
    });

    expect(setData).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("rejects invalid quantity", async () => {
    const setData = vi.fn();
    const deps = baseDeps({ setData });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "0");
    });
    expect(setData).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "-5");
    });
    expect(setData).not.toHaveBeenCalled();
  });

  it("calls cloud sync when connected", async () => {
    const syncInventarioNube = vi.fn();
    const guardarBajaEnNube = vi.fn();
    const deps = baseDeps({ isCloudConnected: true, syncInventarioNube, guardarBajaEnNube });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "1");
    });

    expect(syncInventarioNube).toHaveBeenCalledWith(expect.objectContaining({ id: "2.1.1", grupo: "adultas", count: 49 }));
    expect(guardarBajaEnNube).toHaveBeenCalledWith(expect.objectContaining({ tanqueId: "2.1.1", cantidad: 1, categoria: "Mortalidad" }));
  });

  it("does not call cloud sync when offline", async () => {
    const syncInventarioNube = vi.fn();
    const deps = baseDeps({ isCloudConnected: false, syncInventarioNube });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.registrarBajasEspecial("adultas", "2.1.1", "1");
    });

    expect(syncInventarioNube).not.toHaveBeenCalled();
  });
});

describe("useBajas — borrarBajaCloud", () => {
  it("removes baja from local state", async () => {
    const setBajasCloud = vi.fn();
    const deps = baseDeps({ setBajasCloud });
    const { result } = renderHook(() => useBajas(deps));

    await act(async () => {
      await result.current.borrarBajaCloud(123);
    });

    expect(setBajasCloud).toHaveBeenCalledTimes(1);
    const updater = setBajasCloud.mock.calls[0][0];
    const filtered = updater([{ id: 123 }, { id: 456 }]);
    expect(filtered).toEqual([{ id: 456 }]);
  });
});
