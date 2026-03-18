// POST /api/stripe/create-checkout-session
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { getOrCreateStripeCustomer, getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    const user = await getOrCreateUser()
    const body = await req.json() as {
      priceId?: string
      plan?: string
      type?: 'subscription' | 'credits'
      credits?: number
    }

    // Resolve priceId — accept either a raw priceId or a plan name alias
    const planPriceMap: Record<string, string | undefined> = {
      pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      pro_annual:  process.env.STRIPE_PRICE_PRO_ANNUAL,
      credits_50:  process.env.STRIPE_PRICE_CREDITS_50,
      credits_150: process.env.STRIPE_PRICE_CREDITS_150,
      credits_500: process.env.STRIPE_PRICE_CREDITS_500,
    }

    const priceId = body.priceId ?? (body.plan ? planPriceMap[body.plan] : undefined)
    if (!priceId) {
      return NextResponse.json({ error: 'Missing or unrecognised price' }, { status: 400 })
    }

    // Infer type from plan name if not provided explicitly
    const isCredits = body.plan?.startsWith('credits_') ?? false
    const type: 'subscription' | 'credits' = body.type ?? (isCredits ? 'credits' : 'subscription')
    const credits = body.credits ?? (body.plan === 'credits_50' ? 50 : body.plan === 'credits_150' ? 150 : body.plan === 'credits_500' ? 500 : 0)

    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email,
      [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined
    )

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

    let session
    if (type === 'subscription') {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/upgrade?cancelled=true`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { userId: user.id },
        },
      })
    } else {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        payment_intent_data: {
          metadata: { userId: user.id, credits: String(credits ?? 0) },
        },
        metadata: { userId: user.id, credits: String(credits ?? 0) },
        success_url: `${baseUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/credits?cancelled=true`,
      })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/stripe/create-checkout-session]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
