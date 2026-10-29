import './load-env.js'
import { z } from 'zod'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
      message: 'DATABASE_URL must be a PostgreSQL connection URL',
    }),
    DATABASE_TRANSPORT: z.enum(['tcp', 'websocket']).default('tcp'),
    JWT_SECRET: z.string().min(8),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.url(),
  })
  .superRefine((config, ctx) => {
    // Neon's WebSocket proxy only exists on Neon endpoints, not local Docker Postgres.
    if (
      config.DATABASE_TRANSPORT === 'websocket' &&
      !new URL(config.DATABASE_URL).hostname.endsWith('.neon.tech')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_TRANSPORT'],
        message: 'DATABASE_TRANSPORT=websocket requires a Neon DATABASE_URL',
      })
    }
    if (config.NODE_ENV !== 'production') return
    if (config.JWT_SECRET.length < 32 || config.JWT_SECRET === 'change-me-in-production') {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'Production JWT_SECRET must be a unique random secret of at least 32 characters',
      })
    }
    if (!config.CORS_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'Production CORS_ORIGIN must use HTTPS',
      })
    }
  })

const isProduction = process.env.NODE_ENV === 'production'

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    (isProduction ? undefined : 'postgresql://homestock:homestock@localhost:5432/home_stock'),
  DATABASE_TRANSPORT: process.env.DATABASE_TRANSPORT || undefined,
  JWT_SECRET:
    process.env.JWT_SECRET ?? (isProduction ? undefined : 'local-development-only-secret'),
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? (isProduction ? undefined : 'http://localhost:5173'),
})
