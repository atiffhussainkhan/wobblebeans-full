import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Canonical JSON so signatures do not depend on key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    const out: Record<string, unknown> = {}
    for (const [key, child] of entries) out[key] = sortValue(child)
    return out
  }
  return value
}

export function hmacHex(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex')
}

export function hmacEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function signPayload(payload: string, key: string): string {
  return hmacHex(payload, key)
}

export function verifyPayload(payload: string, signature: string, key: string): boolean {
  return hmacEqual(signPayload(payload, key), signature)
}

/** UUIDv7. Player ids are these strings everywhere outside the parent store. */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16)
  const ts = BigInt(now)
  bytes[0] = Number((ts >> 40n) & 0xffn)
  bytes[1] = Number((ts >> 32n) & 0xffn)
  bytes[2] = Number((ts >> 24n) & 0xffn)
  bytes[3] = Number((ts >> 16n) & 0xffn)
  bytes[4] = Number((ts >> 8n) & 0xffn)
  bytes[5] = Number(ts & 0xffn)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function platformLinkHash(pepper: string, platform: string, subject: string): string {
  return createHmac('sha256', pepper).update(`${platform}\0${subject}`).digest('hex')
}

export function saltedPlayerPid(salt: Buffer, playerId: string): string {
  return createHmac('sha256', salt).update(playerId).digest('hex')
}

export interface SecretBox {
  seal(plaintext: string): Buffer
  open(payload: Buffer): string
}

/** AES-256-GCM. The key lives only on the service that stores parent records. */
export function createSecretBox(key: Buffer): SecretBox {
  if (key.length !== 32) throw new Error('data key must be 32 bytes')
  return {
    seal(plaintext: string): Buffer {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      return Buffer.concat([iv, tag, body])
    },
    open(payload: Buffer): string {
      const iv = payload.subarray(0, 12)
      const tag = payload.subarray(12, 28)
      const body = payload.subarray(28)
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
    },
  }
}

export function keyFromEnv(value: string | undefined, label: string): Buffer {
  if (!value) throw new Error(`${label} is required`)
  const asBase64 = Buffer.from(value, 'base64')
  if (asBase64.length === 32 && value.length >= 43) return asBase64
  const raw = Buffer.from(value, 'utf8')
  if (raw.length === 32) return raw
  throw new Error(`${label} must decode to 32 bytes`)
}
