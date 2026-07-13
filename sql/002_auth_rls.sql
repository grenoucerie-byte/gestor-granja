-- 002_auth_rls.sql
--
-- Sustituye las politicas "permitir todo" / "allow all" (que dan lectura y
-- escritura a cualquiera con la anon key, sin necesidad de iniciar sesion)
-- por politicas que exigen una sesion de Supabase Auth (auth.role() =
-- 'authenticated'). Es el complemento en base de datos del login añadido en
-- el codigo (src/hooks/useAuth.js, src/components de la pestaña
-- Configuracion).
--
-- COMO EJECUTAR:
--   1. Antes de correr esto, crea en Supabase → Authentication → Users al
--      menos una cuenta (email + contraseña) para cada persona que use la
--      app (Pau, Anabel...). Sin al menos un usuario creado, nadie podra
--      volver a entrar a la nube tras aplicar este script (la app seguira
--      funcionando en modo local, pero sin sincronizar).
--   2. Copia y pega este archivo completo en Supabase → SQL Editor → RUN.
--   3. Prueba: entra en la app, ve a Configuracion, inicia sesion con una
--      de esas cuentas y confirma que "Guardar y Conectar" funciona.
--
-- Es idempotente: se puede ejecutar varias veces sin duplicar politicas,
-- porque primero elimina TODAS las politicas existentes de cada tabla
-- (sea cual sea su nombre) antes de crear las nuevas.

-- Lista de tablas de gestor-granja detectadas en el codigo y en los scripts
-- SQL previos. Si en el futuro se añade una tabla nueva (por ejemplo
-- "conteos_ia" para la integracion con vision artificial de terceros),
-- hay que añadirla aqui tambien.
do $$
declare
  tabla text;
  pol record;
  tablas text[] := array[
    'censos', 'inventario', 'tratamientos', 'bajas', 'puestas',
    'alimentacion', 'configuracion', 'incidencias', 'notas_pizarra',
    'lotes', 'ubicaciones', 'movimientos_lote',
    -- Tablas detectadas en Supabase que no usa el codigo actual pero que
    -- siguen accesibles con la anon key (restos de pruebas anteriores).
    -- Se cierran igualmente por seguridad, aunque esten sin uso.
    'audit_log', 'bloqueos', 'fases_historial', 'incidencias_sanitarias',
    'productos', 'tareas_programadas', 'usuarios'
  ];
begin
  foreach tabla in array tablas loop
    -- Solo actua si la tabla existe (evita errores si alguna no se llego a crear).
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tabla) then

      execute format('alter table public.%I enable row level security', tabla);

      -- Elimina todas las politicas existentes en esa tabla, sea cual sea su nombre.
      for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = tabla
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tabla);
      end loop;

      -- Nueva politica: solo usuarios con sesion de Supabase Auth
      -- (autenticados) pueden leer y escribir. El anon key por si solo
      -- ya no da acceso a los datos.
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        tabla || '_solo_autenticados', tabla
      );

    end if;
  end loop;
end $$;

-- Verificacion rapida: lista las politicas resultantes por tabla.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename;
