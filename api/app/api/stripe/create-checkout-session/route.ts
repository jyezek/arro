// POST /api/stripe/create-checkout-session
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { getOrCreateStripeCustomer, stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { priceId, type, credits } = await req.json() as {
      priceId: string
      type: 'subscription' | 'credits'
      credits?: number
    }

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
