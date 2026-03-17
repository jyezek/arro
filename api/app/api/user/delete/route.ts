// POST /api/user/delete — initiate account deletion (30-day grace period)
// DELETE /api/user/delete — cancel a pending deletion request
//
// On POST: suspends the account and sets pendingDeletionAt = now + 30 days.
// The /api/cron/process-deletions job runs daily and permanently purges
// accounts whose grace period has expired.
// Stripe subscription is cancelled immediately on request.
import { NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { db } from '@/lib/db'

const GRACE_PERIOD_DAYS = 30

export async function POST() {
  try {
    const stripe = getStripe()
    const user = await getOrCreateUser()

    if (user.pendingDeletionAt) {
      return NextResponse.json(
        { error: 'Account deletion already pending', deleteAt: user.pendingDeletionAt },
        { status: 409 }
      )
    }

    // Cancel Stripe subscription immediately — no partial-month refund
    if (user.subscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.subscriptionId, { prorate: false })
      } catch (stripeErr) {
        // Log but don't block deletion if Stripe fails (e.g. already cancelled)
        console.error('[DELETE /api/user] Stripe cancel failed', stripeErr)
      }
    }

    const deleteAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

    await db.user.update({
      where: { id: user.id },
      data: {
        suspended: true,
        pendingDeletionAt: deleteAt,
        subscriptionStatus: 'cancelled',
        subscriptionId: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Account scheduled for deletion. You have ${GRACE_PERIOD_DAYS} days to cancel.`,
      deleteAt,
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/user/delete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    // Cancel a pending deletion — re-activate the account
    // Note: getOrCreateUser throws for suspended accounts, so we resolve directly
    const { auth } = await import('@clerk/nextjs/server')
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (!user.pendingDeletionAt) {
      return NextResponse.json({ error: 'No pending deletion to cancel' }, { status: 409 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        suspended: false,
        pendingDeletionAt: null,
      },
    })

    return NextResponse.json({ success: true, message: 'Account deletion cancelled. Your account is restored.' })
  } catch (err) {
    console.error('[DELETE /api/user/delete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
