import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '@/lib/db'

export const ResumeContentSchema = z.object({
  summary: z.string().default(''),
  experience: z.array(z.object({
    roleTitle: z.string(),
    company: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    location: z.string().optional(),
    bullets: z.array(z.string()).default([]),
  })).default([]),
  keyProducts: z.array(z.object({
    name: z.string(),
    tagline: z.string(),
    highlights: z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({
    degree: z.string().default(''),
    institution: z.string(),
    graduationYear: z.string().default(''),
    fieldOfStudy: z.string().optional(),
  })).default([]),
  skillGroups: z.array(z.object({
    category: z.string(),
    skills: z.array(z.string()).default([]),
  })).default([]),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string().optional(),
  })).default([]),
  tailoredSections: z.array(z.string()).default([]),
  tailoringReason: z.string().default(''),
})

export type ResumeContent = z.infer<typeof ResumeContentSchema>

export const RESUME_SECTION_KEYS = [
  'summary',
  'experience',
  'keyProducts',
  'education',
  'skillGroups',
  'certifications',
] as const

export type ResumeSectionKey = (typeof RESUME_SECTION_KEYS)[number]

const ResumeSectionSchemas = {
  summary: z.object({ summary: ResumeContentSchema.shape.summary }),
  experience: z.object({ experience: ResumeContentSchema.shape.experience }),
  keyProducts: z.object({ keyProducts: ResumeContentSchema.shape.keyProducts }),
  education: z.object({ education: ResumeContentSchema.shape.education }),
  skillGroups: z.object({ skillGroups: ResumeContentSchema.shape.skillGroups }),
  certifications: z.object({ certifications: ResumeContentSchema.shape.certifications }),
} satisfies Record<ResumeSectionKey, z.ZodTypeAny>

export const PrepKitContentSchema = z.object({
  coverLetter: z.string().default(''),
  whyInterested: z.string().default(''),
  biggestStrength: z.string().default(''),
  elevatorPitch: z.string().default(''),
  preparationNotes: z.array(z.string()).default([]),
  salaryApproach: z.string().default(''),
  screeningAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).default([]),
  followUpEmails: z.array(z.object({
    stage: z.string(),
    sendAfter: z.string(),
    subject: z.string(),
    body: z.string(),
  })).default([]),
  companyBrief: z.object({
    overview: z.string().default(''),
    culture: z.string().default(''),
    recentNews: z.string().default(''),
    whyThisCompany: z.string().default(''),
  }).default({
    overview: '',
    culture: '',
    recentNews: '',
    whyThisCompany: '',
  }),
})

export type PrepKitContent = z.infer<typeof PrepKitContentSchema>

export const PREP_KIT_SECTION_KEYS = [
  'coverLetter',
  'whyInterested',
  'biggestStrength',
  'elevatorPitch',
  'preparationNotes',
  'salaryApproach',
  'screeningAnswers',
  'followUpEmails',
  'companyBrief',
] as const

export type PrepKitSectionKey = (typeof PREP_KIT_SECTION_KEYS)[number]

const PrepKitSectionSchemas = {
  coverLetter: z.object({ coverLetter: PrepKitContentSchema.shape.coverLetter }),
  whyInterested: z.object({ whyInterested: PrepKitContentSchema.shape.whyInterested }),
  biggestStrength: z.object({ biggestStrength: PrepKitContentSchema.shape.biggestStrength }),
  elevatorPitch: z.object({ elevatorPitch: PrepKitContentSchema.shape.elevatorPitch }),
  preparationNotes: z.object({ preparationNotes: PrepKitContentSchema.shape.preparationNotes }),
  salaryApproach: z.object({ salaryApproach: PrepKitContentSchema.shape.salaryApproach }),
  screeningAnswers: z.object({ screeningAnswers: PrepKitContentSchema.shape.screeningAnswers }),
  followUpEmails: z.object({ followUpEmails: PrepKitContentSchema.shape.followUpEmails }),
  companyBrief: z.object({ companyBrief: PrepKitContentSchema.shape.companyBrief }),
} satisfies Record<PrepKitSectionKey, z.ZodTypeAny>

export const CompanyResearchContentSchema = z.object({
  companySnapshot: z.string().default(''),
  businessModel: z.string().default(''),
  productEcosystem: z.string().default(''),
  roleContext: z.string().default(''),
  dayInTheLife: z.array(z.string()).default([]),
  first90DaysPlan: z.array(z.string()).default([]),
  keyStakeholders: z.array(z.string()).default([]),
  interviewTalkingPoints: z.array(z.string()).default([]),
  questionsToAsk: z.array(z.string()).default([]),
  risksAndWatchouts: z.array(z.string()).default([]),
  prepChecklist: z.array(z.string()).default([]),
})

export type CompanyResearchContent = z.infer<typeof CompanyResearchContentSchema>

type CandidateContext = {
  name: string
  profileText: string
  skills: string[]
}

type StoredPrepKitLike = {
  coverLetter?: string | null
  whyInterested?: string | null
  biggestStrength?: string | null
  elevatorPitch?: string | null
  preparationNotes?: string | null
  screeningAnswers?: string | null
  followUpEmails?: string | null
  negotiationNotes?: string | null
  companyResearch?: string | null
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
    const candidate = fenced?.[1] ?? trimmed
    const first = candidate.indexOf('{')
    const last = candidate.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1)) as unknown
    }
    throw new Error('No JSON object found in model response')
  }
}

function sanitizeText(value: string | null | undefined, max = 2200): string {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

export function parseStoredResumeContent(raw: string | null | undefined): ResumeContent {
  if (!raw) return ResumeContentSchema.parse({})
  try {
    return ResumeContentSchema.parse(JSON.parse(raw))
  } catch {
    return ResumeContentSchema.parse({})
  }
}

export function serializeResumeContent(content: ResumeContent): string {
  return JSON.stringify({
    summary: content.summary,
    experience: content.experience,
    keyProducts: content.keyProducts,
    education: content.education,
    skillGroups: content.skillGroups,
    certifications: content.certifications,
  })
}

export function parseStoredPrepKitContent(raw: StoredPrepKitLike): PrepKitContent {
  return PrepKitContentSchema.parse({
    coverLetter: raw.coverLetter ?? '',
    whyInterested: raw.whyInterested ?? '',
    biggestStrength: raw.biggestStrength ?? '',
    elevatorPitch: raw.elevatorPitch ?? '',
    preparationNotes: safeJsonArray(raw.preparationNotes),
    salaryApproach: raw.negotiationNotes ?? '',
    screeningAnswers: safeJsonArray(raw.screeningAnswers),
    followUpEmails: safeJsonArray(raw.followUpEmails),
    companyBrief: safeJsonObject(raw.companyResearch),
  })
}

export function prepKitUpdateDataFromContent(content: PrepKitContent) {
  return {
    coverLetter: content.coverLetter || null,
    whyInterested: content.whyInterested || null,
    biggestStrength: content.biggestStrength || null,
    elevatorPitch: content.elevatorPitch || null,
    preparationNotes: JSON.stringify(content.preparationNotes ?? []),
    screeningAnswers: JSON.stringify(content.screeningAnswers ?? []),
    followUpEmails: JSON.stringify(content.followUpEmails ?? []),
    negotiationNotes: content.salaryApproach || null,
    companyResearch: JSON.stringify(content.companyBrief ?? {}),
  }
}

function safeJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export async function buildCandidateContext(userId: string): Promise<CandidateContext> {
  const [user, experience, education, skills] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        location: true,
        linkedinUrl: true,
        portfolioUrl: true,
      },
    }),
    db.experience.findMany({
      where: { userId },
      include: { bullets: { where: { accepted: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    }),
    db.education.findMany({ where: { userId }, orderBy: { graduationYear: 'desc' } }),
    db.skill.findMany({ where: { userId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
  ])

  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  const sections = [
    `Name: ${name || 'Candidate'}`,
    user?.location ? `Location: ${user.location}` : null,
    user?.linkedinUrl ? `LinkedIn: ${user.linkedinUrl}` : null,
    user?.portfolioUrl ? `Portfolio: ${user.portfolioUrl}` : null,
    '',
    '## Experience',
    ...experience.map((item) => [
      `${item.roleTitle} at ${item.company} (${item.startDate}–${item.isCurrent ? 'Present' : (item.endDate ?? '')})`,
      item.description ?? '',
      ...item.bullets.map((bullet) => `- ${bullet.text}`),
    ].filter(Boolean).join('\n')),
    '',
    '## Education',
    ...education.map((item) =>
      `${item.degree ?? ''} ${item.fieldOfStudy ?? ''} — ${item.institution} (${item.graduationYear ?? ''})`.trim(),
    ),
    '',
    '## Skills',
    skills.map((item) => item.name).join(', '),
  ].filter(Boolean)

  return {
    name: name || 'Candidate',
    profileText: sections.join('\n'),
    skills: skills.map((item) => item.name),
  }
}

export async function generateResumeArtifact(
  client: Anthropic,
  params: {
    candidate: CandidateContext
    job: {
      title: string
      company: string
      description: string | null
      location?: string | null
      salary?: string | null
      tags?: string[]
      jobType?: string | null
    }
  },
): Promise<ResumeContent> {
  const prompt = `You are an expert resume strategist creating ATS-aware, highly tailored resumes.

Rules:
- Use only facts from the candidate profile.
- Do not invent employers, titles, metrics, certifications, or tools.
- Prioritize relevance to the target role over chronology when selecting bullets.
- Keep bullets concise, specific, and achievement-oriented.
- Return only valid JSON.

Return this exact JSON shape:
{
  "summary": "2-3 sentence summary",
  "experience": [
    {
      "roleTitle": "string",
      "company": "string",
      "startDate": "string",
      "endDate": "string",
      "location": "string optional",
      "bullets": ["string", "string"]
    }
  ],
  "keyProducts": [
    { "name": "string", "tagline": "string", "highlights": ["string"] }
  ],
  "education": [
    { "degree": "string", "institution": "string", "graduationYear": "string", "fieldOfStudy": "string optional" }
  ],
  "skillGroups": [
    { "category": "string", "skills": ["string"] }
  ],
  "certifications": [
    { "name": "string", "issuer": "string optional" }
  ],
  "tailoredSections": ["summary", "experience", "skills"],
  "tailoringReason": "1-2 sentence explanation"
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2800,
    messages: [{
      role: 'user',
      content: `${prompt}

TARGET JOB:
Title: ${params.job.title}
Company: ${params.job.company}
Location: ${params.job.location ?? 'Not specified'}
Type: ${params.job.jobType ?? 'Not specified'}
Salary: ${params.job.salary ?? 'Not specified'}
Tags: ${(params.job.tags ?? []).join(', ') || 'None'}
Description:
${sanitizeText(params.job.description, 4200) || 'No description available'}

CANDIDATE PROFILE:
${params.candidate.profileText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return ResumeContentSchema.parse(extractJsonObject(text))
}

function resumeSectionPrompt(section: ResumeSectionKey): string {
  switch (section) {
    case 'summary':
      return `Return only valid JSON in this exact shape:
{
  "summary": "2-3 sentence professional summary"
}`
    case 'experience':
      return `Return only valid JSON in this exact shape:
{
  "experience": [
    {
      "roleTitle": "string",
      "company": "string",
      "startDate": "string",
      "endDate": "string",
      "location": "string optional",
      "bullets": ["string", "string"]
    }
  ]
}`
    case 'keyProducts':
      return `Return only valid JSON in this exact shape:
{
  "keyProducts": [
    {
      "name": "string",
      "tagline": "string",
      "highlights": ["string"]
    }
  ]
}`
    case 'education':
      return `Return only valid JSON in this exact shape:
{
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "graduationYear": "string",
      "fieldOfStudy": "string optional"
    }
  ]
}`
    case 'skillGroups':
      return `Return only valid JSON in this exact shape:
{
  "skillGroups": [
    {
      "category": "string",
      "skills": ["string"]
    }
  ]
}`
    case 'certifications':
      return `Return only valid JSON in this exact shape:
{
  "certifications": [
    {
      "name": "string",
      "issuer": "string optional"
    }
  ]
}`
  }
}

export async function generateResumeSectionArtifact(
  client: Anthropic,
  params: {
    section: ResumeSectionKey
    currentContent: ResumeContent
    candidate: CandidateContext
    job: {
      title: string
      company: string
      description: string | null
      location?: string | null
      salary?: string | null
      tags?: string[]
      jobType?: string | null
    }
  },
): Promise<Partial<ResumeContent>> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2200,
    messages: [{
      role: 'user',
      content: `You are updating one section of a tailored resume for a real job application.

Rules:
- Use only facts from the candidate profile.
- Do not invent employers, titles, metrics, certifications, or tools.
- Keep the updated section consistent with the rest of the resume draft.
- Optimize the section for relevance to the target role.
- Return only valid JSON.

Requested section: ${params.section}
${resumeSectionPrompt(params.section)}

TARGET JOB:
Title: ${params.job.title}
Company: ${params.job.company}
Location: ${params.job.location ?? 'Not specified'}
Type: ${params.job.jobType ?? 'Not specified'}
Salary: ${params.job.salary ?? 'Not specified'}
Tags: ${(params.job.tags ?? []).join(', ') || 'None'}
Description:
${sanitizeText(params.job.description, 4200) || 'No description available'}

CURRENT RESUME DRAFT:
${JSON.stringify({
  summary: params.currentContent.summary,
  experience: params.currentContent.experience,
  keyProducts: params.currentContent.keyProducts,
  education: params.currentContent.education,
  skillGroups: params.currentContent.skillGroups,
  certifications: params.currentContent.certifications,
}, null, 2)}

CANDIDATE PROFILE:
${params.candidate.profileText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return ResumeSectionSchemas[params.section].parse(extractJsonObject(text))
}

export async function generatePrepKitArtifact(
  client: Anthropic,
  params: {
    candidate: CandidateContext
    job: {
      title: string
      company: string
      description: string | null
      salary?: string | null
    }
  },
): Promise<PrepKitContent> {
  const prompt = `You are an expert job search coach producing a per-job application kit.

Rules:
- Use only facts from the candidate profile.
- Every section must be specific to the role and company.
- Keep tone confident and practical, not generic.
- Return only valid JSON.

Return this exact JSON shape:
{
  "coverLetter": "string",
  "whyInterested": "string",
  "biggestStrength": "string",
  "elevatorPitch": "string",
  "preparationNotes": ["string", "string"],
  "salaryApproach": "string",
  "screeningAnswers": [
    { "question": "string", "answer": "string" }
  ],
  "followUpEmails": [
    { "stage": "string", "sendAfter": "string", "subject": "string", "body": "string" }
  ],
  "companyBrief": {
    "overview": "string",
    "culture": "string",
    "recentNews": "string",
    "whyThisCompany": "string"
  }
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4200,
    messages: [{
      role: 'user',
      content: `${prompt}

TARGET JOB:
Title: ${params.job.title}
Company: ${params.job.company}
Salary: ${params.job.salary ?? 'Not specified'}
Description:
${sanitizeText(params.job.description, 4200) || 'No description available'}

CANDIDATE PROFILE:
${params.candidate.profileText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return PrepKitContentSchema.parse(extractJsonObject(text))
}

function prepKitSectionPrompt(section: PrepKitSectionKey): string {
  switch (section) {
    case 'coverLetter':
      return `Return only valid JSON in this exact shape:
{
  "coverLetter": "string"
}`
    case 'whyInterested':
      return `Return only valid JSON in this exact shape:
{
  "whyInterested": "string"
}`
    case 'biggestStrength':
      return `Return only valid JSON in this exact shape:
{
  "biggestStrength": "string"
}`
    case 'elevatorPitch':
      return `Return only valid JSON in this exact shape:
{
  "elevatorPitch": "string"
}`
    case 'preparationNotes':
      return `Return only valid JSON in this exact shape:
{
  "preparationNotes": ["string", "string"]
}`
    case 'salaryApproach':
      return `Return only valid JSON in this exact shape:
{
  "salaryApproach": "string"
}`
    case 'screeningAnswers':
      return `Return only valid JSON in this exact shape:
{
  "screeningAnswers": [
    { "question": "string", "answer": "string" }
  ]
}`
    case 'followUpEmails':
      return `Return only valid JSON in this exact shape:
{
  "followUpEmails": [
    { "stage": "string", "sendAfter": "string", "subject": "string", "body": "string" }
  ]
}`
    case 'companyBrief':
      return `Return only valid JSON in this exact shape:
{
  "companyBrief": {
    "overview": "string",
    "culture": "string",
    "recentNews": "string",
    "whyThisCompany": "string"
  }
}`
  }
}

export async function generatePrepKitSectionArtifact(
  client: Anthropic,
  params: {
    section: PrepKitSectionKey
    currentContent: PrepKitContent
    candidate: CandidateContext
    job: {
      title: string
      company: string
      description: string | null
      salary?: string | null
    }
  },
): Promise<Partial<PrepKitContent>> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2600,
    messages: [{
      role: 'user',
      content: `You are updating one section of a tailored job application prep kit.

Rules:
- Use only facts from the candidate profile.
- Keep the tone confident, specific, and practical.
- Keep the updated section consistent with the rest of the prep kit draft.
- Return only valid JSON.

Requested section: ${params.section}
${prepKitSectionPrompt(params.section)}

TARGET JOB:
Title: ${params.job.title}
Company: ${params.job.company}
Salary: ${params.job.salary ?? 'Not specified'}
Description:
${sanitizeText(params.job.description, 4200) || 'No description available'}

CURRENT PREP KIT DRAFT:
${JSON.stringify(params.currentContent, null, 2)}

CANDIDATE PROFILE:
${params.candidate.profileText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return PrepKitSectionSchemas[params.section].parse(extractJsonObject(text))
}

export async function generateCompanyResearchArtifact(
  client: Anthropic,
  params: {
    candidate: CandidateContext
    job: {
      title: string
      company: string
      description: string | null
    }
  },
): Promise<CompanyResearchContent> {
  const prompt = `You are a strategic company and interview research assistant for serious candidates.

Rules:
- Tailor the brief to the target role and company.
- Be specific and actionable.
- If you are uncertain about company specifics, say so clearly instead of pretending.
- Return only valid JSON.

Return this exact JSON shape:
{
  "companySnapshot": "string",
  "businessModel": "string",
  "productEcosystem": "string",
  "roleContext": "string",
  "dayInTheLife": ["string"],
  "first90DaysPlan": ["string"],
  "keyStakeholders": ["string"],
  "interviewTalkingPoints": ["string"],
  "questionsToAsk": ["string"],
  "risksAndWatchouts": ["string"],
  "prepChecklist": ["string"]
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4200,
    messages: [{
      role: 'user',
      content: `${prompt}

TARGET JOB:
Title: ${params.job.title}
Company: ${params.job.company}
Description:
${sanitizeText(params.job.description, 4200) || 'No description available'}

CANDIDATE PROFILE:
${params.candidate.profileText}`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  return CompanyResearchContentSchema.parse(extractJsonObject(text))
}
