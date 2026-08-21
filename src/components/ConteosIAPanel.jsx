import { useEffect } from "react";

// Buzon de lecturas del bot de vision pendientes de revisar.
//
// Ninguna lectura toca el censo sola: aqui se ve lo que propone el bot frente
// a lo que dice la app ahora, y una persona decide. Es el mismo criterio que
// se aplico al auto-borrado de censos "corruptos": avisar y dejar decidir, no
// actuar en silencio.
function ConteosIAPanel({ conteosIA, data, onAplicar, isCloudConnected, usuarioActual }) {
  const { pendientes, cargando, error, cargarPendientes, compararConCenso } = conteosIA;

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  if (!isCloudConnected) {
    return (
      <p style={{ textAlign: "center", color: "#888", padding: "1.5rem" }}>
        Conéctate a la nube para ver las lecturas del bot de visión.
      </p>
    );
  }

  if (cargando) {
    return <p style={{ textAlign: "center", color: "#888", padding: "1.5rem" }}>Cargando lecturas…</p>;
  }

  if (error) {
    return (
      <p style={{ textAlign: "center", color: "var(--rojo-alerta, #c0392b)", padding: "1.5rem" }}>
        {error}
      </p>
    );
  }

  if (pendientes.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#888", padding: "1.5rem" }}>
        <p style={{ margin: 0 }}>No hay lecturas pendientes de revisar.</p>
        <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
          Aquí aparecerán los pesajes que envíe el bot de visión desde Telegram.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={{ background: "#eef5ff", border: "1px solid #c7ddf5", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.8rem", color: "#2c5282" }}>
        El conteo por foto suele quedarse corto porque los renacuajos se solapan
        en la bandeja. La cifra que se aplica es la calculada <strong>por peso</strong>;
        la de la foto se muestra solo como contraste.
      </div>

      {pendientes.map((lectura) => {
        const cmp = compararConCenso(lectura, data);
        const sinCelda = cmp.countActual === null;
        const hayDesvio = cmp.porcentaje !== null && Math.abs(cmp.porcentaje) >= 10;

        return (
          <div
            key={lectura.id}
            style={{
              background: "#fff",
              border: `1px solid ${hayDesvio ? "#f5c6c6" : "#dee2e6"}`,
              borderLeft: `4px solid ${hayDesvio ? "#c0392b" : "var(--pistacho, #27ae60)"}`,
              borderRadius: "8px",
              padding: "0.8rem 1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: "bold", color: "var(--oliva, #556b2f)" }}>
                📷 {lectura.tanque_id}
              </span>
              <span style={{ fontSize: "0.76rem", color: "#888" }}>
                {lectura.medido_en ? new Date(lectura.medido_en).toLocaleString("es-ES") : ""}
                {lectura.operario ? ` · ${lectura.operario}` : ""}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <Dato etiqueta="Censo actual" valor={sinCelda ? "—" : `${cmp.countActual} ud`} />
              <Dato etiqueta="Propone (por peso)" valor={`${cmp.propuesto} ud`} destacado />
              <Dato
                etiqueta="Diferencia"
                valor={cmp.diferencia === null ? "—" : `${cmp.diferencia > 0 ? "+" : ""}${cmp.diferencia} ud${cmp.porcentaje !== null ? ` (${cmp.porcentaje > 0 ? "+" : ""}${cmp.porcentaje}%)` : ""}`}
                alerta={hayDesvio}
              />
              <Dato etiqueta="Biomasa" valor={lectura.biomasa_g ? `${lectura.biomasa_g} g` : "—"} />
              <Dato etiqueta="Peso medio" valor={lectura.peso_medio_g ? `${lectura.peso_medio_g} g/ud` : "—"} />
              {lectura.conteo_foto != null && (
                <Dato
                  etiqueta="Conteo por foto"
                  valor={`${lectura.conteo_foto} ud${cmp.desvioFoto !== null ? ` (${cmp.desvioFoto > 0 ? "+" : ""}${cmp.desvioFoto}%)` : ""}`}
                />
              )}
            </div>

            {lectura.peso_medio_muestreo != null && (
              <div style={{ fontSize: "0.76rem", color: "#666", marginBottom: "0.5rem" }}>
                Muestreo independiente: {lectura.muestreo_unidades} ud = {lectura.muestreo_gramos} g
                → <strong>{lectura.peso_medio_muestreo} g/ud</strong>
              </div>
            )}

            {sinCelda && (
              <div style={{ fontSize: "0.78rem", color: "#b9770e", background: "#fef9e7", border: "1px solid #f9e79f", borderRadius: "6px", padding: "0.4rem 0.6rem", marginBottom: "0.5rem" }}>
                ⚠️ No se encuentra la bandeja <strong>{lectura.tanque_id}</strong> en el censo.
                Revisa que el identificador sea correcto antes de aplicarla.
              </div>
            )}

            {hayDesvio && !sinCelda && (
              <div style={{ fontSize: "0.78rem", color: "#c0392b", background: "#fdecea", border: "1px solid #f5b7b1", borderRadius: "6px", padding: "0.4rem 0.6rem", marginBottom: "0.5rem" }}>
                ⚠️ Diferencia del {Math.abs(cmp.porcentaje)}% con el censo. Merece la pena
                repesar la bandeja antes de aplicarla.
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                className="btn-baja"
                style={{ background: "#7f8c8d", fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
                onClick={() => onAplicar(lectura, cmp, "descartado", usuarioActual)}
              >
                Descartar
              </button>
              <button
                className="btn-guardar"
                style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
                disabled={sinCelda}
                title={sinCelda ? "No se encuentra esa bandeja en el censo" : ""}
                onClick={() => onAplicar(lectura, cmp, "aplicado", usuarioActual)}
              >
                ✓ Aplicar al censo
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dato({ etiqueta, valor, destacado, alerta }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.3px" }}>{etiqueta}</div>
      <div style={{
        fontSize: destacado ? "1rem" : "0.9rem",
        fontWeight: destacado || alerta ? "bold" : "normal",
        color: alerta ? "#c0392b" : destacado ? "var(--oliva, #556b2f)" : "#333",
      }}>
        {valor}
      </div>
    </div>
  );
}

export default ConteosIAPanel;
