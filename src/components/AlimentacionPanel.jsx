import React, { useState } from "react";

function AlimentacionPanel({ data, planesAlimentacion = {}, setPlanesAlimentacion, planesFase = {}, setPlanesFase, editandoFase, setEditandoFase, productosDisponibles = [], setProductosDisponibles, nuevoProd = "", setNuevoProd, registrosAlimentacion = [], setRegistrosAlimentacion, planesExpanded, setPlanesExpanded, planesFaseExpanded, setPlanesFaseExpanded, bulkAlimSelectedTanks = [], setBulkAlimSelectedTanks, bulkAlimItems = [{ producto: "", gramos: "" }], setBulkAlimItems, bulkAlimFecha, setBulkAlimFecha, bulkAlimTomas = "1", setBulkAlimTomas, isCloudConnected, guardarPlanesEnNube, cloudConfig = {}, obtenerCabeceras, inventario = [] }) {

  // ─── Funciones del sistema de Alimentación ─────────────────────────────────

  // Registrar raciones para múltiples tanques a la vez
  const registrarAlimentacionMasiva = () => {
    if (bulkAlimSelectedTanks.length === 0) return alert("Selecciona al menos un tanque.");
    const itemsValidos = bulkAlimItems.filter(i => i.producto.trim() !== "");
    if (itemsValidos.length === 0) return alert("Añade al menos un alimento con producto.");

    const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const [yyyy, mm, dd] = bulkAlimFecha.split("-");
    const fechaFormat = `${dd}/${mm}/${yyyy}`;

    const batchId = Date.now();
    const nuevosRegistros = [];
    bulkAlimSelectedTanks.forEach(tanqueId => {
      let grupoTanque = "adultas";
      Object.keys(data).forEach(g => {
        if (data[g].some(c => c.id === tanqueId)) grupoTanque = g;
      });
      itemsValidos.forEach(item => {
        const gramosPorToma = parseFloat(item.gramosPorToma || item.gramos) || 0;
        const tomasItem = parseInt(item.tomas) || 1;
        nuevosRegistros.push({
          id: batchId + Math.random(),
          batchId,
          fecha: fechaFormat,
          hora,
          tanqueId,
          grupo: grupoTanque,
          producto: item.producto.trim(),
          gramosPorToma,
          tomas: tomasItem,
          gramos: gramosPorToma * tomasItem,
        });
      });
    });

    const actualizados = [...nuevosRegistros, ...registrosAlimentacion].slice(0, 500);
    setRegistrosAlimentacion(actualizados);

    if (isCloudConnected && cloudConfig.url) {
      nuevosRegistros.forEach(reg => {
        fetch(`${cloudConfig.url}/rest/v1/alimentacion`, {
          method: "POST",
          headers: { ...obtenerCabeceras(), Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ ...reg, id: Math.floor(reg.id) }),
        }).catch(e => console.warn("Error al guardar alimentación en nube:", e));
      });
    }

    const totalG = nuevosRegistros.reduce((s, r) => s + r.gramos, 0) / bulkAlimSelectedTanks.length;
    alert(`✅ Registro diario guardado — ${bulkAlimSelectedTanks.length} tanque(s) · ${totalG.toFixed(1)}g/tanque.`);
    setBulkAlimItems([{ producto: "", gramosPorToma: "", tomas: "1" }]);
    setBulkAlimSelectedTanks([]);
  };

  // Cargar plan para todos los tanques seleccionados en alimentación masiva
  // Prioridad: 1) plan individual del raceway  2) plan de fase (cell.type)  3) nada
  const cargarPlanMasivo = () => {
    const items = [];
    const planesEncontrados = new Set();
    let usandoFase = false;

    bulkAlimSelectedTanks.forEach(tanqueId => {
      // Buscar datos del tanque
      let tankData = null;
      Object.keys(data).forEach(g => {
        const found = data[g].find(c => c.id === tanqueId);
        if (found) tankData = found;
      });

      // Resolución de plan: individual > fase > nada
      const planIndividual = planesAlimentacion[tanqueId];
      const fase = tankData?.type;
      const planFase = fase ? planesFase[fase] : null;
      const plan = (planIndividual?.items?.length) ? planIndividual : planFase;
      if (!plan?.items?.length) return;
      if (!planIndividual?.items?.length && planFase?.items?.length) usandoFase = true;

      plan.items.forEach(item => {
        if (!planesEncontrados.has(item.producto)) {
          planesEncontrados.add(item.producto);
          let gramos = item.cantidad || item.gramosPorToma || item.gramos || 0;
          if ((plan.modo || "fijos") === "biomasa" && tankData && (tankData.pesoMedio || tankData.peso_medio) && tankData.count) {
            const pm = parseFloat(tankData.pesoMedio || tankData.peso_medio);
            const biomasaTotal = pm * parseInt(tankData.count);
            gramos = ((parseFloat(item.cantidad) || 0) / 100 * biomasaTotal).toFixed(1);
          }
          items.push({
            producto: item.producto,
            gramosPorToma: String(gramos),
            tomas: String(item.tomas || plan.tomasAl_dia || 1),
          });
        }
      });
    });

    if (items.length === 0) return alert("Ninguno de los tanques seleccionados tiene plan individual ni plan de fase definido.");
    setBulkAlimItems(items);
    if (usandoFase) {
      // Pequeño aviso no bloqueante
      setTimeout(() => {}, 0); // placeholder — podría mostrarse en UI
    }
  };

  // Función que renderiza el Tab completo de Alimentación masiva
    const productosAlmacen = inventario ? inventario.map(i => i.nombre).filter(Boolean) : [];
    const chipsBase = ["Micro-pellets", "Spirulina", "Calcio carbonato", "Asticot", "Vitaminas", "Alimento vivo"];
    const chipsPreset = [...new Set([...productosAlmacen, ...chipsBase])].slice(0, 12);

    let allTanks = [];
    Object.keys(data).forEach(grupo => {
      data[grupo].forEach(cell => {
        if (cell.count > 0) allTanks.push({ ...cell, grupoNombre: grupo });
      });
    });
    allTanks.sort((a, b) => a.id.localeCompare(b.id));

    // Calcular qué tanques tocan hoy según su frecuencia
    const diasSemana = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const hoyDia = new Date().getDay(); // 0=Dom, 1=Lun...
    const tocaHoy = (tanqueId) => {
      // Plan individual > plan de fase > asumir diario
      const planIndividual = planesAlimentacion[tanqueId];
      const tankCell = allTanks.find(t => t.id === tanqueId);
      const planFaseActual = tankCell?.type ? planesFase[tankCell.type] : null;
      const frec = planIndividual?.frecuencia || planFaseActual?.frecuencia || "Diario";
      if (frec === "Diario") return true;
      if (frec === "Días alternos") {
        const d = new Date(); const inicio = new Date(d.getFullYear(),0,0);
        const diaAnyo = Math.floor((d - inicio) / 86400000);
        return diaAnyo % 2 === 0;
      }
      if (frec === "Lun-Mié-Vie") return [1,3,5].includes(hoyDia);
      if (frec === "Mar-Jue-Sáb") return [2,4,6].includes(hoyDia);
      if (frec === "Solo laborables") return hoyDia >= 1 && hoyDia <= 5;
      return true;
    };

    // Últimos 30 registros de alimentación
    const ultimos30 = registrosAlimentacion.slice(0, 30);

    // Total consumido hoy
    const hoy = new Date().toLocaleDateString("es-ES");
    const consumoHoy = registrosAlimentacion
      .filter(r => r.fecha === hoy)
      .reduce((acc, r) => acc + (r.gramos || 0), 0);

    const FASES = ["Recién eclosionado","Renacuajo S","Renacuajo M","2 patas","4 patas","Ranita con cola","Recién metamorf.","Iniciación","Juvenil","Engorde","Reproductora"];
    const savePlanFase = (fase, nuevoplan) => setPlanesFase(prev => ({ ...prev, [fase]: nuevoplan }));
    const deletePlanFase = (fase) => setPlanesFase(prev => { const n = { ...prev }; delete n[fase]; return n; });

    return (
      <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem" }}>
          🌿 Panel de Alimentación
        </h2>

        {/* ── CATÁLOGO DE PRODUCTOS ── */}
        <div style={{ marginBottom: "1.5rem", background: "#f9f9f9", border: "1px solid #ddd", borderRadius: "12px", padding: "0.9rem 1.2rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#444", marginBottom: "0.6rem" }}>🗂 Catálogo de productos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
            {productosDisponibles.map(p => (
              <span key={p} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#fff", border: "1px solid #ccc", borderRadius: "12px", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}>
                {p}
                <button onClick={() => setProductosDisponibles(prev => prev.filter(x => x !== p))}
                  style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input type="text" value={nuevoProd} onChange={e => setNuevoProd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && nuevoProd.trim()) { setProductosDisponibles(prev => [...prev, nuevoProd.trim()]); setNuevoProd(""); }}}
              placeholder="Nuevo producto..." style={{ flex: 1, padding: "0.3rem 0.6rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.8rem" }} />
            <button onClick={() => { if (nuevoProd.trim()) { setProductosDisponibles(prev => [...prev, nuevoProd.trim()]); setNuevoProd(""); }}}
              style={{ padding: "0.3rem 0.8rem", borderRadius: "6px", background: "#27ae60", color: "white", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>+ Añadir</button>
          </div>
        </div>

        {/* ── PLANES POR FASE ── */}
        <div style={{ marginBottom: "1.5rem", background: "#f8fff8", border: "1px solid #c8e6c9", borderRadius: "12px", overflow: "hidden" }}>
          <button
            onClick={() => setPlanesFaseExpanded(v => !v)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.2rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold", color: "#2e7d32" }}
          >
            <span>📋 Planes de alimentación por fase biológica</span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <span style={{ fontWeight: "normal", fontSize: "0.8rem", color: "#666" }}>
                {Object.keys(planesFase).length} fase(s) definida(s) · heredado por raceways sin plan propio
              </span>
              {planesFaseExpanded ? "▲" : "▼"}
            </span>
          </button>

          {planesFaseExpanded && (
            <div style={{ padding: "0 1.2rem 1.2rem 1.2rem" }}>
              {/* Chips para añadir fase */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                {FASES.filter(f => !planesFase[f]).map(fase => (
                  <button key={fase}
                    onClick={() => { savePlanFase(fase, { items: [{ producto: "", cantidad: "", tomas: "1" }], frecuencia: "Diario", modo: "fijos", notas: "" }); setEditandoFase(fase); }}
                    style={{ padding: "0.25rem 0.7rem", fontSize: "0.78rem", borderRadius: "10px", cursor: "pointer", border: "1px dashed #81c784", background: "white", color: "#388e3c" }}>
                    + {fase}
                  </button>
                ))}
                {FASES.every(f => planesFase[f]) && <span style={{ fontSize: "0.8rem", color: "#888" }}>Todas las fases tienen plan definido.</span>}
              </div>

              {/* Cards de fases definidas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {Object.entries(planesFase).map(([fase, plan]) => {
                  const editando = editandoFase === fase;
                  // Contar cuántos raceways usan este plan de fase
                  let usando = 0;
                  Object.values(data).forEach(grupo => grupo.forEach(cell => {
                    if (cell.type === fase && !planesAlimentacion[cell.id]?.items?.length) usando++;
                  }));
                  return (
                    <div key={fase} style={{ background: "white", border: editando ? "2px solid #27ae60" : "1px solid #c8e6c9", borderRadius: "10px", overflow: "hidden" }}>
                      {/* Header de la card */}
                      <div style={{ background: editando ? "#e8f5e9" : "#f1f8f1", padding: "0.6rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#1b5e20" }}>{fase}</span>
                          <span style={{ fontSize: "0.75rem", color: "#666", marginLeft: "0.6rem" }}>
                            {usando > 0 ? `${usando} raceway(s) la usan` : "sin raceways aún"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button onClick={() => setEditandoFase(editando ? null : fase)}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid #aaa", background: "white", cursor: "pointer" }}>
                            {editando ? "✓ Cerrar" : "✏️ Editar"}
                          </button>
                          <button onClick={() => { deletePlanFase(fase); if (editandoFase === fase) setEditandoFase(null); }}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid #e57373", background: "white", color: "#c62828", cursor: "pointer" }}>
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Resumen cuando está cerrado */}
                      {!editando && (
                        <div style={{ padding: "0.5rem 0.9rem", fontSize: "0.78rem", color: "#444" }}>
                          <div>{(plan.items || []).filter(i => i.producto).map(i => `${i.producto}${i.cantidad ? ` ${i.cantidad}${plan.modo === "biomasa" ? "% bio" : "g/toma"}` : ""}`).join(" · ") || <span style={{ color: "#bbb" }}>Sin productos</span>}</div>
                          <div style={{ color: "#888", marginTop: "2px" }}>{plan.frecuencia || "Diario"} · {plan.tomasAl_dia || 1} toma(s)/día{(plan.diasMin || plan.diasMax) ? ` · ⏱ ${plan.diasMin || "?"}–${plan.diasMax || "?"}d` : ""}</div>
                        </div>
                      )}

                      {/* Editor expandido */}
                      {editando && (
                        <div style={{ padding: "0.8rem 0.9rem" }}>
                          {/* Modo */}
                          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
                            {["fijos","biomasa"].map(modo => (
                              <button key={modo} onClick={() => savePlanFase(fase, { ...plan, modo })}
                                style={{ flex: 1, padding: "0.25rem", fontSize: "0.72rem", borderRadius: "6px", cursor: "pointer",
                                  border: (plan.modo||"fijos") === modo ? "2px solid #27ae60" : "1px solid #ccc",
                                  background: (plan.modo||"fijos") === modo ? "#e8f8f0" : "white",
                                  fontWeight: (plan.modo||"fijos") === modo ? "bold" : "normal", color: (plan.modo||"fijos") === modo ? "#1a7a40" : "#555" }}>
                                {modo === "fijos" ? "⚖️ Gramos fijos" : "📊 % Biomasa"}
                              </button>
                            ))}
                          </div>
                          {/* Frecuencia + tomas */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "0.4rem", marginBottom: "0.5rem" }}>
                            <select value={plan.frecuencia || "Diario"} onChange={e => savePlanFase(fase, { ...plan, frecuencia: e.target.value })}
                              style={{ padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                              {["Diario","Días alternos","Lun-Mié-Vie","Mar-Jue-Sáb","Solo laborables"].map(f => <option key={f}>{f}</option>)}
                            </select>
                            <select value={plan.tomasAl_dia || "1"} onChange={e => savePlanFase(fase, { ...plan, tomasAl_dia: e.target.value })}
                              style={{ padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                              {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×/día</option>)}
                            </select>
                          </div>
                          {/* Productos */}
                          <datalist id="grenoucerie-productos">
                            {productosDisponibles.map(p => <option key={p} value={p} />)}
                          </datalist>
                          {(plan.items || []).map((item, idx) => {
                            const esOcasional = item.tipo === "ocasional";
                            const toggleTipo = () => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], tipo: esOcasional ? "fijo" : "ocasional" }; savePlanFase(fase, { ...plan, items }); };
                            return (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 46px 68px 22px", gap: "3px", marginBottom: "4px", alignItems: "center" }}>
                              <input type="text" list="grenoucerie-productos" value={item.producto || ""} placeholder="Producto..."
                                onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], producto: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                style={{ gridColumn: "1", padding: "0.3rem 0.4rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc" }} />
                              {esOcasional ? (
                                <span style={{ gridColumn: "2 / 4", fontSize: "0.7rem", color: "#999", fontStyle: "italic", paddingLeft: "4px" }}>cuando nec.</span>
                              ) : (
                                <>
                                  <input type="text" value={item.cantidad || ""} placeholder={plan.modo === "biomasa" ? "%" : "g/toma"}
                                    onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], cantidad: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                    style={{ gridColumn: "2", padding: "0.3rem 0.4rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", textAlign: "right" }} />
                                  <select value={item.tomas || "1"} onChange={e => { const items = [...(plan.items||[])]; items[idx] = { ...items[idx], tomas: e.target.value }; savePlanFase(fase, { ...plan, items }); }}
                                    style={{ gridColumn: "3", padding: "0.3rem 0.2rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #ccc" }}>
                                    {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×</option>)}
                                  </select>
                                </>
                              )}
                              <button onClick={toggleTipo} style={{ gridColumn: "4", fontSize: "0.62rem", padding: "0.15rem 0.3rem", borderRadius: "4px", cursor: "pointer", border: "1px solid", background: esOcasional ? "#e8f4fd" : "#f0faf0", borderColor: esOcasional ? "#90caf9" : "#a5d6a7", color: esOcasional ? "#1565c0" : "#2e7d32" }}>
                                {esOcasional ? "💧 Ocas." : "📅 Fijo"}
                              </button>
                              <button onClick={() => { const items = (plan.items||[]).filter((_,i) => i !== idx); savePlanFase(fase, { ...plan, items }); }}
                                style={{ gridColumn: "5", background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "0.9rem" }}>×</button>
                            </div>
                            );
                          })}
                          <button onClick={() => savePlanFase(fase, { ...plan, items: [...(plan.items||[]), { producto: "", cantidad: "", tomas: "1", tipo: "fijo" }] })}
                            style={{ fontSize: "0.75rem", background: "#e8f8f0", border: "1px dashed #2ecc71", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#27ae60", marginTop: "3px", width: "100%" }}>
                            + Añadir producto
                          </button>
                          <textarea value={plan.notas || ""} onChange={e => savePlanFase(fase, { ...plan, notas: e.target.value })}
                            placeholder="Notas..." rows={2}
                            style={{ width: "100%", marginTop: "0.4rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #ccc", padding: "0.3rem", resize: "vertical", boxSizing: "border-box" }} />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginTop: "0.5rem" }}>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#666", marginBottom: "2px" }}>🟡 Días mín. en fase</div>
                              <input type="number" min="1" value={plan.diasMin || ""} placeholder="—"
                                onChange={e => savePlanFase(fase, { ...plan, diasMin: e.target.value ? parseInt(e.target.value) : null })}
                                style={{ width: "100%", padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                            </div>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#666", marginBottom: "2px" }}>🔴 Días máx. en fase</div>
                              <input type="number" min="1" value={plan.diasMax || ""} placeholder="—"
                                onChange={e => savePlanFase(fase, { ...plan, diasMax: e.target.value ? parseInt(e.target.value) : null })}
                                style={{ width: "100%", padding: "0.3rem", fontSize: "0.78rem", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem" }}>

          {/* ── Columna izquierda: Lista de tanques ── */}
          <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h3 style={{ margin: 0 }}>Raceways con animales</h3>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => setBulkAlimSelectedTanks(allTanks.filter(t => tocaHoy(t.id)).map(t => t.id))}
                  style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", padding: "0.3rem 0.7rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", color: "#2e7d32", fontWeight: "bold" }}>
                  ✅ Los de hoy
                </button>
                <button onClick={() => setBulkAlimSelectedTanks(allTanks.map(t => t.id))}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Todos
                </button>
                <button onClick={() => setBulkAlimSelectedTanks([])}
                  style={{ background: "#e9ecef", border: "none", padding: "0.3rem 0.7rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                  Ninguno
                </button>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#999", margin: "0 0 0.7rem 0" }}>
              {diasSemana[hoyDia]} — {allTanks.filter(t => tocaHoy(t.id)).length} tanque(s) según plan de hoy
            </p>
            <div style={{ maxHeight: "440px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {allTanks.map(t => {
                const plan = planesAlimentacion[t.id];
                const tienePlan = !!(plan?.items?.length);
                const frecuencia = plan?.frecuencia || (tienePlan ? "Diario" : null);
                const tomas = plan?.tomasAl_dia || "1";
                const esHoy = tocaHoy(t.id);
                const seleccionado = bulkAlimSelectedTanks.includes(t.id);
                return (
                  <label key={t.id} style={{
                    display: "flex", alignItems: "center", padding: "0.5rem 0.8rem",
                    borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                    background: seleccionado ? "#e8f8f0" : esHoy && tienePlan ? "#fffde7" : "transparent",
                    borderLeft: esHoy && tienePlan ? "3px solid #f9a825" : "3px solid transparent",
                  }}>
                    <input type="checkbox"
                      checked={seleccionado}
                      onChange={() => {
                        if (seleccionado)
                          setBulkAlimSelectedTanks(bulkAlimSelectedTanks.filter(id => id !== t.id));
                        else
                          setBulkAlimSelectedTanks([...bulkAlimSelectedTanks, t.id]);
                      }}
                      style={{ marginRight: "0.7rem", width: "16px", height: "16px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{t.id}</span>
                        <span style={{ color: "#888", fontSize: "0.78rem" }}>{t.grupoNombre} · {t.count} ud</span>
                      </div>
                      {tienePlan && (
                        <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "1px" }}>
                          📋 {frecuencia} · {tomas} toma{parseInt(tomas)>1?"s":""}/día
                          {plan?.modo === "biomasa" && " · % biomasa"}
                        </div>
                      )}
                      {!tienePlan && (() => {
                        const planF = t.type ? planesFase[t.type] : null;
                        if (planF?.items?.length) return (
                          <div style={{ fontSize: "0.72rem", color: "#2e7d32", marginTop: "1px" }}>
                            🌿 Plan de fase: {t.type}
                          </div>
                        );
                        return <div style={{ fontSize: "0.72rem", color: "#bbb" }}>Sin plan definido</div>;
                      })()}
                    </div>
                    {esHoy && tienePlan && !seleccionado && (
                      <span style={{ fontSize: "0.7rem", color: "#f9a825", fontWeight: "bold", flexShrink: 0 }}>HOY</span>
                    )}
                  </label>
                );
              })}
              {allTanks.length === 0 && <p style={{ textAlign: "center", color: "#aaa", padding: "2rem" }}>No hay tanques activos.</p>}
            </div>
          </div>

          {/* ── Columna derecha: Registro diario ── */}
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Registro diario</h3>
                <p style={{ margin: "0.1rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>Un registro por día · engloba todas las tomas</p>
              </div>
              <button
                onClick={cargarPlanMasivo}
                disabled={bulkAlimSelectedTanks.length === 0}
                style={{ background: "#28a745", color: "white", border: "none", padding: "0.4rem 0.9rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", opacity: bulkAlimSelectedTanks.length === 0 ? 0.5 : 1 }}>
                📋 Cargar plan
              </button>
            </div>

            {/* Fecha */}
            <div style={{ margin: "0.9rem 0 1rem 0" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.4rem", fontSize: "0.85rem" }}>Fecha del registro</label>
              <input type="date" value={bulkAlimFecha}
                onChange={e => setBulkAlimFecha(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc" }} />
            </div>

            {/* Chips de presets */}
            <div style={{ marginBottom: "0.8rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#666", marginBottom: "0.35rem" }}>Añadir alimento rápido:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {chipsPreset.map(chip => (
                  <button key={chip}
                    onClick={() => setBulkAlimItems(prev => {
                      const yaEsta = prev.some(i => i.producto === chip);
                      if (yaEsta) return prev;
                      return [...prev.filter(i => i.producto !== ""), { producto: chip, gramosPorToma: "" }];
                    })}
                    style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", padding: "0.2rem 0.55rem", borderRadius: "12px", cursor: "pointer", fontSize: "0.76rem", color: "#2e7d32" }}>
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Filas de alimento: producto + g/toma + nº tomas + total */}
            <div style={{ marginBottom: "0.8rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 70px 55px 24px", gap: "0.3rem", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.71rem", color: "#888", paddingLeft: "2px" }}>Producto</span>
                <span style={{ fontSize: "0.71rem", color: "#888", textAlign: "center" }}>g/toma</span>
                <span style={{ fontSize: "0.71rem", color: "#888", textAlign: "center" }}>tomas</span>
                <span style={{ fontSize: "0.71rem", color: "#27ae60", textAlign: "right" }}>total</span>
                <span />
              </div>
              {bulkAlimItems.map((item, idx) => {
                const gToma = parseFloat(item.gramosPorToma || item.gramos) || 0;
                const tomas = parseInt(item.tomas || 1);
                const totalDia = gToma * tomas;
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 65px 70px 55px 24px", gap: "0.3rem", marginBottom: "0.35rem", alignItems: "center" }}>
                    <input type="text" list="grenoucerie-productos" placeholder="Producto..."
                      value={item.producto}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, producto: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.83rem" }} />
                    <input type="number" placeholder="g"
                      value={item.gramosPorToma ?? ""}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, gramosPorToma: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.4rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.83rem", textAlign: "right" }} />
                    <select
                      value={item.tomas || "1"}
                      onChange={e => setBulkAlimItems(prev => prev.map((it, i) => i === idx ? { ...it, tomas: e.target.value } : it))}
                      style={{ padding: "0.4rem 0.3rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.8rem" }}>
                      {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}×</option>)}
                    </select>
                    <div style={{ background: totalDia > 0 ? "#e8f8f0" : "#f5f5f5", borderRadius: "4px", padding: "0.4rem 0.3rem", fontSize: "0.8rem", color: "#27ae60", fontWeight: "bold", textAlign: "right" }}>
                      {totalDia > 0 ? `${totalDia.toFixed(1)}g` : "—"}
                    </div>
                    <button onClick={() => setBulkAlimItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                      style={{ background: "#ff7675", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", height: "30px", lineHeight: "30px" }}>×</button>
                  </div>
                );
              })}
              <button onClick={() => setBulkAlimItems(prev => [...prev, { producto: "", gramosPorToma: "", tomas: "1" }])}
                style={{ background: "transparent", border: "1px dashed #aaa", width: "100%", padding: "0.35rem", borderRadius: "6px", cursor: "pointer", color: "#666", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                + Añadir alimento
              </button>
            </div>

            {/* Resumen total del día */}
            {(() => {
              const totalDia = bulkAlimItems.reduce((s, it) => s + (parseFloat(it.gramosPorToma) || 0) * (parseInt(it.tomas) || 1), 0);
              if (totalDia === 0) return null;
              return (
                <div style={{ background: "#e8f8f0", border: "1px solid #b2dfdb", borderRadius: "6px", padding: "0.5rem 0.8rem", fontSize: "0.82rem", color: "#1b5e20", marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>📊 Total consumo diario:</span>
                    <strong>{totalDia.toFixed(1)} g/día</strong>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#388e3c", marginTop: "0.2rem" }}>
                    {bulkAlimItems.filter(it => it.producto && it.gramosPorToma).map((it, i) => (
                      <span key={i} style={{ marginRight: "0.8rem" }}>
                        {it.producto}: {((parseFloat(it.gramosPorToma)||0)*(parseInt(it.tomas)||1)).toFixed(1)}g ({it.tomas||1}×{parseFloat(it.gramosPorToma)||0}g)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Botón registrar */}
            <button
              onClick={registrarAlimentacionMasiva}
              disabled={bulkAlimSelectedTanks.length === 0}
              style={{ width: "100%", padding: "0.9rem", background: "var(--pistacho)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer", opacity: bulkAlimSelectedTanks.length === 0 ? 0.5 : 1 }}>
              🌿 Guardar registro diario — {bulkAlimSelectedTanks.length} tanque(s)
            </button>

            {/* Resumen consumo hoy */}
            {consumoHoy > 0 && (
              <div style={{ marginTop: "1rem", background: "#e8f5e9", padding: "0.6rem 1rem", borderRadius: "8px", fontSize: "0.85rem", color: "#2e7d32" }}>
                🌿 Consumo hoy: <strong>{consumoHoy.toFixed(1)} g</strong> registrados
              </div>
            )}
          </div>
        </div>

        {/* ── Historial agrupado por registro diario ── */}
        {registrosAlimentacion.length > 0 && (() => {
          // Agrupar por batchId (registros nuevos) o por fecha+tanqueId+hora (registros legacy)
          const grupos = [];
          const vistos = new Map();
          registrosAlimentacion.forEach(r => {
            const clave = r.batchId ? `batch_${r.batchId}_${r.tanqueId}` : `${r.fecha}_${r.tanqueId}_${r.hora}`;
            if (!vistos.has(clave)) {
              vistos.set(clave, { fecha: r.fecha, hora: r.hora, tanqueId: r.tanqueId, grupo: r.grupo, items: [], totalG: 0 });
              grupos.push(vistos.get(clave));
            }
            const g = vistos.get(clave);
            g.items.push({ producto: r.producto, gramosPorToma: r.gramosPorToma || r.gramos, tomas: r.tomas || 1, total: r.gramos });
            g.totalG += r.gramos || 0;
          });
          // Ordenar por fecha desc (ya vienen ordenados del state pero por si acaso)
          const ultimos = grupos.slice(0, 50);
          // Agrupar filas por fecha para mostrar separador
          return (
            <div style={{ marginTop: "2rem", background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #ddd" }}>
              <h3 style={{ color: "var(--oliva)", marginBottom: "1rem" }}>📋 Historial de registros diarios</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {ultimos.map((g, i) => {
                  const esNuevoDia = i === 0 || ultimos[i-1].fecha !== g.fecha;
                  return (
                    <div key={i}>
                      {esNuevoDia && (
                        <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#888", padding: "0.4rem 0", borderTop: i > 0 ? "1px solid #eee" : "none", marginTop: i > 0 ? "0.3rem" : 0 }}>
                          {g.fecha}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr auto", gap: "0.5rem", alignItems: "start", padding: "0.45rem 0.6rem", borderRadius: "6px", background: i % 2 === 0 ? "#fafafa" : "white", border: "1px solid #f0f0f0" }}>
                        {/* Tanque */}
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "var(--oliva)" }}>{g.tanqueId}</div>
                          <div style={{ fontSize: "0.7rem", color: "#aaa" }}>{g.hora}</div>
                        </div>
                        {/* Productos */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
                          {g.items.map((it, j) => (
                            <span key={j} style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: "10px", padding: "0.15rem 0.55rem", fontSize: "0.76rem" }}>
                              {it.producto}
                              {it.gramosPorToma ? ` ${it.gramosPorToma}g` : ""}
                              {it.tomas > 1 ? ` ×${it.tomas}` : ""}
                              {it.tomas > 1 ? ` = ${it.total}g` : "g"}
                            </span>
                          ))}
                        </div>
                        {/* Total */}
                        <div style={{ textAlign: "right", fontWeight: "bold", fontSize: "0.85rem", color: "#27ae60", whiteSpace: "nowrap" }}>
                          {g.totalG.toFixed(1)} g
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
}

export default AlimentacionPanel;
