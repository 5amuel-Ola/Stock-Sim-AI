// financial-ai-backend/src/test/auth.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import bcrypt from 'bcrypt'
import { authRouter } from '../auth/auth.router'
import { errorHandler } from '../middleware/error.middleware'
import { prisma } from '../lib/prisma'

const app = express()
app.use(express.json())
app.use('/api/v1/auth', authRouter)
app.use(errorHandler)

const mock = prisma as any

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with user on success', async () => {
    mock.user.findUnique.mockResolvedValue(null)
    mock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      createdAt: new Date(),
    })

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('test@example.com')
  })

  it('returns 409 when email is already taken', async () => {
    mock.user.findUnique.mockResolvedValue({ id: 'existing' })

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'exists@example.com', password: 'Password123!' })

    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: '123' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with accessToken and refreshToken', async () => {
    const hash = await bcrypt.hash('Password123!', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
    })
    mock.simulationAccount.findFirst.mockResolvedValue({ id: 'acct-1' })
    mock.refreshToken.create.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
  })

  it('auto-creates a simulation account when none exists on first login', async () => {
    const hash = await bcrypt.hash('Password123!', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      passwordHash: hash,
    })
    // No account exists yet
    mock.simulationAccount.findFirst.mockResolvedValue(null)
    mock.simulationAccount.create.mockResolvedValue({
      id: 'acct-new',
      userId: 'user-1',
      name: 'My Simulator',
      balance: 10000,
    })
    mock.refreshToken.create.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'new@example.com', password: 'Password123!' })

    expect(res.status).toBe(200)
    expect(mock.simulationAccount.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'My Simulator', balance: 5000 },
    })
  })

  it('does not create a duplicate account when one already exists', async () => {
    const hash = await bcrypt.hash('Password123!', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
    })
    // Account already exists
    mock.simulationAccount.findFirst.mockResolvedValue({ id: 'acct-1' })
    mock.refreshToken.create.mockResolvedValue({})

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' })

    expect(mock.simulationAccount.create).not.toHaveBeenCalled()
  })

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct-pass', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
    })

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrong-pass' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown email', async () => {
    mock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and deletes the refresh token', async () => {
    mock.refreshToken.deleteMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-raw-token' })

    expect(res.status).toBe(204)
    expect(mock.refreshToken.deleteMany).toHaveBeenCalledOnce()
    expect(mock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: expect.stringMatching(/^[a-f0-9]{64}$/) }
    })
  })
})

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 with new accessToken and refreshToken', async () => {
    mock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'hashed',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    mock.$transaction.mockResolvedValue([{}, {}])

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'some-raw-token' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
  })

  it('returns 401 for invalid or expired refresh token', async () => {
    mock.refreshToken.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid-token' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired refresh token', async () => {
    mock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'hashed',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    })

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'some-raw-token' })

    expect(res.status).toBe(401)
  })
})
