import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '@/lib/db'
import { computeCompanyInitials, computeDetailScore } from '@/lib/profile'

const SKILL_CATEGORIES = ['design', 'engineering', 'tools', 'soft', 'other'] as const

const ExtractedExperienceSchema = z.object({
  roleTitle: z.string().default(''),
  company: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  description: z.string().default(''),
  bullets: z.array(z.string()).default([]),
})

const ExtractedEducationSchema = z.object({
  degree: z.string().default(''),
  institution: z.string().default(''),
  graduationYear: z.string().default(''),
  fieldOfStudy: z.string().default(''),
})

const ExtractedSkillSchema = z.object({
  name: z.string().default(''),
  category: z.enum(SKILL_CATEGORIES).default('other'),
})

export const ExtractedMasterResumeSchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  linkedinUrl: z.string().default(''),
  portfolioUrl: z.string().default(''),
  summary: z.string().default(''),
  experience: z.array(ExtractedExperienceSchema).default([]),
  education: z.array(ExtractedEducationSchema).default([]),
  skills: z.array(ExtractedSkillSchema).default([]),
  inferredTargetRoles: z.array(z.string()).default([]),
})

export type ExtractedMasterResume = z.infer<typeof ExtractedMasterResumeSchema>

const RoleAssistantSchema = z.object({
  roleSummary: z.string().default(''),
  strongestSignals: z.array(z.string()).default([]),
  missingDetails: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  suggestedBullets: z.array(z.string()).default([]),
  improvedDescription: z.string().default(''),
})

export type RoleAssistantResult = z.infer<typeof RoleAssistantSchema>

export type ProfileStrengthSummary = {
  overall: number
  experience: number
  skills: number
  achievements: number
  education: number
  completedRoles: number
  totalBullets: number
  weakRoleIds: string[]
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
    const candidate = fenced?.[1] ?? trimmed
    const firstObject = candidate.indexOf('{')
    const lastObject = candidate.lastIndexOf('}')
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(candidate.slice(firstObject, lastObject + 1)) as unknown
    }
    throw new Error('No JSON object found in model response')
  }
}

function sanitizeText(value: string | null | undefined, max = 8000): string {
  if (!value) return ''
  const normalized = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

function sanitizeResumeText(value: string | null | undefined, max = 40000): string {
  if (!value) return ''

  const normalized = value
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

function dedupeStrings(values: string[], max = 12): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    const cleaned = value.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= max) break
  }

  return out
}

function buildExperienceKey(item: Pick<ExtractedMasterResume['experience'][number], 'roleTitle' | 'company' | 'startDate'>): string {
  return [item.roleTitle, item.company, item.startDate]
    .map(value => value.trim().toLowerCase())
    .join('|')
}

function buildEducationKey(item: Pick<ExtractedMasterResume['education'][number], 'institution' | 'degree' | 'graduationYear'>): string {
  return [item.institution, item.degree, item.graduationYear]
    .map(value => value.trim().toLowerCase())
    .join('|')
}

export function mergeExtractedResumes(parts: ExtractedMasterResume[]): ExtractedMasterResume {
  const merged: ExtractedMasterResume = {
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    portfolioUrl: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    inferredTargetRoles: [],
  }

  const experienceMap = new Map<string, ExtractedMasterResume['experience'][number]>()
  const educationMap = new Map<string, ExtractedMasterResume['education'][number]>()
  const skillMap = new Map<string, ExtractedMasterResume['skills'][number]>()

  for (const part of parts) {
    if (!merged.firstName && part.firstName.trim()) merged.firstName = part.firstName.trim()
    if (!merged.lastName && part.lastName.trim()) merged.lastName = part.lastName.trim()
    if (!merged.phone && part.phone.trim()) merged.phone = part.phone.trim()
    if (!merged.location && part.location.trim()) merged.location = part.location.trim()
    if (!merged.linkedinUrl && part.linkedinUrl.trim()) merged.linkedinUrl = part.linkedinUrl.trim()
    if (!merged.portfolioUrl && part.portfolioUrl.trim()) merged.portfolioUrl = part.portfolioUrl.trim()
    if (part.summary.trim().length > merged.summary.trim().length) merged.summary = part.summary.trim()

    for (const item of part.experience) {
      const roleTitle = item.roleTitle.trim()
      const company = item.company.trim()
      const startDate = item.startDate.trim()
      if (!roleTitle || !company || !startDate) continue

      const key = buildExperienceKey({ roleTitle, company, startDate })
      const existing = experienceMap.get(key)
      if (!existing) {
        experienceMap.set(key, {
          roleTitle,
          company,
          startDate,
          endDate: item.endDate.trim(),
          description: item.description.trim(),
          bullets: dedupeStrings(item.bullets, 20),
        })
        continue
      }

      existing.endDate = existing.endDate || item.endDate.trim()
      if (item.description.trim().length > existing.description.trim().length) {
        existing.description = item.description.trim()
      }
      existing.bullets = dedupeStrings([...existing.bullets, ...item.bullets], 20)
    }

    for (const item of part.education) {
      const institution = item.institution.trim()
      if (!institution) continue
      const normalized = {
        degree: item.degree.trim(),
        institution,
        graduationYear: item.graduationYear.trim(),
        fieldOfStudy: item.fieldOfStudy.trim(),
      }
      const key = buildEducationKey(normalized)
      if (!educationMap.has(key)) {
        educationMap.set(key, normalized)
      }
    }

    for (const item of part.skills) {
      const name = item.name.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (!skillMap.has(key)) {
        skillMap.set(key, { name, category: item.category })
      }
    }

    merged.inferredTargetRoles = dedupeStrings([
      ...merged.inferredTargetRoles,
      ...part.inferredTargetRoles,
    ], 8)
  }

  merged.experience = Array.from(experienceMap.values())
  merged.education = Array.from(educationMap.values())
  merged.skills = Array.from(skillMap.values())

  return merged
}

export function snapshotToExtractedMasterResume(snapshot: Awaited<ReturnType<typeof buildMasterResumeSnapshot>>): ExtractedMasterResume {
  return {
    firstName: snapshot.firstName ?? '',
    lastName: snapshot.lastName ?? '',
    phone: snapshot.phone ?? '',
    location: snapshot.location ?? '',
    linkedinUrl: snapshot.linkedinUrl ?? '',
    portfolioUrl: snapshot.portfolioUrl ?? '',
    summary: '',
    experience: snapshot.experience.map(item => ({
      roleTitle: item.roleTitle,
      company: item.company,
      startDate: item.startDate,
      endDate: item.isCurrent ? 'Present' : (item.endDate ?? ''),
      description: item.description ?? '',
      bullets: item.bullets,
    })),
    education: snapshot.education.map(item => ({
      degree: item.degree ?? '',
      institution: item.institution,
      graduationYear: item.graduationYear ?? '',
      fieldOfStudy: item.fieldOfStudy ?? '',
    })),
    skills: snapshot.skills.map(name => ({
      name,
      category: 'other',
    })),
    inferredTargetRoles: snapshot.suggestedTargetRoles,
  }
}

function chunkResumeText(resumeText: string, maxChars = 14000): string[] {
  if (resumeText.length <= maxChars) return [resumeText]

  const paragraphs = resumeText
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  const appendLine = (line: string) => {
    const candidate = current ? `${current}\n${line}` : line
    if (candidate.length <= maxChars) {
      current = candidate
      return
    }
    pushCurrent()
    if (line.length <= maxChars) {
      current = line
      return
    }
    for (let index = 0; index < line.length; index += maxChars) {
      chunks.push(line.slice(index, index + maxChars).trim())
    }
  }

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) pushCurrent()

    if (paragraph.length <= maxChars) {
      current = paragraph
      continue
    }

    const lines = paragraph.split('\n').map(line => line.trim()).filter(Boolean)
    for (const line of lines) {
      appendLine(line)
    }
  }

  pushCurrent()
  return chunks.length > 0 ? chunks : [resumeText]
}

export async function extractTextFromUpload(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop()

  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(buffer)
    return result.text
  }

  if (ext === 'docx' || ext === 'doc') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported file type: .${ext ?? 'unknown'}`)
}

async function extractStructuredResumeChunk(
  client: Anthropic,
  resumeText: string,
): Promise<ExtractedMasterResume> {
  const prompt = `You are a resume parser for a job search assistant.

Extract structured data from the provided resume text.

Rules:
- Extract only what is explicitly stated in the resume text.
- Do not invent employers, titles, dates, metrics, URLs, contact details, or tools.
- Preserve the meaning of bullets, but you may lightly normalize whitespace.
- Preserve distinct roles, employers, date ranges, and education entries. Do not merge multiple jobs into one item.
- Extract every role, degree, and skill that appears in this chunk of the resume text.
- For current roles use "Present" for endDate if clearly current.
- inferredTargetRoles should be a short list of likely job families suggested by the experience and skills, such as Product Design, Product Management, UX Research, Engineering, Marketing, Operations, or Consulting.
- Return only valid JSON matching the requested shape.

Return this exact JSON shape:
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "location": "string",
  "linkedinUrl": "string",
  "portfolioUrl": "string",
  "summary": "string",
  "experience": [
    {
      "roleTitle": "string",
      "company": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "graduationYear": "string",
      "fieldOfStudy": "string"
    }
  ],
  "skills": [
    {
      "name": "string",
      "category": "design|engineering|tools|soft|other"
    }
  ],
  "inferredTargetRoles": ["string"]
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5200,
    messages: [{
      role: 'user',
      content: `${prompt}\n\nRESUME TEXT:\n${resumeText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return ExtractedMasterResumeSchema.parse(extractJsonObject(text))
}

export async function extractStructuredResume(
  client: Anthropic,
  resumeText: string,
): Promise<ExtractedMasterResume> {
  const normalizedResumeText = sanitizeResumeText(resumeText, 40000)
  const chunks = chunkResumeText(normalizedResumeText)

  const parts: ExtractedMasterResume[] = []
  for (const chunk of chunks) {
    parts.push(await extractStructuredResumeChunk(client, chunk))
  }

  return mergeExtractedResumes(parts)
}

export async function generateRoleAssistantResponse(
  client: Anthropic,
  params: {
    role: {
      roleTitle: string
      company: string
      startDate: string
      endDate: string | null
      description: string | null
      bullets: string[]
    }
    userSummary: string
    additionalContext?: string | null
  },
): Promise<RoleAssistantResult> {
  const prompt = `You are helping a user strengthen a master resume entry so it can later be tailored precisely to jobs.

Goals:
- Identify what is already strong about the role entry.
- Identify what evidence is missing.
- Ask concrete follow-up questions that will uncover scope, outcomes, metrics, collaboration, ownership, and complexity.
- If enough context exists, suggest stronger resume bullets and a tighter role description.

Rules:
- Never invent facts or metrics.
- Suggested bullets must stay truthful to the provided information.
- Follow-up questions must be specific to this role, not generic advice.
- Return only valid JSON.

Return this exact JSON shape:
{
  "roleSummary": "1-2 sentence summary of the role as currently understood",
  "strongestSignals": ["string"],
  "missingDetails": ["string"],
  "followUpQuestions": ["string"],
  "suggestedBullets": ["string"],
  "improvedDescription": "string"
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2200,
    messages: [{
      role: 'user',
      content: `${prompt}

USER MASTER RESUME CONTEXT:
${sanitizeText(params.userSummary, 5000)}

ROLE ENTRY:
Title: ${params.role.roleTitle}
Company: ${params.role.company}
Dates: ${params.role.startDate} – ${params.role.endDate ?? 'Present'}
Description: ${params.role.description ?? ''}
Bullets:
${params.role.bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join('\n') || '(none yet)'}

ADDITIONAL USER CONTEXT:
${sanitizeText(params.additionalContext, 3000) || '(none provided)'}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return RoleAssistantSchema.parse(extractJsonObject(text))
}

export async function replaceMasterResume(
  userId: string,
  extracted: ExtractedMasterResume,
  options: {
    masterResumeText: string
    masterResumeSource: string
  },
) {
  await db.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: extracted.firstName || null,
        lastName: extracted.lastName || null,
        phone: extracted.phone || null,
        location: extracted.location || null,
        linkedinUrl: extracted.linkedinUrl || null,
        portfolioUrl: extracted.portfolioUrl || null,
        masterResumeText: options.masterResumeText,
        masterResumeSource: options.masterResumeSource,
      },
    })

    await tx.bullet.deleteMany({
      where: {
        experience: { userId },
      },
    })
    await tx.experience.deleteMany({ where: { userId } })
    await tx.education.deleteMany({ where: { userId } })
    await tx.skill.deleteMany({ where: { userId } })

    for (const item of extracted.experience) {
      const roleTitle = item.roleTitle.trim()
      const company = item.company.trim()
      const startDate = item.startDate.trim()
      if (!roleTitle || !company || !startDate) continue

      const bullets = dedupeStrings(item.bullets, 12)
      const endDate = item.endDate.trim()
      const isCurrent = /present|current|now/i.test(endDate)

      const created = await tx.experience.create({
        data: {
          userId,
          roleTitle,
          company,
          companyInitials: computeCompanyInitials(company),
          startDate,
          endDate: isCurrent ? null : (endDate || null),
          isCurrent,
          description: item.description.trim() || null,
          detailScore: computeDetailScore(bullets, startDate, isCurrent ? null : (endDate || null), isCurrent),
        },
      })

      if (bullets.length > 0) {
        await tx.bullet.createMany({
          data: bullets.map(text => ({
            experienceId: created.id,
            text,
            source: 'extracted',
            accepted: true,
          })),
        })
      }
    }

    if (extracted.education.length > 0) {
      await tx.education.createMany({
        data: extracted.education
          .map(item => ({
            userId,
            degree: item.degree.trim() || null,
            institution: item.institution.trim(),
            fieldOfStudy: item.fieldOfStudy.trim() || null,
            graduationYear: item.graduationYear.trim() || null,
          }))
          .filter(item => item.institution),
      })
    }

    if (extracted.skills.length > 0) {
      await tx.skill.createMany({
        data: extracted.skills
          .map(item => ({
            userId,
            name: item.name.trim(),
            category: item.category,
          }))
          .filter(item => item.name),
      })
    }

    const inferredRoles = dedupeStrings(extracted.inferredTargetRoles, 6)
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { targetRoleTypes: true },
    })
    if ((existingUser?.targetRoleTypes.length ?? 0) === 0 && inferredRoles.length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          targetRoleTypes: inferredRoles,
        },
      })
    }
  })
}

export async function buildMasterResumeSnapshot(userId: string) {
  const [user, experience, education, skills] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        location: true,
        linkedinUrl: true,
        portfolioUrl: true,
        onboardingComplete: true,
        updatedAt: true,
        masterResumeText: true,
        masterResumeSource: true,
        targetRoleTypes: true,
      },
    }),
    db.experience.findMany({
      where: { userId },
      include: { bullets: { where: { accepted: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ isCurrent: 'desc' }, { updatedAt: 'desc' }],
    }),
    db.education.findMany({
      where: { userId },
      orderBy: [{ graduationYear: 'desc' }, { createdAt: 'asc' }],
    }),
    db.skill.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  ])

  const experiencePayload = experience.map(item => ({
    id: item.id,
    roleTitle: item.roleTitle,
    company: item.company,
    startDate: item.startDate,
    endDate: item.endDate,
    isCurrent: item.isCurrent,
    description: item.description,
    bullets: item.bullets.map(bullet => bullet.text),
    detailScore: item.detailScore,
  }))

  const educationPayload = education.map(item => ({
    id: item.id,
    degree: item.degree,
    institution: item.institution,
    fieldOfStudy: item.fieldOfStudy,
    graduationYear: item.graduationYear,
  }))

  const skillsPayload = skills.map(item => item.name)
  const strength = computeMasterResumeStrength({
    experience: experiencePayload,
    educationCount: educationPayload.length,
    skillCount: skillsPayload.length,
  })

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    location: user.location,
    linkedinUrl: user.linkedinUrl,
    portfolioUrl: user.portfolioUrl,
    onboardingComplete: user.onboardingComplete,
    updatedAt: user.updatedAt.toISOString(),
    masterResumeText: user.masterResumeText,
    masterResumeSource: user.masterResumeSource,
    suggestedTargetRoles: user.targetRoleTypes,
    experience: experiencePayload,
    education: educationPayload,
    skills: skillsPayload,
    strength,
  }
}

export function buildUserSummaryForAssistant(snapshot: Awaited<ReturnType<typeof buildMasterResumeSnapshot>>): string {
  return [
    `${snapshot.firstName ?? ''} ${snapshot.lastName ?? ''}`.trim(),
    snapshot.location ? `Location: ${snapshot.location}` : null,
    snapshot.suggestedTargetRoles.length ? `Likely roles: ${snapshot.suggestedTargetRoles.join(', ')}` : null,
    '',
    ...snapshot.experience.map(item => [
      `${item.roleTitle} at ${item.company} (${item.startDate} – ${item.isCurrent ? 'Present' : item.endDate ?? ''})`,
      item.description ?? '',
      ...item.bullets.map(bullet => `- ${bullet}`),
    ].filter(Boolean).join('\n')),
    '',
    snapshot.skills.length ? `Skills: ${snapshot.skills.join(', ')}` : null,
  ].filter(Boolean).join('\n')
}

function computeMasterResumeStrength(params: {
  experience: Array<{ id: string; detailScore: number; bullets: string[] }>
  educationCount: number
  skillCount: number
}): ProfileStrengthSummary {
  const completedRoles = params.experience.length
  const totalBullets = params.experience.reduce((sum, item) => sum + item.bullets.length, 0)
  const avgDetailScore = completedRoles
    ? Math.round(params.experience.reduce((sum, item) => sum + item.detailScore, 0) / completedRoles)
    : 0
  const skillsScore = Math.min(100, params.skillCount * 8)
  const achievementsScore = Math.min(
    100,
    params.experience.reduce((sum, item) => {
      const metricBullets = item.bullets.filter(bullet => /\d|%/.test(bullet)).length
      return sum + Math.min(100, metricBullets * 25)
    }, 0) / Math.max(completedRoles, 1),
  )
  const educationScore = params.educationCount > 0 ? 92 : 25
  const overall = Math.round((avgDetailScore * 0.45) + (skillsScore * 0.15) + (achievementsScore * 0.25) + (educationScore * 0.15))

  return {
    overall,
    experience: avgDetailScore,
    skills: Math.round(skillsScore),
    achievements: Math.round(achievementsScore),
    education: educationScore,
    completedRoles,
    totalBullets,
    weakRoleIds: params.experience
      .filter(item => item.detailScore < 75)
      .sort((a, b) => a.detailScore - b.detailScore)
      .slice(0, 3)
      .map(item => item.id),
  }
}
