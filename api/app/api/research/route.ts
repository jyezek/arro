// POST /api/research — generate a company research brief for a job
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCandidateContext, generateCompanyResearchArtifact } from '@/lib/application-artifacts'
import { checkFreeLimit } from '@/lib/credits'
import { track } from '@/lib/analytics'

export const maxDuration = 120

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true, title: true, company: true, description: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const COST = 3
    const hasUnlimitedAccess = hasFullPlatformAccess(user)

    const freeLimit = await checkFreeLimit(user.id, 'company_overview', user.subscriptionStatus, user.role)
    if (!freeLimit.allowed) {
      return NextResponse.json(
        { error: `Free plan includes ${freeLimit.limit} company overviews lifetime. Upgrade to Pro for unlimited.`, code: 'FREE_LIMIT_REACHED' },
        { status: 402 }
      )
    }

    if (!hasUnlimitedAccess && user.creditBalance < COST) {
      return NextResponse.json({ error: 'Insufficient credits', credits: user.creditBalance }, { status: 402 })
    }

    const candidate = await buildCandidateContext(user.id)

    const research = await db.companyResearch.create({
      data: {
        userId: user.id,
        jobId,
        content: '{}',
        status: 'generating',
      },
    })

    try {
      const generated = await generateCompanyResearchArtifact(client, {
        candidate,
        job,
      })

      await db.companyResearch.update({
        where: { id: research.id },
        data: {
          content: JSON.stringify(generated),
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
              description: `Company research — ${job.title} at ${job.company}`,
              featureKey: 'company_overview',
              jobId,
            },
          }),
        ])
      }

      track(user.id, 'company_research_generated', { jobId, company: job.company })
      return NextResponse.json({ researchId: research.id })
    } catch (genErr) {
      await db.companyResearch.update({ where: { id: research.id }, data: { status: 'draft' } })
      throw genErr
    }
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/research]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
