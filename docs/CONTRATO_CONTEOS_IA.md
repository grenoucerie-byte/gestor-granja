# Contrato: cómo el bot de visión envía sus mediciones

Documento para el equipo que mantiene el bot de Telegram (Laraneriabot).
Describe **dónde escribir** y **con qué forma**, para que gestor-granja pueda
leer las mediciones sin que nadie tenga que copiar nada a mano.

No hace falta tocar la app: escribiendo en esta tabla, las lecturas aparecen
solas en gestor-granja para que una persona las revise.

---

## Idea de fondo

> **El bot mide. La app inventaría.**

El bot **no** debe llevar su propio inventario de las bandejas ni escribir en
la tabla `censos`. Escribe una lectura, y esa lectura queda **pendiente**
hasta que alguien en la app la revisa y decide aplicarla al censo.

El motivo es concreto: hoy hay dos inventarios en paralelo de las mismas
bandejas físicas, y ya discrepan. Para `E2-F7-C1`, la app dice 313 unidades y
el bot 240. Con un solo censo (el de la app) y el bot aportando mediciones,
eso desaparece.

## Hay tres cifras, y las tres hacen falta

En vuestros propios mensajes conviven tres estimaciones distintas de cuántos
animales hay:

| Fuente | En el ejemplo real | De dónde sale |
|---|---|---|
| **Operario** | 240 ud | La *"cantidad fijada"* que pone la persona |
| **Muestreo** | 243 ud | 73 g ÷ 0,300 g/ud — **la única independiente** |
| **Visión** | 185 ud | El conteo por foto |

Ojo con una trampa: el *"peso medio usado"* (0,304) sale de dividir la biomasa
entre el conteo del operario (73 ÷ 240). Usarlo para calcular unidades es
**circular**: devuelve otra vez 240 y no valida nada. La cifra que de verdad
contrasta es la del muestreo independiente.

Es justo la comprobación que el bot ya hacía cuando respondía *"los dos
cálculos prácticamente coinciden: 0,304 frente a 0,300"*. Enviad las tres por
separado y la app las enseña juntas para que una persona elija cuál aplicar.

## Por qué el conteo por foto no puede ser el censo

En las dos mediciones que tenemos, el conteo fotográfico se quedó corto:

| Caso | Por peso | Por foto | Desvío |
|---|---|---|---|
| Bandeja `E2-F7-C1` | 313 ud | 240 ud | −23 % |
| Lote de 50 g | 181 ud | 150 ud | −17 % |

Tiene explicación física: en una bandeja densa los renacuajos se solapan y se
tapan unos a otros. **No es un fallo que haya que corregir, es una limitación
que hay que registrar.** El propio bot ya llegó a esa conclusión: *"Para
inventario, manda ahora el peso medido."*

Por eso el contrato pide **las dos cifras**: `unidades_calculadas` (por peso,
la que cuenta) y `conteo_foto` (el contraste). Guardando ambas a lo largo del
tiempo se podrá calibrar el sesgo.

---

## Dónde escribir

Tabla `conteos_ia` del mismo Supabase que usa gestor-granja
(ver `sql/003_conteos_ia.sql`).

**Autenticación:** con la **service_role key**, desde el servidor del bot.
Nunca la anon key, y nunca desde un navegador. Esa clave se salta las
políticas de seguridad de la base de datos, así que se trata como una
contraseña maestra: solo en variables de entorno del servidor, jamás en el
repositorio.

```
POST https://<PROYECTO>.supabase.co/rest/v1/conteos_ia
apikey: <SERVICE_ROLE_KEY>
Authorization: Bearer <SERVICE_ROLE_KEY>
Content-Type: application/json
Prefer: return=representation
```

## Qué enviar

```json
{
  "tanque_id": "E2-F7-C1",
  "medido_en": "2026-08-20T12:52:00+02:00",
  "operario": "Enzo Da Silva Morales",
  "operacion": "censo",

  "biomasa_g": 73,
  "peso_medio_g": 0.304,
  "unidades_calculadas": 243,
  "conteo_humano": 240,
  "unidades_por_muestreo": 243,

  "muestreo_unidades": 30,
  "muestreo_gramos": 9,
  "peso_medio_muestreo": 0.300,

  "conteo_foto": 232,

  "fotos": ["file_id_1", "file_id_2", "file_id_3", "file_id_4"],
  "clave_idempotencia": "telegram:-100123456:9871",
  "payload_original": { "texto": "Enzo, registrado y verificado en..." }
}
```

### Campos

| Campo | Obligatorio | Notas |
|---|---|---|
| `tanque_id` | **Sí** | Formato exacto de la app: `E2-F7-C1`, `2.1.3`, `UCI-Cen-5`. **Ya lo emitís así**, no hay que traducir nada. |
| `medido_en` | No | Cuándo se tomó la medida (ISO 8601). Si falta, se usa la hora de llegada. |
| `operario` | Recomendado | Quien hizo la medición. Es lo que da trazabilidad, hoy inexistente en la app. |
| `operacion` | No | `censo` (por defecto), `entrada` o `salida`. |
| `biomasa_g` | **Sí** | Gramos totales pesados. |
| `peso_medio_g` | **Sí** | Gramos por unidad usados para el cálculo. |
| `conteo_humano` | Recomendado | La *"cantidad fijada"* por el operario. |
| `unidades_por_muestreo` | **Muy recomendable** | `biomasa_g / peso_medio_muestreo`. La única estimación independiente del conteo humano. |
| `unidades_calculadas` | **Sí** | La cifra que el bot considera más fiable de las tres. |
| `muestreo_unidades` / `muestreo_gramos` / `peso_medio_muestreo` | Recomendado | El muestreo independiente. Es lo que permite detectar una báscula mal tarada. |
| `conteo_foto` | Recomendado | Lo que contó la visión. **Contraste, no censo.** |
| `fotos` | No | Lista de identificadores o URLs. |
| `clave_idempotencia` | **Muy recomendable** | Valor estable y único por medición (p. ej. `telegram:<chat>:<mensaje>`). Si el bot reintenta, evita contar dos veces la misma bandeja. |
| `payload_original` | Recomendado | El mensaje tal cual. Sirve para auditar de dónde salió un número. |

**No enviéis** `estado`, `revisado_por`, `revisado_en` ni `fuente_definitiva`:
los gestiona la app cuando una persona valida la lectura. `fuente_definitiva`
guarda cuál de las tres cifras se aceptó, lo que con el tiempo permitirá ver
cuál acierta más.

## Qué NO hay que hacer

- **No escribir en `censos`.** Es el inventario autoritativo de la granja y
  solo se toca desde la app.
- **No manejar la app por el navegador.** La app recarga desde la nube cada 5
  minutos en modo autoritativo, así que cualquier cosa escrita en su
  `localStorage` desaparece sola en ese plazo.
- **No mantener inventario propio en el bot.** Si el bot lleva su cuenta de lo
  que hay en cada bandeja, volvemos a tener dos verdades.

## Cómo comprobar que ha funcionado

Un `POST` correcto devuelve `201`. Después, la lectura aparece en
gestor-granja marcada como **pendiente**, con la comparación frente al censo
actual, para que alguien la acepte o la descarte.

## Si preferís no tocar el bot todavía

Alternativa intermedia mientras tanto: que el bot escriba su fichero de salida
en una carpeta **compartida** de OneDrive en vez de en el escritorio local
(`C:\Users\PC\OneDrive\Desktop\01_GRENO...`, que no llega a nadie más). Para
vosotros es cambiar una ruta, y permite importar los datos sin más cambios.
