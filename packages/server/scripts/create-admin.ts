import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../src/db.js'

async function createAdmin() {
  const result = z
    .object({
      name: z.string().trim().min(1),
      email: z.email(),
      password: z.string().min(12),
    })
    .safeParse({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })

  if (!result.success) {
    throw new Error(
      'Set ADMIN_NAME, a valid ADMIN_EMAIL, and ADMIN_PASSWORD (at least 12 characters).',
    )
  }

  const { name, email, password } = result.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error('An account already exists for this email. No account or password was changed.')
  }

  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN' },
  })
  console.log('Administrator created. You can now sign in.')
}

createAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to create administrator.')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
