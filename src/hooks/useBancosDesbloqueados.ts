import { useCallback, useState } from 'react'

const KEY = 'cashflow_bancos_todos_continentes'

// Interruptor global para que un usuario Pro vea los bancos de TODOS los
// continentes en vez de solo el suyo — "global" en el sentido de que es
// UNO SOLO para toda la app (Bancos.tsx en Configuración y el selector de
// banco al crear una cuenta en CuentaNueva.tsx leen y escriben la misma
// llave), no un candado que haya que abrir en cada pantalla por separado.
// Vive en localStorage porque es una preferencia de visualización de este
// dispositivo, no un dato de la cuenta — no necesita columna en Supabase
// ni sincronizarse entre dispositivos.
export function useBancosDesbloqueados(): [boolean, (v: boolean) => void] {
  const [valor, setValor] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })

  const set = useCallback((v: boolean) => {
    setValor(v)
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* noop */ }
  }, [])

  return [valor, set]
}
