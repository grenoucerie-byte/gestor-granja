-- Paso 2: ver columnas de lotes y ubicaciones (para saber cómo mapear
-- un tanque de texto como "2.1.3" a su lote_id / ubicacion_id en uuid)

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('lotes', 'ubicaciones')
ORDER BY table_name, ordinal_position;

-- Paso 3: unas filas de ejemplo para ver cómo se ven los datos reales
SELECT * FROM ubicaciones LIMIT 5;
SELECT * FROM lotes LIMIT 5;
