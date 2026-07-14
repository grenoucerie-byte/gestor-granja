export const normalizarId = (id) => {
  if (!id) return "";
  return String(id).replace(/[^a-zA-Z0-9\-\.]/g, "");
};

export const lockIcon = (obs) => {
  if (!obs || !obs.includes("[BLOQUEADO")) return "";
  const motivo = (obs.match(/\[BLOQUEADO(?:[:-]?\s*(.*?))?\]/) || [])[1] || "";
  const m = motivo.toLowerCase();
  if (m.includes("desinfec") || m.includes("limpi")) return "🧴";
  if (m.includes("repara")) return "🔧";
  return "🔒";
};

export const lockClass = (obs) => {
  if (!obs || !obs.includes("[BLOQUEADO")) return "";
  const motivo = (obs.match(/\[BLOQUEADO(?:[:-]?\s*(.*?))?\]/) || [])[1] || "";
  const m = motivo.toLowerCase();
  if (m.includes("desinfec") || m.includes("limpi")) return "locked desinfectar";
  if (m.includes("repara")) return "locked reparar";
  return "locked";
};

export const parseSubgrupos = (obs) => {
  if (!obs) return { subgrupos: [], comentario: "" };
  let parts = String(obs).split("||");
  let subData = parts[0].trim();
  let comentario = parts.slice(1).join("||").trim();

  if (!subData.includes("♂") && !subData.includes("♀") && !subData.includes("❓")) {
    return { subgrupos: [], comentario: obs.trim() };
  }

  const subgrupos = [];
  const tokens = subData.split("|").map(t => t.trim()).filter(Boolean);

  tokens.forEach((token, index) => {
    const match = token.match(/^(\d+)([♂♀❓])\[(.*?)\]\((.*?)\)$/);
    if (match) {
      const sexoMap = { "♂": "Macho", "♀": "Hembra", "❓": "Indet" };
      subgrupos.push({
        id: `sub_${Date.now()}_${index}`,
        cantidad: parseInt(match[1], 10),
        sexo: sexoMap[match[2]],
        estado: match[3] || "Ninguno",
        fecha: match[4] || ""
      });
    }
  });

  return { subgrupos, comentario };
};

export const serializeSubgrupos = (subgrupos, comentario) => {
  if (!subgrupos || subgrupos.length === 0) return comentario || "";

  const sexoMap = { "Macho": "♂", "Hembra": "♀", "Indet": "❓" };
  const tokens = subgrupos.map(sg => {
    return `${sg.cantidad}${sexoMap[sg.sexo] || "❓"}[${sg.estado || "Ninguno"}](${sg.fecha || ""})`;
  });

  let str = tokens.join(" | ");
  if (comentario && comentario.trim().length > 0) {
    str += " || " + comentario.trim();
  }
  return str;
};

export const normalizarFecha = (fechaStr) => {
  if (!fechaStr) return "";
  const matchYMD = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchYMD) {
    return `${parseInt(matchYMD[3], 10)}/${parseInt(matchYMD[2], 10)}/${matchYMD[1]}`;
  }
  const matchDMY = fechaStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchDMY) {
    return `${parseInt(matchDMY[1], 10)}/${parseInt(matchDMY[2], 10)}/${matchDMY[3]}`;
  }
  return fechaStr;
};

export const getFechaHoyNorm = () => {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const getFechaAyerNorm = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const parseCellId = (id) => {
  const match = id.match(/^E(\d+)-F(\d+)-C(\d+)$/);
  if (match) {
    return {
      estructura: match[1],
      fila: match[2],
      columna: match[3],
    };
  }
  return null;
};

export const parseFechaTrat = (fechaStr) => {
  if (!fechaStr) return null;
  const partsSlash = fechaStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partsSlash) return new Date(partsSlash[3], partsSlash[2] - 1, partsSlash[1]);
  const partsISO = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partsISO) return new Date(partsISO[1], partsISO[2] - 1, partsISO[3]);
  return null;
};

export const esEventoNoTratamiento = (t) => {
  const tipo = (t.tipo || "").toLowerCase();
  return tipo.includes("salida") || tipo.includes("baja") || tipo.includes("traslado") ||
         tipo.includes("ajuste") || tipo.includes("ingreso") || tipo.includes("actualizaci");
};

export const INCIDENCIA_SEMAFORO_DEFAULTS = {
  bajasSemana: "0",
  ojosVelados: "0",
  rojeces: "0",
  caquexia: "0",
  circulos: "0",
  distension: "0",
  letargo: "0",
  empeoran: "0",
  tipoLote: "normal",
};

const numSemaforo = (value) => Number(value || 0);

export const evaluarSemaforoClinico = (form = {}) => {
  const f = {
    bajasSemana: numSemaforo(form.bajasSemana),
    ojosVelados: numSemaforo(form.ojosVelados),
    rojeces: numSemaforo(form.rojeces),
    caquexia: numSemaforo(form.caquexia),
    circulos: numSemaforo(form.circulos),
    distension: numSemaforo(form.distension),
    letargo: numSemaforo(form.letargo),
    empeoran: numSemaforo(form.empeoran),
    tipoLote: form.tipoLote || "normal",
  };

  let score = 0;
  if (f.bajasSemana >= 2) score += 2;
  if (f.bajasSemana >= 3) score += 1;
  if (f.ojosVelados > 0) score += 1;
  if (f.ojosVelados >= 3) score += 1;
  if (f.rojeces > 0) score += 3;
  if (f.caquexia > 0) score += 2;
  if (f.circulos > 0) score += 4;
  if (f.distension > 0) score += 2;
  if (f.letargo > 0) score += 2;
  if (f.empeoran > 0) score += 2;
  if (f.tipoLote === "silvestre" && f.ojosVelados > 0) score += 1;

  let nivel = "VERDE";
  if (f.circulos > 0 || (f.caquexia > 0 && f.letargo > 0 && f.bajasSemana >= 2)) {
    nivel = "NEGRO";
  } else if ((f.rojeces > 0 && f.bajasSemana >= 3) || score >= 8) {
    nivel = "ROJO";
  } else if (score >= 4) {
    nivel = "AMARILLO";
  }

  const severidad = nivel === "VERDE" ? "Baja" : nivel === "AMARILLO" ? "Media" : "Alta";

  let accion = "Observar en lote. Vigilancia 1-2 veces al día y revisar agua/mortalidad. Sin medicar automáticamente.";
  if (nivel === "AMARILLO") {
    accion = "Separar y enfriar. Priorizar oscuridad, agua buena y reevaluación en 24-48 h antes de medicar por sistema.";
  } else if (nivel === "ROJO") {
    accion = "Triaje inmediato del lote. Separar sospechosas, baja densidad y valorar Ganadexil solo si el patrón de verdad parece infeccioso activo.";
  } else if (nivel === "NEGRO") {
    accion = "Separar inmediatamente. Manejo de cero estrés, priorizar necropsia del siguiente muerto y evitar sobrecarga terapéutica si el patrón es terminal.";
  }

  let ganadexil = "No necesario por ahora.";
  if (f.rojeces > 0 || (f.bajasSemana >= 3 && f.empeoran > 0)) {
    ganadexil = "Sí valorar. Si se usa: 0,025 ml/L, 45 min, sin sal en el baño y con agua fresca.";
  } else if (f.tipoLote === "silvestre" && f.ojosVelados > 0 && f.rojeces === 0) {
    ganadexil = "No automático. En silvestres con ojos velados aislados, pensar primero en irritación/queratitis/estrés y evitar sobrecarga química.";
  } else if (f.caquexia > 0 || f.circulos > 0) {
    ganadexil = "Mucho cuidado. Si parece secuela, caquexia o terminalidad, puede castigar más que ayudar.";
  } else if (nivel === "AMARILLO") {
    ganadexil = "De entrada no. Primero separación, frío, oscuridad y seguimiento.";
  }

  const razones = [];
  razones.push(`Score clínico: ${score}`);
  if (f.bajasSemana >= 2) razones.push("Ya supera el umbral práctico de triaje del lote.");
  if (f.ojosVelados > 0) razones.push("Hay afectación ocular: puede ser local o acompañar un cuadro mayor.");
  if (f.rojeces > 0) razones.push("Las rojeces/hemorragias suben mucho la sospecha de infección activa.");
  if (f.caquexia > 0) razones.push("La caquexia apunta a animal crónico o descompensado.");
  if (f.circulos > 0) razones.push("Nadar en círculos = caso avanzado y preocupante.");
  if (f.tipoLote === "silvestre") razones.push("Al ser silvestres, toleran peor el manejo y la sobrecarga terapéutica.");
  razones.push(`Nivel final: ${nivel}`);

  return { nivel, severidad, score, accion, ganadexil, razones };
};

export const construirBloqueSemaforo = (form = {}, resultado = null) => {
  if (!resultado) return "";
  const partes = [
    "[SEMÁFORO CLÍNICO]",
    `Nivel: ${resultado.nivel}`,
    `Score: ${resultado.score}`,
    `Lote: ${form.tipoLote || "normal"}`,
    `Signos: bajas=${numSemaforo(form.bajasSemana)}, ojos=${numSemaforo(form.ojosVelados)}, rojeces=${numSemaforo(form.rojeces)}, caquexia=${numSemaforo(form.caquexia)}, círculos=${numSemaforo(form.circulos)}, distensión=${numSemaforo(form.distension)}, letargo=${numSemaforo(form.letargo)}, empeoran=${numSemaforo(form.empeoran)}`,
    `Acción: ${resultado.accion}`,
    `Ganadexil: ${resultado.ganadexil}`,
    "[/SEMÁFORO CLÍNICO]",
  ];
  return partes.join("\n");
};

export const extraerSemaforoDeNotas = (notas = "") => {
  if (!notas.includes("[SEMÁFORO CLÍNICO]")) return null;
  const bloque = notas.match(/\[SEMÁFORO CLÍNICO\]([\s\S]*?)\[\/SEMÁFORO CLÍNICO\]/);
  if (!bloque) return null;
  const contenido = bloque[1];
  const leer = (label) => {
    const match = contenido.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : "";
  };
  return {
    nivel: leer("Nivel"),
    score: leer("Score"),
    lote: leer("Lote"),
    signos: leer("Signos"),
    accion: leer("Acción"),
    ganadexil: leer("Ganadexil"),
  };
};
