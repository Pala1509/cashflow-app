# Desplegar la Fase 2 de Push — guía paso a paso

Esto SÍ necesita la terminal (no es solo pegar SQL en Supabase). Son 6 pasos, uno solo se hace una vez (instalar la CLI), el resto siempre que quieras actualizar la función.

## 1. Instala la CLI de Supabase (una sola vez)

```bash
npm install -g supabase
```

Verifica que quedó instalada:
```bash
supabase --version
```

## 2. Inicia sesión

```bash
supabase login
```

Esto abre el navegador para que autorices — sigue las instrucciones en pantalla.

## 3. Conecta este proyecto con tu proyecto de Supabase

Desde la carpeta `cashflow-app` (la raíz del proyecto, donde está la carpeta `supabase/`):

```bash
supabase link --project-ref TU_PROJECT_REF
```

`TU_PROJECT_REF` lo sacas de la URL de tu proyecto: `https://TU_PROJECT_REF.supabase.co` — es el mismo que vas a necesitar para la sección del cron en `02_cashflow_schema.sql`.

## 4. Configura los 3 secrets de Firebase

Estos son los 3 valores del archivo del service account que descargaste (el JSON con `project_id`, `client_email`, `private_key`):

```bash
supabase secrets set FCM_PROJECT_ID=cashflow-1b1a1
supabase secrets set FCM_CLIENT_EMAIL="el-client-email-de-tu-archivo@cashflow-1b1a1.iam.gserviceaccount.com"
supabase secrets set FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...(todo el contenido)...\n-----END PRIVATE KEY-----\n"
```

**Ojo con `FCM_PRIVATE_KEY`:** cópiala completa, tal cual aparece en el JSON (con los `\n` incluidos tal cual texto, no como saltos de línea reales) — el JSON ya la trae en el formato correcto, solo copia el valor completo entre comillas.

## 5. Despliega la función

```bash
supabase functions deploy enviar-push --no-verify-jwt
```

El `--no-verify-jwt` es porque el cron la llama sin la sesión de un usuario logueado — es la propia función la que valida internamente contra tu base de datos, no hace falta esa capa extra.

## 6. Programa que corra sola cada día

Abre `supabase/02_cashflow_schema.sql`, busca la sección "CRON DE PUSH" cerca del final, reemplaza `PEGA_TU_ANON_KEY_AQUI` por tu anon key (Settings → API → anon public key), y pega el archivo completo en el SQL Editor de Supabase.

---

## ¿Cómo pruebo que funciona sin esperar al cron?

Puedes disparar la función manualmente desde la terminal:

```bash
supabase functions invoke enviar-push
```

Si todo salió bien, te devuelve algo como `{"ok":true,"enviados":0}` (el `0` es normal si no tienes ningún presupuesto excedido o meta al 90%+ en este momento — significa que corrió sin errores, no que esté rota).

## ¿Qué revisa hoy, y qué falta?

- ✅ Presupuestos excedidos este mes
- ✅ Metas de ahorro al 90% o más
- ❌ Gastos hormiga — no está en esta primera versión, porque portar la lógica de "productos similares" (los alias, normalización de texto) al servidor es un pedazo de trabajo aparte. Se puede agregar después si quieres.

## ¿Y la función de tasas de cambio (actualizar-tasas)?

Es una Edge Function distinta, pero se despliega con los **mismos pasos exactos** de arriba — solo cambia el nombre:

```bash
supabase functions deploy actualizar-tasas --no-verify-jwt
```

No necesita secrets nuevos (no usa Firebase ni ninguna llave — la API de tasas de cambio es pública y gratis, sin autenticación). El cron que la dispara todos los días ya está en `02_cashflow_schema.sql`, junto al de push.

Para probarla manualmente sin esperar al cron:
```bash
curl.exe -X POST https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/actualizar-tasas -H "Authorization: Bearer TU_ANON_KEY"
```
(recuerda: en PowerShell es `curl.exe`, no `curl` a secas — ver la conversación de cuando desplegamos push si se te olvidó por qué).

## Si algo sale mal

- **`supabase functions deploy` da error de autenticación:** corre `supabase login` de nuevo.
- **La función corre pero no llega ningún push:** revisa que el dispositivo tenga un token guardado en la tabla `push_tokens` (abre la app una vez en el teléfono con `google-services.json` puesto, para que se registre).
- **Error de la llave privada al invocar:** revisa que copiaste el `FCM_PRIVATE_KEY` completo, con el `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----` incluidos.
