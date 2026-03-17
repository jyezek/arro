// POST /api/interview — start a new interview session or continue existing one
// GET  /api/interview/[id] — fetch session
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()
    const { action, jobId, sessionId, userResponse } = body

    if (action === 'start') {
      // Start new session (costs 20 credits for free users)
      const COST = 20
      const hasUnlimitedAccess = hasFullPlatformAccess(user)
      if (!hasUnlimitedAccess && user.creditBalance < COST) {
        return NextResponse.json({ error: 'Insufficient credits', credits: user.creditBalance }, { status: 402 })
      }

      const job = jobId
        ? await db.job.findUnique({
            where: { id: jobId },
            select: { id: true, userId: true, title: true, company: true, description: true },
          })
        : null

      if (job && !canAccessUserResource(user, job.userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Generate first question
      const context = job
        ? `The interview is for: ${job.title} at ${job.company}.\nJob description: ${(job.description ?? '').slice(0, 500)}`
        : 'This is a general behavioral interview practice session.'

      const systemPrompt = `You are an experienced technical interviewer conducting a professional interview practice session. ${context}

Ask one interview question at a time. Be conversational and encouraging. After the candidate answers, give brief feedback (1-2 sentences) and then ask the next question.

For the first message, introduce yourself briefly and ask your first question. Keep responses concise and professional.`

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Ready to start the interview.' }],
      })

      const firstMessage = response.content[0].type === 'text' ? response.content[0].text : ''
      const history = [
        { role: 'user', content: 'Ready to start the interview.' },
        { role: 'assistant', content: firstMessage },
      ]

      const session = await db.interviewSession.create({
        data: {
          userId: user.id,
          jobId: job?.id ?? null,
          copilotHistory: JSON.stringify(history),
          questionsAnswered: 0,
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
              jobId: job?.id ?? null,
            },
          }),
        ])
      }

      return NextResponse.json({
        sessionId: session.id,
        message: firstMessage,
      })
    }

    if (action === 'respond') {
      // Continue existing session with user's answer
      if (!sessionId || !userResponse) {
        return NextResponse.json({ error: 'sessionId and userResponse required' }, { status: 400 })
      }

      const session = await db.interviewSession.findUnique({ where: { id: sessionId } })
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (!canAccessUserResource(user, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const history: { role: string; content: string }[] = parseJson(session.copilotHistory, [])
      history.push({ role: 'user', content: userResponse })

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'You are an experienced interviewer giving feedback and asking the next question. Be concise, warm, and professional.',
        messages: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      })

      const aiMessage = response.content[0].type === 'text' ? response.content[0].text : ''
      history.push({ role: 'assistant', content: aiMessage })

      await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          copilotHistory: JSON.stringify(history),
          questionsAnswered: { increment: 1 },
        },
      })

      return NextResponse.json({ message: aiMessage })
    }

    if (action === 'complete') {
      // End session and generate debrief
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
      }

      const session = await db.interviewSession.findUnique({ where: { id: sessionId } })
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (!canAccessUserResource(user, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const history: { role: string; content: string }[] = parseJson(session.copilotHistory, [])

      const debriefResponse = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          {
            role: 'user',
            content: 'Please provide a brief debrief of this interview session as JSON: { "overallScore": 75, "strengths": ["..."], "improvements": ["..."], "summary": "..." }',
          },
        ],
      })

      const debriefText = debriefResponse.content[0].type === 'text' ? debriefResponse.content[0].text : '{}'
      const jsonMatch = debriefText.match(/\{[\s\S]*\}/)
      const debrief = jsonMatch ? jsonMatch[0] : '{}'

      await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          debrief,
        },
      })

      return NextResponse.json({ debrief: parseJson(debrief, {}) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/interview]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}
