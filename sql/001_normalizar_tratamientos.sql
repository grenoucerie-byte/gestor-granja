-- ============================================================================
-- MIGRACIÓN: Normalizar tabla tratamientos + FK en censos
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-06-23
-- ============================================================================

-- 1. Añadir columna categoria_evento para clasificar registros existentes
ALTER TABLE public.tratamientos
  ADD COLUMN IF NOT EXISTS categoria_evento text DEFAULT 'tratamiento';

-- 2. Clasificar registros existentes según su tipo
UPDATE public.tratamientos SET categoria_evento = 'baja'
WHERE lower(tipo) LIKE '%baja%';

UPDATE public.tratamientos SET categoria_evento = 'traslado'
WHERE lower(tipo) LIKE '%traslado%';

UPDATE public.tratamientos SET categoria_evento = 'salida'
WHERE lower(tipo) LIKE '%salida%';

UPDATE public.tratamientos SET categoria_evento = 'ajuste'
WHERE lower(tipo) LIKE '%ajuste%'
   OR lower(tipo) LIKE '%ingreso%'
   OR lower(tipo) LIKE '%actualizaci%';

UPDATE public.tratamientos SET categoria_evento = 'mantenimiento'
WHERE lower(tipo) LIKE '%adición%'
   OR lower(tipo) LIKE '%mantenimiento%';

-- Los que no matchean ninguno quedan como 'tratamiento' (el default)

-- 3. Crear índice para queries filtradas por categoria_evento
CREATE INDEX IF NOT EXISTS idx_tratamientos_categoria_evento
  ON public.tratamientos (categoria_evento);

-- 4. FK en censos.lote_id → lotes.id (nullable)
-- Primero limpiar lote_ids huérfanos que no existen en lotes
UPDATE public.censos SET lote_id = NULL
WHERE lote_id IS NOT NULL
  AND lote_id::uuid NOT IN (SELECT id FROM public.lotes);

-- Ahora añadir la FK
ALTER TABLE public.censos
  ADD CONSTRAINT fk_censos_lote
  FOREIGN KEY (lote_id) REFERENCES public.lotes(id)
  ON DELETE SET NULL;

-- 5. FK en bajas.lote_id → lotes.id (nullable)
UPDATE public.bajas SET lote_id = NULL
WHERE lote_id IS NOT NULL
  AND lote_id NOT IN (SELECT id FROM public.lotes);

ALTER TABLE public.bajas
  ADD CONSTRAINT fk_bajas_lote
  FOREIGN KEY (lote_id) REFERENCES public.lotes(id)
  ON DELETE SET NULL;

-- 6. Añadir columnas faltantes en bajas si no existen
ALTER TABLE public.bajas ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.bajas ADD COLUMN IF NOT EXISTS tipo_salida text;
ALTER TABLE public.bajas ADD COLUMN IF NOT EXISTS destino text;
ALTER TABLE public.bajas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Mortalidad';

-- ============================================================================
-- VERIFICACIÓN: ejecutar después de la migración
-- ============================================================================
-- SELECT categoria_evento, count(*) FROM tratamientos GROUP BY categoria_evento;
-- SELECT count(*) FROM censos WHERE lote_id IS NOT NULL;
-- SELECT count(*) FROM bajas WHERE lote_id IS NOT NULL;
