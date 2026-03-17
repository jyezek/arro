// POST /api/prep-kit — generate a full prep kit for a job (costs 15 credits for free users)
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCandidateContext, generatePrepKitArtifact } from '@/lib/application-artifacts'
import { checkFreeLimit } from '@/lib/credits'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { track } from '@/lib/analytics'

export const maxDuration = 120

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { jobId } = await req.json()

    const limited = rateLimitResponse(rateLimit(user.id, 'prep_kit'))
    if (limited) return limited

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true, title: true, company: true, description: true, salary: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const COST = 15
    const hasUnlimitedAccess = hasFullPlatformAccess(user)

    const freeLimit = await checkFreeLimit(user.id, 'full_prep_kit', user.subscriptionStatus, user.role)
    if (!freeLimit.allowed) {
      return NextResponse.json(
        { error: `Free plan includes ${freeLimit.limit} prep kit lifetime. Upgrade to Pro for unlimited.`, code: 'FREE_LIMIT_REACHED' },
        { status: 402 }
      )
    }

    if (!hasUnlimitedAccess && user.creditBalance < COST) {
      return NextResponse.json({ error: 'Insufficient credits', credits: user.creditBalance }, { status: 402 })
    }

    const candidate = await buildCandidateContext(user.id)

    const kit = await db.prepKit.create({
      data: { userId: user.id, jobId, status: 'generating' },
    })

    try {
      const generated = await generatePrepKitArtifact(client, {
        candidate,
        job,
      })

      await db.prepKit.update({
        where: { id: kit.id },
        data: {
          coverLetter: generated.coverLetter,
          whyInterested: generated.whyInterested,
          biggestStrength: generated.biggestStrength,
          elevatorPitch: generated.elevatorPitch,
          preparationNotes: JSON.stringify(generated.preparationNotes ?? []),
          companyResearch: JSON.stringify(generated.companyBrief ?? {}),
          screeningAnswers: JSON.stringify(generated.screeningAnswers ?? []),
          followUpEmails: JSON.stringify(generated.followUpEmails ?? []),
          negotiationNotes: generated.salaryApproach ?? null,
          status: 'ready',
        },
      })

      if (!hasUnlimitedAccess) {
        await db.$transaction([
          db.user.update({ where: { id: user.id }, data: { creditBalance: { decrement: COST } } }),
          db.creditLedgerEntry.create({
            data: {
              userId: user.id,
              amount: -COST,
              type: 'spend',
              description: `Prep kit — ${job.title} at ${job.company}`,
              featureKey: 'full_prep_kit',
              jobId,
            },
          }),
        ])
      }

      track(user.id, 'prep_kit_generated', { jobId, jobTitle: job.title, company: job.company })
      return NextResponse.json({ kitId: kit.id })
    } catch (genErr) {
      await db.prepKit.update({ where: { id: kit.id }, data: { status: 'draft' } })
      throw genErr
    }
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/prep-kit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
