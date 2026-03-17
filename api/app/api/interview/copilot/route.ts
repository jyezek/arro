import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  buildCopilotContextPack,
  classifyQuestionType,
  CopilotCueSchema,
  CopilotModeValues,
  fallbackCue,
  normalizeCue,
} from '@/lib/interview-copilot'

export const maxDuration = 30

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TranscriptSegmentSchema = z.object({
  speaker: z.enum(['interviewer', 'candidate', 'ai', 'user']).optional(),
  role: z.enum(['interviewer', 'candidate', 'ai', 'user']).optional(),
  text: z.string().min(1).max(1600),
})

const CopilotRequestSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(CopilotModeValues).default('live_assist'),
  questionText: z.string().max(4000).optional(),
  answerText: z.string().max(8000).optional(),
  additionalContext: z.string().max(1200).optional(),
  transcript: z.array(TranscriptSegmentSchema).max(60).default([]),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const parsed = CopilotRequestSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid copilot request payload' }, { status: 400 })
    }

    const { sessionId, mode, transcript, additionalContext } = parsed.data
    const questionText = (parsed.data.questionText ?? '').trim()
    const answerText = (parsed.data.answerText ?? '').trim()

    const session = await db.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
          },
        },
      },
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (!canAccessUserResource(user, session.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const contextPack = await buildCopilotContextPack(user.id, session.jobId, additionalContext)
    const transcriptTail = transcript.slice(-18)
    const questionType = classifyQuestionType(questionText)

    if (!process.env.OPENAI_API_KEY) {
      const cue = fallbackCue(questionText, answerText, contextPack)
      return NextResponse.json({ cue, source: 'fallback', warning: 'OPENAI_API_KEY is not set' })
    }

    try {
      const completion = await openai.chat.completions.create({
        model: mode === 'live_assist' ? 'gpt-4.1-nano' : 'gpt-4.1-mini',
        max_tokens: mode === 'live_assist' ? 350 : 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are Arro Interview Copilot. Provide sparse, glanceable interview cues while a candidate speaks.

This is not a teleprompter. Never write answer paragraphs.

Return ONLY valid JSON with exactly this shape:
{
  "questionType": "behavioral | conflict_challenge | leadership | product_strategy | technical | collaboration | prioritization | failure_learning | why_role_company | tell_me_about_yourself | general",
  "likelyIntent": "one short sentence",
  "recommendedAnswerFramework": "short framework label",
  "status": "on_track | needs_structure | missing_outcome | drifting | wrap_up | suggest_topic",
  "primaryCue": "2-5 words",
  "secondaryCues": ["up to 3 concise cues"],
  "relevantThemes": ["up to 4 real themes"],
  "relevantStories": ["up to 3 real stories"]
}

Rules:
- Use only the user's actual context. Never invent achievements.
- primaryCue should be uppercase-friendly and instantly readable.
- secondaryCues should be no more than 4 words each.
- In live_assist mode, stay calm and minimal.
- In practice mode, you may be slightly more explicit, but still concise.
- If the answer has not started yet, help the user choose a story and structure quickly.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              mode,
              questionText,
              answerText,
              transcriptTail,
              session: session.job
                ? {
                    role: session.job.title,
                    company: session.job.company,
                  }
                : null,
              contextPack,
            }),
          },
        ],
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const json = JSON.parse(raw) as unknown
      const result = CopilotCueSchema.safeParse(json)
      if (!result.success) {
        const cue = fallbackCue(questionText, answerText, contextPack)
        return NextResponse.json({ cue, source: 'fallback', warning: 'Model returned an invalid cue payload' })
      }

      const cue = normalizeCue(result.data, questionType)
      return NextResponse.json({ cue, source: 'openai' })
    } catch (error) {
      console.error('[POST /api/interview/copilot] Falling back to heuristic cue', error)
      const cue = fallbackCue(questionText, answerText, contextPack)
      return NextResponse.json({ cue, source: 'fallback', warning: 'AI cue generation failed' })
    }
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/interview/copilot]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
