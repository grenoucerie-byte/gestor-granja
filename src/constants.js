// ── Catálogo de productos y planes por defecto ──────────────────────────────
export const PRODUCTOS_DEFAULT = [
  "MICROBAQ T-0",
  "AGUA VERDE",
  "DAPHNIA",
  "DIBAQ T 1MM",
  "DIBAQ T 2MM",
  "DIBAQ T 4.5MM",
  "Alimento vivo pequeño",
  "Alimento VIVO",
  "CALCIO",
  "PIENSO RAMIRO",
];

const _mk  = (p, tipo="fijo")  => ({ producto: p, cantidad: "", tomas: "1", tipo });
export const PLANES_FASE_DEFAULT = {
  "Renacuajo S":      { items: [_mk("MICROBAQ T-0","fijo"), _mk("AGUA VERDE","ocasional"), _mk("DAPHNIA","ocasional")],                    frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Renacuajo M":      { items: [_mk("MICROBAQ T-0","fijo"), _mk("AGUA VERDE","ocasional"), _mk("DAPHNIA","ocasional")],                    frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "2 patas":          { items: [_mk("MICROBAQ T-0","fijo"), _mk("AGUA VERDE","ocasional"), _mk("DAPHNIA","ocasional")],                    frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Recién metamorf.": { items: [_mk("DIBAQ T 2MM","fijo"), _mk("DIBAQ T 1MM","fijo"), _mk("Alimento vivo pequeño","ocasional"), _mk("CALCIO","ocasional")], frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Iniciación":       { items: [_mk("DIBAQ T 2MM","fijo"), _mk("DIBAQ T 1MM","fijo"), _mk("Alimento vivo pequeño","ocasional"), _mk("CALCIO","ocasional")], frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Juvenil":          { items: [_mk("DIBAQ T 2MM","fijo"), _mk("DIBAQ T 1MM","fijo"), _mk("Alimento vivo pequeño","ocasional"), _mk("CALCIO","ocasional")], frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Engorde":          { items: [_mk("DIBAQ T 4.5MM","fijo"), _mk("Alimento VIVO","ocasional"), _mk("CALCIO","ocasional"), _mk("PIENSO RAMIRO","ocasional")], frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
  "Reproductora":     { items: [_mk("DIBAQ T 4.5MM","fijo"), _mk("Alimento VIVO","ocasional"), _mk("CALCIO","ocasional"), _mk("PIENSO RAMIRO","ocasional")], frecuencia:"Diario", modo:"fijos", tomasAl_dia:"2", notas:"" },
};

export const AREAS_PIZARRA = ["General", "UCI", "Nave Verde", "Metamorfoseadas", "Renacuajos", "Incubadoras", "Invernadero"];

export const INTERVALO_2A_DOSIS = 7;
export const PRODUCTOS_2A_DOSIS = ["levamisol", "sal", "desparasit", "veterelin"];

export const OBTENER_DATOS_DENSIDAD = (grupo, id, count) => {
  let maxRecomendado = 500;
  let factorArea = 10;
  let unidad = "ranas/m²";
  let esGrid = false;

  if (grupo === "adultas") {
    maxRecomendado = 500;
    factorArea = 10;
    unidad = "ranas/m²";
  } else if (grupo === "naveVerde") {
    maxRecomendado = 200;
    factorArea = 10;
    unidad = "ranas/m²";
  } else if (grupo === "renacuajos") {
    esGrid = /^E\d-F\d-C\d+/.test(id);
    if (esGrid) {
      maxRecomendado = 300;
      factorArea = 1;
      unidad = "ud";
    } else {
      maxRecomendado = 300;
      factorArea = 200;
      unidad = "renac./L";
    }
  } else if (grupo === "metamorfoseadas") {
    maxRecomendado = 500;
    factorArea = 2;
    unidad = "ranitas/m²";
  }

  const total = parseInt(count, 10) || 0;
  const valorDensidad = esGrid ? total : (total / factorArea).toFixed(1);
  const maxDensidad = esGrid
    ? maxRecomendado
    : (maxRecomendado / factorArea).toFixed(1);
  const porcentaje = Math.min(Math.round((total / maxRecomendado) * 100), 200);

  let estado = "normal";
  if (porcentaje > 100) {
    estado = "peligro";
  } else if (porcentaje > 80) {
    estado = "advertencia";
  }

  return {
    actual: valorDensidad,
    maxima: maxDensidad,
    unidad,
    porcentaje,
    estado,
  };
};
