// financial-ai-backend/src/auth/auth.service.ts
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import type { RegisterBody, LoginBody, RefreshBody, LogoutBody, ForgotPasswordBody, ResetPasswordBody } from './auth.types'

const BCRYPT_ROUNDS = 12
const ACCESS_TTL = '15m'
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

function signAccess(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: ACCESS_TTL })
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export const authService = {
  async register(body: RegisterBody) {
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) throw new AppError('Email already in use', 409, 'EMAIL_TAKEN')

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    })
    return { user }
  },

  async login(body: LoginBody) {
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')

    // Auto-create default simulation account if none exists
    const existingAccount = await prisma.simulationAccount.findFirst({
      where: { userId: user.id },
    })
    if (!existingAccount) {
      await prisma.simulationAccount.create({
        data: { userId: user.id, name: 'My Simulator', balance: 5000 },
      })
    }

    const rawToken = crypto.randomBytes(40).toString('hex')
    await prisma.refreshToken.create({
      data: {
        token: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    })

    return { accessToken: signAccess(user.id), refreshToken: rawToken }
  },

  async refresh(body: RefreshBody) {
    const record = await prisma.refreshToken.findUnique({
      where: { token: hashToken(body.refreshToken) },
    })
    if (!record || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401, 'REFRESH_INVALID')
    }

    const rawNew = crypto.randomBytes(40).toString('hex')
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: hashToken(body.refreshToken) } }),
      prisma.refreshToken.create({
        data: {
          token: hashToken(rawNew),
          userId: record.userId,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ])

    return { accessToken: signAccess(record.userId), refreshToken: rawNew }
  },

  async logout(body: LogoutBody) {
    await prisma.refreshToken.deleteMany({ where: { token: hashToken(body.refreshToken) } })
  },

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND')

    // onDelete: Cascade handles SimulationAccount, Position, Order, RefreshToken, PasswordResetToken
    await prisma.user.delete({ where: { id: userId } })
  },

  async forgotPassword(body: ForgotPasswordBody) {
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    // Always return success to prevent email enumeration
    if (!user) return

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    const rawToken = crypto.randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: {
        token: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    })

    // In production, send rawToken via email. For dev, log it.
    if (config.NODE_ENV !== 'production') {
      return { resetToken: rawToken }
    }
  },

  async resetPassword(body: ResetPasswordBody) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(body.token) },
    })
    if (!record || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset token', 400, 'RESET_TOKEN_INVALID')
    }

    const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS)

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
      // Invalidate all refresh tokens to force re-login
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ])
  },
}
