import { Component, type ErrorInfo, type ReactNode } from 'react'

// Red de seguridad: sin esto, cualquier error al dibujar una pantalla deja
// la app en blanco (se "tuesta") y no hay forma de saber qué pasó. Con
// esto la app muestra un aviso, el mensaje técnico del error (para poder
// diagnosticarlo con una captura) y un botón para volver al inicio.
type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CashFlow] Error de pantalla:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const en = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
        <div className="text-base font-bold font-display">{en ? 'Something went wrong' : 'Algo salió mal'}</div>
        <div className="mt-2 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {en ? 'Your data is safe. Go back to the start and try again.' : 'Tus datos están a salvo. Vuelve al inicio e inténtalo de nuevo.'}
        </div>
        <div className="mt-3 max-w-xs break-words rounded-xl px-3 py-2 font-mono text-[10px]" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.assign('/inicio') }}
          className="mt-5 rounded-2xl px-6 py-3.5 text-[13px] font-bold"
          style={{ background: 'var(--lime)', color: 'var(--lime-text)' }}
        >
          {en ? 'Back to start' : 'Volver al inicio'}
        </button>
      </div>
    )
  }
}
