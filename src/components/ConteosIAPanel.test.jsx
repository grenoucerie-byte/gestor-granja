import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConteosIAPanel from "./ConteosIAPanel";
import { useConteosIA } from "../hooks/useConteosIA";
import { renderHook } from "@testing-library/react";

// Datos calcados del caso real: la bandeja E2-F7-C1, donde la app decia 313
// unidades y el bot midio 240.
const lectura = (extra = {}) => ({
  id: 1,
  tanque_id: "E2-F7-C1",
  medido_en: "2026-08-20T12:52:00Z",
  operario: "Enzo Da Silva Morales",
  biomasa_g: 73,
  peso_medio_g: 0.304,
  unidades_calculadas: 240,
  muestreo_unidades: 30,
  muestreo_gramos: 9,
  peso_medio_muestreo: 0.3,
  conteo_foto: 185,
  ...extra,
});

const data = { renacuajos: [{ id: "E2-F7-C1", count: 313 }] };

// El panel recibe el hook entero; se construye uno real (sin red) para no
// duplicar la logica de comparacion en el test.
const construirConteosIA = (pendientes, overrides = {}) => {
  const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
  return {
    pendientes,
    cargando: false,
    error: null,
    cargarPendientes: vi.fn(),
    compararConCenso: result.current.compararConCenso,
    ...overrides,
  };
};

describe("ConteosIAPanel", () => {
  it("pide conectarse a la nube antes que nada", () => {
    render(
      <ConteosIAPanel conteosIA={construirConteosIA([])} data={data} onAplicar={vi.fn()} isCloudConnected={false} />,
    );
    expect(screen.getByText(/conéctate a la nube/i)).toBeTruthy();
  });

  it("explica que no hay nada pendiente sin dar sensacion de error", () => {
    render(
      <ConteosIAPanel conteosIA={construirConteosIA([])} data={data} onAplicar={vi.fn()} isCloudConnected={true} />,
    );
    expect(screen.getByText(/no hay lecturas pendientes/i)).toBeTruthy();
  });

  it("muestra el censo actual, lo que propone el bot y la diferencia", () => {
    const { container } = render(
      <ConteosIAPanel conteosIA={construirConteosIA([lectura()])} data={data} onAplicar={vi.fn()} isCloudConnected={true} />,
    );
    const texto = container.textContent;
    expect(texto).toContain("E2-F7-C1");
    expect(texto).toContain("313 ud");   // censo actual
    expect(texto).toContain("240 ud");   // propuesta por peso
    expect(texto).toContain("-73 ud");   // diferencia
    expect(texto).toContain("Enzo Da Silva Morales");
  });

  it("avisa cuando la diferencia con el censo es grande", () => {
    const { container } = render(
      <ConteosIAPanel conteosIA={construirConteosIA([lectura()])} data={data} onAplicar={vi.fn()} isCloudConnected={true} />,
    );
    expect(container.textContent).toMatch(/merece la pena repesar/i);
  });

  it("deja claro que la cifra que manda es la del peso, no la de la foto", () => {
    const { container } = render(
      <ConteosIAPanel conteosIA={construirConteosIA([lectura()])} data={data} onAplicar={vi.fn()} isCloudConnected={true} />,
    );
    expect(container.textContent).toMatch(/por peso/i);
    expect(container.textContent).toMatch(/solo como contraste/i);
  });

  it("no deja aplicar una lectura de una bandeja que no existe en el censo", () => {
    const { container } = render(
      <ConteosIAPanel
        conteosIA={construirConteosIA([lectura({ tanque_id: "NO-EXISTE-1" })])}
        data={data} onAplicar={vi.fn()} isCloudConnected={true}
      />,
    );
    const aplicar = [...container.querySelectorAll("button")].find((b) => b.textContent.includes("Aplicar"));
    expect(aplicar.disabled).toBe(true);
    expect(container.textContent).toMatch(/no se encuentra la bandeja/i);
  });

  it("aplicar y descartar pasan siempre por la persona, nunca solos", () => {
    const onAplicar = vi.fn();
    const { container } = render(
      <ConteosIAPanel conteosIA={construirConteosIA([lectura()])} data={data} onAplicar={onAplicar} isCloudConnected={true} usuarioActual="paula@x.com" />,
    );
    // Renderizar el panel no debe disparar ninguna aplicacion por si solo.
    expect(onAplicar).not.toHaveBeenCalled();

    const botones = [...container.querySelectorAll("button")];
    fireEvent.click(botones.find((b) => b.textContent.includes("Aplicar")));
    expect(onAplicar).toHaveBeenCalledWith(expect.anything(), expect.anything(), "aplicado", "paula@x.com");

    fireEvent.click(botones.find((b) => b.textContent.includes("Descartar")));
    expect(onAplicar).toHaveBeenCalledWith(expect.anything(), expect.anything(), "descartado", "paula@x.com");
  });
});
