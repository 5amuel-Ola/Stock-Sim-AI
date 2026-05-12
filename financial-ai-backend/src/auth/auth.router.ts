// financial-ai-backend/src/auth/auth.router.ts
import { Router, Request, Response } from 'express'
import { authService } from './auth.service'
import { validate } from '../middleware/validate.middleware'
import { authenticate } from '../middleware/auth.middleware'
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type RegisterBody,
  type LoginBody,
  type RefreshBody,
  type LogoutBody,
  type ForgotPasswordBody,
  type ResetPasswordBody,
} from './auth.types'

export const authRouter = Router()

authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const result = await authService.register(req.body as RegisterBody)
    res.status(201).json(result)
  }
)

authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const result = await authService.login(req.body as LoginBody)
    res.status(200).json(result)
  }
)

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body as RefreshBody)
    res.json(result)
  }
)

authRouter.post(
  '/logout',
  validate(logoutSchema),
  async (req: Request, res: Response) => {
    await authService.logout(req.body as LogoutBody)
    res.status(204).send()
  }
)

authRouter.delete(
  '/me',
  authenticate,
  async (req: Request, res: Response) => {
    await authService.deleteAccount(req.user!.userId)
    res.json({ success: true })
  }
)

authRouter.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body as ForgotPasswordBody)
    res.json({ message: 'If that email exists, a reset link has been sent.', ...result })
  }
)

authRouter.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req: Request, res: Response) => {
    await authService.resetPassword(req.body as ResetPasswordBody)
    res.json({ success: true })
  }
)
