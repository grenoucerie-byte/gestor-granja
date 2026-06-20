import React, { useState } from "react";

function TableHistory({ items, onBorrar, isPuesta, isDashboard = false }) {
  const [filtro, setFiltro] = useState("");
  const [expandido, setExpandido] = useState(false);

  if (items.length === 0)
    return (
      <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>
        Aún no hay registros.
      </p>
    );

  const filtrados = items.filter(
    (p) =>
      (p.fecha || "").includes(filtro) ||
      (p.tanque || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (p.tipo || "").toLowerCase().includes(filtro.toLowerCase()),
  );

  const limite = isDashboard ? 3 : expandido ? filtrados.length : 3;
  const mostrados = filtrados.slice(0, limite);

  const emojiCat = (cat = "") => {
    const c = cat.toLowerCase();
    if (c.includes("antibi") || c.includes("medicament")) return "💊";
    if (c.includes("preventiv") || c.includes("vitamina") || c.includes("suplemento")) return "🛡️";
    if (c.includes("desparasit")) return "🧴";
    if (c.includes("hormona") || c.includes("induccion") || c.includes("inducción")) return "💉";
    if (c.includes("mantenimiento") || c.includes("limpieza") || c.includes("desinfec")) return "🧹";
    if (c.includes("aliment") || c === "alimento") return "🌿";
    return "💊";
  };
  const chipCat = (cat = "") => {
    const c = cat.toLowerCase();
    if (c.includes("antibi") || c.includes("medicament")) return { bg: "#fdecea", color: "#c0392b" };
    if (c.includes("desparasit")) return { bg: "#f0e6ff", color: "#6c3483" };
    if (c.includes("hormona") || c.includes("induccion") || c.includes("inducción")) return { bg: "#fef9e7", color: "#d4ac0d" };
    if (c.includes("preventiv") || c.includes("vitamina") || c.includes("suplemento")) return { bg: "#eaf3fb", color: "#1a5276" };
    if (c.includes("mantenimiento") || c.includes("limpieza") || c.includes("desinfec")) return { bg: "#eef2f5", color: "#34495e" };
    return { bg: "#e8f8f0", color: "#1a7a40" };
  };

  return (
    <div>
      {!isDashboard && (
        <div
          style={{
            marginBottom: "1rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="🔍 Buscar por fecha o tanque..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              flex: 1,
            }}
          />
          <button
            className="btn-guardar"
            onClick={() => setExpandido(!expandido)}
            style={{ padding: "0.5rem 1rem" }}
          >
            {expandido ? "Colapsar (Ver 3)" : "Ver Todos"}
          </button>
        </div>
      )}
      <table className="history-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tanque</th>
            {isPuesta ? (
              <th>Detalles</th>
            ) : (
              <>
                <th>Categoría / Tratamiento</th>
                <th>Dosis</th>
                {!isDashboard && <th>Frecuencia / Pauta</th>}
              </>
            )}
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {mostrados.map((p) => (
            <React.Fragment key={p.id}>
              <tr>
                <td>{p.fecha}</td>
                <td>{p.hora}</td>
                <td>
                  <span
                    className="id-badge"
                    style={{ padding: "0.1rem 0.5rem", fontSize: "0.8rem" }}
                  >
                    {p.tanque}
                  </span>
                </td>
                {isPuesta ? (
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                      {p.destino && (
                        <span style={{ fontSize: "0.78rem", color: "#555" }}>📦 {p.destino}</span>
                      )}
                      {p.tipo_puesta && (
                        <span style={{ background: "#eaf0ff", color: "#2c5282", borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem" }}>{p.tipo_puesta}</span>
                      )}
                      {p.estado && (
                        <span style={{
                          background: p.estado === "Buena" ? "#eaf4ea" : p.estado === "Regular" ? "#fef9e7" : "#fdecea",
                          color: p.estado === "Buena" ? "#27ae60" : p.estado === "Regular" ? "#e67e22" : "#c0392b",
                          borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem"
                        }}>● {p.estado}</span>
                      )}
                      {p.huevos && (
                        <span style={{ color: "#555", fontSize: "0.78rem" }}>🥚 {p.huevos}</span>
                      )}
                      {!p.destino && !p.tipo_puesta && !p.estado && !p.huevos && (
                        <span style={{ color: "#888" }}>{p.grupo || "—"}</span>
                      )}
                    </div>
                  </td>
                ) : (
                  <>
                    <td>
                      {p.tipo === "Baja" ? (
                        <span style={{ fontWeight: "bold", color: "var(--rojo-alerta)" }}>💀 Baja registrada</span>
                      ) : (() => {
                        let cat = p.categoria || "";
                        let producto = p.tipo || "";
                        if (!cat && producto.includes(":")) {
                          const idx = producto.indexOf(":");
                          cat = producto.slice(0, idx).trim();
                          producto = producto.slice(idx + 1).trim();
                        }
                        const chip = chipCat(cat);
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                            {cat && (
                              <span style={{ background: chip.bg, color: chip.color, borderRadius: "4px", padding: "1px 6px", fontSize: "0.75rem", fontWeight: "500", whiteSpace: "nowrap" }}>
                                {emojiCat(cat)} {cat}
                              </span>
                            )}
                            <span style={{ fontSize: "0.85rem" }}>{producto || "—"}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td>{p.dosis || "—"}</td>
                    {!isDashboard && (
                      <td style={{ fontSize: "0.78rem", color: "#555" }}>
                        {p.frecuencia ? (
                          <span>
                            🕐 {p.frecuencia}
                            {p.numDosis ? <strong> × {p.numDosis} dosis</strong> : ""}
                          </span>
                        ) : (
                          <span style={{ color: "#bbb" }}>—</span>
                        )}
                      </td>
                    )}
                  </>
                )}
                <td>
                  <button
                    className="btn-baja-mini"
                    onClick={() =>
                      onBorrar(p.id, isPuesta ? "puesta" : "tratamiento")
                    }
                  >
                    Borrar
                  </button>
                </td>
              </tr>
              {!isDashboard && isPuesta && p.obs && (
                <tr style={{ background: "#fffef0" }}>
                  <td colSpan={5} style={{ fontSize: "0.78rem", color: "#7f6a00", paddingLeft: "2.5rem", paddingTop: "2px", paddingBottom: "6px", borderTop: "none", fontStyle: "italic" }}>
                    💬 {p.obs}
                  </td>
                </tr>
              )}
              {!isDashboard && !isPuesta && p.notas && (
                <tr style={{ background: "#fffef0" }}>
                  <td
                    colSpan={7}
                    style={{
                      fontSize: "0.78rem",
                      color: "#7f6a00",
                      paddingLeft: "2.5rem",
                      paddingTop: "2px",
                      paddingBottom: "6px",
                      borderTop: "none",
                      fontStyle: "italic",
                    }}
                  >
                    📝 {p.notas}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {filtrados.length === 0 && (
            <tr>
              <td colSpan={isPuesta ? 5 : isDashboard ? 6 : 7} style={{ textAlign: "center", color: "#888" }}>
                No hay resultados para la búsqueda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TableHistory;
