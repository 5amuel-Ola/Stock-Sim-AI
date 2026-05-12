import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'

function resolveAuthenticatedUser(header?: string): { userId: string } | null {
  if (!header) return null
  if (!header.startsWith('Bearer ')) {
    throw new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED')
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string }
    return { userId: payload.userId }
  } catch {
    throw new AppError('Invalid or expired token', 401, 'TOKEN_INVALID')
  }
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const user = resolveAuthenticatedUser(req.headers.authorization)
    if (!user) {
      next(new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED'))
      return
    }
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export const authenticateOptional = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.headers.authorization) {
    next()
    return
  }

  try {
    const user = resolveAuthenticatedUser(req.headers.authorization)
    req.user = user ?? undefined
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user?.userId) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'))
    return
  }
  next()
}
