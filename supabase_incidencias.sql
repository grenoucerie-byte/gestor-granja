-- ════════════════════════════════════════════════════════════════
-- Tabla de Control de Incidencias (bacteriosis y otros brotes sanitarios)
-- Seguro de re-ejecutar (usa IF NOT EXISTS en todo)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.incidencias (
  id bigint PRIMARY KEY,
  fecha_inicio text,
  agente_causante text,
  raceways_afectados text,
  tratamiento_aplicado text,
  severidad text DEFAULT 'Media',
  estado text DEFAULT 'Abierta',
  notas text,
  fecha_cierre text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todo_incidencias" ON public.incidencias;
CREATE POLICY "permitir_todo_incidencias" ON public.incidencias
  FOR ALL USING (true) WITH CHECK (true);
