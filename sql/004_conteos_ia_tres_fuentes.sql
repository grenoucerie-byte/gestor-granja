-- 004_conteos_ia_tres_fuentes.sql
--
-- Amplia conteos_ia para guardar POR SEPARADO las tres estimaciones de
-- cuantos animales hay, en vez de una sola cifra ya resuelta.
--
-- POR QUE
--
-- En el mensaje real del bot conviven tres numeros distintos:
--
--   - "Cantidad fijada: 240 renacuajos"        -> lo fija la persona
--   - "Biomasa total medida: 73 g"             -> lo pesa la persona
--   - "Peso medio usado: 0,304 g (73 / 240)"   -> DERIVADO del conteo humano
--   - "Muestreo independiente: 30 ud = 9 g"    -> 0,300 g/ud, independiente
--   - conteo por foto                          -> la vision
--
-- El diseno original calculaba unidades = biomasa / peso_medio_g. Pero
-- peso_medio_g sale de dividir la biomasa entre el conteo humano, asi que
-- ese calculo es circular: devuelve otra vez el numero de partida y no
-- valida nada.
--
-- La estimacion realmente independiente es la del muestreo:
--   73 g / 0,300 g/ud = 243 ud,  que contrasta con las 240 que dijo la
-- persona. Es justamente la comprobacion que el bot ya hacia cuando
-- respondia "los dos calculos practicamente coinciden".
--
-- Con estas columnas, la app puede ensenar las tres cifras juntas y dejar
-- que quien revisa elija cual es la definitiva, en vez de decidirlo el
-- sistema por su cuenta.
--
-- COMO EJECUTAR:
--   Copia y pega en Supabase -> SQL Editor -> RUN.
--   Idempotente: se puede ejecutar varias veces.

-- Cifra que fija la persona que hace la medicion ("cantidad fijada").
alter table public.conteos_ia
  add column if not exists conteo_humano integer;

-- Estimacion independiente: biomasa_g / peso_medio_muestreo.
-- No depende del conteo humano, por eso sirve para contrastarlo.
alter table public.conteos_ia
  add column if not exists unidades_por_muestreo integer;

-- Cual de las tres se acepto al validar la lectura. Lo escribe la app
-- cuando una persona pulsa "aplicar", nunca el bot.
alter table public.conteos_ia
  add column if not exists fuente_definitiva text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conteos_ia_fuente_definitiva_check'
  ) then
    alter table public.conteos_ia
      add constraint conteos_ia_fuente_definitiva_check
      check (fuente_definitiva is null
             or fuente_definitiva in ('humano', 'muestreo', 'foto', 'manual'));
  end if;
end $$;

comment on column public.conteos_ia.conteo_humano is
  'Unidades que fija la persona que mide (la "cantidad fijada" del bot).';
comment on column public.conteos_ia.unidades_por_muestreo is
  'biomasa_g / peso_medio_muestreo. Estimacion independiente del conteo humano.';
comment on column public.conteos_ia.conteo_foto is
  'Unidades contadas por vision. Contraste, nunca fuente del censo por si sola.';
comment on column public.conteos_ia.unidades_calculadas is
  'Cifra que el bot propone como mas fiable de las tres.';
comment on column public.conteos_ia.fuente_definitiva is
  'Que cifra acepto la persona al validar: humano | muestreo | foto | manual.';

-- Verificacion rapida.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'conteos_ia'
  and column_name in ('conteo_humano', 'unidades_por_muestreo',
                      'conteo_foto', 'unidades_calculadas', 'fuente_definitiva')
order by column_name;
