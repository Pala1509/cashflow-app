import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Download, FileSpreadsheet, Check, Share2 } from 'lucide-react'
import { useFinanzas } from '../hooks/useFinanzas'
import { useAuth } from '../lib/AuthContext'
import { todayLocal } from '../lib/date'
import { getNombre } from '../lib/profile'
import ReporteCard, { calcularReporteMes } from '../components/ReporteCard'
import { compartirNodoComoImagen } from '../lib/compartirImagen'
import { useTasasCambio } from '../hooks/useTasasCambio'
import { useIdioma } from '../lib/IdiomaContext'

export default function ExportarDatos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useIdioma()
  const { transacciones, categorias, cuentas } = useFinanzas()
  const { convertirCOP } = useTasasCambio()
  const [done, setDone] = useState(false)
  const [compartiendo, setCompartiendo] = useState(false)
  const reporteRef = useRef<HTMLDivElement>(null)

  const totalCash = cuentas.filter((c) => c.tipo !== 'tarjeta_credito').reduce((s, c) => s + convertirCOP(c.saldo, c.moneda), 0)
  const reporte = calcularReporteMes(transacciones, categorias, totalCash, getNombre(user))

  async function compartirResumen() {
    if (!reporteRef.current || compartiendo) return
    setCompartiendo(true)
    try {
      await compartirNodoComoImagen(reporteRef.current, `cashflow-resumen-${todayLocal()}.png`, t('ed_resumen_mes'))
    } catch (e) {
      console.warn('No se pudo compartir el resumen:', e)
    }
    setCompartiendo(false)
  }

  function exportarCSV() {
    const header = [t('ed_csv_fecha'), t('ed_csv_tipo'), t('ed_csv_descripcion'), t('ed_csv_categoria'), t('ed_csv_cuenta'), t('ed_csv_monto'), '4x1000', t('ed_csv_total')]
    const rows = transacciones.map((t) => {
      const cat = categorias.find((c) => c.id === t.categoria_id)?.nombre ?? ''
      const cuenta = cuentas.find((c) => c.id === t.cuenta_id)?.nombre ?? ''
      return [
        t.fecha,
        t.tipo,
        (t.descripcion ?? '').replace(/,/g, ' '),
        cat,
        cuenta,
        t.monto.toString(),
        t.monto_4x1000.toString(),
        (t.monto + t.monto_4x1000).toString(),
      ]
    })
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashflow-movimientos-${todayLocal()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setDone(true)
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-shrink-0 items-center justify-between px-4.5 pb-1 pt-2.5">
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[15px] font-semibold font-display">{t('ed_titulo')}</div>
        <button onClick={() => navigate(-1)} className="flex h-8.5 w-8.5 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lavender-dim)', color: 'var(--lavender)' }}>
          <Share2 size={26} />
        </div>
        <div className="text-base font-bold font-display">{t('ed_compartir_titulo')}</div>
        <div className="mt-2 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {t('ed_compartir_desc')}
        </div>
        <button
          onClick={compartirResumen}
          disabled={compartiendo}
          className="mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--lavender)', color: '#1c1330' }}
        >
          <Share2 size={16} /> {compartiendo ? t('ed_generando') : t('ed_compartir_resumen')}
        </button>

        <div className="my-7 h-px w-full max-w-xs" style={{ background: 'var(--line)' }} />

        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>
          <FileSpreadsheet size={26} />
        </div>
        <div className="text-base font-bold font-display">{t('ed_exportar_titulo')}</div>
        <div className="mt-2 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {t('ed_exportar_desc', { n: transacciones.length })}
        </div>

        <button onClick={exportarCSV} className="mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold" style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}>
          <Download size={16} /> {t('ed_descargar_csv')}
        </button>
        {done && <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: 'var(--lime)' }}><Check size={13} /> {t('ed_descargado')}</div>}
      </div>

      {/* Fuera de pantalla a propósito — html2canvas necesita que esto
          exista de verdad en el DOM (con su tamaño y estilos reales) para
          poder capturarlo, pero nadie tiene que verlo mientras se genera. */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
        <ReporteCard ref={reporteRef} data={reporte} />
      </div>
    </div>
  )
}
