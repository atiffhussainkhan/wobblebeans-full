export interface JsonStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSec?: number): Promise<void>
  del(key: string): Promise<void>
  add(key: string, delta: number): Promise<number>
  close(): Promise<void>
}

export function memoryJsonStore(): JsonStore {
  const values = new Map<string, { value: string; expiresAt: number | null }>()
  const read = (key: string): string | null => {
    const row = values.get(key)
    if (!row) return null
    if (row.expiresAt !== null && row.expiresAt <= Date.now()) {
      values.delete(key)
      return null
    }
    return row.value
  }
  return {
    async get(key: string): Promise<string | null> {
      return read(key)
    },
    async set(key: string, value: string, ttlSec?: number): Promise<void> {
      values.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null })
    },
    async del(key: string): Promise<void> {
      values.delete(key)
    },
    async add(key: string, delta: number): Promise<number> {
      const next = Number(read(key) ?? '0') + delta
      values.set(key, { value: String(next), expiresAt: null })
      return next
    },
    async close(): Promise<void> {
      values.clear()
    },
  }
}
