// Base de datos local en el dispositivo (IndexedDB), para dos cosas:
// 1. "cache": la última copia conocida de tus datos, para poder VER algo
//    aunque no tengas internet.
// 2. "outbox": movimientos que agregaste sin conexión, esperando a
//    sincronizarse con Supabase apenas vuelva la señal.

const DB_NAME = 'cashflow_offline'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite')
    tx.objectStore('cache').put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly')
    const req = tx.objectStore('cache').get(key)
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null)
    req.onerror = () => reject(req.error)
  })
}

export interface OutboxItem {
  id: string
  table: 'transacciones'
  op: 'insert'
  payload: Record<string, unknown>
  createdAt: number
}

export async function outboxAdd(item: OutboxItem): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite')
    tx.objectStore('outbox').put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function outboxAll(): Promise<OutboxItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly')
    const req = tx.objectStore('outbox').getAll()
    req.onsuccess = () => resolve((req.result as OutboxItem[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export async function outboxRemove(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite')
    tx.objectStore('outbox').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
