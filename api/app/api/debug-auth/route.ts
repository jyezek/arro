import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { verifyToken } from '@clerk/backend'
import { headers } from 'next/headers'

export async function GET(req: NextRequest) {
  const reqHeaders = await headers()
  const authHeader = reqHeaders.get('Authorization') ?? reqHeaders.get('authorization') ?? 'MISSING'
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  let clerkAuth: unknown = null
  try { clerkAuth = await auth() } catch (e) { clerkAuth = { error: String(e) } }

  let verified: unknown = null
  if (token) {
    try {
      verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    } catch (e) { verified = { error: String(e) } }
  }

  return NextResponse.json({
    authHeader: authHeader.slice(0, 40) + (authHeader.length > 40 ? '...' : ''),
    hasToken: !!token,
    clerkAuth,
    verified,
  })
}
