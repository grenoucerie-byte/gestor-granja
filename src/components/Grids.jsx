import React, { useState } from "react";
import { OBTENER_DATOS_DENSIDAD } from "../constants";
import { lockIcon, lockClass, normalizarId } from "../utils";

// ─── UCI (Nave Verde) ────────────────────────────────────────────────
export const UCIGrid = ({ data, handleCellClick, planesFase }) => {
  // Helper para deduplicar visualmente
  const forceUnique = (arr) => {
    const map = {};
    arr.forEach((c) => {
      const key = normalizarId(c.id).toLowerCase();
      if (!map[key]) map[key] = c;
      else if (parseInt(c.count || 0) > parseInt(map[key].count || 0))
        map[key] = c;
    });
    return Object.values(map);
  };

  const izq = forceUnique(
    data.filter((c) => c.id.startsWith("UCI-Izq-")),
  ).sort(
    (a, b) => parseInt(b.id.split("-")[2]) - parseInt(a.id.split("-")[2]),
  );
  const cen = forceUnique(
    data.filter((c) => c.id.startsWith("UCI-Cen-")),
  ).sort(
    (a, b) => parseInt(b.id.split("-")[2]) - parseInt(a.id.split("-")[2]),
  );
  const der = data.find((c) => c.id === "UCI-Der-1");
  const corrales = forceUnique(
    data.filter((c) => c.id.startsWith("Corral-")),
  ).sort();
  const caja = data.find((c) => c.id === "Caja-Blanca");

  return (
    <div
      className="metamorfosis-container group-section"
      style={{ marginTop: "3rem" }}
    >
      <h2 className="group-title">
        🏥 Nave Verde (Unidad de Cuidados Intensivos)
      </h2>

      <div className="uci-layout">
        {/* Columna Izquierda */}
        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            Izquierda (Termoarcilla)
          </h4>
          {(() => {
            const rendered = new Set();
            return izq.map((cell) => {
              if (rendered.has(cell.id)) return null;
              rendered.add(cell.id);
              const dens = OBTENER_DATOS_DENSIDAD(
                "naveVerde",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                  onClick={() => {
                    handleCellClick(cell, "naveVerde");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {lockIcon(cell?.obs)}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                    const plan = planesFase[cell.type];
                    const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                    if (plan.diasMax && dias > plan.diasMax) return <div style={{ fontSize: "0.65rem", color: "#e74c3c", fontWeight: "bold" }}>🔴 {dias}d</div>;
                    if (plan.diasMin && dias >= plan.diasMin) return <div style={{ fontSize: "0.65rem", color: "#e67e22", fontWeight: "bold" }}>🟡 {dias}d</div>;
                    return null;
                  })()}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Bloque Central de Corrales */}
        <div className="uci-corrales">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "#666",
              fontSize: "0.8rem",
            }}
          >
            Suelo
          </h4>
          {corrales.map((cell) => {
            const dens = OBTENER_DATOS_DENSIDAD(
              "naveVerde",
              cell.id,
              cell.count,
            );
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado} corral-cell ${lockClass(cell?.obs)}`}
                onClick={() => {
                  handleCellClick(cell, "naveVerde");
                }}
              >
                <div className="cell-id">
                  {cell.id} {lockIcon(cell?.obs)}
                </div>
                <div className="cell-count">
                  {cell.count > 0 ? `${cell.count} ud` : "-"}
                </div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                  const plan = planesFase[cell.type];
                  const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                  if (plan.diasMax && dias > plan.diasMax) return <div style={{ fontSize: "0.65rem", color: "#e74c3c", fontWeight: "bold" }}>🔴 {dias}d</div>;
                  if (plan.diasMin && dias >= plan.diasMin) return <div style={{ fontSize: "0.65rem", color: "#e67e22", fontWeight: "bold" }}>🟡 {dias}d</div>;
                  return null;
                })()}
                {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                  <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Columna Central */}
        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            Centrales
          </h4>
          {(() => {
            const rendered = new Set();
            return cen.map((cell) => {
              if (rendered.has(cell.id)) return null;
              rendered.add(cell.id);
              const dens = OBTENER_DATOS_DENSIDAD(
                "naveVerde",
                cell.id,
                cell.count,
              );
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                  onClick={() => {
                    handleCellClick(cell, "naveVerde");
                  }}
                >
                  <div className="cell-id">
                    {cell.id} {lockIcon(cell?.obs)}
                  </div>
                  <div className="cell-count">
                    {cell.count > 0 ? `${cell.count} ud` : "-"}
                  </div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                    const plan = planesFase[cell.type];
                    const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                    if (plan.diasMax && dias > plan.diasMax) return <div style={{ fontSize: "0.65rem", color: "#e74c3c", fontWeight: "bold" }}>🔴 {dias}d</div>;
                    if (plan.diasMin && dias >= plan.diasMin) return <div style={{ fontSize: "0.65rem", color: "#e67e22", fontWeight: "bold" }}>🟡 {dias}d</div>;
                    return null;
                  })()}
                  {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                    <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Columna Derecha / Caja Blanca */}
        <div className="uci-right-col">
          <div className="raceways-col" style={{ marginBottom: "2rem" }}>
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "var(--oliva)",
                fontSize: "0.9rem",
              }}
            >
              Derecha (Sal)
            </h4>
            {der &&
              (() => {
                const dens = OBTENER_DATOS_DENSIDAD(
                  "naveVerde",
                  der.id,
                  der.count,
                );
                return (
                  <div
                    key={der.id}
                    className={`grid-cell ${dens.estado} ${lockClass(der?.obs)}`}
                    onClick={() => {
                      handleCellClick(der, "naveVerde");
                    }}
                  >
                    <div className="cell-id">
                      {der.id} {lockIcon(der?.obs)}
                    </div>
                    <div className="cell-count">
                      {der.count > 0 ? `${der.count} ud` : "-"}
                    </div>
                    {der.type && <div className="cell-fase">{der.type}</div>}
                    {(der.pesoMedio || der.peso_medio) && der.count > 0 && (
                      <div className="cell-meta-preview"><span>~{der.pesoMedio || der.peso_medio}g</span></div>
                    )}
                  </div>
                );
              })()}
          </div>

          <div className="raceways-col">
            <h4
              style={{
                textAlign: "center",
                marginBottom: "10px",
                color: "#666",
                fontSize: "0.8rem",
              }}
            >
              Independiente
            </h4>
            {caja &&
              (() => {
                const dens = OBTENER_DATOS_DENSIDAD(
                  "naveVerde",
                  caja.id,
                  caja.count,
                );
                return (
                  <div
                    key={caja.id}
                    className={`grid-cell ${dens.estado} caja-blanca ${lockClass(caja?.obs)}`}
                    onClick={() => {
                      handleCellClick(caja, "naveVerde");
                    }}
                  >
                    <div className="cell-id">{caja.id.replace("-", " ")}</div>
                    <div className="cell-count">
                      {caja.count > 0 ? `${caja.count} ud` : "-"}
                    </div>
                    {caja.type && <div className="cell-fase">{caja.type}</div>}
                  </div>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Reproduccion ────────────────────────────────────────────────────
export const ReproduccionGrid = ({ data, handleCellClick }) => {
  return (
    <div className="adultas-container group-section" style={{ borderTopColor: "#ff6b81" }}>
      <h2 className="group-title" style={{ color: "#ff6b81" }}>💕 Área de Reproducción</h2>

      <div className="pasillo-central-layout" style={{ marginTop: "2rem" }}>
        <div className="raceways-col">
          <h4 style={{ textAlign: "center", marginBottom: "10px", color: "#ff6b81", fontSize: "1rem" }}>Tanques Aislados</h4>
          {data
            .filter(c => c.id.startsWith("Repro-"))
            .map(cell => {
              const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado}`}
                  onClick={() => handleCellClick(cell, "reproduccion")}
                  style={{ borderLeft: "4px solid #ff6b81", padding: "1.5rem" }}
                >
                  <div className="cell-id">{cell.id}</div>
                  <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                </div>
              );
            })}
        </div>

        <div className="pasillo">PASILLO CENTRAL</div>

        <div className="raceways-col">
          <h4 style={{ textAlign: "center", marginBottom: "10px", color: "#ff6b81", fontSize: "1rem" }}>Carros Móviles</h4>
          {data
            .filter(c => c.id.startsWith("Carro-"))
            .map(cell => {
              const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
              return (
                <div
                  key={cell.id}
                  className={`grid-cell ${dens.estado}`}
                  onClick={() => handleCellClick(cell, "reproduccion")}
                  style={{ borderLeft: "4px solid #ff6b81", padding: "1.5rem" }}
                >
                  <div className="cell-id">{cell.id}</div>
                  <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                  {cell.type && <div className="cell-fase">{cell.type}</div>}
                  {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

// ─── Laboratorio ─────────────────────────────────────────────────────
export const LaboratorioGrid = ({ data, handleCellClick }) => {
  return (
    <div className="adultas-container group-section" style={{ borderTopColor: "#9b59b6" }}>
      <h2 className="group-title" style={{ color: "#9b59b6" }}>🔬 Laboratorio Ex-Situ</h2>
      <div style={{ padding: "1rem", maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap" }}>
        {data
          .filter(c => c.id.startsWith("Lab-"))
          .map(cell => {
            const dens = OBTENER_DATOS_DENSIDAD("reproduccion", cell.id, cell.count);
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado}`}
                onClick={() => handleCellClick(cell, "reproduccion")}
                style={{ borderLeft: "4px solid #9b59b6", padding: "1.5rem", minWidth: "250px" }}
              >
                <div className="cell-id">{cell.id}</div>
                <div className="cell-count">{cell.count > 0 ? `${cell.count} ud` : "-"}</div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {cell.obs && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "8px" }}>{cell.obs}</div>}
              </div>
            );
          })}
      </div>
    </div>
  );
};

// ─── Invernadero ─────────────────────────────────────────────────────
export const InvernaderoGrid = ({ data, handleCellClick }) => {
  const [invernaderoLiters, setInvernaderoLiters] = useState(1000);
  const factor = invernaderoLiters / 1000;

  return (
    <div className="adultas-container group-section" style={{ borderTopColor: "#27ae60" }}>
      <h2 className="group-title" style={{ color: "#27ae60" }}>🪴 Invernadero (Agua Verde y Daphnia)</h2>

      <div style={{ padding: "1rem", maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
        {/* Piscinas Agua Verde */}
        <div style={{ background: "#e8f8f5", padding: "1.5rem", borderRadius: "12px", border: "2px solid #a3e4d7", flex: "1", minWidth: "300px" }}>
          <h3 style={{ color: "#117a65", textAlign: "center", marginBottom: "1rem" }}>🌊 Piscinas Termoarcilla (Agua Verde)</h3>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            {data
              .filter(c => c.id.startsWith("Termoarcilla-"))
              .map(cell => (
                <div
                  key={cell.id}
                  className="grid-cell normal"
                  onClick={() => handleCellClick(cell, "invernadero")}
                  style={{ borderLeft: "4px solid #1abc9c", padding: "1rem", flex: "1", background: "white" }}
                >
                  <div className="cell-id">{cell.id}</div>
                  {cell.ph && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>pH: {cell.ph}</div>}
                  {cell.no3 && <div style={{ fontSize: "0.8rem", color: "#666" }}>NO3: {cell.no3}</div>}
                  {cell.no2 && <div style={{ fontSize: "0.8rem", color: "#666" }}>NO2: {cell.no2}</div>}
                  {cell.aireacion && <div style={{ fontSize: "0.8rem", color: "#3498db", fontWeight: "bold" }}>{cell.aireacion}</div>}
                </div>
              ))}
          </div>
        </div>

        {/* Charcas Daphnia */}
        <div style={{ background: "#fef9e7", padding: "1.5rem", borderRadius: "12px", border: "2px solid #f9e79f", flex: "1", minWidth: "300px" }}>
          <h3 style={{ color: "#b7950b", textAlign: "center", marginBottom: "1rem" }}>🦐 Charcas (Cría Daphnia)</h3>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexDirection: "column" }}>
            {data
              .filter(c => c.id.startsWith("Charca-"))
              .map(cell => (
                <div
                  key={cell.id}
                  className="grid-cell normal"
                  onClick={() => handleCellClick(cell, "invernadero")}
                  style={{ borderLeft: "4px solid #f1c40f", padding: "1rem", background: "white" }}
                >
                  <div className="cell-id">{cell.id}</div>
                  {cell.obs && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Calculadora Agua Verde */}
      <div style={{ background: "#f0f8ff", border: "2px solid #b3d4ff", borderRadius: "12px", padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
        <h3 style={{ textAlign: "center", color: "#0056b3", marginBottom: "1rem" }}>🧮 Calculadora de Agua Verde</h3>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
          <label style={{ fontWeight: "bold", color: "#333" }}>Litros a preparar:</label>
          <input
            type="number"
            className="modal-input"
            style={{ width: "120px", margin: 0 }}
            value={invernaderoLiters}
            onChange={(e) => setInvernaderoLiters(e.target.value)}
          />
          <span>L</span>
        </div>

        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid #ddd", minWidth: "250px", flex: "1" }}>
            <h4 style={{ color: "#27ae60", borderBottom: "2px solid #27ae60", paddingBottom: "5px" }}>🧪 Solución 1</h4>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.8" }}>
              <li>💧 <strong>Agua:</strong> {(5 * factor).toFixed(1)} Lt</li>
              <li>🧪 <strong>Fosfato Monopotásico:</strong> {(200 * factor).toFixed(0)} gr</li>
              <li>🧂 <strong>Sulfato de Magnesio:</strong> {(373 * factor).toFixed(0)} gr</li>
              <li>🌿 <strong>Nitrato de Potasio:</strong> {(350 * factor).toFixed(0)} gr</li>
              <li>🔬 <strong>Micro:</strong> {(45 * factor).toFixed(0)} gr</li>
            </ul>
          </div>

          <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid #ddd", minWidth: "250px", flex: "1" }}>
            <h4 style={{ color: "#2980b9", borderBottom: "2px solid #2980b9", paddingBottom: "5px" }}>🧪 Solución 2</h4>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.8" }}>
              <li>💧 <strong>Agua:</strong> {(2 * factor).toFixed(1)} Lt</li>
              <li>🦴 <strong>Nitrato de Calcio:</strong> {(700 * factor).toFixed(0)} gr</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: "2rem", background: "#fff3cd", padding: "1rem", borderRadius: "8px", borderLeft: "4px solid #ffc107" }}>
          <h4 style={{ color: "#856404", marginTop: 0 }}>📝 Aplicación Paso a Paso</h4>
          <ol style={{ margin: 0, color: "#555", paddingLeft: "1.5rem" }}>
            <li>Lavar bien el raceway con solución de lejía y posteriormente con agua.</li>
            <li>Mezclar la <strong>Solución 1</strong> en los {invernaderoLiters} litros de agua y mezclar bien.</li>
            <li>Añadir posteriormente la <strong>Solución 2</strong>.</li>
            <li>Colocar aireación.</li>
            <li>Al segundo día colocar inóculo de agua verde.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

// ─── Brumacion ───────────────────────────────────────────────────────
export const BrumacionGrid = ({ data, handleCellClick, selectedCell }) => {
  return (
    <div style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ background: "#f0f8ff", border: "2px solid #b3d4ff", borderRadius: "12px", padding: "1.5rem" }}>
        <h3 style={{ textAlign: "center", color: "#0056b3", marginBottom: "1.5rem", fontSize: "1.4rem" }}>
          ❄️ Vitrina Expositora de Brumación
        </h3>

        <div style={{ background: "#e6f2ff", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px dashed #99c2ff" }}>
          <h4 style={{ color: "#004085", marginBottom: "1rem", textAlign: "center" }}>Área Superior (Frio Positivo / Fotoperiodo)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
            {data && data.slice(0, 5).map((cell) => {
              const bg = selectedCell && selectedCell.cell.id === cell.id ? "#ffeeba" : "#ffffff";
              const border = cell.count > 0 ? "2px solid #0056b3" : "1px solid #ccc";
              return (
                <div
                  key={cell.id}
                  onClick={() => handleCellClick(cell, "brumacion")}
                  style={{
                    background: bg,
                    border: border,
                    padding: "10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    minHeight: "80px",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#004085", marginBottom: "5px" }}>{cell.id}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: cell.count > 0 ? "#28a745" : "#ccc" }}>{cell.count} ud</div>
                  {cell.obs && <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>{cell.obs}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: "#343a40", padding: "1rem", borderRadius: "8px", border: "1px solid #1d2124" }}>
          <h4 style={{ color: "#f8f9fa", marginBottom: "1rem", textAlign: "center" }}>Área Inferior (Oscuridad y Frío)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
            {data && data.slice(5, 10).map((cell) => {
              const bg = selectedCell && selectedCell.cell.id === cell.id ? "#ffeeba" : "#495057";
              const border = cell.count > 0 ? "2px solid #17a2b8" : "1px solid #6c757d";
              return (
                <div
                  key={cell.id}
                  onClick={() => handleCellClick(cell, "brumacion")}
                  style={{
                    background: bg,
                    border: border,
                    padding: "10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    minHeight: "80px",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#f8f9fa", marginBottom: "5px" }}>{cell.id}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: cell.count > 0 ? "#17a2b8" : "#adb5bd" }}>{cell.count} ud</div>
                  {cell.obs && <div style={{ fontSize: "0.7rem", color: "#ced4da", marginTop: "4px" }}>{cell.obs}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Adultas ─────────────────────────────────────────────────────────
export const AdultasGrid = ({ data, handleCellClick }) => {
  const [activeAdultasBloque, setActiveAdultasBloque] = useState(1);
  const [activeAdultasPiso, setActiveAdultasPiso] = useState(1);

  const blocksConfig = [
    { left: [2.1, 2.2, 2.3], right: [5.1, 5.2, 5.3] },
    { left: [2.4, 2.5, 2.6], right: [5.4, 5.5, 5.6] },
    { left: [3.1, 3.2, 3.3], right: [6.1, 6.2, 6.3] },
    { left: [3.4, 3.5, 3.6], right: [6.4, 6.5, 6.6] },
  ];

  const currentBlock = blocksConfig[activeAdultasBloque - 1] || blocksConfig[0];
  const leftPrefix = currentBlock.left[activeAdultasPiso - 1];
  const rightPrefix = currentBlock.right[activeAdultasPiso - 1];

  const celdasIzquierda = [];
  for (let r = 10; r >= 1; r--) {
    const id = `${leftPrefix}.${r}`;
    celdasIzquierda.push(
      data.find((c) => c.id === id) || { id, count: 0 },
    );
  }

  const celdasDerecha = [];
  for (let r = 1; r <= 10; r++) {
    const id = `${rightPrefix}.${r}`;
    celdasDerecha.push(
      data.find((c) => c.id === id) || { id, count: 0 },
    );
  }

  return (
    <div
      className="metamorfosis-container group-section"
      style={{ marginBottom: "2rem" }}
    >
      <h2 className="group-title">🐸 Estructura de Ranas Adultas</h2>

      <div
        className="estructura-tabs"
        style={{ marginBottom: "10px", gap: "5px", flexWrap: "wrap" }}
      >
        {[
          { id: 1, label: "Estructura 2 (Izq-1)" },
          { id: 2, label: "Estructura 3 (Izq-2)" },
          { id: 3, label: "Estructura 5 (Der-1)" },
          { id: 4, label: "Estructura 6 (Der-2)" }
        ].map((est) => (
          <button
            key={est.id}
            className={`estructura-tab-btn ${activeAdultasBloque === est.id ? "active" : ""}`}
            style={{ padding: "0.5rem 0.8rem" }}
            onClick={() => setActiveAdultasBloque(est.id)}
          >
            {est.label}
          </button>
        ))}
      </div>

      <div className="estructura-tabs" style={{ gap: "5px" }}>
        <button
          className={`estructura-tab-btn ${activeAdultasPiso === 1 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActiveAdultasPiso(1)}
        >
          Piso Bajo
        </button>
        <button
          className={`estructura-tab-btn ${activeAdultasPiso === 2 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActiveAdultasPiso(2)}
        >
          Piso Medio
        </button>
        <button
          className={`estructura-tab-btn ${activeAdultasPiso === 3 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActiveAdultasPiso(3)}
        >
          Piso Superior
        </button>
      </div>

      <div className="pasillo-central-layout">
        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            {leftPrefix} · Cuadrante 1 · {activeAdultasPiso === 1 ? "Piso Bajo" : activeAdultasPiso === 2 ? "Piso Medio" : "Piso Superior"}
          </h4>
          {celdasIzquierda.map((cell) => {
            const dens = OBTENER_DATOS_DENSIDAD(
              "adultas",
              cell.id,
              cell.count,
            );
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                onClick={() => {
                  handleCellClick(cell, "adultas");
                }}
              >
                <div className="cell-id">
                  {cell.id} {lockIcon(cell?.obs)}
                </div>
                <div className="cell-count">
                  {cell.count > 0 ? `${cell.count} ud` : "-"}
                </div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                  <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pasillo-visual">
          <div className="pasillo-text">
            P<br />A<br />S<br />I<br />L<br />L<br />O
          </div>
        </div>

        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            {rightPrefix} · Cuadrante 2 · {activeAdultasPiso === 1 ? "Piso Bajo" : activeAdultasPiso === 2 ? "Piso Medio" : "Piso Superior"}
          </h4>
          {celdasDerecha.map((cell) => {
            const dens = OBTENER_DATOS_DENSIDAD(
              "adultas",
              cell.id,
              cell.count,
            );
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                onClick={() => {
                  handleCellClick(cell, "adultas");
                }}
              >
                <div className="cell-id">
                  {cell.id} {lockIcon(cell?.obs)}
                </div>
                <div className="cell-count">
                  {cell.count > 0 ? `${cell.count} ud` : "-"}
                </div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                  <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Metamorfoseadas ─────────────────────────────────────────────────
export const MetamorfoseadasGrid = ({ data, handleCellClick, planesFase }) => {
  const [activeBloque, setActiveBloque] = useState("Trasero");
  const [activePiso, setActivePiso] = useState(1);

  const pisoEstructuraIzquierda =
    activeBloque === "Trasero"
      ? activePiso
      : activePiso + 3;
  const pisoEstructuraDerecha =
    activeBloque === "Trasero"
      ? activePiso
      : activePiso + 3;

  const celdasIzquierda = [];
  for (let r = 10; r >= 1; r--) {
    const id = `1.${pisoEstructuraIzquierda}.${r}`;
    celdasIzquierda.push(
      data.find((c) => c.id === id) || { id, count: 0 },
    );
  }

  const celdasDerecha = [];
  for (let r = 1; r <= 10; r++) {
    const id = `4.${pisoEstructuraDerecha}.${r}`;
    celdasDerecha.push(
      data.find((c) => c.id === id) || { id, count: 0 },
    );
  }

  return (
    <div className="metamorfosis-container group-section">
      <h2 className="group-title">🐸 Estructura de Recién Metamorfoseadas</h2>

      <div className="estructura-tabs" style={{ marginBottom: "10px" }}>
        <button
          className={`estructura-tab-btn ${activeBloque === "Trasero" ? "active" : ""}`}
          onClick={() => setActiveBloque("Trasero")}
        >
          Bloque Trasero (1 y 4)
        </button>
        <button
          className={`estructura-tab-btn ${activeBloque === "Delantero" ? "active" : ""}`}
          onClick={() => setActiveBloque("Delantero")}
        >
          Bloque Delantero (1 y 4 Frente)
        </button>
      </div>

      <div className="estructura-tabs" style={{ gap: "5px" }}>
        <button
          className={`estructura-tab-btn ${activePiso === 1 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActivePiso(1)}
        >
          Piso 1 (Abajo)
        </button>
        <button
          className={`estructura-tab-btn ${activePiso === 2 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActivePiso(2)}
        >
          Piso 2 (Medio)
        </button>
        <button
          className={`estructura-tab-btn ${activePiso === 3 ? "active" : ""}`}
          style={{ padding: "0.4rem 1rem" }}
          onClick={() => setActivePiso(3)}
        >
          Piso 3 (Alto)
        </button>
      </div>

      <div className="pasillo-central-layout">
        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            Estructura 1{" "}
            {activeBloque === "Delantero" ? "(Frente)" : ""}
          </h4>
          {celdasIzquierda.map((cell) => {
            const dens = OBTENER_DATOS_DENSIDAD(
              "metamorfoseadas",
              cell.id,
              cell.count,
            );
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                onClick={() => {
                  handleCellClick(cell, "metamorfoseadas");
                }}
              >
                <div className="cell-id">
                  {cell.id} {lockIcon(cell?.obs)}
                </div>
                <div className="cell-count">
                  {cell.count > 0 ? `${cell.count} ud` : "-"}
                </div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                  const plan = planesFase[cell.type];
                  const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                  if (plan.diasMax && dias > plan.diasMax) return <div style={{ fontSize: "0.65rem", color: "#e74c3c", fontWeight: "bold" }}>🔴 {dias}d</div>;
                  if (plan.diasMin && dias >= plan.diasMin) return <div style={{ fontSize: "0.65rem", color: "#e67e22", fontWeight: "bold" }}>🟡 {dias}d</div>;
                  return null;
                })()}
                {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                  <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pasillo-visual">
          <div className="pasillo-text">
            P<br />A<br />S<br />I<br />L<br />L<br />O
          </div>
        </div>

        <div className="raceways-col">
          <h4
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "var(--oliva)",
              fontSize: "0.9rem",
            }}
          >
            Estructura 4{" "}
            {activeBloque === "Delantero" ? "(Frente)" : ""}
          </h4>
          {celdasDerecha.map((cell) => {
            const dens = OBTENER_DATOS_DENSIDAD(
              "metamorfoseadas",
              cell.id,
              cell.count,
            );
            return (
              <div
                key={cell.id}
                className={`grid-cell ${dens.estado} ${lockClass(cell?.obs)}`}
                onClick={() => {
                  handleCellClick(cell, "metamorfoseadas");
                }}
              >
                <div className="cell-id">
                  {cell.id} {lockIcon(cell?.obs)}
                </div>
                <div className="cell-count">
                  {cell.count > 0 ? `${cell.count} ud` : "-"}
                </div>
                {cell.type && <div className="cell-fase">{cell.type}</div>}
                {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                  const plan = planesFase[cell.type];
                  const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                  if (plan.diasMax && dias > plan.diasMax) return <div style={{ fontSize: "0.65rem", color: "#e74c3c", fontWeight: "bold" }}>🔴 {dias}d</div>;
                  if (plan.diasMin && dias >= plan.diasMin) return <div style={{ fontSize: "0.65rem", color: "#e67e22", fontWeight: "bold" }}>🟡 {dias}d</div>;
                  return null;
                })()}
                {(cell.pesoMedio || cell.peso_medio) && cell.count > 0 && (
                  <div className="cell-meta-preview"><span>~{cell.pesoMedio || cell.peso_medio}g</span></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── GridEstructura (Renacuajos) ─────────────────────────────────────
export const GridEstructura = ({ data, handleCellClick, activeEstructura, planesFase }) => {
  const filas = ["F7", "F6", "F5", "F4", "F3", "F2", "F1"];
  const columnas = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];

  return (
    <div className="grid-wrapper">
      <div className="grid-cols-label">
        <div></div>
        {columnas.map((col) => (
          <div key={col}>{col}</div>
        ))}
      </div>

      {filas.map((fila) => (
        <div key={fila} className="grid-row-container">
          <div className="grid-row-label">{fila}</div>

          {columnas.map((col) => {
            const cellId = `E${activeEstructura}-${fila}-${col}`;
            const cell = data.find((c) => c.id === cellId) || {
              id: cellId,
              count: 0,
              lastDate: "",
              type: "",
              dose: "",
              obs: "",
            };
            const dens = OBTENER_DATOS_DENSIDAD(
              "renacuajos",
              cell.id,
              cell.count,
            );
            const esOcupada = cell.count > 0;
            const gVal = parseFloat(cell.dose) || 0;
            const ratioVal =
              esOcupada && gVal > 0 ? (gVal / cell.count).toFixed(3) : null;

            let cellClass = "grid-cell";
            const isLocked = cell?.obs?.includes("[BLOQUEADO");
            const lockMatch = cell?.obs?.match(/\[BLOQUEADO(?:[:-]?\s*(.*?))?\]/);
            const lockReason = lockMatch && lockMatch[1] ? lockMatch[1] : "Bloqueado";

            if (isLocked) {
              cellClass += " locked";
              if (lockReason.toLowerCase().includes("repara")) {
                cellClass += " reparar";
              } else if (lockReason.toLowerCase().includes("desinfec") || lockReason.toLowerCase().includes("limpi")) {
                cellClass += " desinfectar";
              }
            }

            if (esOcupada) {
              cellClass += " occupied";
              if (dens.estado === "advertencia")
                cellClass += " density-warning";
              if (dens.estado === "peligro") cellClass += " density-danger";
            }

            let capacityColor = "#27ae60";
            let capacityText = `Disp: ${300 - cell.count}`;
            if (300 - cell.count === 0) {
              capacityColor = "#e67e22";
              capacityText = "COMPLETO";
            } else if (300 - cell.count < 0) {
              capacityColor = "#e74c3c";
              capacityText = `Exc: ${Math.abs(300 - cell.count)}`;
            }

            return (
              <div
                key={cellId}
                className={cellClass}
                onClick={() => handleCellClick(cell, "renacuajos")}
                title={
                  esOcupada
                    ? `Celda ${fila}-${col}: ${cell.count} ud., ${gVal}g, Estado: ${cell.type || "Ninguno"}`
                    : `Celda ${fila}-${col} (Haga clic para poblar)`
                }
              >
                <span className="grid-cell-id">
                  {fila}-{col} {isLocked && lockIcon(cell?.obs)}
                </span>
                {isLocked && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      color: "#fff",
                      background: lockReason.toLowerCase().includes("repara") ? "#d35400" : lockReason.toLowerCase().includes("desinfec") || lockReason.toLowerCase().includes("limpi") ? "#0984e3" : "#c23616",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      marginTop: "2px",
                      marginBottom: "2px",
                      textAlign: "center",
                      display: "block",
                    }}
                  >
                    {lockReason.toLowerCase().includes("repara") ? "🔧 REPARAR" : lockReason.toLowerCase().includes("desinfec") || lockReason.toLowerCase().includes("limpi") ? "🧴 " + lockReason.toUpperCase() : lockReason}
                  </span>
                )}
                {esOcupada ? (
                  <>
                    <span className="grid-cell-count">
                      {cell.count}{" "}
                      <span style={{ fontSize: "0.6rem" }}>ud</span>
                    </span>
                    {gVal > 0 && (
                      <span className="grid-cell-weight">{gVal}g</span>
                    )}
                    {ratioVal && (
                      <span className="grid-cell-ratio">{ratioVal} g/u</span>
                    )}
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: capacityColor,
                        fontWeight: "bold",
                        marginTop: "2px",
                      }}
                    >
                      {capacityText}
                    </span>
                    {cell.type && cell.fechaFase && planesFase[cell.type] && (() => {
                      const plan = planesFase[cell.type];
                      const dias = Math.floor((new Date() - new Date(cell.fechaFase)) / 86400000);
                      if (plan.diasMax && dias > plan.diasMax) return <span style={{ fontSize: "0.6rem", color: "#e74c3c", fontWeight: "bold", marginTop: "2px", display: "block" }}>🔴 {dias}d</span>;
                      if (plan.diasMin && dias >= plan.diasMin) return <span style={{ fontSize: "0.6rem", color: "#e67e22", fontWeight: "bold", marginTop: "2px", display: "block" }}>🟡 {dias}d</span>;
                      return null;
                    })()}
                  </>
                ) : (
                  <>
                    <span className="grid-cell-empty">+</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "#27ae60",
                        fontWeight: "bold",
                        marginTop: "2px",
                      }}
                    >
                      Libres: 300
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
