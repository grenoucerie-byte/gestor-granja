import { useEffect } from "react";

// Curva de peso simple en SVG puro (sin dependencias nuevas: el bundle ya
// tiene un aviso de tamaño en el informe técnico, así que evitamos sumar
// una librería de gráficos solo para esto).
function CurvaPeso({ puntos }) {
  if (!puntos || puntos.length === 0) {
    return (
      <p style={{ color: "#888", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
        Aún no hay pesajes registrados para este tanque. Se irán guardando cada vez que edites el peso medio en esta celda.
      </p>
    );
  }

  const w = 520;
  const h = 180;
  const padL = 42;
  const padR = 16;
  const padT = 14;
  const padB = 28;

  const pesos = puntos.map((p) => p.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const rango = max - min || 1;

  const x = (i) => padL + (i * (w - padL - padR)) / Math.max(puntos.length - 1, 1);
  const y = (peso) => padT + (h - padT - padB) * (1 - (peso - min) / rango);

  const pathD = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.peso)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* líneas guía horizontales */}
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={padL} x2={w - padR}
          y1={padT + (h - padT - padB) * f} y2={padT + (h - padT - padB) * f}
          stroke="#e9ecef" strokeWidth="1"
        />
      ))}
      <text x={4} y={padT + 4} fontSize="9" fill="#888">{max.toFixed(2)}g</text>
      <text x={4} y={h - padB + 4} fontSize="9" fill="#888">{min.toFixed(2)}g</text>

      <path d={pathD} fill="none" stroke="var(--pistacho, #27ae60)" strokeWidth="2" />

      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.peso)} r="3.5" fill="var(--oliva, #556b2f)" />
          <title>{`${p.fecha} — ${p.peso}g/ud`}</title>
        </g>
      ))}

      {puntos.map((p, i) => {
        if (puntos.length > 8 && i % Math.ceil(puntos.length / 8) !== 0 && i !== puntos.length - 1) return null;
        return (
          <text key={`lbl-${i}`} x={x(i)} y={h - padB + 16} fontSize="8" fill="#888" textAnchor="middle">
            {p.fecha}
          </text>
        );
      })}
    </svg>
  );
}

function LineaTiempoMovimientos({ movimientos, cargando, error }) {
  if (cargando) {
    return <p style={{ color: "#888", fontSize: "0.85rem", textAlign: "center" }}>Cargando movimientos…</p>;
  }
  if (error) {
    return <p style={{ color: "var(--rojo-alerta, #c0392b)", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>;
  }
  if (!movimientos || movimientos.length === 0) {
    return (
      <p style={{ color: "#888", fontSize: "0.85rem", textAlign: "center", padding: "0.5rem" }}>
        Sin movimientos registrados para este tanque todavía (los traslados nuevos sí quedarán aquí).
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {movimientos.map((m, i) => {
        const esEntrada = m.direccion === "entrada";
        const esTriaje = (m.motivo || "").toLowerCase().includes("triaje") || (m.motivo || "").toLowerCase().includes("desdoble");
        return (
          <div
            key={m.id || i}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.4rem 0.6rem", borderRadius: "6px",
              background: esEntrada ? "#eaf4ea" : "#fdf2f2",
              border: `1px solid ${esEntrada ? "#a9dfbf" : "#f5c6c6"}`,
              fontSize: "0.8rem",
            }}
          >
            <span>{esEntrada ? "📥" : "📤"}</span>
            <span style={{ color: "#555", minWidth: "80px" }}>{m.fecha}</span>
            <span style={{ fontWeight: 600, color: esEntrada ? "#1e8449" : "#a93226" }}>
              {esEntrada ? "Entró a este tanque" : "Salió de este tanque"}
            </span>
            {esTriaje && (
              <span style={{ background: "#fef9e7", color: "#b9770e", borderRadius: "4px", padding: "1px 6px", fontSize: "0.72rem", fontWeight: "bold" }}>
                🔀 Triaje
              </span>
            )}
            {m.motivo && <span style={{ color: "#777", fontStyle: "italic" }}>— {m.motivo}</span>}
          </div>
        );
      })}
    </div>
  );
}

function HistorialCrecimiento({ tanqueId, tratamientos, historial, onClose }) {
  const { historialMovimientos, cargandoHistorial, errorHistorial, cargarMovimientosTanque, obtenerCurvaPeso } = historial;

  useEffect(() => {
    cargarMovimientosTanque(tanqueId);
    // Solo al abrir/cambiar de tanque — cargarMovimientosTanque es estable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanqueId]);

  const curva = obtenerCurvaPeso(tanqueId, tratamientos);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "12px", padding: "1.2rem 1.4rem",
          width: "min(600px, 92vw)", maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--oliva, #556b2f)" }}>
            📈 Histórico de crecimiento — {tanqueId}
          </h3>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#888" }}
          >
            ✕
          </button>
        </div>

        <h4 style={{ fontSize: "0.85rem", color: "#495057", marginBottom: "0.4rem" }}>Curva de peso medio (g/ud)</h4>
        <CurvaPeso puntos={curva} />

        <h4 style={{ fontSize: "0.85rem", color: "#495057", margin: "1rem 0 0.4rem" }}>
          Entradas, salidas y triajes de este tanque
        </h4>
        <LineaTiempoMovimientos movimientos={historialMovimientos} cargando={cargandoHistorial} error={errorHistorial} />
      </div>
    </div>
  );
}

export default HistorialCrecimiento;
