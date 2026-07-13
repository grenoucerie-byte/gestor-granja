# Fase 0 — Estabilización: qué se ha hecho y qué falta por hacer tú

Este documento acompaña a los cambios de código de la Fase 0 del roadmap
(login, permisos reales, copias de seguridad). Está pensado para que puedas
seguirlo paso a paso sin necesitar más contexto.

## 1. Qué se ha añadido en el código

- `src/supabaseClient.js` — cliente de Supabase Auth (nuevo).
- `src/hooks/useAuth.js` — hook de sesión: `login`, `logout`, `isAuthenticated`, etc.
  Solo se activa cuando hay una nube configurada; **no bloquea el modo local**
  (esto es justo lo que rompió la app la vez anterior que se intentó login).
- `src/hooks/useSupabase.js` — ahora usa el token de la sesión iniciada (si
  existe) en vez de la anon key pelada para las llamadas a Supabase.
- `src/hooks/useCloudSync.js` — la sincronización automática con la nube ya
  no arranca sola con solo tener URL/clave guardadas: también exige sesión
  iniciada.
- `src/App.jsx` — en la pestaña **Configuración**, debajo de los campos de
  URL/clave, aparece un bloque de inicio de sesión cuando hay nube
  configurada pero no hay sesión activa.
- `sql/002_auth_rls.sql` — migración que sustituye las políticas "permitir
  todo" de la base de datos por políticas que exigen sesión autenticada.
- `scripts/backup.mjs` + `.github/workflows/backup.yml` — copia de
  seguridad diaria automática de todas las tablas.

Todo esto ya está probado localmente: compila (`npm run build`), pasa el
linter sin errores nuevos, y pasan los 92 tests automáticos (`npm test`).

## 2. Lo que tienes que hacer tú en Supabase (una sola vez)

Esto **no lo puedo hacer yo** porque requiere entrar con tus credenciales al
panel de Supabase, y no tengo ni pido acceso a ellas.

1. **Crear los usuarios de acceso.** Panel de Supabase → *Authentication* →
   *Users* → *Add user* → crea una cuenta (email + contraseña) para ti y
   otra para Anabel. Guardad esas contraseñas donde las guardéis
   normalmente (gestor de contraseñas).
   - Importante: si Supabase pide confirmación de email por defecto y no
     tenéis forma de recibir ese correo desde el panel, en *Authentication* →
     *Providers* → *Email* puedes desactivar "Confirm email" para estas dos
     cuentas internas, o confirmar el usuario manualmente desde el propio
     panel (columna de estado del usuario).
2. **Ejecutar la migración SQL.** Panel de Supabase → *SQL Editor* → pega el
   contenido completo de `sql/002_auth_rls.sql` → *RUN*. Es seguro
   ejecutarlo más de una vez.
3. **Probar el login.** Abre la app, ve a *Configuración*, y con la URL/clave
   ya puestas, inicia sesión con una de las cuentas creadas en el paso 1.
   Debe aparecer "Sesión iniciada como...". Pulsa "Guardar y Conectar" y
   comprueba que los datos siguen sincronizando con normalidad.
4. **Crear la service_role key para el backup.** Panel de Supabase →
   *Settings* → *API* → copia la **service_role key** (no la anon key).

## 3. Lo que tienes que hacer tú en GitHub (para el backup automático)

1. En el repositorio, ve a *Settings* → *Secrets and variables* → *Actions*.
2. Añade dos secretos:
   - `SUPABASE_URL` → la URL de tu proyecto (la misma que usas en la app).
   - `SUPABASE_SERVICE_KEY` → la service_role key del paso anterior.
     **Nunca la pongas en el código ni en el .env del navegador**, solo aquí.
3. El workflow `.github/workflows/backup.yml` se ejecutará automáticamente
   cada día a las 03:00 UTC. También puedes lanzarlo a mano desde la pestaña
   *Actions* → *Backup diario gestor-granja* → *Run workflow*.
4. Cada ejecución deja un backup descargable (JSON con todas las tablas)
   durante 90 días en *Actions* → la ejecución concreta → *Artifacts*.

## 4. Verificación de que todo funciona (checklist)

- [ ] Puedo entrar en la app sin iniciar sesión y sigue funcionando en modo
      local (censos, tratamientos, etc. con los datos guardados en este
      ordenador).
- [ ] Con la nube configurada pero sin sesión, la app avisa de que hay que
      iniciar sesión y no descarga datos de la nube automáticamente.
- [ ] Tras iniciar sesión, "Guardar y Conectar" funciona y los datos se
      sincronizan.
- [ ] Ejecuté `sql/002_auth_rls.sql` en Supabase sin errores.
- [ ] Probé a llamar a la API de Supabase sin sesión (por ejemplo, abriendo
      la URL `https://tu-proyecto.supabase.co/rest/v1/censos` con solo la
      anon key en las cabeceras) y ahora debe devolver un array vacío o un
      error de permisos, no los datos reales.
- [ ] El workflow de backup se ejecutó al menos una vez sin errores (pestaña
      Actions) y generó un artefacto descargable.

## 5. Si algo se bloquea

Si por lo que sea nadie puede iniciar sesión (contraseña olvidada, usuario
mal configurado, etc.), la app **no se queda bloqueada**: en la pestaña
Configuración puedes pulsar "🔌 Desconectar Nube" para volver al modo local
con los datos guardados en el ordenador, mientras se soluciona el acceso a
la nube en el panel de Supabase.
