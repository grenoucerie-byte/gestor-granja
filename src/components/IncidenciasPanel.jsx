import React from "react";

function IncidenciasPanel({ incidencias, incidenciaForm, setIncidenciaForm, incidenciaCerrarId, setIncidenciaCerrarId, incidenciaNotasCierre, setIncidenciaNotasCierre, abrirIncidencia, cerrarIncidencia, borrarIncidencia, actualizarIncidencia, data }) {
    const abiertas = incidencias.filter((i) => i.estado !== "Cerrada");
    const cerradas = incidencias.filter((i) => i.estado === "Cerrada");

    const colorSeveridad = (sev) => {
      if (sev === "Alta") return { bg: "#fdecea", color: "#c0392b", border: "#f5b7b1" };
      if (sev === "Baja") return { bg: "#eaf4ea", color: "#27ae60", border: "#a9dfbf" };
      return { bg: "#fef9e7", color: "#d68910", border: "#f9e79f" }; // Media
    };

    const handleAbrir = async () => {
      const ok = await abrirIncidencia(incidenciaForm);
      if (ok) {
        setIncidenciaForm({
          fechaInicio: new Date().toLocaleDateString("es-ES"),
          agenteCausante: "",
          racewaysAfectados: "",
          tratCategoria: "Tratamiento Antibiótico",
          tratProducto: "",
          tratDosis: "",
          tratFrecuencia: "",
          severidad: "Media",
          notas: "",
        });
      }
    };

    const Card = ({ inc }) => {
      const sev = colorSeveridad(inc.severidad);
      const cerrando = incidenciaCerrarId === inc.id;
      return (
        <div style={{
          background: "#fff", border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.color}`,
          borderRadius: "8px", padding: "0.9rem 1.1rem", marginBottom: "0.8rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ fontSize: "0.95rem" }}>🦠 {inc.agente_causante}</strong>
                <span style={{ background: sev.bg, color: sev.color, borderRadius: "4px", padding: "1px 7px", fontSize: "0.72rem", fontWeight: "bold" }}>
                  {inc.severidad}
                </span>
                <span style={{
                  background: inc.estado === "Cerrada" ? "#eaf4ea" : "#fdecea",
                  color: inc.estado === "Cerrada" ? "#27ae60" : "#c0392b",
                  borderRadius: "4px", padding: "1px 7px", fontSize: "0.72rem",
                }}>
                  {inc.estado === "Cerrada" ? "✅ Cerrada" : "🔴 Abierta"}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: "4px" }}>
                📅 Inicio: <strong>{inc.fecha_inicio}</strong>
                {inc.fecha_cierre && <> · Cierre: <strong>{inc.fecha_cierre}</strong></>}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#333", marginBottom: "4px" }}>
                📍 Raceways afectados: <strong>{inc.raceways_afectados}</strong>
              </div>
              {inc.tratamiento_aplicado && (
                <div style={{ fontSize: "0.82rem", color: "#333", marginBottom: "4px" }}>
                  💊 Tratamiento: {inc.tratamiento_aplicado}
                </div>
              )}
              {inc.notas && (
                <div style={{ fontSize: "0.78rem", color: "#777", fontStyle: "italic" }}>
                  💬 {inc.notas}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {inc.estado !== "Cerrada" && !cerrando && (
                <button onClick={() => { setIncidenciaCerrarId(inc.id); setIncidenciaNotasCierre(""); }}
                  style={{ background: "var(--oliva)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}>
                  Cerrar incidencia
                </button>
              )}
              <button onClick={() => { if (window.confirm("¿Borrar esta incidencia definitivamente?")) borrarIncidencia(inc.id); }}
                style={{ background: "#f5f5f5", color: "#888", border: "1px solid #ddd", borderRadius: "6px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}>
                Borrar
              </button>
            </div>
          </div>
          {cerrando && (
            <div style={{ marginTop: "0.7rem", paddingTop: "0.7rem", borderTop: "1px solid #eee" }}>
              <textarea
                placeholder="Notas de cierre (opcional): resultado, evolución, lecciones..."
                value={incidenciaNotasCierre}
                onChange={(e) => setIncidenciaNotasCierre(e.target.value)}
                style={{ width: "100%", minHeight: "60px", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  onClick={async () => {
                    await cerrarIncidencia(inc.id, incidenciaNotasCierre);
                    setIncidenciaCerrarId(null);
                    setIncidenciaNotasCierre("");
                  }}
                  style={{ background: "var(--rojo-alerta)", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}
                >
                  ✅ Confirmar cierre
                </button>
                <button onClick={() => setIncidenciaCerrarId(null)}
                  style={{ background: "#e9ecef", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          🚨 Control de Incidencias
        </h2>

        <div style={{ background: "#fff", padding: "1.3rem 1.5rem", borderRadius: "12px", border: "1px solid #ddd", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.9rem 0", fontSize: "1rem" }}>➕ Abrir nueva incidencia</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
            <div className="input-group">
              <label>Fecha de inicio</label>
              <input type="text" value={incidenciaForm.fechaInicio}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Severidad</label>
              <select value={incidenciaForm.severidad}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, severidad: e.target.value }))}>
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Agente causante</label>
              <input type="text" placeholder="Ej: Bacteriosis (Aeromonas sp.), hongo, parásito..."
                value={incidenciaForm.agenteCausante}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, agenteCausante: e.target.value }))} />
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Raceways afectados</label>
              <input type="text" placeholder="Ej: 2.1.3, 2.1.4, UCI-Cen-3..."
                value={incidenciaForm.racewaysAfectados}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, racewaysAfectados: e.target.value }))} />
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Tratamiento a aplicar (opcional — se registrará en cada raceway afectado)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                <select value={incidenciaForm.tratCategoria}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratCategoria: e.target.value }))}>
                  <option value="Tratamiento Antibiótico">Antibiótico</option>
                  <option value="Desparasitación Externa">Desparasit. Externa</option>
                  <option value="Desparasitación Interna">Desparasit. Interna</option>
                  <option value="Inducción Hormonal">Hormonal</option>
                  <option value="Preventivo">Preventivo</option>
                  <option value="Alimento">Alimento</option>
                </select>
                <input type="text" placeholder="Producto (Ej: Ganadexil)"
                  value={incidenciaForm.tratProducto}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratProducto: e.target.value }))} />
                <input type="text" placeholder="Dosis (Ej: 2ml/L)"
                  value={incidenciaForm.tratDosis}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratDosis: e.target.value }))} />
                <input type="text" placeholder="Frecuencia (Ej: 24h x 3d)"
                  value={incidenciaForm.tratFrecuencia}
                  onChange={(e) => setIncidenciaForm((f) => ({ ...f, tratFrecuencia: e.target.value }))} />
              </div>
            </div>
            <div className="input-group" style={{ gridColumn: "span 2" }}>
              <label>Notas</label>
              <textarea value={incidenciaForm.notas}
                onChange={(e) => setIncidenciaForm((f) => ({ ...f, notas: e.target.value }))}
                style={{ minHeight: "60px", resize: "vertical" }} />
            </div>
          </div>
          <button className="btn-guardar" onClick={handleAbrir} style={{ marginTop: "1rem" }}>
            🚨 Abrir Incidencia
          </button>
        </div>

        <h3 style={{ fontSize: "1rem", color: "var(--rojo-alerta)" }}>
          🔴 Incidencias Abiertas ({abiertas.length})
        </h3>
        {abiertas.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>Sin incidencias abiertas.</p>
        ) : (
          abiertas.map((inc) => <Card key={inc.id} inc={inc} />)
        )}

        {cerradas.length > 0 && (
          <>
            <h3 style={{ fontSize: "1rem", color: "#888", marginTop: "1.5rem" }}>
              ✅ Incidencias Cerradas ({cerradas.length})
            </h3>
            {cerradas.map((inc) => <Card key={inc.id} inc={inc} />)}
          </>
        )}
      </div>
    );
}

export default IncidenciasPanel;
