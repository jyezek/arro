import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { db } = await import('@/lib/db')
    await db.$queryRaw`SELECT 1`

    const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
    const stripeMode = stripeKey.startsWith('sk_test_') ? 'test' : stripeKey.startsWith('sk_live_') ? 'live' : 'unknown'

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      stripeMode,
      // Test card for Stripe test mode: 4242 4242 4242 4242, any future date, any CVC
    })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
