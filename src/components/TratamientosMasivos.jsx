import React from "react";

function TratamientosMasivos({ data, bulkTratSelectedTanks, setBulkTratSelectedTanks, bulkTratCategoria, setBulkTratCategoria, bulkTratProducto, setBulkTratProducto, bulkTratDosis, setBulkTratDosis, bulkTratTiempo, setBulkTratTiempo, bulkTratFecha, setBulkTratFecha, alarmasDesparasitacion, alarmas2aDosis, aplicarTratamientoMasivo, planesTratamiento, inventario }) {
    let allTanks = [];
    Object.keys(data).forEach(grupo => {
      data[grupo].forEach(cell => {
        if (cell.count > 0) allTanks.push({ ...cell, grupoNombre: grupo });
      });
    });
    allTanks.sort((a, b) => a.id.localeCompare(b.id));

    const toggleTank = (id) => {
      if (bulkTratSelectedTanks.includes(id))
        setBulkTratSelectedTanks(bulkTratSelectedTanks.filter(t => t !== id));
      else
        setBulkTratSelectedTanks([...bulkTratSelectedTanks, id]);
    };

    const CHIPS_TRAT = ["Ganadexil (antibiótico)", "Levamisol (desparasit.)", "Sal (desparasit.)", "Inducción hormonal", "Frío (baño)", "Vitaminas", "Calcio"];
    const chipsAlmacen = inventario ? inventario.map(i => i.nombre).filter(Boolean) : [];
    const chips = [...new Set([...chipsAlmacen, ...CHIPS_TRAT])].slice(0, 14);

    const cargarPlanTratamiento = () => {
      const productosEncontrados = new Set();
      bulkTratSelectedTanks.forEach(tanqueId => {
        const plan = planesTratamiento[tanqueId];
        if (plan?.items?.length) {
          const primer = plan.items.find(it => it.producto && !productosEncontrados.has(it.producto));
          if (primer) {
            productosEncontrados.add(primer.producto);
            setBulkTratProducto(primer.producto);
            if (primer.dosis) setBulkTratDosis(primer.dosis);
            if (primer.frecuencia) setBulkTratTiempo(primer.frecuencia);
          }
        }
      });
      if (productosEncontrados.size === 0) alert("Ninguno de los tanques seleccionados tiene un plan de tratamiento definido.");
    };

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          💊 Panel de Tratamientos Masivos
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem" }}>
          {/* Lista de Tanques */}
          <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
              <h3 style={{ margin: 0 }}>Raceways con animales</h3>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button onClick={() => setBulkTratSelectedTanks(alarmasDesparasitacion.filter(id => allTanks.some(t => t.id === id)))}
                  style={{ background: "#ffdddd", color: "#cc0000", border: "1px solid #ff9999", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  ⚠️ Alarmas
                </button>
                <button onClick={() => setBulkTratSelectedTanks(allTanks.map(t => t.id))}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Todos
                </button>
                <button onClick={() => setBulkTratSelectedTanks([])}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Ninguno
                </button>
              </div>
            </div>
            <div style={{ maxHeight: "460px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {allTanks.map(t => {
                const tienePlan = !!(planesTratamiento[t.id]?.items?.length);
                const planResumen = tienePlan ? planesTratamiento[t.id].items.map(i => i.producto).filter(Boolean).join(", ") : null;
                const seleccionado = bulkTratSelectedTanks.includes(t.id);
                const esAlarma = alarmasDesparasitacion.includes(t.id);
                return (
                  <label key={t.id} style={{
                    display: "flex", alignItems: "center", padding: "0.5rem 0.8rem",
                    borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                    background: seleccionado ? "#fff3e0" : esAlarma ? "#fff8f8" : "transparent",
                    borderLeft: esAlarma ? "3px solid #e74c3c" : "3px solid transparent",
                  }}>
                    <input type="checkbox" checked={seleccionado} onChange={() => toggleTank(t.id)}
                      style={{ marginRight: "0.7rem", width: "16px", height: "16px" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{t.id}</span>
                        <span style={{ color: "#888", fontSize: "0.78rem" }}>{t.grupoNombre} · {t.count} ud</span>
                        {t.type && <span style={{ fontSize: "0.7rem", background: "#e8f5e9", color: "#2e7d32", borderRadius: "8px", padding: "0 5px" }}>{t.type}</span>}
                      </div>
                      {tienePlan && <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "1px" }}>💊 {planResumen}</div>}
                      {esAlarma && (() => {
                        const info = alarmas2aDosis.find(a => a.tanqueId === t.id);
                        if (!info) return <div style={{ fontSize: "0.72rem", color: "#e74c3c", fontWeight: "bold" }}>⚠️ 2ª dosis pendiente</div>;
                        return <div style={{ fontSize: "0.72rem", color: info.vencida ? "#c0392b" : "#e67e22", fontWeight: "bold" }}>
                          {info.vencida ? `🔴 2ª dosis VENCIDA (hace ${Math.abs(info.diasParaVencer)}d) — ${info.producto}` : `⚠️ 2ª dosis en ${info.diasParaVencer}d — ${info.producto}`}
                        </div>;
                      })()}
                    </div>
                  </label>
                );
              })}
              {allTanks.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: "2rem" }}>No hay tanques con animales.</p>}
            </div>
          </div>

          {/* Formulario */}
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd", height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Configurar tratamiento</h3>
              <button onClick={cargarPlanTratamiento} disabled={bulkTratSelectedTanks.length === 0}
                style={{ background: "#28a745", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", opacity: bulkTratSelectedTanks.length === 0 ? 0.5 : 1 }}>
                📋 Cargar plan
              </button>
            </div>

            {/* Chips rápidos */}
            <div style={{ marginBottom: "0.9rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#666", display: "block", marginBottom: "0.35rem" }}>Añadir rápido:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {chips.map(chip => (
                  <button key={chip} onClick={() => setBulkTratProducto(chip)}
                    style={{ background: bulkTratProducto === chip ? "#d5f5e3" : "#f0f0f0", border: bulkTratProducto === chip ? "1px solid #27ae60" : "1px solid #ccc", padding: "0.2rem 0.55rem", borderRadius: "12px", cursor: "pointer", fontSize: "0.75rem", color: bulkTratProducto === chip ? "#1a5c30" : "#555" }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Categoría</label>
              <select value={bulkTratCategoria} onChange={e => setBulkTratCategoria(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}>
                <option value="Desparasitación Externa">Desparasitación Externa</option>
                <option value="Desparasitación Interna">Desparasitación Interna</option>
                <option value="Tratamiento Antibiótico">Tratamiento Antibiótico</option>
                <option value="Suplemento / Vitaminas">Suplemento / Vitaminas</option>
                <option value="Alimentación Especial">Alimentación Especial</option>
                <option value="Otro Tratamiento">Otro Tratamiento</option>
              </select>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Producto / Tipo</label>
              <input type="text" value={bulkTratProducto} onChange={e => setBulkTratProducto(e.target.value)}
                placeholder="Ej. Ganadexil, Levamisol..."
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Dosis</label>
              <input type="text" value={bulkTratDosis} onChange={e => setBulkTratDosis(e.target.value)}
                placeholder="Ej. 0,1ml/L"
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Fecha</label>
              <input type="date" value={bulkTratFecha} onChange={e => setBulkTratFecha(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc" }} />
            </div>

            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "bold", fontSize: "0.85rem" }}>Observación / Pauta</label>
              <input type="text" value={bulkTratTiempo} onChange={e => setBulkTratTiempo(e.target.value)}
                placeholder="Ej. Baño 24h, 2ª dosis en 7 días..."
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }} />
            </div>

            <button onClick={aplicarTratamientoMasivo} disabled={bulkTratSelectedTanks.length === 0}
              style={{ width: "100%", padding: "0.9rem", background: "#28a745", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer", opacity: bulkTratSelectedTanks.length === 0 ? 0.5 : 1 }}>
              💊 Aplicar a {bulkTratSelectedTanks.length} tanque(s)
            </button>
          </div>
        </div>
      </div>
    );
}

export default TratamientosMasivos;
