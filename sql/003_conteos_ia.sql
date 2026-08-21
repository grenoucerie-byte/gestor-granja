-- 003_conteos_ia.sql
--
-- Tabla donde el bot de vision artificial (Telegram) deja sus mediciones de
-- renacuajos. El nombre "conteos_ia" ya estaba previsto en el comentario de
-- 002_auth_rls.sql.
--
-- PRINCIPIO DE DISENO: el bot MIDE, la app INVENTARIA.
--
-- Esta tabla es un buzon de lecturas pendientes de revisar, no un censo
-- paralelo. Nada de lo que se escriba aqui toca la tabla censos por su
-- cuenta: una persona abre la app, compara la lectura con el censo actual y
-- decide si la aplica. Hasta entonces la fila se queda en estado
-- 'pendiente'.
--
-- El motivo es que la vision subcuenta de forma sistematica. En las dos
-- mediciones que tenemos, el conteo por foto quedaba entre un 17% y un 23%
-- por debajo del calculo por peso (313 vs 240 en una bandeja; 181 vs 150 en
-- un lote de 50 g). Es logico: en una bandeja densa los renacuajos se
-- solapan y se tapan. Por eso se guardan las dos cifras y manda el peso,
-- con el conteo por foto como contraste.
--
-- COMO EJECUTAR:
--   Copia y pega este fichero entero en Supabase -> SQL Editor -> RUN.
--   Es idempotente: se puede ejecutar varias veces sin duplicar nada.

create table if not exists public.conteos_ia (
  id bigint primary key generated always as identity,

  -- Mismo formato de ID que usa censos: "E2-F7-C1", "2.1.3", "UCI-Cen-5".
  -- El bot ya emite exactamente este formato, asi que no hace falta traducir.
  tanque_id text not null,

  -- Cuando se tomo la medida (no cuando llego la fila).
  medido_en timestamptz not null default now(),
  operario text,

  -- 'censo'  = recuento del contenido actual de la bandeja
  -- 'entrada'/'salida' = movimiento de animales hacia/desde esa bandeja
  operacion text not null default 'censo'
    check (operacion in ('censo', 'entrada', 'salida')),

  -- ─── Medicion por peso: es la que manda para inventario ───────────────
  biomasa_g numeric,
  peso_medio_g numeric,
  unidades_calculadas integer,   -- biomasa_g / peso_medio_g

  -- ─── Muestreo independiente, para contrastar el peso medio ────────────
  muestreo_unidades integer,
  muestreo_gramos numeric,
  peso_medio_muestreo numeric,

  -- ─── Conteo por vision: contraste, nunca fuente del censo ─────────────
  conteo_foto integer,

  fotos jsonb not null default '[]'::jsonb,
  origen text not null default 'telegram-bot',

  -- ─── Validacion humana ────────────────────────────────────────────────
  -- Ninguna lectura llega al censo sin pasar por aqui.
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aplicado', 'descartado')),
  revisado_por text,
  revisado_en timestamptz,

  notas text,

  -- Mensaje original del bot tal cual, por si hay que reinterpretarlo o
  -- auditar de donde salio un numero.
  payload_original jsonb,

  -- Clave estable que envia el bot (por ejemplo el id del mensaje de
  -- Telegram). Evita que un reintento cuente dos veces la misma bandeja.
  clave_idempotencia text unique,

  created_at timestamptz not null default now()
);

-- Consultas previstas: "que hay pendiente de revisar" y "historico de esta
-- bandeja, de mas reciente a mas antiguo".
create index if not exists conteos_ia_estado_idx
  on public.conteos_ia (estado);
create index if not exists conteos_ia_tanque_fecha_idx
  on public.conteos_ia (tanque_id, medido_en desc);

-- ─── Seguridad ──────────────────────────────────────────────────────────
--
-- Mismo criterio que 002_auth_rls.sql: solo usuarios con sesion de Supabase
-- Auth. La anon key por si sola no da acceso.
--
-- El bot NO usa la anon key: escribe con la service_role key desde su propio
-- servidor, que se salta las politicas RLS. Esa clave nunca debe acabar en
-- un navegador ni en el repositorio (ver scripts/backup.mjs, que sigue la
-- misma regla).

alter table public.conteos_ia enable row level security;

drop policy if exists conteos_ia_solo_autenticados on public.conteos_ia;
create policy conteos_ia_solo_autenticados
  on public.conteos_ia
  for all
  to authenticated
  using (true)
  with check (true);

-- Verificacion rapida.
select policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'conteos_ia';
