-- Enlaza censos con el lote real que ocupa esa ubicación.
-- Aditivo y seguro: no afecta filas existentes (quedan en NULL hasta que
-- la app las vaya resolviendo/creando en el primer uso).
ALTER TABLE public.censos ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id);
