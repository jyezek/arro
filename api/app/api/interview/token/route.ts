// POST /api/interview/token
// Creates an OpenAI Realtime session and returns an ephemeral key for the client.
// Browser clients use this key to negotiate a WebRTC session immediately.

import { NextRequest, NextResponse } from 'next/server'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCopilotContextPack } from '@/lib/interview-copilot'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { track } from '@/lib/analytics'

export const maxDuration = 30

function parseStoredJson(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function stringifyContext(value: unknown, max = 26000): string {
  const raw = JSON.stringify(value, null, 2)
  if (raw.length <= max) return raw
  return `${raw.slice(0, max)}\n...[context truncated]`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const limited = rateLimitResponse(rateLimit(user.id, 'interview_token'))
    if (limited) return limited

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
    }

    const body = (await req.json()) as { jobId?: string | null }
    const { jobId } = body

    const COST = 20
    const hasUnlimitedAccess = hasFullPlatformAccess(user)
    if (!hasUnlimitedAccess && user.creditBalance < COST) {
      return NextResponse.json({ error: 'Insufficient credits', credits: user.creditBalance }, { status: 402 })
    }

    const job = jobId
      ? await db.job.findUnique({
          where: { id: jobId },
          select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            location: true,
            description: true,
            matchReason: true,
            salary: true,
            url: true,
          },
        })
      : null

    if (job && !canAccessUserResource(user, job.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [contextPack, generatedResume, prepKit, research] = await Promise.all([
      buildCopilotContextPack(user.id, jobId ?? null),
      db.generatedResume.findFirst({
        where: { userId: user.id, jobId: jobId ?? undefined },
        orderBy: { updatedAt: 'desc' },
        select: {
          content: true,
          tailoredSections: true,
          tailoringReason: true,
          updatedAt: true,
        },
      }),
      db.prepKit.findFirst({
        where: { userId: user.id, jobId: jobId ?? undefined },
        orderBy: { updatedAt: 'desc' },
        select: {
          coverLetter: true,
          whyInterested: true,
          biggestStrength: true,
          elevatorPitch: true,
          preparationNotes: true,
          screeningAnswers: true,
          followUpEmails: true,
          negotiationNotes: true,
          companyResearch: true,
          updatedAt: true,
        },
      }),
      db.companyResearch.findFirst({
        where: { userId: user.id, jobId: jobId ?? undefined },
        orderBy: { updatedAt: 'desc' },
        select: {
          content: true,
          updatedAt: true,
        },
      }),
    ])

    const contextBlob = {
      interviewScope: job
        ? 'Role-specific interview practice'
        : 'General interview practice based on the candidate profile',
      job: job
        ? {
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            matchReason: job.matchReason,
            salary: job.salary,
            url: job.url,
          }
        : null,
      candidate: contextPack.candidate,
      generatedAssets: {
        tailoredResume: generatedResume
          ? {
              content: parseStoredJson(generatedResume.content),
              tailoredSections: parseStoredJson(generatedResume.tailoredSections),
              tailoringReason: generatedResume.tailoringReason,
              updatedAt: generatedResume.updatedAt,
            }
          : null,
        prepKit: prepKit
          ? {
              coverLetter: prepKit.coverLetter,
              whyInterested: prepKit.whyInterested,
              biggestStrength: prepKit.biggestStrength,
              elevatorPitch: prepKit.elevatorPitch,
              preparationNotes: parseStoredJson(prepKit.preparationNotes),
              screeningAnswers: parseStoredJson(prepKit.screeningAnswers),
              followUpEmails: parseStoredJson(prepKit.followUpEmails),
              negotiationNotes: prepKit.negotiationNotes,
              companyResearch: parseStoredJson(prepKit.companyResearch),
              updatedAt: prepKit.updatedAt,
            }
          : null,
        companyResearch: research
          ? {
              content: parseStoredJson(research.content),
              updatedAt: research.updatedAt,
            }
          : null,
      },
    }

    const instructions = `You are Arro's live AI interviewer, simulating a strong hiring manager or panel interviewer.

Your job:
- Conduct a realistic spoken interview for the role and company in the provided context.
- Use the candidate's real background, tailored resume, prep materials, and company research to drive better questions.
- Ask one concise question at a time.
- Listen, react naturally, and ask short follow-ups when needed.
- Probe for ownership, judgment, tradeoffs, and measurable outcomes.
- Keep interviewer turns brief enough for a natural voice conversation.

Rules:
- Do not invent candidate background beyond the provided context.
- Prioritize the specific job, company, and tailored resume if they are available.
- Mix behavioral, execution, collaboration, role-fit, and company-fit questions.
- Sound like a smart human interviewer, not a coach or narrator.
- Do not give away ideal answers unless the candidate directly asks for coaching after a response.

Start immediately by introducing yourself in one sentence and asking the first interview question.

INTERVIEW CONTEXT:
${stringifyContext(contextBlob)}`

    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          instructions,
          audio: {
            input: {
              transcription: { model: 'gpt-4o-mini-transcribe' },
              turn_detection: {
                type: 'semantic_vad',
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              voice: 'verse',
            },
          },
        },
      }),
    })

    const session = (await sessionResponse.json()) as {
      client_secret?: { value?: string; expires_at?: number }
      value?: string
      error?: unknown
    }

    if (!sessionResponse.ok) {
      return NextResponse.json({ error: 'Failed to create realtime session' }, { status: 500 })
    }

    const clientSecret = session.client_secret?.value ?? session.value
    if (!clientSecret) {
      return NextResponse.json({ error: 'Realtime token missing from response' }, { status: 500 })
    }

    const dbSession = await db.interviewSession.create({
      data: {
        userId: user.id,
        jobId: job ? jobId : null,
        status: 'active',
        startedAt: new Date(),
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
            description: `Interview practice${job ? ` — ${job.title} at ${job.company}` : ''}`,
            featureKey: 'practice_interview',
            jobId: jobId ?? null,
          },
        }),
      ])
    }

    track(user.id, 'interview_started', {
      sessionId: dbSession.id,
      jobId: jobId ?? null,
      hasJobContext: !!job,
    })

    return NextResponse.json({
      clientSecret,
      sessionId: dbSession.id,
      expiresAt: session.client_secret?.expires_at ?? null,
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/interview/token]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
