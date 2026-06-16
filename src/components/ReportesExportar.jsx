import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const ReportesExportar = ({ data, tratamientos, puestas, inventario }) => {
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [soloOcupadas, setSoloOcupadas] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');

  const exportarAExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 1. Hoja de Censos (Animales actuales)
    let censosFiltrados = [];
    Object.keys(data).forEach(grupo => {
      if (filtroGrupo === 'todos' || filtroGrupo === grupo) {
        const celdasGrupo = data[grupo] || [];
        celdasGrupo.forEach(celda => {
          if (soloOcupadas && celda.count <= 0) return;
          
          const matchTexto = 
            celda.id.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
            (celda.obs && celda.obs.toLowerCase().includes(textoBusqueda.toLowerCase())) ||
            (celda.type && celda.type.toLowerCase().includes(textoBusqueda.toLowerCase()));
          
          if (matchTexto) {
            censosFiltrados.push({
              Grupo: grupo,
              Celda_ID: celda.id,
              Cantidad: celda.count,
              Tratamiento: celda.type || '-',
              Dosis: celda.dose || '-',
              Observaciones: celda.obs || '-',
              Ultima_Fecha: celda.lastDate || '-',
              PesoMedio: celda.pesoMedio || '-'
            });
          }
        });
      }
    });

    if (censosFiltrados.length > 0) {
      const censosSheet = XLSX.utils.json_to_sheet(censosFiltrados);
      XLSX.utils.book_append_sheet(workbook, censosSheet, 'Censos_Actuales');
    }

    // 2. Hoja de Trazabilidad y Tratamientos
    if (filtroGrupo === 'todos' || filtroGrupo === 'tratamientos') {
      let tratFiltrados = tratamientos;
      if (textoBusqueda) {
        tratFiltrados = tratamientos.filter(t => 
          (t.tanque && t.tanque.toLowerCase().includes(textoBusqueda.toLowerCase())) ||
          (t.tipo && t.tipo.toLowerCase().includes(textoBusqueda.toLowerCase()))
        );
      }
      
      const tratamientosFormatted = tratFiltrados.map(t => ({
        Fecha: t.fecha,
        Hora: t.hora,
        Raceway_Celda: t.tanque,
        Accion_Tratamiento: t.tipo,
        Cantidad_Dosis: t.dosis
      }));

      if (tratamientosFormatted.length > 0) {
        const tratSheet = XLSX.utils.json_to_sheet(tratamientosFormatted);
        XLSX.utils.book_append_sheet(workbook, tratSheet, 'Historial_Trazabilidad');
      }
    }

    // 3. Hoja de Puestas
    if (filtroGrupo === 'todos' || filtroGrupo === 'puestas') {
      const puestasFormatted = puestas.map(p => ({
        Fecha: p.fecha,
        Hora: p.hora,
        Lote_Grupo: p.grupo,
        Tanque: p.tanque
      }));
      
      if (puestasFormatted.length > 0) {
        const puestasSheet = XLSX.utils.json_to_sheet(puestasFormatted);
        XLSX.utils.book_append_sheet(workbook, puestasSheet, 'Puestas_Huevos');
      }
    }

    // Guardar el archivo
    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Reporte_Granja_${fechaStr}.xlsx`);
  };

  return (
    <div className="group-section" style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--blanco)', padding: '2rem', borderRadius: '15px', boxShadow: 'var(--sombra)' }}>
      <h2 className="group-title" style={{ borderLeft: '6px solid var(--pistacho)', paddingLeft: '1rem', color: 'var(--oliva)' }}>
        📊 Reportes y Exportación
      </h2>
      
      <p style={{ marginBottom: '1.5rem', color: 'var(--texto)', fontSize: '0.95rem' }}>
        Genera archivos Excel con toda la información de trazabilidad, tratamientos y censos actuales.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="input-group">
          <label>¿Qué datos exportar?</label>
          <select 
            value={filtroGrupo} 
            onChange={e => setFiltroGrupo(e.target.value)}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
          >
            <option value="todos">Todos los datos (Completo)</option>
            <option value="tratamientos">Solo Historial de Tratamientos/Movimientos</option>
            <option value="adultas">Censo - Ranas Adultas</option>
            <option value="renacuajos">Censo - Renacuajos</option>
            <option value="metamorfoseadas">Censo - Metamorfoseadas</option>
            <option value="naveVerde">Censo - Nave Verde (UCI)</option>
            <option value="puestas">Registro de Puestas</option>
          </select>
        </div>

        <div className="input-group">
          <label>Filtro de Texto (Lote, Raceway, Tratamiento...)</label>
          <input 
            type="text" 
            placeholder="Ej: UCI-Izq-1, Ganadexil, Traslado..." 
            value={textoBusqueda}
            onChange={e => setTextoBusqueda(e.target.value)}
          />
        </div>

        <div className="input-group full" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            id="soloOcupadas" 
            checked={soloOcupadas} 
            onChange={e => setSoloOcupadas(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="soloOcupadas" style={{ cursor: 'pointer', fontSize: '0.9rem', textTransform: 'none' }}>
            En los censos, exportar SOLAMENTE las celdas/raceways que contengan animales (ignorar vacíos).
          </label>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <button 
          onClick={exportarAExcel}
          style={{ 
            background: 'var(--pistacho)', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: '30px', 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px rgba(147, 197, 114, 0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.target.style.transform = 'translateY(0)'}
        >
          ⬇️ Generar y Descargar Excel
        </button>
      </div>
    </div>
  );
};

export default ReportesExportar;
