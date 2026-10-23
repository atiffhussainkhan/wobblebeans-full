import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:47220',
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @wobblebeans/server start',
      cwd: root,
      url: 'http://127.0.0.1:47221/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @wobblebeans/client dev',
      cwd: root,
      url: 'http://127.0.0.1:47220',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
