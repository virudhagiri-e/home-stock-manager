import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../src/db.js'

async function createAdmin() {
  const result = z
    .object({
      name: z.string('ADMIN_NAME is not set').trim().min(1, 'ADMIN_NAME is empty'),
      email: z.email('ADMIN_EMAIL is not set or is not a valid email address'),
      password: z
        .string('ADMIN_PASSWORD is not set')
        .min(12, 'ADMIN_PASSWORD must be at least 12 characters'),
    })
    .safeParse({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n')
    throw new Error(
      `Cannot create the administrator. Set these in the same terminal first:\n${problems}`,
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
