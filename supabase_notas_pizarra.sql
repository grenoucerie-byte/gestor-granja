-- Tabla para la pizarra de comunicación entre responsables
CREATE TABLE IF NOT EXISTS public.notas_pizarra (
  id bigint PRIMARY KEY,
  texto text NOT NULL,
  area text NOT NULL DEFAULT 'General',
  prioridad text NOT NULL DEFAULT 'normal',
  autor text NOT NULL DEFAULT 'Anónimo',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_pizarra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_pizarra_anon_all" ON public.notas_pizarra
  FOR ALL USING (true) WITH CHECK (true);
