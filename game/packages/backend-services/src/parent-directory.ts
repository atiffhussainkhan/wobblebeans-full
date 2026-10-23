import type { ParentAccountStore } from './parent-account'
import type { SecretBox } from './codec'

export interface ParentBlobStore {
  put(kind: string, id: string, cipher: Buffer, retainUntil: string | null): Promise<void>
  get(kind: string, id: string): Promise<Buffer | null>
  delete(kind: string, id: string): Promise<void>
}

/**
 * Seals whatever the parent store hands it. The plaintext fields stay in
 * `ParentAccountStore`. This directory only sees ciphertext plus an id.
 * Consent rows can set `retainUntil` (life of the account plus three years).
 * Show servers do not receive the key this box was built with.
 */
export class ParentDirectory {
  constructor(
    private readonly box: SecretBox,
    private readonly store: ParentBlobStore,
  ) {}

  async save(kind: string, id: string, record: unknown, retainUntil: string | null = null): Promise<void> {
    const cipher = this.box.seal(JSON.stringify(record))
    await this.store.put(kind, id, cipher, retainUntil)
  }

  async load(kind: string, id: string): Promise<unknown | null> {
    const cipher = await this.store.get(kind, id)
    if (!cipher) return null
    return JSON.parse(this.box.open(cipher)) as unknown
  }

  async remove(kind: string, id: string): Promise<void> {
    await this.store.delete(kind, id)
  }
}

export class MemoryParentBlobs implements ParentBlobStore {
  private readonly rows = new Map<string, { cipher: Buffer; retainUntil: string | null }>()

  async put(kind: string, id: string, cipher: Buffer, retainUntil: string | null): Promise<void> {
    this.rows.set(`${kind}:${id}`, { cipher: Buffer.from(cipher), retainUntil })
  }

  async get(kind: string, id: string): Promise<Buffer | null> {
    const row = this.rows.get(`${kind}:${id}`)
    return row ? Buffer.from(row.cipher) : null
  }

  async delete(kind: string, id: string): Promise<void> {
    this.rows.delete(`${kind}:${id}`)
  }

  held(kind: string, id: string): Buffer | null {
    return this.rows.get(`${kind}:${id}`)?.cipher ?? null
  }
}

/**
 * Mirrors the methods that exist on today's store and, if a later consent
 * build adds them, the control update as well. Callers keep using the store.
 */
export function rememberParentWrites(
  store: ParentAccountStore,
  directory: ParentDirectory,
  hooks?: { onErasePlayer?: (playerId: string) => void },
): ParentAccountStore {
  const register = store.register.bind(store)
  store.register = ((input: Parameters<ParentAccountStore['register']>[0]) => {
    const account = register(input)
    void directory.save('guardian', account.id, account)
    return account
  }) as ParentAccountStore['register']

  const addChild = store.addChild.bind(store)
  store.addChild = ((parentId: string, year: number, locale: string) => {
    const child = addChild(parentId, year, locale)
    void directory.save('child', child.id, child)
    const controls = store.getControls(child.id)
    if (controls) void directory.save('controls', child.id, controls)
    return child
  }) as ParentAccountStore['addChild']

  const extended = store as ParentAccountStore & {
    updateControls?: (parentId: string, childId: string, patch: unknown, sessionToken: string) => unknown
    requestDeletion?: (parentId: string, childId: string, sessionToken: string) => unknown
  }
  if (typeof extended.updateControls === 'function') {
    const updateControls = extended.updateControls.bind(store)
    extended.updateControls = (parentId, childId, patch, sessionToken) => {
      const controls = updateControls(parentId, childId, patch, sessionToken)
      void directory.save('controls', childId, controls)
      return controls
    }
  }
  if (typeof extended.requestDeletion === 'function') {
    const requestDeletion = extended.requestDeletion.bind(store)
    extended.requestDeletion = (parentId, childId, sessionToken) => {
      const result = requestDeletion(parentId, childId, sessionToken)
      const playerId = store.pseudonym(childId)?.playerId
      if (playerId) hooks?.onErasePlayer?.(playerId)
      return result
    }
  }
  return store
}
