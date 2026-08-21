import { useEffect, useState } from "react";

// Buzon de lecturas del bot de vision pendientes de revisar.
//
// Cada medicion trae hasta tres estimaciones de cuantos animales hay: la que
// fija el operario, la que sale del muestreo independiente y la que cuenta la
// vision. No se muestran ya resueltas en una sola cifra: se ensenan las tres,
// se dice cuanto se separan, y quien revisa elige cual manda antes de aplicar
// nada al censo.
//
// Es el mismo criterio que se aplico al auto-borrado de censos "corruptos":
// avisar y dejar decidir, no actuar en silencio.
function ConteosIAPanel({ conteosIA, data, onAplicar, isCloudConnected, usuarioActual }) {
  const { pendientes, cargando, error, cargarPendientes, compararConCenso, fuentesDe } = conteosIA;

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
        Cada lectura puede traer hasta tres cifras: la del <strong>operario</strong>, la del{" "}
        <strong>muestreo</strong> (la única independiente) y la de la <strong>visión</strong>
        {" "}(que suele quedarse corta porque los renacuajos se solapan). Elige cuál aplicar.
      </div>

      {pendientes.map((lectura) => (
        <FichaLectura
          key={lectura.id}
          lectura={lectura}
          data={data}
          fuentesDe={fuentesDe}
          compararConCenso={compararConCenso}
          onAplicar={onAplicar}
          usuarioActual={usuarioActual}
        />
      ))}
    </div>
  );
}

function FichaLectura({ lectura, data, fuentesDe, compararConCenso, onAplicar, usuarioActual }) {
  const fuentes = fuentesDe(lectura);
  const [elegida, setElegida] = useState(fuentes.sugerida);

  const fuenteActiva = fuentes.lista.find((f) => f.clave === elegida) || fuentes.lista[0] || null;
  const cmp = compararConCenso(lectura, data, fuenteActiva ? fuenteActiva.valor : null);

  const sinCelda = cmp.countActual === null;
  const hayDesvio = cmp.porcentaje !== null && Math.abs(cmp.porcentaje) >= 10;
  const fuentesDiscrepan = fuentes.dispersion !== null && fuentes.dispersion >= 10;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${hayDesvio ? "#f5c6c6" : "#dee2e6"}`,
        borderLeft: `4px solid ${hayDesvio ? "#c0392b" : "var(--pistacho, #27ae60)"}`,
        borderRadius: "8px",
        padding: "0.8rem 1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <span style={{ fontWeight: "bold", color: "var(--oliva, #556b2f)" }}>
          📷 {lectura.tanque_id}
        </span>
        <span style={{ fontSize: "0.76rem", color: "#888" }}>
          {lectura.medido_en ? new Date(lectura.medido_en).toLocaleString("es-ES") : ""}
          {lectura.operario ? ` · ${lectura.operario}` : ""}
        </span>
      </div>

      {/* ─── Las tres fuentes, para elegir ─── */}
      {fuentes.lista.length > 0 && (
        <div style={{ marginBottom: "0.7rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "0.3rem" }}>
            Qué cifra aplicar
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {fuentes.lista.map((f) => {
              const activa = f.clave === elegida;
              return (
                <button
                  key={f.clave}
                  onClick={() => setElegida(f.clave)}
                  aria-pressed={activa}
                  style={{
                    flex: "1 1 8rem",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: "8px",
                    padding: "0.45rem 0.65rem",
                    border: activa ? "2px solid var(--oliva, #556b2f)" : "1px solid #ccc",
                    background: activa ? "#f0f5ea" : "#fff",
                  }}
                >
                  <div style={{ fontSize: "0.68rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                    {f.etiqueta}
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: "bold", color: activa ? "var(--oliva, #556b2f)" : "#333" }}>
                    {f.valor} ud
                  </div>
                  {f.nota && <div style={{ fontSize: "0.68rem", color: "#999" }}>{f.nota}</div>}
                </button>
              );
            })}
          </div>
          {fuentesDiscrepan && (
            <div style={{ fontSize: "0.76rem", color: "#b9770e", marginTop: "0.35rem" }}>
              ⚠️ Las cifras se separan un {fuentes.dispersion}% entre sí. Merece la pena
              mirar de dónde viene la diferencia antes de aceptar ninguna.
            </div>
          )}
        </div>
      )}

      {/* ─── Contraste con el censo ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <Dato etiqueta="Censo actual" valor={sinCelda ? "—" : `${cmp.countActual} ud`} />
        <Dato etiqueta="Pasaría a" valor={`${cmp.propuesto} ud`} destacado />
        <Dato
          etiqueta="Diferencia"
          valor={cmp.diferencia === null ? "—" : `${cmp.diferencia > 0 ? "+" : ""}${cmp.diferencia} ud${cmp.porcentaje !== null ? ` (${cmp.porcentaje > 0 ? "+" : ""}${cmp.porcentaje}%)` : ""}`}
          alerta={hayDesvio}
        />
        <Dato etiqueta="Biomasa" valor={lectura.biomasa_g ? `${lectura.biomasa_g} g` : "—"} />
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
          ⚠️ Diferencia del {Math.abs(cmp.porcentaje)}% con el censo. Merece la pena repesar
          la bandeja antes de aplicarla.
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          className="btn-baja"
          style={{ background: "#7f8c8d", fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
          onClick={() => onAplicar(lectura, cmp, "descartado", usuarioActual, elegida)}
        >
          Descartar
        </button>
        <button
          className="btn-guardar"
          style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
          disabled={sinCelda || !fuenteActiva}
          title={sinCelda ? "No se encuentra esa bandeja en el censo" : ""}
          onClick={() => onAplicar(lectura, cmp, "aplicado", usuarioActual, elegida)}
        >
          ✓ Aplicar al censo
        </button>
      </div>
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
