import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe() {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })

  return stripeClient
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { db } = await import('./db')
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.stripeCustomerId) return user.stripeCustomerId

  const customer = await getStripe().customers.create({
    email,
    name: name ?? email,
    metadata: { userId },
  })

  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}
