import { Gift } from 'lucide-react'
import { usePrestaciones } from '../hooks/usePrestaciones'
import { useIdioma } from '../lib/IdiomaContext'
import { parseLocalDate } from '../lib/date'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const DIAS_ANTES_MOSTRAR = 60

// Inicio: prima y cesantías.
//   - Si CashFlow detectó un salario y nunca ha preguntado → una pregunta
//     de un toque ("¿es empleo con prima?"). Nada más que configurar.
//   - Si ya dijo que sí → el próximo pago (prima o intereses de cesantías)
//     cuando falten 60 días o menos.
//   - Si dijo que no, o no hay salario → no se muestra nada.
export default function PrestacionesCard() {
  const { t, idioma } = useIdioma()
  const { salarioMensual, recibe, proximo, responder } = usePrestaciones()
  if (!salarioMensual || recibe === undefined || recibe === false) return null

  if (recibe === null) {
    return (
      <div className="mt-3 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}><Gift size={16} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold">{t('prest_pregunta_titulo')}</div>
            <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('prest_pregunta_desc', { monto: fmt(salarioMensual) })}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => responder(true)} className="flex-1 rounded-xl py-2.5 text-[12px] font-bold" style={{ background: 'var(--lime)', color: '#000000' }}>{t('prest_si')}</button>
          <button onClick={() => responder(false)} className="flex-1 rounded-xl py-2.5 text-[12px] font-semibold" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>{t('prest_no')}</button>
        </div>
      </div>
    )
  }

  if (!proximo) return null
  const fecha = parseLocalDate(proximo.fecha)
  const faltan = Math.ceil((fecha.getTime() - Date.now()) / 86_400_000)
  if (faltan > DIAS_ANTES_MOSTRAR) return null
  const nombre = proximo.tipo === 'intereses_cesantias' ? t('prest_intereses') : proximo.tipo === 'prima_junio' ? t('prest_prima_junio') : t('prest_prima_diciembre')
  const fechaTxt = fecha.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' })

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}><Gift size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[12.5px] font-semibold">{nombre}</div>
          <div className="flex-shrink-0 font-mono text-[13px] font-bold" style={{ color: 'var(--lime)' }}>~{fmt(proximo.monto)}</div>
        </div>
        <div className="mt-0.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{t('prest_llega', { fecha: fechaTxt })}</div>
      </div>
    </div>
  )
}
