import React, { useState } from "react";
import { normalizarFecha, parseFechaTrat } from "../utils";

function DashboardMetricas({ bajasCloud, tratamientos, data, planesFase, registrosAlimentacion }) {
  const [periodoMortalidad, setPeriodoMortalidad] = useState(30);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // ── MORTALIDAD ──────────────────────────────────────────────
  const getBajasPorDia = () => {
    const porDia = {};
    const fuente = bajasCloud.length > 0 ? bajasCloud : tratamientos.filter(t => (t.tipo || "").toLowerCase().includes("baja"));

    fuente.forEach(b => {
      const fechaRaw = bajasCloud.length > 0 ? b.fecha : b.fecha;
      const f = parseFechaTrat(fechaRaw) || parseFechaTrat(normalizarFecha(fechaRaw));
      if (!f) return;
      const diff = Math.floor((hoy - f) / 86400000);
      if (diff < 0 || diff >= periodoMortalidad) return;
      const key = f.toISOString().split("T")[0];
      const cant = bajasCloud.length > 0 ? (parseInt(b.cantidad, 10) || 0) : (parseInt(b.dosis, 10) || 0);
      porDia[key] = (porDia[key] || 0) + cant;
    });
    return porDia;
  };

  const bajasPorDia = getBajasPorDia();
  const diasOrdenados = Object.keys(bajasPorDia).sort();
  const totalBajasPeriodo = Object.values(bajasPorDia).reduce((s, v) => s + v, 0);
  const maxBajasDia = Math.max(1, ...Object.values(bajasPorDia));

  const getBajasPorArea = () => {
    const porArea = {};
    if (bajasCloud.length > 0) {
      bajasCloud.forEach(b => {
        const area = b.tanque_id || "Sin asignar";
        const grupo = area.startsWith("UCI") ? "UCI" : area.startsWith("E") ? "Renacuajos" : area.match(/^\d/) ? "Adultas" : "Otros";
        porArea[grupo] = (porArea[grupo] || 0) + (parseInt(b.cantidad, 10) || 0);
      });
    } else {
      tratamientos.filter(t => (t.tipo || "").toLowerCase().includes("baja")).forEach(t => {
        const tanque = t.tanque || "Sin asignar";
        const grupo = tanque.startsWith("UCI") ? "UCI" : tanque.startsWith("E") ? "Renacuajos" : tanque.match(/^\d/) ? "Adultas" : "Otros";
        porArea[grupo] = (porArea[grupo] || 0) + (parseInt(t.dosis, 10) || 0);
      });
    }
    return porArea;
  };
  const bajasPorArea = getBajasPorArea();

  // ── CRECIMIENTO POR FASE ───────────────────────────────────
  const getDistribucionFases = () => {
    const fases = {};
    const atrasados = [];
    Object.keys(data).forEach(grupo => {
      (data[grupo] || []).forEach(cell => {
        if (cell.count > 0 && cell.type) {
          fases[cell.type] = (fases[cell.type] || 0) + cell.count;
          if (cell.fechaFase && planesFase[cell.type]) {
            const plan = planesFase[cell.type];
            const dias = Math.floor((hoy - new Date(cell.fechaFase)) / 86400000);
            if (plan.diasMax && dias > plan.diasMax) {
              atrasados.push({ id: cell.id, fase: cell.type, dias, maxDias: plan.diasMax });
            }
          }
        }
      });
    });
    return { fases, atrasados };
  };
  const { fases: distribucionFases, atrasados: tanquesAtrasados } = getDistribucionFases();
  const fasesOrdenadas = Object.entries(distribucionFases).sort((a, b) => b[1] - a[1]);
  const maxFase = Math.max(1, ...Object.values(distribucionFases));

  // ── CONSUMO DE ALIMENTO ────────────────────────────────────
  const getConsumoSemanal = () => {
    const porDia = {};
    let totalGramos = 0;
    (registrosAlimentacion || []).forEach(r => {
      const f = parseFechaTrat(r.fecha) || parseFechaTrat(normalizarFecha(r.fecha));
      if (!f) return;
      const diff = Math.floor((hoy - f) / 86400000);
      if (diff < 0 || diff >= 7) return;
      const key = f.toISOString().split("T")[0];
      const g = parseFloat(r.gramos) || 0;
      porDia[key] = (porDia[key] || 0) + g;
      totalGramos += g;
    });
    return { porDia, totalGramos };
  };
  const { porDia: consumoPorDia, totalGramos: totalConsumo7d } = getConsumoSemanal();
  const consumoDiasOrdenados = Object.keys(consumoPorDia).sort();
  const maxConsumo = Math.max(1, ...Object.values(consumoPorDia));

  const getConsumoPorProducto = () => {
    const porProducto = {};
    (registrosAlimentacion || []).forEach(r => {
      const f = parseFechaTrat(r.fecha) || parseFechaTrat(normalizarFecha(r.fecha));
      if (!f) return;
      const diff = Math.floor((hoy - f) / 86400000);
      if (diff < 0 || diff >= 7) return;
      const prod = r.producto || "Desconocido";
      porProducto[prod] = (porProducto[prod] || 0) + (parseFloat(r.gramos) || 0);
    });
    return Object.entries(porProducto).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const consumoPorProducto = getConsumoPorProducto();

  const censoTotal = Object.keys(data).reduce((acc, g) => acc + (data[g] || []).reduce((s, c) => s + (parseInt(c.count, 10) || 0), 0), 0);

  // ── COLORES ────────────────────────────────────────────────
  const COLORES_AREA = { UCI: "#e74c3c", Adultas: "#e67e22", Renacuajos: "#3498db", Otros: "#95a5a6" };
  const COLORES_FASE = ["#27ae60", "#2ecc71", "#1abc9c", "#16a085", "#3498db", "#2980b9", "#9b59b6", "#8e44ad", "#f39c12", "#e67e22", "#e74c3c"];

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ color: "var(--oliva)", borderBottom: "2px solid var(--pistacho)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
        📊 Métricas Operativas
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1rem" }}>

        {/* ── MORTALIDAD ── */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem", border: "1px solid #fdd", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <h4 style={{ margin: 0, color: "#c0392b" }}>💀 Mortalidad</h4>
            <select value={periodoMortalidad} onChange={e => setPeriodoMortalidad(parseInt(e.target.value))}
              style={{ padding: "0.2rem 0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.8rem" }}>
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "0.8rem" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "900", color: totalBajasPeriodo > 0 ? "#e74c3c" : "#aaa" }}>{totalBajasPeriodo}</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>bajas / {periodoMortalidad}d</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#e67e22" }}>
                {censoTotal > 0 ? ((totalBajasPeriodo / (censoTotal + totalBajasPeriodo)) * 100).toFixed(2) : "0.00"}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>tasa mortalidad</div>
            </div>
          </div>

          {diasOrdenados.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "60px", marginBottom: "0.5rem" }}>
              {diasOrdenados.map(dia => {
                const val = bajasPorDia[dia];
                const h = Math.max(4, (val / maxBajasDia) * 55);
                return (
                  <div key={dia} title={`${dia}: ${val} bajas`}
                    style={{ flex: 1, height: `${h}px`, background: val > 0 ? "#e74c3c" : "#f0f0f0", borderRadius: "3px 3px 0 0", minWidth: "4px", cursor: "default" }} />
                );
              })}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#ccc", fontSize: "0.8rem" }}>Sin bajas en el periodo</p>
          )}

          {Object.keys(bajasPorArea).length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {Object.entries(bajasPorArea).map(([area, cant]) => (
                <span key={area} style={{ background: COLORES_AREA[area] || "#95a5a6", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: "600" }}>
                  {area}: {cant}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── DISTRIBUCIÓN POR FASE ── */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem", border: "1px solid #dfd", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h4 style={{ margin: "0 0 0.8rem 0", color: "#27ae60" }}>🌱 Distribución por Fase</h4>

          {fasesOrdenadas.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {fasesOrdenadas.map(([fase, cant], i) => (
                <div key={fase} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#555", width: "110px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fase}</span>
                  <div style={{ flex: 1, height: "16px", background: "#f0f0f0", borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ width: `${(cant / maxFase) * 100}%`, height: "100%", background: COLORES_FASE[i % COLORES_FASE.length], borderRadius: "8px", transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#333", width: "50px" }}>{cant.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#ccc", fontSize: "0.8rem" }}>Sin datos de fase</p>
          )}

          {tanquesAtrasados.length > 0 && (
            <div style={{ marginTop: "0.8rem", background: "#fef9e7", borderRadius: "8px", padding: "0.5rem", border: "1px solid #f9e79f" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#d68910", marginBottom: "0.3rem" }}>⚠️ Tanques atrasados ({tanquesAtrasados.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {tanquesAtrasados.slice(0, 10).map(t => (
                  <span key={t.id} style={{ background: "#fff", border: "1px solid #f0c040", borderRadius: "6px", padding: "1px 6px", fontSize: "0.7rem" }}>
                    {t.id} ({t.fase}, {t.dias}d / {t.maxDias}d)
                  </span>
                ))}
                {tanquesAtrasados.length > 10 && <span style={{ fontSize: "0.7rem", color: "#888" }}>+{tanquesAtrasados.length - 10} más</span>}
              </div>
            </div>
          )}
        </div>

        {/* ── CONSUMO DE ALIMENTO ── */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem", border: "1px solid #ddf", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h4 style={{ margin: "0 0 0.8rem 0", color: "#2980b9" }}>🌿 Consumo de Alimento (7d)</h4>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "0.8rem" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#2980b9" }}>{(totalConsumo7d / 1000).toFixed(1)}</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>kg / 7 días</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#27ae60" }}>{censoTotal > 0 ? (totalConsumo7d / 7 / censoTotal).toFixed(2) : "0.00"}</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>g/animal/día</div>
            </div>
          </div>

          {consumoDiasOrdenados.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "60px", marginBottom: "0.5rem" }}>
              {consumoDiasOrdenados.map(dia => {
                const val = consumoPorDia[dia];
                const h = Math.max(4, (val / maxConsumo) * 55);
                const label = dia.slice(5);
                return (
                  <div key={dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div title={`${dia}: ${val.toFixed(0)}g`}
                      style={{ width: "100%", height: `${h}px`, background: "#3498db", borderRadius: "3px 3px 0 0", minWidth: "8px" }} />
                    <span style={{ fontSize: "0.55rem", color: "#aaa", marginTop: "2px" }}>{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#ccc", fontSize: "0.8rem" }}>Sin registros esta semana</p>
          )}

          {consumoPorProducto.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "0.3rem" }}>Top productos:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {consumoPorProducto.map(([prod, g]) => (
                  <div key={prod} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "#555" }}>{prod}</span>
                    <span style={{ fontWeight: "700", color: "#2980b9" }}>{(g / 1000).toFixed(2)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardMetricas;
