import './src/load-env.js'
import { defineConfig } from 'prisma/config'

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === 'production'
    ? undefined
    : 'postgresql://homestock:homestock@localhost:5432/home_stock')

if (!databaseUrl) {
  throw new Error('Set DATABASE_URL or DIRECT_URL before running Prisma in production.')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
})
