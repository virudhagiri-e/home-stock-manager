import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

if (process.env.NODE_ENV !== 'test') {
  config({
    path: [
      fileURLToPath(new URL('../../../.env.local', import.meta.url)),
      fileURLToPath(new URL('../.env.local', import.meta.url)),
      fileURLToPath(new URL('../.env', import.meta.url)),
      fileURLToPath(new URL('../../../.env', import.meta.url)),
    ],
    quiet: true,
  })
}
