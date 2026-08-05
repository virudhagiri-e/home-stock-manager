import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import type { ItemCategory, MedicineFor, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { env } from './config.js'
import { prisma } from './db.js'
import { itemSchema, loginSchema, registerSchema, stockAdjustSchema } from './schemas.js'

const app = Fastify({ logger: true })

app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
})

app.register(jwt, {
  secret: env.JWT_SECRET,
})

type AuthUser = {
  sub: string
  role: UserRole
  email: string
  name: string
}

type AuthenticatedRequest = FastifyRequest & {
  user: AuthUser
}

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ message: 'Unauthorized' })
  }
}

function requireAdmin(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  if (request.user.role !== 'ADMIN') {
    reply.code(403).send({ message: 'Admin access required' })
    return true
  }

  return false
}

app.get('/health', async () => ({ ok: true }))

app.post('/auth/login', async (request, reply) => {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user) {
    return reply.code(401).send({ message: 'Invalid credentials' })
  }

  const match = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!match) {
    return reply.code(401).send({ message: 'Invalid credentials' })
  }

  const token = await reply.jwtSign({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
})

app.post('/auth/register', { preHandler: authenticate }, async (request, reply) => {
  const authReq = request as AuthenticatedRequest
  if (requireAdmin(authReq, reply)) {
    return
  }

  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (exists) {
    return reply.code(409).send({ message: 'User already exists' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role ?? 'FAMILY',
    },
  })

  return reply.code(201).send({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
})

app.get('/users/me', { preHandler: authenticate }, async (request) => {
  const authReq = request as AuthenticatedRequest
  const user = await prisma.user.findUnique({
    where: { id: authReq.user.sub },
    select: { id: true, name: true, email: true, role: true },
  })
  return user
})

app.get('/items', { preHandler: authenticate }, async (request) => {
  const query = request.query as { category?: ItemCategory; lowStock?: string }

  const items = await prisma.stockItem.findMany({
    where: {
      category: query.category,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  if (query.lowStock === 'true') {
    return items.filter((item) => item.quantity < item.threshold)
  }

  return items
})

app.post('/items', { preHandler: authenticate }, async (request, reply) => {
  const parsed = itemSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const payload = parsed.data
  if (payload.category !== 'MEDICINE') {
    payload.medicineFor = undefined
  }

  const item = await prisma.stockItem.create({
    data: {
      name: payload.name,
      category: payload.category,
      unit: payload.unit,
      quantity: payload.quantity,
      threshold: payload.threshold,
      notes: payload.notes,
      medicineFor: payload.medicineFor,
    },
  })

  return reply.code(201).send(item)
})

app.patch('/items/:id', { preHandler: authenticate }, async (request, reply) => {
  const { id } = request.params as { id: string }
  const parsed = itemSchema.partial().safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  if (parsed.data.category && parsed.data.category !== 'MEDICINE') {
    parsed.data.medicineFor = null as unknown as MedicineFor
  }

  const updated = await prisma.stockItem.update({
    where: { id },
    data: parsed.data,
  })

  return updated
})

app.patch('/items/:id/stock', { preHandler: authenticate }, async (request, reply) => {
  const { id } = request.params as { id: string }
  const authReq = request as AuthenticatedRequest
  const parsed = stockAdjustSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const item = await prisma.stockItem.findUnique({ where: { id } })
  if (!item) {
    return reply.code(404).send({ message: 'Item not found' })
  }

  const afterValue = item.quantity + parsed.data.delta
  if (afterValue < 0) {
    return reply.code(400).send({ message: 'Stock cannot become negative' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.stockItem.update({
      where: { id },
      data: { quantity: afterValue },
    })

    await tx.stockEvent.create({
      data: {
        itemId: id,
        userId: authReq.user.sub,
        delta: parsed.data.delta,
        afterValue,
        reason: parsed.data.reason,
      },
    })

    return updatedItem
  })

  return result
})

app.delete('/items/:id', { preHandler: authenticate }, async (request, reply) => {
  const authReq = request as AuthenticatedRequest
  if (requireAdmin(authReq, reply)) {
    return
  }

  const { id } = request.params as { id: string }
  await prisma.stockItem.delete({ where: { id } })
  return reply.code(204).send()
})

app.get('/shopping-list', { preHandler: authenticate }, async () => {
  const items = await prisma.stockItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return items
    .filter((item) => item.quantity < item.threshold)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      threshold: item.threshold,
      missingBy: Number((item.threshold - item.quantity).toFixed(2)),
      medicineFor: item.medicineFor,
    }))
})

app.get('/medicines/grouped', { preHandler: authenticate }, async () => {
  const items = await prisma.stockItem.findMany({
    where: { category: 'MEDICINE' },
    orderBy: [{ medicineFor: 'asc' }, { name: 'asc' }],
  })

  const grouped: Record<string, typeof items> = {
    ME: [],
    WIFE: [],
    BOTH: [],
    CHILD: [],
    FAMILY: [],
    UNKNOWN: [],
  }

  for (const item of items) {
    const key = item.medicineFor ?? 'UNKNOWN'
    grouped[key].push(item)
  }

  return grouped
})

async function bootstrap() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`API running on port ${env.PORT}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

bootstrap()
