import winston from 'winston'

const { combine, timestamp, colorize, printf, json } = winston.format

const devFormat = combine(
  colorize(),
  timestamp(),
  printf(({ level, message, timestamp, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${extra}`
  })
)

const prodFormat = combine(timestamp(), json())

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    process.env.NODE_ENV === 'production'
      ? new winston.transports.File({ filename: 'logs/app.log', format: prodFormat })
      : new winston.transports.Console({ format: devFormat }),
  ],
})
