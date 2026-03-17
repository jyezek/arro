import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  if (process.env.NODE_ENV === 'development') {
    try {
      const url = new URL(connectionString)
      console.log('[db] connecting to', url.host, { pgbouncer: url.searchParams.get('pgbouncer') })
    } catch {
      console.log('[db] connecting with DATABASE_URL (unable to parse host)')
    }
  }

  const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
