// GET /api/credits — return current user's credit balance
import { NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    return NextResponse.json({ credits: user.creditBalance ?? 0 })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
