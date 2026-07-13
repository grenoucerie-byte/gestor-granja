#!/usr/bin/env node
// Copia de seguridad automatica de todas las tablas de gestor-granja en Supabase.
//
// Uso local:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/backup.mjs
//
// En GitHub Actions se ejecuta a diario (ver .github/workflows/backup.yml)
// usando los secretos del repositorio SUPABASE_URL y SUPABASE_SERVICE_KEY.
//
// Importante sobre la clave: esto usa la "service_role key" de Supabase, NO
// la anon key que usa la app en el navegador. La service_role key salta las
// politicas RLS (necesario para poder respaldar todo aunque las tablas
// ahora exijan sesion autenticada) y por eso NUNCA debe usarse en el
// navegador ni commitearse al repositorio: solo debe vivir como secreto en
// GitHub Actions o en el entorno local de quien ejecute el backup a mano.

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const TABLAS = [
  "censos", "inventario", "tratamientos", "bajas", "puestas",
  "alimentacion", "configuracion", "incidencias", "notas_pizarra",
  "lotes", "ubicaciones",
];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

async function descargarTabla(tabla) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new Error(`Fallo al descargar "${tabla}" (${res.status}): ${texto}`);
  }
  return res.json();
}

async function main() {
  const fecha = new Date().toISOString().slice(0, 10);
  const salida = { fecha_backup: new Date().toISOString(), tablas: {} };
  const errores = [];

  for (const tabla of TABLAS) {
    try {
      salida.tablas[tabla] = await descargarTabla(tabla);
      console.log(`✔ ${tabla}: ${salida.tablas[tabla].length} filas`);
    } catch (err) {
      console.error(`✘ ${tabla}: ${err.message}`);
      errores.push(`${tabla}: ${err.message}`);
      salida.tablas[tabla] = null;
    }
  }

  const dir = "backups";
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const destino = `${dir}/backup_${fecha}.json`;
  await writeFile(destino, JSON.stringify(salida, null, 2), "utf8");
  console.log(`\nBackup guardado en ${destino}`);

  if (errores.length > 0) {
    console.error(`\nATENCION: ${errores.length} tabla(s) no se pudieron respaldar:`);
    errores.forEach((e) => console.error(` - ${e}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error inesperado durante el backup:", err);
  process.exit(1);
});
