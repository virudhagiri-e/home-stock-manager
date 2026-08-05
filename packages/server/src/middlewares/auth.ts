import type { UserRole } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config.js'
import { userRepository } from '../repositories/user.repository.js'

export type AuthUser = {
  sub: string
  role: UserRole
  email: string
  name: string
}

export type AuthenticatedRequest = Request & {
  user: AuthUser
}

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Unauthorized' })
    return
  }

  const token = authHeader.replace('Bearer ', '').trim()

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser

    const user = await userRepository.findById(payload.sub)
    if (!user) {
      response.status(401).json({ message: 'Unauthorized' })
      return
    }

    ;(request as AuthenticatedRequest).user = payload
    next()
  } catch {
    response.status(401).json({ message: 'Unauthorized' })
  }
}

export function requireAdmin(request: AuthenticatedRequest, response: Response): boolean {
  if (request.user.role !== 'ADMIN') {
    response.status(403).json({ message: 'Admin access required' })
    return true
  }

  return false
}
