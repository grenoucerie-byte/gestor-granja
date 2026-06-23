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
