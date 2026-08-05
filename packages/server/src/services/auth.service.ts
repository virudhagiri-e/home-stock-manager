import bcrypt from 'bcryptjs'
import { userRepository } from '../repositories/user.repository.js'

type RegisterInput = {
  name: string
  email: string
  password: string
  role?: 'ADMIN' | 'FAMILY'
}

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email)
    if (!user) return null

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) return null

    return user
  },

  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email)
    if (existing) {
      return { error: 'User already exists' as const }
    }

    const passwordHash = await bcrypt.hash(input.password, 12)
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? 'FAMILY',
    })

    return { user }
  },

  me(userId: string) {
    return userRepository.findById(userId)
  },
}
