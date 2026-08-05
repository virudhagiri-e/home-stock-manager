import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config.js'
import { loginSchema, registerSchema } from '../schemas.js'
import { type AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js'
import { authService } from '../services/auth.service.js'

export const authController = {
  async login(request: Request, response: Response) {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const user = await authService.login(parsed.data.email, parsed.data.password)
    if (!user) {
      response.status(401).json({ message: 'Invalid credentials' })
      return
    }

    const token = jwt.sign({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    }, env.JWT_SECRET)

    response.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  },

  async register(request: Request, response: Response) {
    const authReq = request as AuthenticatedRequest
    if (requireAdmin(authReq, response)) return

    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const result = await authService.register(parsed.data)
    if ('error' in result) {
      response.status(409).json({ message: result.error })
      return
    }

    response.status(201).json({
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    })
  },

  async me(request: Request, response: Response) {
    const authReq = request as AuthenticatedRequest
    const user = await authService.me(authReq.user.sub)
    response.json(user)
  },
}
