// POST /api/resume — generate a tailored resume for a job (costs 5 credits for free users)
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCandidateContext, generateResumeArtifact } from '@/lib/application-artifacts'
import { checkFreeLimit } from '@/lib/credits'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { track } from '@/lib/analytics'

export const maxDuration = 120

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { jobId } = await req.json()

    const limited = rateLimitResponse(rateLimit(user.id, 'resume'))
    if (limited) return limited

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        userId: true,
        title: true,
        company: true,
        description: true,
        tags: true,
        location: true,
        jobType: true,
        salary: true,
      },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const COST = 5
    const hasUnlimitedAccess = hasFullPlatformAccess(user)

    const freeLimit = await checkFreeLimit(user.id, 'tailored_resume', user.subscriptionStatus, user.role)
    if (!freeLimit.allowed) {
      return NextResponse.json(
        { error: `Free plan includes ${freeLimit.limit} tailored resumes lifetime. Upgrade to Pro for unlimited.`, code: 'FREE_LIMIT_REACHED' },
        { status: 402 }
      )
    }

    if (!hasUnlimitedAccess && user.creditBalance < COST) {
      return NextResponse.json({ error: 'Insufficient credits', credits: user.creditBalance }, { status: 402 })
    }

    const candidate = await buildCandidateContext(user.id)

    const resume = await db.generatedResume.create({
      data: {
        userId: user.id,
        jobId,
        content: '{}',
        status: 'generating',
      },
    })

    try {
      const generated = await generateResumeArtifact(client, {
        candidate,
        job,
      })

      await db.generatedResume.update({
        where: { id: resume.id },
        data: {
          content: JSON.stringify({
            summary: generated.summary,
            experience: generated.experience,
            keyProducts: generated.keyProducts,
            education: generated.education,
            skillGroups: generated.skillGroups,
            certifications: generated.certifications,
          }),
          tailoredSections: JSON.stringify(generated.tailoredSections ?? []),
          tailoringReason: generated.tailoringReason ?? null,
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
              description: `Tailored resume — ${job.title} at ${job.company}`,
              featureKey: 'tailored_resume',
              jobId,
            },
          }),
        ])
      }

      track(user.id, 'resume_generated', { jobId, jobTitle: job.title, company: job.company })
      return NextResponse.json({ resumeId: resume.id })
    } catch (genErr) {
      await db.generatedResume.update({
        where: { id: resume.id },
        data: { status: 'draft' },
      })
      throw genErr
    }
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/resume]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
