// financial-ai-backend/src/server.ts
import { buildApp } from './app'
import { config } from './lib/config'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'

const app = buildApp()
const port = parseInt(config.PORT, 10)

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`, { env: config.NODE_ENV })
})

async function shutdown() {
  logger.info('Shutting down...')
  server.close(async () => {
    await prisma.$disconnect()
    logger.info('Disconnected from database')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
