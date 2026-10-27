# LÉEME PRIMERO — Contexto para retomar CashFlow

Este documento es para que una sesión nueva de Claude (u otro asistente) entienda
el proyecto de una — sin tener que adivinar nada, y **sin romper cosas que ya
están resueltas**. Léelo completo antes de tocar código.

---

## Qué es esto

**CashFlow** — app de finanzas personales gamificada, de **Vanta Lab Studio**
(estudio de Felipe Palacios, Medellín, Colombia). Actualmente en **BETA**
cerrada, repartida como APK directo a un grupo de gente de confianza (no está
en Google Play todavía).

- **Persona:** Felipe (Andrés Felipe Palacios Moreno). Habla en español
  colombiano casual — "parce", "ome", "manito", directo con lo que no le
  gusta. Trátalo igual de directo, sin rodeos, y avísale cuando algo tuyo
  quedó mal o incompleto en vez de asumir que funcionó.
- **Stack:** React 19 + Vite + TypeScript + Tailwind v4 + Supabase (auth +
  Postgres + storage) + Capacitor 7 (Android nativo).
- **Raíz del proyecto:** `/home/claude/vantalab-finanzas/` en este entorno.
  En la máquina de Felipe puede estar en rutas distintas según el PC que use
  (tiene más de uno).

---

## ⚠️ LO MÁS IMPORTANTE — no rompas esto

### 1. El NAV (rail/tab bar) SIEMPRE debe estar visible

Hace poco cambiamos la arquitectura de raíz: **todas** las pantallas de
crear/editar (Nuevo movimiento, Nueva cuenta, Nueva deuda, Registrar pago,
Presupuestos, Editar perfil, etc.) viven **anidadas dentro de `AppShell`**
(`src/components/AppShell.tsx`), no como rutas sueltas. Esto es a propósito —
Felipe pidió explícitamente que el NAV nunca desaparezca, ni siquiera
creando o editando algo.

En `src/App.tsx`, **todas** las rutas (menos `/auth`) van anidadas dentro de:
```
<Route path="/" element={<Protected><AppShell /></Protected>}>
  <Route path="inicio" element={<Inicio />} />
  <Route path="movimiento/nuevo" element={<MovimientoNuevo />} />
  ... (todas las demás, sin excepción)
</Route>
```

**Nunca vuelvas a sacar una ruta de ahí adentro** para "simplificar" o
"hacerla pantalla completa" — eso es exactamente el bug que ya arreglamos.

### 2. El wrapper del `<Outlet />` necesita `h-full`

En `AppShell.tsx`, el div que envuelve el `<Outlet />` tiene esto:
```tsx
<div className="flex-1 overflow-y-auto pb-24 md:pb-6">
  <div key={pathname} className="page-transition h-full">
    <Outlet />
  </div>
</div>
```

El `h-full` en el wrapper interno **es obligatorio**. Sin él, las pantallas
tipo "Nuevo movimiento" (que están armadas como `<div className="flex h-full
flex-col">` con su propio scroll interno y el botón de Guardar al fondo)
pierden la referencia de altura y todo el scroll se comporta mal — es
exactamente el bug de "se come cosas y deja scrollear de más" que mencionas.

Si algo del responsive se ve raro, **revisa primero este wrapper antes de
tocar las páginas individuales** — casi siempre el problema está aquí, no en
cada pantalla suelta.

### 3. Cada pantalla de formulario asume que tiene TODA la altura disponible

Páginas como `MovimientoNuevo.tsx`, `CuentaNueva.tsx`, `BalanceNuevo.tsx`,
`DeudaPago.tsx` están armadas así:
```tsx
<div className="flex h-full flex-col">
  <Header .../>                                    {/* fijo arriba */}
  <div className="flex-1 overflow-y-auto px-5 pb-6">  {/* scroll propio */}
    ...campos del formulario...
  </div>
  <button>Guardar</button>  {/* dentro del scroll, al final */}
</div>
```

Esto depende 100% de que el padre le dé una altura real (ver punto 2). No
cambies esta estructura interna sin motivo — ya está probada.

### 4. `pb-24 md:pb-6` en el contenedor de AppShell

Ese padding-bottom existe para que el contenido no quede tapado por la tab
bar de celular (que es `position: absolute` en la parte de abajo). Si lo
quitas, el botón de "Guardar" de cualquier formulario queda escondido detrás
de la tab bar en celular.

---

## Arquitectura general

### Responsive — 3 niveles
- `<768px` (celular): tab bar abajo, con FAB verde en el centro.
- `768–1023px` (tablet vertical): rail lateral izquierdo, contenido en 1
  columna.
- `≥1024px` (tablet horizontal / PC): rail lateral + contenido en 2 columnas
  donde aplica, centrado con `max-w-[900px]`.

### Datos — arquitectura local-primero
`src/hooks/useFinanzas.ts` es el hook central. **No es un Context** — cada
página que lo llama tiene su propia instancia/fetch independiente (así se
construyó desde el inicio, no lo cambies a un Context sin avisar, sería una
refactorización grande). Muestra caché de IndexedDB al instante, y refresca
en segundo plano con timeout de 5s. Nuevos movimientos se guardan en una
cola offline (`outbox`) si no hay señal.

### Base de datos — Supabase
- Proyecto: `vnlblvrsdypbxgendchl` (ver `.env.local`, que **no** está en git).
- **Hay MUCHAS migraciones sueltas en `supabase/*.sql`** — se fueron
  acumulando sesión tras sesión. `schema_zafra.sql` es el esquema completo
  y actualizado (para instalaciones nuevas desde cero), pero la base de
  datos de producción de Felipe se armó corriendo migraciones una por una.
  **Si algo falla con "Could not find the X column"**, casi seguro es una
  migración que falta — revisa `supabase/` por el archivo correspondiente
  antes de asumir que es un bug de código nuevo.
- Triggers importantes que NO debes tocar sin entender bien: `sync_saldo_cuenta`
  (ajusta saldos en cuentas al insertar/editar/borrar transacciones — incluye
  lógica especial para tarjetas de crédito y transferencias), `sync_pago_deuda`
  (descuenta `capital_pagado` al registrar un pago).

---

## Sistema de diseño

- **Fondo:** `#131313` (`--bg`). Cards: `--card` (`#1D1D1F`), `--card-2`
  (`#242426`). Líneas/bordes: `--line` (`#2C2C2F`).
- **Colores de acento:** `--lime` (#C6FF4D, ingresos/positivo/marca),
  `--coral` (#FF7A6E, egresos/negativo/alertas), `--yellow`, `--lavender`,
  `--pink`, `--blue`, `--teal` (para los 7 grupos de categorías estilo
  Buddy). Cada color tiene su versión `-dim` (fondo tenue) para chips/badges.
- **Tipografía:** Space Grotesk (títulos/display), Inter (texto normal),
  JetBrains Mono (números/montos — **siempre** monoespaciada para plata).
- **Sin emojis en ningún lado** — todo ícono es SVG (lucide-react). Esto es
  una regla explícita de Felipe, no una preferencia estética mía.
- **Formato de plata:** `'$' + Math.round(n).toLocaleString('es-CO')` — pesos
  colombianos, sin decimales. El selector de Moneda (COP/USD/EUR/MXN) existe
  pero **todavía no cambia el formato real** — se lo advertimos a Felipe con
  un aviso amarillo en esa pantalla, es una función pendiente, no un bug.

---

## Hábitos de trabajo de Felipe (importantes)

1. **"Boceto antes de codificar"** — para cualquier feature visual nueva o
   estructural, Felipe pide un boceto HTML primero (carpeta `mockup/`) antes
   de tocar código real. Es una regla que ha corregido varias veces cuando
   me la salté — no te la saltes tú tampoco sin que él lo pida explícitamente.
2. **Verificación real antes de entregar** — cada entrega debe pasar por:
   `npx tsc -b --noEmit` → `npm run build` → `npx cap sync android` → zip
   completo del proyecto → `present_files`. No digas "listo" sin haber
   corrido estos pasos.
3. **Archivos SQL nuevos** van en `supabase/` con nombre descriptivo
   (`migracion_algo.sql`), y se entregan aparte del zip con `present_files`
   para que Felipe los corra en el SQL Editor de Supabase.
4. **Nunca asumas que una migración ya se corrió** — Felipe se ha encontrado
   varias veces con errores de columnas faltantes porque no las había
   corrido. Sé explícito sobre qué SQL hace falta cada vez que agregues
   columnas o tablas nuevas.
5. Prefiere que le mandes **archivos específicos cambiados**, aunque
   normalmente igual le doy el zip completo por simplicidad — ambas cosas
   están bien, pero si el cambio es chiquito, a veces solo quiere el archivo.
6. Cuando algo "no se ve", antes de asumir que es un bug de código, considera:
   ¿está probando un build viejo sin recompilar? ¿le falta correr una
   migración? Pregúntale directo — ya ha pasado varias veces.

---

## Estado actual de las funciones

### Completo y funcionando
- Auth (correo/contraseña + OTP celular), PIN de seguridad.
- Cuentas: efectivo, billeteras digitales, cuentas bancarias, tarjetas de
  crédito (con lógica de saldo invertida — gastar SUMA la deuda, no resta).
- Deudas y créditos: interés sobre saldo / fijo sobre capital / sin interés,
  con auto-detección inteligente según subtipo (bancario/hipotecario/rotativo
  siempre usan "sobre saldo", sin preguntar). Vinculables a un gasto fijo.
  Datos de préstamos bancarios: plazo en meses, cuota mensual.
- Transferencias entre cuentas propias (no cuentan como ingreso/egreso).
- "¿Necesitas mover plata primero?" — mini-transferencia dentro del flujo de
  registrar un movimiento.
- ~68 categorías por defecto agrupadas en 7 grupos con color (estilo Buddy),
  se auto-rellenan en cada login comparando contra lo que ya tienes.
- Presupuestos por categoría, metas de ahorro con "cuotas atrasadas".
- Gastos fijos e ingresos fijos, ambos con barra de progreso visual
  (cuánto falta para el próximo, si ya se pagó/recibió este periodo) —
  vinculables desde un movimiento nuevo ("Tipo de movimiento" → fijo).
- Notificaciones locales reales (deudas por vencer, gastos fijos, presupuesto
  superado, meta al 90%) — con preferencias guardadas de verdad.
- Widget de Android nativo (Java, no React) — balance + botones rápidos de
  Ingreso/Egreso. Archivos en `android/app/src/main/java/studio/vantalab/cashflow/`.
- Sistema Free/Pro con límites (cuentas, metas, ingresos/gastos fijos) y 3
  funciones exclusivas Pro en Balance: Proyección de fin de mes, Comparación
  con el mes anterior, Gastos hormiga.
- 3 planes de precio (Mensual/Semestral/Anual) — el botón de pagar está
  deshabilitado ("próximamente"), no hay pasarela de pago conectada. Hay un
  interruptor de prueba Free/Pro solo visible para el correo de Felipe.

### Pendiente / con simplificaciones a propósito (no son bugs)
- Pasarela de pago real (Stripe/RevenueCat) — no conectada.
- El selector de Moneda no cambia el formato real todavía.
- Recordatorio de gastos fijos se reprograma mensual sin importar la
  frecuencia exacta (quincenal/trimestral/etc.) — simplificación a propósito.
- "Confirmación de cada movimiento" en Notificaciones es solo visual, no
  dispara nada real todavía.
- No hay AAB (App Bundle) generado — solo APK directo, porque así lo pidió
  Felipe mientras no suba a Google Play.

---

## Cómo compilar el APK (Felipe ya sabe esto, pero por si acaso)

```bash
npm install
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleRelease    # Windows
```

Necesita `JAVA_HOME` apuntando al JDK de Android Studio (normalmente
`C:\Program Files\Android\Android Studio\jbr`) y un archivo
`android/keystore.properties` (no está en git) con la ruta a su keystore
real (`cashflow.jks`) y las contraseñas. **Ese keystore es el único e
irremplazable** — ya hay APKs instalados firmados con él, si se pierde no
se puede reemplazar sin romper las instalaciones existentes.

APK final queda en `android/app/build/outputs/apk/release/app-release.apk`.

---

*Si después de leer esto todavía tienes dudas de algo específico, pregúntale a
Felipe directo en vez de adivinar — prefiere eso a que le rompas algo que ya
estaba resuelto.*
