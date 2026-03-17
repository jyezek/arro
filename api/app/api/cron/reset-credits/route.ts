// GET /api/cron/reset-credits
// Runs monthly on the 1st for free-tier users.
// Pro users reset on billing anniversary via invoice.paid Stripe webhook.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Include 'cancelled' users — they revert to free-tier credit allowance
  const freeUsers = await db.user.findMany({
    where: { subscriptionStatus: { in: ['free', 'cancelled'] } },
    select: { id: true },
  })

  let resetCount = 0
  for (const user of freeUsers) {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { creditBalance: 20, lastCreditReset: new Date() },
      }),
      db.creditLedgerEntry.create({
        data: {
          userId: user.id,
          amount: 20,
          type: 'monthly_reset',
          description: 'Monthly free tier credit reset',
        },
      }),
    ])
    resetCount++
  }

  return NextResponse.json({ resetCount, timestamp: new Date().toISOString() })
}
