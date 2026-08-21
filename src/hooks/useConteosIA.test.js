import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConteosIA } from "./useConteosIA";

const respuesta = (data, ok = true, status = 200) => ({
  ok, status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const lectura = (extra = {}) => ({
  id: 1,
  tanque_id: "E2-F7-C1",
  medido_en: "2026-08-20T12:52:00Z",
  operario: "Enzo Da Silva Morales",
  biomasa_g: 73,
  peso_medio_g: 0.304,
  unidades_calculadas: 240,
  conteo_foto: 185,
  conteo_humano: 240,
  muestreo_unidades: 30,
  muestreo_gramos: 9,
  peso_medio_muestreo: 0.3,
  estado: "pendiente",
  ...extra,
});

const censoConCelda = (count) => ({
  renacuajos: [{ id: "E2-F7-C1", count, pesoMedio: "0.3" }],
  adultas: [{ id: "2.1.1", count: 10 }],
});

describe("useConteosIA — cargarPendientes", () => {
  it("solo pide las lecturas pendientes", async () => {
    const sbFetch = vi.fn().mockResolvedValue(respuesta([lectura()]));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.cargarPendientes(); });

    expect(sbFetch).toHaveBeenCalledWith(expect.stringContaining("estado=eq.pendiente"));
    expect(result.current.pendientes).toHaveLength(1);
  });

  it("no consulta nada si no hay conexion con la nube", async () => {
    const sbFetch = vi.fn();
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: false }));

    await act(async () => { await result.current.cargarPendientes(); });

    expect(sbFetch).not.toHaveBeenCalled();
  });

  it("trata un 404 como 'aun no hay tabla', sin dar error al usuario", async () => {
    // Pasa mientras no se haya ejecutado sql/003_conteos_ia.sql. No es un
    // fallo que deba alarmar a nadie en la nave.
    const sbFetch = vi.fn().mockResolvedValue(respuesta({}, false, 404));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.cargarPendientes(); });

    expect(result.current.pendientes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("avisa si la consulta falla de verdad", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sbFetch = vi.fn().mockResolvedValue(respuesta({}, false, 500));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.cargarPendientes(); });

    expect(result.current.error).toMatch(/no se pudieron cargar/i);
    spy.mockRestore();
  });
});

describe("useConteosIA — el bot nunca escribe en el censo", () => {
  it("cargar lecturas no lanza ninguna escritura", async () => {
    const sbFetch = vi.fn().mockResolvedValue(respuesta([lectura()]));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.cargarPendientes(); });

    const escrituras = sbFetch.mock.calls.filter(
      ([, opciones]) => opciones && ["POST", "PATCH", "PUT", "DELETE"].includes(opciones.method),
    );
    expect(escrituras).toHaveLength(0);
  });

  it("marcarRevisado solo toca conteos_ia, nunca censos", async () => {
    const sbFetch = vi.fn().mockResolvedValue(respuesta([]));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.marcarRevisado(1, "aplicado", "paula@x.com"); });

    const rutas = sbFetch.mock.calls.map(([ruta]) => ruta);
    expect(rutas.every((r) => r.startsWith("conteos_ia"))).toBe(true);
    expect(rutas.some((r) => r.includes("censos"))).toBe(false);
  });
});

describe("useConteosIA — compararConCenso", () => {
  it("calcula la diferencia frente al censo actual y localiza el grupo", () => {
    const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
    const cmp = result.current.compararConCenso(lectura(), censoConCelda(313));

    expect(cmp.grupo).toBe("renacuajos");
    expect(cmp.countActual).toBe(313);
    expect(cmp.propuesto).toBe(240);
    expect(cmp.diferencia).toBe(-73);
    expect(cmp.porcentaje).toBeCloseTo(-23.3, 1);
  });

  it("mide cuanto se queda corto el conteo por foto frente al peso", () => {
    // La vision subcuenta porque los renacuajos se solapan: guardar el desvio
    // permite ir viendo si el sesgo es estable.
    const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
    const cmp = result.current.compararConCenso(lectura(), censoConCelda(313));

    expect(cmp.desvioFoto).toBeCloseTo(-22.9, 1);
  });

  it("avisa cuando la bandeja no existe en el censo en vez de inventarla", () => {
    const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
    const cmp = result.current.compararConCenso(lectura({ tanque_id: "NO-EXISTE-1" }), censoConCelda(313));

    expect(cmp.grupo).toBeNull();
    expect(cmp.countActual).toBeNull();
    expect(cmp.diferencia).toBeNull();
  });

  it("no divide entre cero si la bandeja esta vacia", () => {
    const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
    const cmp = result.current.compararConCenso(lectura(), censoConCelda(0));

    expect(cmp.countActual).toBe(0);
    expect(cmp.diferencia).toBe(240);
    expect(cmp.porcentaje).toBeNull();
  });
});

describe("useConteosIA — las tres fuentes se guardan por separado", () => {
  const hook = () => renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true })).result;

  it("no cae en el calculo circular: el muestreo sale del peso independiente", () => {
    // El "peso medio usado" del bot (0.304) sale de 73/240, o sea del propio
    // conteo humano: usarlo devolveria 240 otra vez y no validaria nada. La
    // cifra independiente es 73 / 0.300 = 243.
    const f = hook().current.fuentesDe(lectura());
    expect(f.humano).toBe(240);
    expect(f.muestreo).toBe(243);
    expect(f.foto).toBe(185);
  });

  it("sugiere el muestreo por ser el unico independiente, sin imponerlo", () => {
    expect(hook().current.fuentesDe(lectura()).sugerida).toBe("muestreo");
  });

  it("mide cuanto se separan las tres cifras entre si", () => {
    // 185 (foto) frente a 243 (muestreo) = 31.4% sobre la menor.
    const f = hook().current.fuentesDe(lectura());
    expect(f.dispersion).toBeCloseTo(31.4, 1);
  });

  it("omite las fuentes que no vengan en la lectura", () => {
    const f = hook().current.fuentesDe(lectura({ conteo_foto: null, conteo_humano: null }));
    expect(f.lista.map((x) => x.clave)).toEqual(["muestreo"]);
    expect(f.dispersion).toBeNull();
  });

  it("compara contra el censo usando la cifra que elige la persona", () => {
    const r = hook().current;
    const conMuestreo = r.compararConCenso(lectura(), censoConCelda(313), 243);
    const conFoto = r.compararConCenso(lectura(), censoConCelda(313), 185);
    expect(conMuestreo.propuesto).toBe(243);
    expect(conMuestreo.diferencia).toBe(-70);
    expect(conFoto.propuesto).toBe(185);
    expect(conFoto.diferencia).toBe(-128);
  });

  it("registra que fuente se acepto al aplicar, y ninguna al descartar", async () => {
    const sbFetch = vi.fn().mockResolvedValue(respuesta([]));
    const { result } = renderHook(() => useConteosIA({ sbFetch, isCloudConnected: true }));

    await act(async () => { await result.current.marcarRevisado(1, "aplicado", "paula@x.com", "muestreo"); });
    expect(JSON.parse(sbFetch.mock.calls[0][1].body).fuente_definitiva).toBe("muestreo");

    await act(async () => { await result.current.marcarRevisado(2, "descartado", "paula@x.com", "muestreo"); });
    expect(JSON.parse(sbFetch.mock.calls[1][1].body).fuente_definitiva).toBeNull();
  });
});
