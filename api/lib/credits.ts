import { db } from './db'
import { isAdmin, isTester } from './auth'

export const CREDIT_COSTS: Record<string, number> = {
  practice_interview:  20,
  deep_dive_per_role:  10,
  full_prep_kit:       15,
  tailored_resume:      5,
  company_overview:     3,
  copilot_message:      1,
  ai_bullet_batch:      3,
}

// Pro users get flat-rate features for free
const FLAT_RATE_FEATURES = ['tailored_resume', 'full_prep_kit', 'company_overview']

// Free-tier lifetime generation caps. Checked via the credit ledger so they
// reset naturally when a churned Pro user returns to free (Pro resumes are
// never written to the spend ledger, so the count starts fresh).
export const FREE_LIFETIME_LIMITS: Record<string, number> = {
  tailored_resume:  3,
  full_prep_kit:    1,
  company_overview: 3,
}

export function getCreditCost(
  featureKey: string,
  subscriptionStatus: string,
  role?: string
): number {
  const userLike = { role: role ?? 'user' }
  if (isAdmin(userLike) || isTester(userLike)) return 0
  if (subscriptionStatus === 'pro' && FLAT_RATE_FEATURES.includes(featureKey)) return 0
  return CREDIT_COSTS[featureKey] ?? 0
}

export async function checkCredits(
  userId: string,
  featureKey: string,
  subscriptionStatus: string,
  role?: string
): Promise<{ canProceed: boolean; balance: number; cost: number; error?: string }> {
  const cost = getCreditCost(featureKey, subscriptionStatus, role)

  if (cost === 0) return { canProceed: true, balance: 0, cost: 0 }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })

  if (!user) return { canProceed: false, balance: 0, cost, error: 'User not found' }

  if (user.creditBalance < cost) {
    return {
      canProceed: false,
      balance: user.creditBalance,
      cost,
      error: `Insufficient credits — need ${cost}, have ${user.creditBalance}`,
    }
  }

  return { canProceed: true, balance: user.creditBalance, cost }
}

/**
 * Check whether a free-tier user has hit the lifetime limit for a feature.
 * Admin and tester roles are always allowed. Pro users are always allowed.
 * Uses the credit ledger as the source of truth — only free-tier spends are
 * recorded there, so the count resets automatically after a Pro → free churn.
 */
export async function checkFreeLimit(
  userId: string,
  featureKey: string,
  subscriptionStatus: string,
  role?: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const userLike = { role: role ?? 'user' }
  if (isAdmin(userLike) || isTester(userLike) || subscriptionStatus === 'pro') {
    return { allowed: true, count: 0, limit: Infinity }
  }

  const limit = FREE_LIFETIME_LIMITS[featureKey]
  if (limit === undefined) return { allowed: true, count: 0, limit: Infinity }

  const count = await db.creditLedgerEntry.count({
    where: { userId, featureKey, type: 'spend' },
  })

  return { allowed: count < limit, count, limit }
}

export async function spendCredits(
  userId: string,
  amount: number,
  description: string,
  featureKey: string,
  jobId?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount === 0) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { creditBalance: true } })
    return { success: true, newBalance: user?.creditBalance ?? 0 }
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) return { success: false, newBalance: 0, error: 'User not found' }
    if (user.creditBalance < amount) {
      return { success: false, newBalance: user.creditBalance, error: 'Insufficient credits' }
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: amount } },
    })

    await tx.creditLedgerEntry.create({
      data: {
        userId,
        amount: -amount,
        type: 'spend',
        description,
        featureKey,
        jobId,
      },
    })

    return { success: true, newBalance: updated.creditBalance }
  })
}

export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<{ newBalance: number }> {
  const updated = await db.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: amount } },
  })

  await db.creditLedgerEntry.create({
    data: { userId, amount, type, description },
  })

  return { newBalance: updated.creditBalance }
}
