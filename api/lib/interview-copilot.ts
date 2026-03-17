import { db } from '@/lib/db'
import { buildMasterResumeSnapshot } from '@/lib/master-resume'
import { z } from 'zod'

export const CopilotQuestionTypeValues = [
  'behavioral',
  'conflict_challenge',
  'leadership',
  'product_strategy',
  'technical',
  'collaboration',
  'prioritization',
  'failure_learning',
  'why_role_company',
  'tell_me_about_yourself',
  'general',
] as const

export type CopilotQuestionType = (typeof CopilotQuestionTypeValues)[number]

export const CopilotStatusValues = [
  'on_track',
  'needs_structure',
  'missing_outcome',
  'drifting',
  'wrap_up',
  'suggest_topic',
] as const

export type CopilotStatus = (typeof CopilotStatusValues)[number]

export const CopilotModeValues = ['practice', 'live_assist'] as const

export type CopilotMode = (typeof CopilotModeValues)[number]

export const CopilotCueSchema = z.object({
  questionType: z.enum(CopilotQuestionTypeValues),
  likelyIntent: z.string().max(220),
  recommendedAnswerFramework: z.string().max(100),
  status: z.enum(CopilotStatusValues),
  primaryCue: z.string().max(72),
  secondaryCues: z.array(z.string().max(48)).max(3),
  relevantThemes: z.array(z.string().max(48)).max(4),
  relevantStories: z.array(z.string().max(80)).max(3).default([]),
})

export type CopilotCue = z.infer<typeof CopilotCueSchema>

export const FALLBACK_FRAMEWORK_BY_TYPE: Record<CopilotQuestionType, string> = {
  behavioral: 'STAR',
  conflict_challenge: 'STAR + conflict-resolution',
  leadership: 'Situation -> leadership move -> outcome',
  product_strategy: 'Context -> bet -> impact',
  technical: 'Problem -> tradeoff -> decision',
  collaboration: 'Context -> alignment -> execution -> result',
  prioritization: 'Goal -> options -> criteria -> tradeoff',
  failure_learning: 'Failure -> learning -> changed behavior',
  why_role_company: 'Motivation -> fit -> value',
  tell_me_about_yourself: 'Present -> past proof -> why now',
  general: 'STAR-lite',
}

type CopilotContextPack = {
  job: {
    title: string | null
    company: string | null
    location: string | null
    description: string | null
    matchReason: string | null
  } | null
  candidate: {
    name: string | null
    targetRoles: string[]
    targetIndustries: string[]
    targetSeniority: string[]
    workPreference: string | null
    skills: string[]
    storyBank: string[]
    prepThemes: string[]
    resumeThemes: string[]
    experienceSummary: string[]
    masterResumeHighlights: string[]
  }
  userProvidedContext: string | null
}

function cleanText(value: string | null | undefined, max = 240): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

function dedupe(items: Array<string | null | undefined>, max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const item of items) {
    const cleaned = cleanText(item, 180)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= max) break
  }

  return out
}

function flattenStringValues(value: unknown, max = 32): string[] {
  const out: string[] = []

  const visit = (next: unknown) => {
    if (out.length >= max || next == null) return

    if (typeof next === 'string') {
      const cleaned = cleanText(next, 180)
      if (cleaned) out.push(cleaned)
      return
    }

    if (Array.isArray(next)) {
      for (const item of next) visit(item)
      return
    }

    if (typeof next === 'object') {
      for (const item of Object.values(next as Record<string, unknown>)) visit(item)
    }
  }

  visit(value)
  return dedupe(out, max)
}

function parseStoredJson(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function extractResumeHighlights(raw: string | null | undefined, max = 14): string[] {
  if (!raw) return []
  return dedupe(
    raw
      .split(/\n+/)
      .map((line) => line.replace(/^[\-\*\u2022]\s*/, '').trim())
      .filter((line) => line.length >= 24 && line.length <= 180),
    max,
  )
}

export function classifyQuestionType(questionText: string): CopilotQuestionType {
  const q = questionText.toLowerCase()
  if (!q.trim()) return 'general'
  if (/tell me about yourself|walk me through your background/.test(q)) return 'tell_me_about_yourself'
  if (/why (this role|this company|you want)|why arro|why us/.test(q)) return 'why_role_company'
  if (/failure|mistake|learned|what went wrong/.test(q)) return 'failure_learning'
  if (/prioriti|trade[- ]?off|limited resources|roadmap/.test(q)) return 'prioritization'
  if (/cross[- ]?functional|stakeholder|partner|align/.test(q)) return 'collaboration'
  if (/system|architecture|technical|api|scal|debug|implementation/.test(q)) return 'technical'
  if (/strategy|vision|market|product/.test(q)) return 'product_strategy'
  if (/led|leadership|manage|mentor/.test(q)) return 'leadership'
  if (/conflict|disagree|challenge|pushback/.test(q)) return 'conflict_challenge'
  if (/behavior|example|time when|situation/.test(q)) return 'behavioral'
  return 'general'
}

export async function buildCopilotContextPack(
  userId: string,
  jobId?: string | null,
  additionalContext?: string,
): Promise<CopilotContextPack> {
  const [user, job, experience, skills, prepKit, resume, research, masterResumeSnapshot] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        targetRoleTypes: true,
        targetIndustries: true,
        targetSeniority: true,
        workPreference: true,
      },
    }),
    jobId
      ? db.job.findUnique({
          where: { id: jobId },
          select: {
            title: true,
            company: true,
            location: true,
            description: true,
            matchReason: true,
          },
        })
      : null,
    db.experience.findMany({
      where: { userId },
      include: {
        bullets: {
          where: { accepted: true },
          take: 2,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      take: 4,
    }),
    db.skill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 18,
    }),
    db.prepKit.findFirst({
      where: { userId, jobId: jobId ?? undefined },
      orderBy: { updatedAt: 'desc' },
      select: {
        screeningAnswers: true,
        negotiationNotes: true,
        companyResearch: true,
      },
    }),
    db.generatedResume.findFirst({
      where: { userId, jobId: jobId ?? undefined },
      orderBy: { updatedAt: 'desc' },
      select: { content: true, tailoringReason: true },
    }),
    db.companyResearch.findFirst({
      where: { userId, jobId: jobId ?? undefined },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    }),
    buildMasterResumeSnapshot(userId),
  ])

  const masterResumeHighlights = extractResumeHighlights(masterResumeSnapshot.masterResumeText, 14)

  const storyBank = dedupe(
    [
      ...masterResumeSnapshot.experience.flatMap((item) => {
        const bulletText = item.bullets.slice(0, 2).join('; ')
        return [
          `${item.roleTitle} at ${item.company}`,
          bulletText ? `${item.roleTitle} at ${item.company}: ${bulletText}` : null,
        ]
      }),
      ...masterResumeHighlights,
      ...experience.flatMap((item) => {
        const bulletText = item.bullets.map((bullet) => bullet.text).join('; ')
        return [
          `${item.roleTitle} at ${item.company}`,
          bulletText ? `${item.roleTitle} at ${item.company}: ${bulletText}` : null,
        ]
      }),
    ],
    14,
  )

  const prepThemes = dedupe(
    [
      ...flattenStringValues(parseStoredJson(prepKit?.screeningAnswers), 10),
      ...flattenStringValues(parseStoredJson(prepKit?.companyResearch), 10),
      ...flattenStringValues(parseStoredJson(research?.content), 12),
      prepKit?.negotiationNotes ?? null,
      ...flattenStringValues(parseStoredJson(resume?.content), 10),
      resume?.tailoringReason ?? null,
      ...masterResumeHighlights,
    ],
    14,
  )

  const resumeThemes = dedupe(
    [
      ...(masterResumeSnapshot.suggestedTargetRoles ?? []),
      ...(user?.targetRoleTypes ?? []),
      ...(user?.targetIndustries ?? []),
      ...(user?.targetSeniority ?? []),
      user?.workPreference ?? null,
      ...masterResumeSnapshot.skills,
      ...skills.map((item) => item.name),
      ...masterResumeSnapshot.experience.map((item) => item.roleTitle),
      ...masterResumeSnapshot.experience.map((item) => item.company),
      ...masterResumeHighlights,
    ],
    18,
  )

  const experienceSummary = dedupe(
    masterResumeSnapshot.experience.map((item) => {
      const bullet = item.bullets[0]
      return [
        bullet ? `${item.roleTitle} at ${item.company}: ${bullet}` : `${item.roleTitle} at ${item.company}`,
      ][0]
    }),
    8,
  )

  return {
    job: job
      ? {
          title: job.title,
          company: job.company,
          location: job.location,
          description: cleanText(job.description, 1800),
          matchReason: cleanText(job.matchReason, 200),
        }
      : null,
    candidate: {
      name: cleanText([user?.firstName, user?.lastName].filter(Boolean).join(' '), 80),
      targetRoles: user?.targetRoleTypes ?? [],
      targetIndustries: user?.targetIndustries ?? [],
      targetSeniority: user?.targetSeniority ?? [],
      workPreference: cleanText(user?.workPreference, 80),
      skills: dedupe(skills.map((item) => item.name), 16),
      storyBank,
      prepThemes,
      resumeThemes,
      experienceSummary,
      masterResumeHighlights,
    },
    userProvidedContext: cleanText(additionalContext, 600),
  }
}

export function estimateCueStatus(questionText: string, answerText: string): {
  status: CopilotStatus
  signals: string[]
  missing: string[]
} {
  const question = questionText.trim()
  const answer = answerText.trim()

  if (!question && !answer) {
    return {
      status: 'needs_structure',
      signals: ['Waiting for interview context.'],
      missing: ['context', 'action', 'result'],
    }
  }

  if (!answer) {
    return {
      status: 'suggest_topic',
      signals: ['Question is present but no answer has started yet.'],
      missing: ['choose story', 'context', 'action', 'result'],
    }
  }

  const words = answer.split(/\s+/).filter(Boolean)
  const sentenceCount = answer.split(/[.!?]+/).filter((item) => item.trim()).length
  const metricPattern = /\b\d+(?:\.\d+)?%?\b|kpi|metric|revenue|impact|result|reduced|increased|improved|saved/i
  const actionPattern = /\bI\s+(led|owned|drove|built|launched|prioritized|implemented|aligned|partnered|created|shipped|delivered)\b/i
  const roleTieBackPattern = /\b(product|pm|design|engineer|roadmap|stakeholder|cross[- ]functional|customer|strategy|role)\b/i

  const missing: string[] = []
  if (!actionPattern.test(answer)) missing.push('clear ownership')
  if (!metricPattern.test(answer)) missing.push('outcome / metric')
  if (!roleTieBackPattern.test(answer) && question) missing.push('tie-back to role')

  const repeatedWordCount = (() => {
    const counts = new Map<string, number>()
    for (const token of words) {
      const key = token.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (key.length < 4) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.values()).filter((count) => count >= 4).length
  })()

  if (words.length >= 210 || repeatedWordCount >= 3) {
    return {
      status: 'drifting',
      signals: ['Answer length or repetition suggests rambling.'],
      missing,
    }
  }

  if (words.length < 28 || sentenceCount <= 1) {
    return {
      status: 'needs_structure',
      signals: ['Answer is short or under-structured.'],
      missing,
    }
  }

  if (missing.includes('outcome / metric')) {
    return {
      status: 'missing_outcome',
      signals: ['Missing a concrete result or impact signal.'],
      missing,
    }
  }

  if (words.length >= 110 && missing.length <= 1) {
    return {
      status: 'wrap_up',
      signals: ['Core structure is present and answer is long enough to close.'],
      missing,
    }
  }

  return {
    status: 'on_track',
    signals: ['Answer includes enough structure to continue.'],
    missing,
  }
}

function sanitizePrimaryCue(value: string | null | undefined, fallback: string): string {
  const cleaned = cleanText(value, 72)
  if (!cleaned) return fallback
  return cleaned
    .replace(/[.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ')
    .toUpperCase()
}

function sanitizeShortList(values: unknown, maxItems: number, maxWords: number): string[] {
  if (!Array.isArray(values)) return []
  return dedupe(
    values
      .map((item) => (typeof item === 'string' ? item : null))
      .map((item) => {
        const cleaned = cleanText(item, 60)
        if (!cleaned) return null
        return cleaned
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .slice(0, maxWords)
          .join(' ')
      }),
    maxItems,
  )
}

export function normalizeCue(
  cue: CopilotCue,
  questionType: CopilotQuestionType,
): CopilotCue {
  return {
    questionType: cue.questionType || questionType,
    likelyIntent:
      cleanText(cue.likelyIntent, 220) ??
      'Assess clarity, ownership, and the impact of your real experience.',
    recommendedAnswerFramework:
      cleanText(cue.recommendedAnswerFramework, 100) ??
      FALLBACK_FRAMEWORK_BY_TYPE[questionType],
    status: cue.status,
    primaryCue: sanitizePrimaryCue(cue.primaryCue, 'SET CONTEXT'),
    secondaryCues: sanitizeShortList(cue.secondaryCues, 3, 4),
    relevantThemes: sanitizeShortList(cue.relevantThemes, 4, 4),
    relevantStories: sanitizeShortList(cue.relevantStories, 3, 8),
  }
}

export function fallbackCue(
  questionText: string,
  answerText: string,
  contextPack: CopilotContextPack,
): CopilotCue {
  const heuristic = estimateCueStatus(questionText, answerText)
  const questionType = classifyQuestionType(questionText)

  const primaryCueByStatus: Record<CopilotStatus, string> = {
    on_track: 'KEEP IT SPECIFIC',
    needs_structure: 'USE STAR ORDER',
    missing_outcome: 'STATE THE RESULT',
    drifting: 'LAND THE POINT',
    wrap_up: 'CLOSE WITH IMPACT',
    suggest_topic: 'CHOOSE STORY FAST',
  }

  const missingToCue: Record<string, string> = {
    'choose story': 'PICK BEST STORY',
    context: 'SET CONTEXT',
    action: 'OWN THE ACTION',
    result: 'RESULT + METRIC',
    'clear ownership': 'OWN THE ACTION',
    'outcome / metric': 'ADD OUTCOME',
    'tie-back to role': 'TIE TO ROLE',
  }

  const secondaryCues = heuristic.missing
    .map((missing) => missingToCue[missing] ?? missing.toUpperCase())
    .slice(0, 3)

  const relevantThemes = [
    ...contextPack.candidate.prepThemes,
    ...contextPack.candidate.resumeThemes,
    ...contextPack.candidate.skills,
  ].slice(0, 4)

  return normalizeCue(
    {
      questionType,
      likelyIntent: 'Assess clarity, ownership, and impact from your real experience.',
      recommendedAnswerFramework: FALLBACK_FRAMEWORK_BY_TYPE[questionType],
      status: heuristic.status,
      primaryCue: primaryCueByStatus[heuristic.status],
      secondaryCues: secondaryCues.length > 0 ? secondaryCues : ['YOUR ROLE', 'RESULT + METRIC'],
      relevantThemes,
      relevantStories: contextPack.candidate.storyBank.slice(0, 3),
    },
    questionType,
  )
}
