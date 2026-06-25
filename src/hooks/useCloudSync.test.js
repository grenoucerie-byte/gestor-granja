import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync } from "./useCloudSync";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const okResponse = (data = []) => ({
  ok: true,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

const errorResponse = (status = 500, body = "Server error") => ({
  ok: false,
  status,
  json: () => Promise.resolve({ message: body }),
  text: () => Promise.resolve(body),
});

// Base deps with empty cloudConfig to prevent auto-load on mount
const quietDeps = (overrides = {}) => ({
  cloudConfig: { url: "", key: "" },
  isCloudConnected: false,
  setIsCloudConnected: vi.fn(),
  setIsSyncing: vi.fn(),
  setCloudSaveError: vi.fn(),
  headers: () => ({
    apikey: "test-key",
    Authorization: "Bearer test-key",
    "Content-Type": "application/json",
  }),
  data: { adultas: [{ id: "2.1.1", count: 10 }], naveVerde: [], renacuajos: [], incubadoras: [], metamorfoseadas: [], reproduccion: [], brumacion: [], invernadero: [] },
  puestas: [],
  tratamientos: [],
  incidencias: [],
  inventario: [],
  registrosAlimentacion: [],
  planesAlimentacion: {},
  planesTratamiento: {},
  planesFase: {},
  productosDisponibles: [],
  setData: vi.fn(),
  setPuestas: vi.fn(),
  setTratamientos: vi.fn(),
  setIncidencias: vi.fn(),
  setBajasCloud: vi.fn(),
  setNotasPizarra: vi.fn(),
  setInventario: vi.fn(),
  setPlanesAlimentacion: vi.fn(),
  setPlanesTratamiento: vi.fn(),
  setPlanesFase: vi.fn(),
  setProductosDisponibles: vi.fn(),
  setRegistrosAlimentacion: vi.fn(),
  obtenerOCrearLote: vi.fn().mockResolvedValue("lote-123"),
  ...overrides,
});

// Deps with URL set + isCloudConnected — mount effects will fire
const connectedDeps = (overrides = {}) => quietDeps({
  cloudConfig: { url: "https://test.supabase.co", key: "test-key" },
  isCloudConnected: true,
  ...overrides,
});

// Render hook with connected config, wait for mount effects to settle, then clear mocks
const renderAndSettle = async (deps) => {
  mockFetch.mockResolvedValue(okResponse());
  const hook = renderHook(() => useCloudSync(deps));
  await act(async () => {});
  mockFetch.mockClear();
  mockFetch.mockReset();
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  localStorage.clear();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockImplementation(() => false);
});

// ─── syncInventarioNube ─────────────────────────────────────────────────────

describe("useCloudSync — syncInventarioNube", () => {
  it("sends censo item to censos table when item has grupo", async () => {
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    await act(async () => {
      await result.current.syncInventarioNube({ id: "2.1.1", grupo: "adultas", count: 10 });
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/censos");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.id).toBe("2.1.1");
    expect(body.grupo).toBe("adultas");
    expect(body.count).toBe(10);
  });

  it("sends to inventario table when item has no grupo", async () => {
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    await act(async () => {
      await result.current.syncInventarioNube({ id: "inv-1", nombre: "Levamisol" });
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/inventario");
  });

  it("does nothing when not cloud connected", async () => {
    const deps = quietDeps();
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();

    await act(async () => {
      await result.current.syncInventarioNube({ id: "2.1.1", grupo: "adultas", count: 5 });
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles API error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad request"));

    await act(async () => {
      await result.current.syncInventarioNube({ id: "2.1.1", grupo: "adultas", count: 5 });
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles network error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    await act(async () => {
      await result.current.syncInventarioNube({ id: "2.1.1", grupo: "adultas", count: 5 });
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("normalizes peso_medio and fecha_fase to null when empty", async () => {
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    await act(async () => {
      await result.current.syncInventarioNube({
        id: "2.1.1", grupo: "adultas", count: 5,
        peso_medio: "", fecha_fase: "",
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.peso_medio).toBeNull();
    expect(body.fecha_fase).toBeNull();
  });
});

// ─── guardarTratamientoEnNube ───────────────────────────────────────────────

describe("useCloudSync — guardarTratamientoEnNube", () => {
  it("posts treatment and returns true on success", async () => {
    const setCloudSaveError = vi.fn();
    const deps = connectedDeps({ setCloudSaveError });
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    let ok;
    await act(async () => {
      ok = await result.current.guardarTratamientoEnNube(
        { id: "t1", fecha: "2026-06-25", tanque: "2.1.1", tipo: "Levamisol" },
        "tratamiento"
      );
    });

    expect(ok).toBe(true);
    expect(setCloudSaveError).toHaveBeenCalledWith(null);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/tratamientos");
  });

  it("returns false and sets error on API failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const setCloudSaveError = vi.fn();
    const deps = connectedDeps({ setCloudSaveError });
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(errorResponse(422, "Invalid payload"));

    let ok;
    await act(async () => {
      ok = await result.current.guardarTratamientoEnNube({ id: "t1" }, "test");
    });

    expect(ok).toBe(false);
    expect(setCloudSaveError).toHaveBeenCalledWith(expect.stringContaining("Error al guardar test"));
    consoleSpy.mockRestore();
  });

  it("returns false and sets error on network failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const setCloudSaveError = vi.fn();
    const deps = connectedDeps({ setCloudSaveError });
    const { result } = await renderAndSettle(deps);
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    let ok;
    await act(async () => {
      ok = await result.current.guardarTratamientoEnNube({ id: "t1" }, "test");
    });

    expect(ok).toBe(false);
    expect(setCloudSaveError).toHaveBeenCalledWith(expect.stringContaining("Error de red"));
    consoleSpy.mockRestore();
  });
});

// ─── guardarBajaEnNube ──────────────────────────────────────────────────────

describe("useCloudSync — guardarBajaEnNube", () => {
  it("creates lote and posts baja on success", async () => {
    const obtenerOCrearLote = vi.fn().mockResolvedValue("lote-abc");
    const deps = connectedDeps({ obtenerOCrearLote });
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    let ok;
    await act(async () => {
      ok = await result.current.guardarBajaEnNube({
        tanqueId: "2.1.1", grupo: "adultas", cantidad: 3,
        categoria: "Mortalidad", causa: "enfermedad",
      });
    });

    expect(ok).toBe(true);
    expect(obtenerOCrearLote).toHaveBeenCalledWith("2.1.1", "adultas", null);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/bajas");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.lote_id).toBe("lote-abc");
    expect(body.cantidad).toBe(3);
    expect(body.causa).toBe("enfermedad");
  });

  it("returns false when lote creation fails", async () => {
    const obtenerOCrearLote = vi.fn().mockResolvedValue(null);
    const setCloudSaveError = vi.fn();
    const deps = connectedDeps({ obtenerOCrearLote, setCloudSaveError });
    const { result } = await renderAndSettle(deps);

    let ok;
    await act(async () => {
      ok = await result.current.guardarBajaEnNube({
        tanqueId: "unknown", grupo: "adultas", cantidad: 1,
      });
    });

    expect(ok).toBe(false);
    expect(setCloudSaveError).toHaveBeenCalledWith(expect.stringContaining("no se pudo enlazar"));
  });

  it("includes sexo field when provided", async () => {
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    await act(async () => {
      await result.current.guardarBajaEnNube({
        tanqueId: "2.1.1", grupo: "adultas", cantidad: 2,
        sexo: "hembra",
      });
    });

    const bajaCall = mockFetch.mock.calls.find(c => c[0].includes("bajas"));
    expect(bajaCall).toBeTruthy();
    const body = JSON.parse(bajaCall[1].body);
    expect(body.sexo).toBe("hembra");
  });

  it("handles network error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    let ok;
    await act(async () => {
      ok = await result.current.guardarBajaEnNube({
        tanqueId: "2.1.1", grupo: "adultas", cantidad: 1,
      });
    });

    expect(ok).toBe(false);
    consoleSpy.mockRestore();
  });
});

// ─── syncPlanesNube ─────────────────────────────────────────────────────────

describe("useCloudSync — syncPlanesNube", () => {
  it("posts config to configuracion table", async () => {
    const deps = connectedDeps();
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse());

    await act(async () => {
      await result.current.syncPlanesNube("planes_alimentacion", { fase1: { dosis: "2ml" } });
    });

    const call = mockFetch.mock.calls.find(c => c[0].includes("configuracion"));
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body.id).toBe("planes_alimentacion");
    expect(body.datos).toEqual({ fase1: { dosis: "2ml" } });
  });

  it("skips when not connected", async () => {
    const deps = quietDeps();
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();

    await act(async () => {
      await result.current.syncPlanesNube("planes_alimentacion", {});
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── cargarPlanesDesdeNube ──────────────────────────────────────────────────

describe("useCloudSync — cargarPlanesDesdeNube", () => {
  it("loads plans from configuracion and calls setters", async () => {
    const planData = [
      { id: "planes_alimentacion", datos: { ranas: "3g" } },
      { id: "productos_disponibles", datos: ["Levamisol", "Oxitetraciclina"] },
    ];
    const setPlanesAlimentacion = vi.fn();
    const setProductosDisponibles = vi.fn();
    const deps = connectedDeps({ setPlanesAlimentacion, setProductosDisponibles });
    const { result } = await renderAndSettle(deps);
    mockFetch.mockResolvedValueOnce(okResponse(planData));

    await act(async () => {
      await result.current.cargarPlanesDesdeNube();
    });

    expect(setPlanesAlimentacion).toHaveBeenCalled();
    expect(setProductosDisponibles).toHaveBeenCalledWith(["Levamisol", "Oxitetraciclina"]);
  });

  it("skips when not connected", async () => {
    const deps = quietDeps();
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();

    await act(async () => {
      await result.current.cargarPlanesDesdeNube();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── cargarDatosDeLaNube ────────────────────────────────────────────────────

describe("useCloudSync — cargarDatosDeLaNube", () => {
  const makeCloudResponses = () => [
    okResponse([{ id: "2.1.1", grupo: "adultas", count: 50, last_date: "2026-06-20", type: "", dose: "", obs: "" }]),
    okResponse([{ id: "p1", fecha: "2026-06-20", tanque: "rep-1", grupo: "reproduccion" }]),
    okResponse([{ id: "t1", fecha: "2026-06-20", tanque: "2.1.1", tipo: "Levamisol" }]),
    okResponse([]),
    okResponse([{ id: 1, fecha: "2026-06-20", tanque_id: "2.1.1", cantidad: 2, causa: "natural" }]),
    okResponse([{ id: 1, area: "general", texto: "Nota test", created_at: "2026-06-20" }]),
    okResponse([]),
  ];

  it("loads all data and sets state", async () => {
    const setData = vi.fn();
    const setPuestas = vi.fn();
    const setTratamientos = vi.fn();
    const setBajasCloud = vi.fn();
    const setNotasPizarra = vi.fn();
    const setIsCloudConnected = vi.fn();
    const setIsSyncing = vi.fn();
    // Use quietDeps so auto-load doesn't fire, then call manually
    const deps = quietDeps({
      cloudConfig: { url: "https://test.supabase.co", key: "test-key" },
      setData, setPuestas, setTratamientos, setBajasCloud, setNotasPizarra,
      setIsCloudConnected, setIsSyncing,
    });

    // Mock for auto-load + cargarPlanesDesdeNube on mount (url+key set = auto-load fires)
    makeCloudResponses().forEach(r => mockFetch.mockResolvedValueOnce(r));
    mockFetch.mockResolvedValueOnce(okResponse([])); // cargarPlanesDesdeNube

    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});

    expect(setData).toHaveBeenCalled();
    expect(setPuestas).toHaveBeenCalled();
    expect(setTratamientos).toHaveBeenCalled();
    expect(setBajasCloud).toHaveBeenCalled();
    expect(setNotasPizarra).toHaveBeenCalled();
    expect(setIsCloudConnected).toHaveBeenCalledWith(true);
    expect(setIsSyncing).toHaveBeenCalledWith(false);
  });

  it("sets isCloudConnected=false on fetch failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const setIsCloudConnected = vi.fn();
    const setIsSyncing = vi.fn();
    const deps = quietDeps({
      cloudConfig: { url: "https://test.supabase.co", key: "test-key" },
      setIsCloudConnected, setIsSyncing,
    });

    mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});

    expect(setIsCloudConnected).toHaveBeenCalledWith(false);
    expect(setIsSyncing).toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });

  it("skips when URL or key is empty", async () => {
    const deps = quietDeps();
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();

    await act(async () => {
      await result.current.cargarDatosDeLaNube();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("accepts configOverride parameter", async () => {
    const deps = quietDeps();
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();

    const responses = makeCloudResponses();
    responses.forEach(r => mockFetch.mockResolvedValueOnce(r));

    await act(async () => {
      await result.current.cargarDatosDeLaNube({ url: "https://override.supabase.co", key: "override-key" });
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch.mock.calls[0][0]).toContain("override.supabase.co");
  });
});

// ─── subirDatosLocalesALaNube ───────────────────────────────────────────────

describe("useCloudSync — subirDatosLocalesALaNube", () => {
  it("uploads censos and shows success alert", async () => {
    const setIsSyncing = vi.fn();
    const deps = quietDeps({ setIsSyncing });
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(okResponse());

    await act(async () => {
      await result.current.subirDatosLocalesALaNube({ url: "https://test.supabase.co", key: "k" });
    });

    expect(mockFetch).toHaveBeenCalled();
    const censoCall = mockFetch.mock.calls.find(c => c[0].includes("censos"));
    expect(censoCall).toBeTruthy();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("éxito"));
    expect(setIsSyncing).toHaveBeenCalledWith(true);
    expect(setIsSyncing).toHaveBeenCalledWith(false);
  });

  it("handles upload error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const setIsSyncing = vi.fn();
    const deps = quietDeps({ setIsSyncing });
    const { result } = renderHook(() => useCloudSync(deps));
    await act(async () => {});
    mockFetch.mockClear();
    mockFetch.mockRejectedValue(new Error("upload failed"));

    await act(async () => {
      await result.current.subirDatosLocalesALaNube({ url: "https://test.supabase.co", key: "k" });
    });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Error"));
    expect(setIsSyncing).toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });
});
