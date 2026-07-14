import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistorialCrecimiento } from "./useHistorialCrecimiento";

const jsonResponse = (data, ok = true) => ({
  ok,
  json: async () => data,
});

describe("useHistorialCrecimiento — obtenerCurvaPeso", () => {
  it("extrae y ordena por fecha los puntos de peso de los tratamientos de un tanque", () => {
    const sbFetch = vi.fn();
    const resolverUbicacionId = vi.fn();
    const { result } = renderHook(() => useHistorialCrecimiento({ sbFetch, resolverUbicacionId }));

    const tratamientos = [
      { tanque: "E1-F1-C1", fecha: "10/05/2026", notas: "[PESO_MEDIO:0.05]" },
      { tanque: "E1-F1-C1", fecha: "01/05/2026", notas: "[PESO_MEDIO:0.02]" },
      { tanque: "E1-F1-C1", fecha: "20/05/2026", notas: "" },
      { tanque: "OTRO-TANQUE", fecha: "15/05/2026", notas: "[PESO_MEDIO:9.9]" },
    ];

    const curva = result.current.obtenerCurvaPeso("E1-F1-C1", tratamientos);

    expect(curva).toEqual([
      { fecha: "01/05/2026", hora: undefined, peso: 0.02 },
      { fecha: "10/05/2026", hora: undefined, peso: 0.05 },
    ]);
  });

  it("devuelve un array vacío si no hay tratamientos con peso para ese tanque", () => {
    const { result } = renderHook(() => useHistorialCrecimiento({ sbFetch: vi.fn(), resolverUbicacionId: vi.fn() }));
    expect(result.current.obtenerCurvaPeso("E1-F1-C1", [])).toEqual([]);
  });
});

describe("useHistorialCrecimiento — cargarMovimientosTanque", () => {
  it("combina movimientos de entrada y salida ordenados por fecha", async () => {
    const resolverUbicacionId = vi.fn().mockResolvedValue("ubic-1");
    const sbFetch = vi.fn((path) => {
      if (path.includes("ubicacion_destino_id")) {
        return Promise.resolve(jsonResponse([{ id: 1, fecha: "2026-05-10", motivo: "Triaje por tamaño" }]));
      }
      if (path.includes("ubicacion_origen_id")) {
        return Promise.resolve(jsonResponse([{ id: 2, fecha: "2026-05-01", motivo: "" }]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    const { result } = renderHook(() => useHistorialCrecimiento({ sbFetch, resolverUbicacionId }));

    await act(async () => {
      await result.current.cargarMovimientosTanque("E1-F1-C1");
    });

    expect(result.current.historialMovimientos).toEqual([
      { id: 2, fecha: "2026-05-01", motivo: "", direccion: "salida" },
      { id: 1, fecha: "2026-05-10", motivo: "Triaje por tamaño", direccion: "entrada" },
    ]);
    expect(result.current.errorHistorial).toBeNull();
  });

  it("deja el historial vacío si no se puede resolver la ubicación", async () => {
    const resolverUbicacionId = vi.fn().mockResolvedValue(null);
    const sbFetch = vi.fn();
    const { result } = renderHook(() => useHistorialCrecimiento({ sbFetch, resolverUbicacionId }));

    await act(async () => {
      await result.current.cargarMovimientosTanque("E1-F1-C1");
    });

    expect(sbFetch).not.toHaveBeenCalled();
    expect(result.current.historialMovimientos).toEqual([]);
  });

  it("marca un error si la resolución de ubicación falla con una excepción", async () => {
    const resolverUbicacionId = vi.fn().mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useHistorialCrecimiento({ sbFetch: vi.fn(), resolverUbicacionId }));

    await act(async () => {
      await result.current.cargarMovimientosTanque("E1-F1-C1");
    });

    expect(result.current.errorHistorial).toMatch(/no se pudo cargar/i);
  });
});
