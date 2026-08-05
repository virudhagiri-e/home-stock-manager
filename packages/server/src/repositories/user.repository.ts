import type { UserRole } from '@prisma/client'
import { prisma } from '../db.js'

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    })
  },

  create(data: { name: string; email: string; passwordHash: string; role: UserRole }) {
    return prisma.user.create({ data })
  },
}
