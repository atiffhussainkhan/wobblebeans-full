import { Redis } from 'ioredis'
import type { JsonStore } from './json-store'

export function redisJsonStore(url: string): JsonStore & { ping: () => Promise<string> } {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true })
  return {
    async get(key: string): Promise<string | null> {
      return redis.get(key)
    },
    async set(key: string, value: string, ttlSec?: number): Promise<void> {
      if (ttlSec && ttlSec > 0) await redis.set(key, value, 'EX', ttlSec)
      else await redis.set(key, value)
    },
    async del(key: string): Promise<void> {
      await redis.del(key)
    },
    async add(key: string, delta: number): Promise<number> {
      return redis.incrby(key, delta)
    },
    async close(): Promise<void> {
      redis.disconnect()
    },
    async ping(): Promise<string> {
      return redis.ping()
    },
  }
}
