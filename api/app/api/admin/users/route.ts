import { NextResponse } from 'next/server'
import { getAuthErrorResponse, requireAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdminUser()

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        suspended: true,
        subscriptionStatus: true,
        creditBalance: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({ users })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
