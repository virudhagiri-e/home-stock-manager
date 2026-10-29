import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { env } from './config.js'

// WebSocket transport tunnels Postgres over HTTPS (port 443) for networks that block port 5432.
const adapter =
  env.DATABASE_TRANSPORT === 'websocket'
    ? new PrismaNeon({ connectionString: env.DATABASE_URL })
    : new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
