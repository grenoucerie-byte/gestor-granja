import React from "react";
import { OBTENER_DATOS_DENSIDAD } from "../constants";

function Section({ title, items, grupo, onBaja, onPuesta, onTrat, onUpdate }) {
  if (!items || items.length === 0) return null;
  return (
    <div
      className="group-section"
      style={{ animation: "fadeIn 0.25s ease-out" }}
    >
      <h2 className="group-title">{title}</h2>
      <div className="structure-grid">
        {items.map((item) => (
          <div key={item.id} className="structure-card extended">
            <div className="card-top">
              <span className="id-badge">{item.id}</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <input
                  type="number"
                  value={item.count}
                  onChange={(e) =>
                    onUpdate(
                      item.id,
                      "count",
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10) || 0,
                    )
                  }
                  style={{
                    width: "65px",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    textAlign: "center",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#666",
                    fontWeight: "bold",
                  }}
                >
                  ud.
                </span>
              </div>
              <div className="btn-group">
                {onPuesta && (
                  <button
                    className="btn-puesta"
                    onClick={() => onPuesta(item.id)}
                    title="Registrar puesta de huevos"
                  >
                    + Puesta
                  </button>
                )}
                <button
                  className="btn-trat"
                  onClick={() => onTrat(item.id, item.type, item.dose)}
                  title="Aplicar un tratamiento"
                >
                  Tratar
                </button>
                <button
                  className="btn-baja"
                  onClick={() => onBaja(item.id)}
                  title="Registrar baja de un individuo"
                >
                  Baja
                </button>
              </div>
            </div>

            {(() => {
              const dens = OBTENER_DATOS_DENSIDAD(grupo, item.id, item.count);
              return (
                <div
                  style={{
                    padding: "0.2rem 0.5rem",
                    background: "#fcfdfc",
                    borderRadius: "8px",
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                      fontSize: "0.8rem",
                      color: "#555",
                    }}
                  >
                    <span>
                      Densidad: <strong>{dens.actual}</strong> / {dens.maxima}{" "}
                      <span style={{ fontSize: "0.7rem", color: "#888" }}>
                        {dens.unidad}
                      </span>
                    </span>
                    <span
                      className={`density-badge ${dens.estado}`}
                      style={{ fontSize: "0.7rem" }}
                    >
                      {dens.porcentaje}% cap.
                    </span>
                  </div>
                  <div className="progress-bg" style={{ height: "6px" }}>
                    <div
                      className={`progress-bar ${dens.estado}`}
                      style={{ width: `${Math.min(dens.porcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="card-fields three-cols">
              <div className="input-group">
                <label>Último Trat.</label>
                <input
                  type="date"
                  value={item.lastDate || ""}
                  onChange={(e) =>
                    onUpdate(item.id, "lastDate", e.target.value)
                  }
                />
              </div>
              <div className="input-group">
                <label>Tratamiento / Alimento</label>
                {grupo === "renacuajos" || grupo === "metamorfoseadas" ? (
                  <input
                    type="text"
                    value={item.type || ""}
                    onChange={(e) => onUpdate(item.id, "type", e.target.value)}
                    placeholder="Alimento/Sal..."
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      fontSize: "0.85rem",
                    }}
                  />
                ) : (
                  <select
                    value={item.type || ""}
                    onChange={(e) => onUpdate(item.id, "type", e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      height: "28px",
                    }}
                  >
                    <option value="">Ninguno</option>
                    <option value="Sal">Sal</option>
                    <option value="Antibiótico/Ganadexil">
                      Antibiótico/Ganadexil
                    </option>
                    <option value="Levamisol">Levamisol</option>
                  </select>
                )}
              </div>
              <div className="input-group">
                <label>Dosis / Fase</label>
                <input
                  type="text"
                  value={item.dose || ""}
                  onChange={(e) => onUpdate(item.id, "dose", e.target.value)}
                  placeholder="ej: 0.0125 / 5g"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Section;
