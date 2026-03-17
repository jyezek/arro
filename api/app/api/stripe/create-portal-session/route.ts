// POST /api/stripe/create-portal-session
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    const user = await getOrCreateUser()

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/profile`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/stripe/create-portal-session]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
