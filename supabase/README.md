# VantaEco — SQL Consolidado

> ⚠️ **El proyecto VantaEco ya tiene todo esto corrido en vivo** (verificado
> columna por columna contra los 24 archivos de migración anteriores, ahora
> archivados en `_archivo_migraciones_anteriores/`). Estos 3 archivos son
> la **documentación de referencia** de cómo quedó la base de datos — NO
> hace falta volver a correrlos en el proyecto actual, salvo que falte
> alguna columna puntual (ver más abajo, todo usa `if not exists`/`create
> or replace`, así que correrlos de nuevo no borra ni daña nada, es
> completamente seguro). Solo sirven para levantar un proyecto Supabase
> nuevo desde cero (por ejemplo en un ambiente de pruebas separado), o
> para poner al día una base de datos que quedó desactualizada.

## Orden de ejecución

Corre estos archivos **en orden** en el SQL Editor de Supabase (proyecto VantaEco):

### 1. `01_vantaeco_core.sql`
**Auth, Profiles, Waitlist, Avatares**
- Tabla `profiles` compartida por TODAS las apps Vanta — con respaldo `alter table add column if not exists` para **cada una** de sus columnas (así, si la tabla en producción queda desactualizada por lo que sea, correr este archivo de nuevo siempre la pone al día completa, sin ir descubriendo columnas faltantes una por una)
- Trigger `handle_new_user` que crea el perfil al registrarse
- Tabla `waitlist` para la lista de espera de la web
- Bucket de avatares en Storage
- RLS de profiles y waitlist

### 2. `02_cashflow_schema.sql`
**Todo lo de CashFlow**
- Tipos: `tipo_transaccion`, `tipo_cuenta`, `frecuencia_fija`, etc.
- Tablas: `cuentas`, `categorias`, `transacciones`, `deudas_creditos`, `pagos_deuda`, `ingresos_fijos`, `gastos_fijos`, `metas_ahorro`, `aportes_meta`, `presupuestos`, `pro_duo`
- Triggers: `sync_saldo_cuenta`, `sync_pago_deuda`, `sync_aporte_meta`, `sync_pro_duo_estado`
- Funciones RPC Pro Dúo
- RLS completo incluyendo compartidos

> ⚠️ Si Supabase da error por el enum `transferencia`, corre primero SOLO esta línea:
> ```sql
> alter type tipo_transaccion add value if not exists 'transferencia';
> ```
> Dale Run, y luego corre el resto del archivo.

### 3. `03_levelx_schema.sql`
**LevelX — Stats básicos + placeholder**
- Tabla `agent_stats` básica para el portal de cuenta de la web
- El resto se completa cuando retomemos LevelX



---

## Arquitectura

```
auth.users (Supabase Auth — login único para todo Vanta)
    ↓
profiles (compartido por todas las apps)
    ├── agent_stats      ← LevelX escribe aquí
    ├── cuentas          ← CashFlow escribe aquí
    ├── transacciones    ← CashFlow escribe aquí
    └── [AscendX vendrá aquí]

waitlist                 ← Web de Vanta Labs escribe aquí
```

## Proyectos Supabase

| Proyecto | Uso |
|----------|-----|
| **VantaEco** | Todo el ecosistema Vanta (LevelX, CashFlow, AscendX, web) |
| **Masters-Pc** | Separado — clientes empresariales, no comparte usuarios |

## Variables de entorno

```
VITE_SUPABASE_URL=https://vnlblvrsdypbxgendchl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Estas credenciales son las mismas para **todas** las apps Vanta.
