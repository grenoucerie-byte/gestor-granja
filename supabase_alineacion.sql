-- ════════════════════════════════════════════════════════════════
-- Alineación de esquema Supabase con los campos que el frontend envía
-- Generado a partir de una revisión completa de src/App.jsx
-- Seguro de re-ejecutar (usa IF NOT EXISTS en todo)
-- ════════════════════════════════════════════════════════════════

-- ─── 1. PUESTAS ─────────────────────────────────────────────────
-- confirmarPuesta() envía: id, fecha, hora, tanque, grupo, destino,
-- huevos, tipo_puesta, estado, obs
ALTER TABLE public.puestas ADD COLUMN IF NOT EXISTS destino text;
ALTER TABLE public.puestas ADD COLUMN IF NOT EXISTS huevos integer;
ALTER TABLE public.puestas ADD COLUMN IF NOT EXISTS tipo_puesta text;
ALTER TABLE public.puestas ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.puestas ADD COLUMN IF NOT EXISTS obs text;

-- ─── 2. TRATAMIENTOS ────────────────────────────────────────────
-- aplicarTratamiento() / aplicarTratamientoMasivo() envían:
-- id, fecha, hora, tanque, tipo, dosis, categoria, frecuencia, num_dosis, notas
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS frecuencia text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS num_dosis text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS notas text;

-- ─── 3. CENSOS ──────────────────────────────────────────────────
-- syncInventarioNube() (cuando item.grupo existe) envía:
-- id, grupo, count, last_date, type, dose, obs, peso_medio, muestras
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS last_date text;
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS dose text;
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS peso_medio text;
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS muestras text;

-- ─── 4. INVENTARIO (productos / stock) ─────────────────────────
-- Pantalla de Almacén envía: id, nombre, stock, unidad, min_stock
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS stock numeric;
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS unidad text;
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS min_stock numeric;

-- ─── 5. ALIMENTACIÓN (tabla nueva) ─────────────────────────────
-- registrarAlimentacionMasiva() / registrarAlimentacionIndividual() envían:
-- id, batchId (solo masiva), fecha, hora, tanqueId, grupo, producto,
-- gramosPorToma (solo masiva), tomas (solo masiva), gramos
CREATE TABLE IF NOT EXISTS public.alimentacion (
  id bigint PRIMARY KEY,
  "batchId" bigint,
  fecha text,
  hora text,
  "tanqueId" text,
  grupo text,
  producto text,
  "gramosPorToma" numeric,
  tomas integer,
  gramos numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alimentacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todo_alimentacion" ON public.alimentacion;
CREATE POLICY "permitir_todo_alimentacion" ON public.alimentacion
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 6. CONFIGURACIÓN (tabla nueva) ────────────────────────────
-- syncPlanesNube() envía: id (texto: 'planes_alimentacion' / 'planes_tratamiento' / 'planes_fase'),
-- datos (jsonb), updated_at
CREATE TABLE IF NOT EXISTS public.configuracion (
  id text PRIMARY KEY,
  datos jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todo_configuracion" ON public.configuracion;
CREATE POLICY "permitir_todo_configuracion" ON public.configuracion
  FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- FIN. Tras ejecutar esto, recarga la app (Ctrl+Shift+R) en todos
-- los dispositivos para que el primer guardado tras el cambio
-- ya no falle por columna inexistente.
-- ════════════════════════════════════════════════════════════════
