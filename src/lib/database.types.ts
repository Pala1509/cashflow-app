// Tipos generados a mano a partir de supabase/schema_cashflow.sql
// Cuando el proyecto crezca, se pueden regenerar automáticamente con:
// npx supabase gen types typescript --project-id TU_PROJECT_REF > src/lib/database.types.ts

export type TipoTransaccion = 'ingreso' | 'egreso' | 'transferencia'
export type TipoCuenta = 'efectivo' | 'billetera_digital' | 'cuenta_bancaria' | 'monedero' | 'tarjeta_debito' | 'tarjeta_credito' | 'cdt'
export type TipoDeudaCredito = 'deuda' | 'credito'
export type TipoInteres = 'sobre_saldo' | 'fijo_capital' | 'sin_interes'
export type EstadoDeudaCredito = 'activa' | 'pagada'
export type EstadoMeta = 'activa' | 'completada'

export interface Profile {
  id: string
  nombre: string
  apellido: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  ciudad: string | null
  pais: string | null
  email: string | null
  avatar_url: string | null
  moneda: string
  idioma: string
  created_at: string
}

export interface Cuenta {
  id: string
  user_id: string
  tipo: TipoCuenta
  subtipo: string | null
  banco: string | null
  diseno_tarjeta: string | null
  tasa_ea: number
  fecha_apertura: string | null
  plazo_dias: number | null
  nombre: string
  saldo: number
  cupo_total: number | null
  icono: string
  color: string
  four_x_mil: boolean
  es_ahorro: boolean
  cuota_manejo: number
  tasa_interes: number
  dia_corte: number | null
  dia_pago: number | null
  activa: boolean
  compartida_con_id: string | null
  congelada: boolean
  moneda: string
  created_at: string
}

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  tipo: TipoTransaccion
  icono: string
  grupo: string | null
  color: string
  predeterminada: boolean
  created_at: string
}

export interface BancoPersonalizado {
  id: string
  user_id: string
  nombre: string
  grupo: string
  color: string
  created_at: string
}

export interface Transaccion {
  id: string
  user_id: string
  tipo: TipoTransaccion
  monto: number
  monto_4x1000: number
  categoria_id: string | null
  cuenta_id: string
  cuenta_destino_id: string | null
  gasto_fijo_id: string | null
  ingreso_fijo_id: string | null
  descripcion: string | null
  lugar: string | null
  fecha: string
  created_at: string
}

export interface DeudaCredito {
  id: string
  user_id: string
  tipo: TipoDeudaCredito
  subtipo: string | null
  nombre: string
  entidad: string | null
  capital: number
  capital_pagado: number
  tipo_interes: TipoInteres
  tasa_interes: number
  periodo_interes: string
  fecha_inicio: string
  fecha_limite: string | null
  notif_dias_antes: number | null
  plazo_meses: number | null
  cuota_mensual: number | null
  gasto_fijo_id: string | null
  estado: EstadoDeudaCredito
  notas: string | null
  compartida_con_id: string | null
  created_at: string
}

export type FrecuenciaFija = 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

export interface IngresoFijo {
  id: string
  user_id: string
  nombre: string
  monto: number
  dia_mes: number
  frecuencia: FrecuenciaFija
  categoria_id: string | null
  icono: string
  activo: boolean
  created_at: string
}

export interface GastoFijo {
  id: string
  user_id: string
  nombre: string
  monto: number
  dia_mes: number
  notif_dias_antes: number | null
  frecuencia: FrecuenciaFija
  categoria_id: string | null
  icono: string
  activo: boolean
  created_at: string
}

export interface MovimientoFrecuente {
  id: string
  user_id: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  categoria_id: string | null
  cuenta_id: string | null
  // Si el frecuente viene de "Pago de un gasto fijo" / "Ingreso fijo",
  // acá queda el vínculo (ver comentario en 02_cashflow_schema.sql).
  gasto_fijo_id: string | null
  ingreso_fijo_id: string | null
  descripcion: string | null
  lugar: string | null
  usos: number
  ultimo_uso: string
  created_at: string
}

export interface MetaAhorro {
  id: string
  user_id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  aporte_mensual: number
  fecha_limite: string | null
  icono: string
  color: string
  estado: EstadoMeta
  compartida_con_id: string | null
  congelada: boolean
  created_at: string
}

export interface Presupuesto {
  id: string
  user_id: string
  categoria_id: string
  monto_limite: number
  mes: number
  anio: number
  created_at: string
}

// Placeholder mínimo para que supabase-js tipe los métodos .from() sin generar
// el archivo completo de Database; se puede reemplazar por el generado real.
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] }
      cuentas: { Row: Cuenta; Insert: Partial<Cuenta>; Update: Partial<Cuenta>; Relationships: [] }
      categorias: { Row: Categoria; Insert: Partial<Categoria>; Update: Partial<Categoria>; Relationships: [] }
      transacciones: { Row: Transaccion; Insert: Partial<Transaccion>; Update: Partial<Transaccion>; Relationships: [] }
      deudas_creditos: { Row: DeudaCredito; Insert: Partial<DeudaCredito>; Update: Partial<DeudaCredito>; Relationships: [] }
      pagos_deuda: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      ingresos_fijos: { Row: IngresoFijo; Insert: Partial<IngresoFijo>; Update: Partial<IngresoFijo>; Relationships: [] }
      gastos_fijos: { Row: GastoFijo; Insert: Partial<GastoFijo>; Update: Partial<GastoFijo>; Relationships: [] }
      movimientos_frecuentes: { Row: MovimientoFrecuente; Insert: Partial<MovimientoFrecuente>; Update: Partial<MovimientoFrecuente>; Relationships: [] }
      metas_ahorro: { Row: MetaAhorro; Insert: Partial<MetaAhorro>; Update: Partial<MetaAhorro>; Relationships: [] }
      aportes_meta: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      presupuestos: { Row: Presupuesto; Insert: Partial<Presupuesto>; Update: Partial<Presupuesto>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
