export type ResumeSettingsProfile = {
  firstName: string | null
  lastName: string | null
  email: string
  phone: string | null
  location: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  onboardingComplete: boolean
  updatedAt: string
  masterResumeText: string | null
  masterResumeSource: string | null
  suggestedTargetRoles: string[]
  strength: {
    overall: number
    experience: number
    skills: number
    achievements: number
    education: number
    completedRoles: number
    totalBullets: number
    weakRoleIds: string[]
  }
  experience: Array<{
    id: string
    roleTitle: string
    company: string
    startDate: string
    endDate: string | null
    isCurrent: boolean
    description: string | null
    bullets: string[]
    detailScore: number
  }>
  education: Array<{
    id: string
    degree: string | null
    institution: string
    fieldOfStudy: string | null
    graduationYear: string | null
  }>
  skills: string[]
}

export type UserSettings = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  location: string | null
  portfolioUrl: string | null
  linkedinUrl: string | null
  targetSalary: number | null
  salaryFlexibility: string | null
  workPreference: string | null
  employmentTypes: string[]
  targetRoleTypes: string[]
  targetSeniority: string[]
  targetIndustries: string[]
  willingToRelocate: boolean | null
  equityImportance: string | null
  subscriptionStatus: string
}

export const WORK_PREFERENCE_OPTIONS = [
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Onsite', value: 'onsite' },
] as const

export const SALARY_FLEXIBILITY_OPTIONS = [
  { label: 'Firm', value: 'firm' },
  { label: 'Flexible', value: 'flexible' },
  { label: 'Negotiable', value: 'negotiable' },
] as const

export const EMPLOYMENT_TYPE_OPTIONS = [
  { label: 'Full-time', value: 'full-time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Freelance', value: 'freelance' },
] as const

export const ROLE_TYPE_SUGGESTIONS = [
  'Product Design',
  'Product Management',
  'UX Research',
  'Engineering',
  'Design Systems',
  'Marketing Tech',
  'Operations',
  'Consulting',
]

export const SENIORITY_SUGGESTIONS = [
  'Mid-level',
  'Senior',
  'Staff / Principal',
  'Director+',
]

export const INDUSTRY_SUGGESTIONS = [
  'Tech / SaaS',
  'Automotive',
  'Healthcare',
  'Fintech',
  'Agency',
  'Enterprise',
]

export const EQUITY_IMPORTANCE_OPTIONS = [
  { label: 'Important', value: 'important' },
  { label: 'Nice to have', value: 'nice-to-have' },
  { label: 'Not a factor', value: 'not-a-factor' },
] as const

export const RELOCATION_OPTIONS = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
  { label: 'Maybe', value: null },
] as const

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

export function splitTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,]+/)
        .map(part => part.trim())
        .filter(Boolean)
    )
  )
}

export function joinTags(values: string[]): string {
  return values.join(', ')
}

export function formatUpdatedAt(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString()
}
