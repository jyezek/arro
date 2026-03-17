import { auth } from '@clerk/nextjs/server'
import { verifyToken, createClerkClient } from '@clerk/backend'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from './db'
import { track } from './analytics'
import type { User } from '@prisma/client'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

const VALID_ROLES = ['user', 'tester', 'admin'] as const
type Role = typeof VALID_ROLES[number]

/**
 * Read the role from Clerk privateMetadata.
 * Set this in the Clerk dashboard: Users → select user → Metadata → Private Metadata:
 *   { "role": "admin" }   — full admin access
 *   { "role": "tester" }  — zero credit cost, Pro features, no admin powers
 *   { "role": "user" }    — default (or omit the field entirely)
 *
 * Changes take effect on the user's next API request — no redeploy needed.
 */
function resolveClerkRole(privateMetadata: Record<string, unknown>): Role {
  const raw = privateMetadata?.role
  if (typeof raw === 'string' && VALID_ROLES.includes(raw as Role)) {
    return raw as Role
  }
  return 'user'
}

async function resolveUserId(): Promise<string> {
  // Try middleware-propagated auth first (cookie / middleware-set headers)
  const { userId } = await auth()
  if (userId) return userId

  // Fallback: verify the Bearer token directly from the Authorization header
  const reqHeaders = await headers()
  const authHeader = reqHeaders.get('Authorization') ?? reqHeaders.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) throw new Error('Not authenticated')

  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    return payload.sub
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[resolveUserId] verifyToken failed', err)
    }
    throw new Error('Not authenticated')
  }
}

/**
 * Get or create the internal user record for the currently authenticated Clerk user.
 * Clerk privateMetadata.role is the source of truth — DB role is kept in sync on
 * every request so role changes in the Clerk dashboard take effect immediately.
 * Throws if not authenticated or account is suspended.
 */
export async function getOrCreateUser(): Promise<User> {
  const clerkId = await resolveUserId()

  const clerkUser = await clerk.users.getUser(clerkId)
  if (!clerkUser) throw new Error('Could not fetch Clerk user')

  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress ?? ''
  const role = resolveClerkRole(clerkUser.privateMetadata as Record<string, unknown>)

  const existing = await db.user.findUnique({ where: { clerkId } })

  if (existing) {
    // Sync role from Clerk if it has changed
    if (existing.role !== role) {
      const updated = await db.user.update({
        where: { id: existing.id },
        data: { role },
      })
      if (updated.suspended) throw new Error('Account suspended')
      return updated
    }
    if (existing.suspended) throw new Error('Account suspended')
    return existing
  }

  // Bootstrap new user
  const newUser = await db.user.create({
    data: {
      clerkId,
      email: primaryEmail,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      role,
      creditBalance: 20,
      creditsIncludedMonthly: 20,
      lastCreditReset: new Date(),
    },
  })

  await db.creditLedgerEntry.create({
    data: {
      userId: newUser.id,
      amount: 20,
      type: 'signup',
      description: 'Welcome credits',
    },
  })

  track(newUser.id, 'user_signed_up', { email: primaryEmail, role })

  return newUser
}

export function isAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin'
}

export function isTester(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'tester'
}

/**
 * Returns true if the user gets unlimited access to flat-rate features
 * and zero credit costs. Admins, testers, and active Pro subscribers qualify.
 * A failed payment strips Pro access even if subscriptionStatus is still 'pro'.
 */
export function hasFullPlatformAccess(
  user: Pick<User, 'role' | 'subscriptionStatus' | 'paymentFailed'> | null | undefined
): boolean {
  if (isAdmin(user) || isTester(user)) return true
  if (user?.paymentFailed) return false
  return user?.subscriptionStatus === 'pro'
}

export function canAccessUserResource(user: Pick<User, 'id'>, resourceUserId: string): boolean {
  return user.id === resourceUserId
}

export async function requireAdminUser(): Promise<User> {
  const user = await getOrCreateUser()
  if (!isAdmin(user)) throw new Error('Admin access required')
  return user
}

export function getAuthErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof Error)) return null
  if (err.message === 'Not authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (err.message === 'Account suspended') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }
  if (err.message === 'Admin access required') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return db.user.findUnique({ where: { clerkId } })
}
