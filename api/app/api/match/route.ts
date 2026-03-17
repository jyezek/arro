// POST /api/match — score unscored jobs for the authenticated user using Claude
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 300

const client = new Anthropic()
const CONCURRENCY = 8

interface JobToScore {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  jobType: string | null
  salary: string | null
  tags: string[]
}

async function scoreJob(job: JobToScore, profileSummary: string): Promise<{ score: number; reason: string }> {
  const prompt = `You are a job-match scoring engine. Score how well this job matches the candidate profile.

CANDIDATE PROFILE:
${profileSummary}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}
Type: ${job.jobType ?? 'Not specified'}
Salary: ${job.salary ?? 'Not specified'}
Tags: ${job.tags.join(', ')}
Description: ${job.description ?? 'No description available'}

Return ONLY a JSON object with two fields:
- "score": integer 0-100 (90+ = excellent, 75-89 = strong, 60-74 = decent, <60 = weak)
- "reason": 1-2 sentence explanation of the score

JSON only, no other text.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    score: Math.max(0, Math.min(100, parseInt(parsed.score))),
    reason: parsed.reason ?? '',
  }
}

function buildProfileSummary(user: {
  firstName: string | null
  targetRoleTypes: string[]
  targetSeniority: string[]
  workPreference: string | null
  targetIndustries: string[]
  employmentTypes: string[]
  targetSalary: number | null
  location: string | null
}): string {
  const parts = [
    user.targetRoleTypes.length ? `Target roles: ${user.targetRoleTypes.join(', ')}` : null,
    user.targetSeniority.length ? `Seniority: ${user.targetSeniority.join(', ')}` : null,
    user.workPreference ? `Work preference: ${user.workPreference}` : null,
    user.targetIndustries.length ? `Target industries: ${user.targetIndustries.join(', ')}` : null,
    user.employmentTypes.length ? `Employment types: ${user.employmentTypes.join(', ')}` : null,
    user.targetSalary ? `Target salary: $${user.targetSalary}k` : null,
    user.location ? `Location: ${user.location}` : null,
  ].filter(Boolean)

  return parts.join('\n') || 'No preferences set — score based on title/description quality'
}

export async function POST() {
  try {
    const user = await getOrCreateUser()

    const limited = rateLimitResponse(rateLimit(user.id, 'match'))
    if (limited) return limited

    // Get unscored, non-hidden jobs for this user
    const jobs = await db.job.findMany({
      where: { userId: user.id, matchScore: null, isHidden: false },
      select: { id: true, title: true, company: true, location: true, description: true, jobType: true, salary: true, tags: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    if (!jobs.length) {
      return NextResponse.json({ scored: 0, total: 0, message: 'No unscored jobs' })
    }

    const profileSummary = buildProfileSummary(user)

    // Process in chunks with concurrency limit
    let scored = 0
    let failed = 0

    const queue = [...jobs]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const job = queue.shift()
        if (!job) break
        try {
          const { score, reason } = await scoreJob(job, profileSummary)
          await db.job.update({
            where: { id: job.id },
            data: { matchScore: score, matchReason: reason },
          })
          scored++
        } catch (err) {
          console.error(`[match] failed job ${job.id}:`, (err as Error).message)
          failed++
        }
      }
    })

    await Promise.all(workers)

    return NextResponse.json({ scored, failed, total: jobs.length })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/match]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
