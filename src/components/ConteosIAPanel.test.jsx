import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, renderHook } from "@testing-library/react";
import ConteosIAPanel from "./ConteosIAPanel";
import { useConteosIA } from "../hooks/useConteosIA";

// Datos calcados del caso real de E2-F7-C1:
//   - el operario fijo 240 unidades
//   - el muestreo independiente da 73 / 0,300 = 243
//   - la vision conto 185
//   - el censo de la app dice 313
const lectura = (extra = {}) => ({
  id: 1,
  tanque_id: "E2-F7-C1",
  medido_en: "2026-08-20T12:52:00Z",
  operario: "Enzo Da Silva Morales",
  biomasa_g: 73,
  peso_medio_g: 0.304,
  unidades_calculadas: 240,
  conteo_humano: 240,
  muestreo_unidades: 30,
  muestreo_gramos: 9,
  peso_medio_muestreo: 0.3,
  conteo_foto: 185,
  ...extra,
});

const data = { renacuajos: [{ id: "E2-F7-C1", count: 313 }] };

// Se construye un hook real (sin red) para no duplicar en el test la logica
// de comparacion que se quiere verificar.
const construirConteosIA = (pendientes, overrides = {}) => {
  const { result } = renderHook(() => useConteosIA({ sbFetch: vi.fn(), isCloudConnected: true }));
  return {
    pendientes,
    cargando: false,
    error: null,
    cargarPendientes: vi.fn(),
    compararConCenso: result.current.compararConCenso,
    fuentesDe: result.current.fuentesDe,
    ...overrides,
  };
};

const pintar = (pendientes, props = {}) =>
  render(
    <ConteosIAPanel
      conteosIA={construirConteosIA(pendientes)}
      data={data}
      onAplicar={vi.fn()}
      isCloudConnected={true}
      {...props}
    />,
  );

describe("ConteosIAPanel — estados vacios", () => {
  it("pide conectarse a la nube antes que nada", () => {
    pintar([], { isCloudConnected: false });
    expect(screen.getByText(/conéctate a la nube/i)).toBeTruthy();
  });

  it("explica que no hay nada pendiente sin dar sensacion de error", () => {
    pintar([]);
    expect(screen.getByText(/no hay lecturas pendientes/i)).toBeTruthy();
  });
});

describe("ConteosIAPanel — las tres fuentes", () => {
  it("ensena las tres cifras, no una sola ya resuelta", () => {
    const { container } = pintar([lectura()]);
    const texto = container.textContent;
    expect(texto).toContain("Operario");
    expect(texto).toContain("240 ud");   // lo que fijo la persona
    expect(texto).toContain("Muestreo");
    expect(texto).toContain("243 ud");   // 73 / 0,300, independiente
    expect(texto).toContain("Visión");
    expect(texto).toContain("185 ud");   // la foto
  });

  it("arranca con el muestreo elegido por ser el unico independiente", () => {
    const { container } = pintar([lectura()]);
    // 313 -> 243 son -70 ud (-22.4%)
    expect(container.textContent).toContain("-70 ud");
  });

  it("al elegir otra fuente cambia la comparacion con el censo", () => {
    const { container } = pintar([lectura()]);
    const botonVision = [...container.querySelectorAll("button")].find((b) => b.textContent.includes("Visión"));

    fireEvent.click(botonVision);

    // 313 -> 185 son -128 ud
    expect(container.textContent).toContain("-128 ud");
  });

  it("avisa cuando las tres cifras se separan mucho entre si", () => {
    const { container } = pintar([lectura()]);
    expect(container.textContent).toMatch(/se separan un/i);
  });

  it("no ofrece fuentes que no vengan en la lectura", () => {
    const { container } = pintar([lectura({ conteo_foto: null, conteo_humano: null })]);
    expect(container.textContent).not.toContain("Visión");
    expect(container.textContent).not.toContain("Operario");
    expect(container.textContent).toContain("Muestreo");
  });
});

describe("ConteosIAPanel — la decision es siempre de una persona", () => {
  it("no aplica nada solo al renderizar", () => {
    const onAplicar = vi.fn();
    pintar([lectura()], { onAplicar });
    expect(onAplicar).not.toHaveBeenCalled();
  });

  it("aplicar y descartar avisan de que fuente se eligio", () => {
    const onAplicar = vi.fn();
    const { container } = pintar([lectura()], { onAplicar, usuarioActual: "paula@x.com" });
    const botones = [...container.querySelectorAll("button")];

    fireEvent.click(botones.find((b) => b.textContent.includes("Aplicar")));
    expect(onAplicar).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "aplicado", "paula@x.com", "muestreo",
    );

    fireEvent.click(botones.find((b) => b.textContent.includes("Descartar")));
    expect(onAplicar).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "descartado", "paula@x.com", "muestreo",
    );
  });

  it("no deja aplicar una lectura de una bandeja que no existe en el censo", () => {
    const { container } = pintar([lectura({ tanque_id: "NO-EXISTE-1" })]);
    const aplicar = [...container.querySelectorAll("button")].find((b) => b.textContent.includes("Aplicar"));
    expect(aplicar.disabled).toBe(true);
    expect(container.textContent).toMatch(/no se encuentra la bandeja/i);
  });

  it("avisa si la diferencia con el censo es grande", () => {
    const { container } = pintar([lectura()]);
    expect(container.textContent).toMatch(/merece la pena repesar/i);
  });
});
