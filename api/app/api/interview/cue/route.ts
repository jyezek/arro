// POST /api/interview/cue
// Real-time copilot: classifies the AI's question and user's answer-so-far.
// Returns a structured cue for the 3-zone copilot UI.
// Called when the AI finishes a question and after each user speech segment.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const maxDuration = 15

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type ExperienceCueContext = {
  roleTitle: string
  company: string
  bullets: Array<{ text: string }>
}

type SkillCueContext = {
  name: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()
    const { sessionId, question, transcript } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const session = await db.interviewSession.findUnique({
      where: { id: sessionId },
      include: { job: { select: { title: true, company: true } } },
    })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (!canAccessUserResource(user, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Build compact context pack from user profile
    const [experience, skills] = await Promise.all([
      db.experience.findMany({
        where: { userId: user.id },
        include: { bullets: { where: { accepted: true }, take: 1 } },
        orderBy: { startDate: 'desc' },
        take: 3,
      }),
      db.skill.findMany({ where: { userId: user.id }, take: 12 }),
    ])

    const roleContext = session.job
      ? `${session.job.title} at ${session.job.company}`
      : 'General interview'

    const experienceSummary = experience
      .map(
        (e: ExperienceCueContext) =>
          `${e.roleTitle} at ${e.company}${e.bullets[0] ? ': ' + e.bullets[0].text : ''}`
      )
      .join('; ')

    const themes = skills
      .slice(0, 8)
      .map((s: SkillCueContext) => s.name)
      .join(', ')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a real-time interview copilot. Classify the question and generate concise visual cues.

Candidate context:
- Role: ${roleContext}
- Experience: ${experienceSummary || 'Not provided'}
- Themes: ${themes || 'Not provided'}

Return ONLY valid JSON with these exact fields:
{
  "questionType": "behavioral" | "situational" | "technical" | "leadership" | "conflict" | "why_role" | "tell_me_about_yourself" | "strengths_weaknesses" | "general",
  "framework": "STAR" | "CAR" | "SOAR" | "Direct" | "",
  "status": "listening" | "on_track" | "needs_structure" | "missing_outcome" | "drifting" | "wrap_up",
  "primaryCue": "SHORT ALL-CAPS (2-4 words, e.g. LAND THE RESULT)",
  "secondaryCues": ["3-5 word phrase", "3-5 word phrase"],
  "relevantThemes": ["theme1", "theme2"]
}

Rules:
- primaryCue must be ≤4 words, ALL CAPS, urgent and glanceable
- secondaryCues: 0-2 items, lowercase, brief
- If no transcript yet: status="listening", primaryCue="LISTEN CAREFULLY"
- If answer is going well: status="on_track"
- If approaching end without result/impact: status="missing_outcome", primaryCue="LAND THE RESULT"`,
        },
        {
          role: 'user',
          content: `Question: "${question || 'Not yet detected'}"
User answer so far: "${transcript || 'User has not spoken yet.'}"`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let cue: Record<string, unknown>
    try {
      cue = JSON.parse(raw)
    } catch {
      cue = {
        questionType: 'general',
        framework: '',
        status: 'listening',
        primaryCue: 'LISTEN CAREFULLY',
        secondaryCues: [],
        relevantThemes: [],
      }
    }

    return NextResponse.json(cue)
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/interview/cue]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
