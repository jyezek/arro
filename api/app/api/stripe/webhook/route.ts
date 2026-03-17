// POST /api/stripe/webhook
// Verifies Stripe signature, processes billing events, updates DB idempotently.
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { addCredits } from '@/lib/credits'
import { track } from '@/lib/analytics'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends infer T ? T : never
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  // Idempotency guard
  const existing = await db.processedStripeEvent.findUnique({
    where: { stripeEventId: event.id },
  })
  if (existing) return NextResponse.json({ received: true })

  try {
    await handleEvent(event as unknown as { type: string; data: { object: Record<string, unknown> } })

    await db.processedStripeEvent.create({
      data: { stripeEventId: event.id, eventType: event.type },
    })
  } catch (err) {
    console.error('[Stripe webhook] Failed to process event', event.type, err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: { type: string; data: { object: Record<string, unknown> } }) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        mode: string
        customer: string
        subscription?: string
        metadata?: Record<string, string>
        payment_intent?: string
      }

      const user = await db.user.findUnique({ where: { stripeCustomerId: session.customer } })
      if (!user) return

      if (session.mode === 'subscription' && session.subscription) {
        await db.user.update({
          where: { id: user.id },
          data: {
            subscriptionId: session.subscription as string,
            subscriptionStatus: 'pro',
            creditsIncludedMonthly: 100,
          },
        })
        await addCredits(user.id, 100, 'monthly_reset', 'Pro plan activation — first 100 credits')
        track(user.id, 'subscription_started', { plan: 'pro' })
      }

      if (session.mode === 'payment' && session.metadata?.credits) {
        const credits = parseInt(session.metadata.credits, 10)
        await addCredits(user.id, credits, 'purchase', `${credits} credit pack`)
        track(user.id, 'credit_pack_purchased', { credits })
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string
        status: string
        current_period_end: number
        items: { data: Array<{ price: { id: string } }> }
      }
      const user = await db.user.findUnique({ where: { subscriptionId: sub.id } })
      if (!user) return

      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: sub.status === 'active' ? 'pro' : 'free',
          subscriptionPriceId: sub.items.data[0]?.price?.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string }
      const user = await db.user.findUnique({ where: { subscriptionId: sub.id } })
      if (!user) return

      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'cancelled',
          subscriptionId: null,
          creditsIncludedMonthly: 20,
        },
      })
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as {
        customer: string
        billing_reason: string
      }
      if (invoice.billing_reason !== 'subscription_cycle') break

      const user = await db.user.findUnique({ where: { stripeCustomerId: invoice.customer } })
      if (!user) return

      const newCredits = user.subscriptionStatus === 'pro' ? 100 : 20
      // Roll over unused credits (capped at 1 cycle worth)
      const rollover = Math.min(user.creditBalance, newCredits)

      await db.user.update({
        where: { id: user.id },
        data: {
          creditBalance: newCredits + rollover,
          lastCreditReset: new Date(),
        },
      })
      await db.creditLedgerEntry.create({
        data: {
          userId: user.id,
          amount: newCredits,
          type: 'monthly_reset',
          description: 'Monthly credit reset',
        },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as { customer: string }
      const user = await db.user.findUnique({ where: { stripeCustomerId: invoice.customer } })
      if (!user) return

      await db.user.update({
        where: { id: user.id },
        data: { paymentFailed: true },
      })
      break
    }
  }
}
