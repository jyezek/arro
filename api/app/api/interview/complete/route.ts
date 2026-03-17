// POST /api/interview/complete
// Finalizes an interview session: saves transcript + generates debrief via GPT-4o.
// Idempotent — if already completed, returns the stored debrief.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()
    const { sessionId, transcript, durationSeconds, questionsAnswered } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const session = await db.interviewSession.findUnique({
      where: { id: sessionId },
      include: { job: { select: { title: true, company: true } } },
    })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (!canAccessUserResource(user, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Idempotent — return cached debrief if already completed
    if (session.status === 'completed' && session.debrief) {
      return NextResponse.json({ debrief: parseJson(session.debrief, {}) })
    }

    const jobContext = session.job
      ? `The interview was for ${session.job.title} at ${session.job.company}.`
      : 'This was a general behavioral interview practice session.'

    const transcriptText = transcript
      ? (typeof transcript === 'string' ? transcript : JSON.stringify(transcript))
      : null

    const debriefResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert interview coach. Analyze this mock interview and provide a constructive debrief.

${jobContext}

Return ONLY valid JSON:
{
  "overallScore": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "summary": "<2-3 sentence overall assessment>"
}

Be specific, encouraging, and actionable. Score 65-85 for typical sessions.`,
        },
        {
          role: 'user',
          content: transcriptText
            ? `Interview transcript:\n${transcriptText}`
            : 'No transcript was captured. Provide an encouraging generic debrief.',
        },
      ],
    })

    const raw = debriefResponse.choices[0]?.message?.content ?? '{}'
    let debrief: Record<string, unknown>
    try {
      debrief = JSON.parse(raw)
    } catch {
      debrief = {
        overallScore: 72,
        strengths: ['Completed the session', 'Engaged with the process'],
        improvements: ['Keep practicing structured responses', 'Focus on specific outcomes'],
        summary: 'Great effort in this practice session. Consistent practice will sharpen your delivery.',
      }
    }

    await db.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        transcript: transcriptText ?? null,
        durationSeconds: durationSeconds ? Math.round(durationSeconds) : null,
        questionsAnswered: questionsAnswered ?? 0,
        debrief: JSON.stringify(debrief),
      },
    })

    return NextResponse.json({ debrief })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/interview/complete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}
