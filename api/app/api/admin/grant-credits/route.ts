// POST /api/admin/grant-credits
// Admin-only. Grant or remove credits from any user account.
// Useful for: testing, customer support, manual corrections.
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, requireAdminUser } from '@/lib/auth'
import { addCredits } from '@/lib/credits'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser()

    const { userId, email, amount, description } = await req.json() as {
      userId?: string
      email?: string
      amount: number
      description?: string
    }

    if (!userId && !email) {
      return NextResponse.json({ error: 'Provide userId or email' }, { status: 400 })
    }
    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 })
    }

    const target = await db.user.findUnique({
      where: userId ? { id: userId } : { email },
      select: { id: true, email: true, creditBalance: true },
    })

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { newBalance } = await addCredits(
      target.id,
      amount,
      amount > 0 ? 'admin_grant' : 'refund',
      description ?? `Admin ${amount > 0 ? 'grant' : 'adjustment'}: ${amount} credits`
    )

    return NextResponse.json({
      success: true,
      user: { id: target.id, email: target.email },
      previousBalance: target.creditBalance,
      newBalance,
      delta: amount,
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/admin/grant-credits]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
