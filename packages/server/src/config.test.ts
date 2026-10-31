import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./load-env.js', () => ({}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

function productionEnvironment() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/config_test')
  vi.stubEnv('JWT_SECRET', 'production-test-only-secret-with-at-least-32-characters')
  vi.stubEnv('CORS_ORIGIN', 'https://home-stock.example.com')
}

describe('runtime configuration', () => {
  it('provides local Postgres defaults only outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DATABASE_URL', undefined)
    vi.stubEnv('JWT_SECRET', undefined)
    vi.stubEnv('CORS_ORIGIN', undefined)
    const { env } = await import('./config.js')
    expect(env.DATABASE_URL).toBe('postgresql://homestock:homestock@localhost:5432/home_stock')
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173')
  })

  it('accepts explicit production configuration', async () => {
    productionEnvironment()
    const { env } = await import('./config.js')
    expect(env.NODE_ENV).toBe('production')
    expect(env.CORS_ORIGIN).toBe('https://home-stock.example.com')
  })

  it.each(['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'])(
    'requires %s in production',
    async (key) => {
      productionEnvironment()
      vi.stubEnv(key, undefined)
      await expect(import('./config.js')).rejects.toThrow()
    },
  )

  it('rejects SQLite URLs after the Postgres migration', async () => {
    productionEnvironment()
    vi.stubEnv('DATABASE_URL', 'file:./prisma/dev.db')
    await expect(import('./config.js')).rejects.toThrow('PostgreSQL connection URL')
  })

  it('rejects short production JWT secrets', async () => {
    productionEnvironment()
    vi.stubEnv('JWT_SECRET', 'test-secret')
    await expect(import('./config.js')).rejects.toThrow('at least 32 characters')
  })

  it('requires HTTPS for the hosted frontend', async () => {
    productionEnvironment()
    vi.stubEnv('CORS_ORIGIN', 'http://home-stock.example.com')
    await expect(import('./config.js')).rejects.toThrow('must use HTTPS')
  })

  it('uses the standard TCP transport by default', async () => {
    productionEnvironment()
    vi.stubEnv('DATABASE_TRANSPORT', undefined)
    const { env } = await import('./config.js')
    expect(env.DATABASE_TRANSPORT).toBe('tcp')
  })

  it('accepts the WebSocket transport for Neon URLs', async () => {
    productionEnvironment()
    vi.stubEnv('DATABASE_URL', 'postgresql://app@ep-test-pooler.eu-central-1.aws.neon.tech/neondb')
    vi.stubEnv('DATABASE_TRANSPORT', 'websocket')
    const { env } = await import('./config.js')
    expect(env.DATABASE_TRANSPORT).toBe('websocket')
  })

  it('rejects the WebSocket transport for non-Neon databases', async () => {
    productionEnvironment()
    vi.stubEnv('DATABASE_TRANSPORT', 'websocket')
    await expect(import('./config.js')).rejects.toThrow('requires a Neon DATABASE_URL')
  })

  it('rejects unknown transports', async () => {
    productionEnvironment()
    vi.stubEnv('DATABASE_TRANSPORT', 'http')
    await expect(import('./config.js')).rejects.toThrow()
  })

  it('uses neutral medicine group names unless MEDICINE_PEOPLE is set', async () => {
    productionEnvironment()
    vi.stubEnv('MEDICINE_PEOPLE', undefined)
    const { env } = await import('./config.js')
    expect(env.MEDICINE_PEOPLE).toEqual({
      ME: 'Me',
      WIFE: 'Partner',
      CHILD: 'Child',
      FAMILY: 'Family',
    })
  })

  it('reads medicine group names from MEDICINE_PEOPLE', async () => {
    productionEnvironment()
    vi.stubEnv('MEDICINE_PEOPLE', ' me = Alex , child=Sam ')
    const { env } = await import('./config.js')
    expect(env.MEDICINE_PEOPLE).toEqual({
      ME: 'Alex',
      WIFE: 'Partner',
      CHILD: 'Sam',
      FAMILY: 'Family',
    })
  })

  it.each(['BOTH=Us', 'ME', 'ME='])('rejects the MEDICINE_PEOPLE entry "%s"', async (value) => {
    productionEnvironment()
    vi.stubEnv('MEDICINE_PEOPLE', value)
    await expect(import('./config.js')).rejects.toThrow('MEDICINE_PEOPLE entries')
  })
})
