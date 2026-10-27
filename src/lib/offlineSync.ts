import { supabase } from './supabase'
import { outboxAll, outboxRemove, type OutboxItem } from './offlineDb'

let syncing = false

// Recorre la cola de movimientos guardados sin conexión y los manda a
// Supabase uno por uno, en el orden en que se crearon. Si alguno falla
// (ej. se volvió a caer la señal a mitad de camino), se detiene ahí — el
// resto queda esperando el próximo intento, no se pierde nada.
export async function syncOutbox(onProgress?: (pendientes: number) => void): Promise<void> {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    const items = await outboxAll()
    items.sort((a, b) => a.createdAt - b.createdAt)
    for (const item of items) {
      const ok = await syncOne(item)
      if (!ok) break
      await outboxRemove(item.id)
      onProgress?.((await outboxAll()).length)
    }
  } finally {
    syncing = false
  }
}

async function syncOne(item: OutboxItem): Promise<boolean> {
  if (item.table === 'transacciones' && item.op === 'insert') {
    const { error } = await supabase.from('transacciones').insert(item.payload)
    // Si el error es "ya existe" (23505), es porque este movimiento ya se
    // había sincronizado antes (ej. se cerró la app a mitad de la sync) —
    // lo tratamos como éxito para no duplicarlo ni quedarnos trabados.
    if (error && !error.message.includes('duplicate')) return false
    return true
  }
  return true
}

export async function pendingCount(): Promise<number> {
  return (await outboxAll()).length
}
