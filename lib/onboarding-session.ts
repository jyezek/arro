export type PendingResumeFile = {
  name: string
  uri: string
  mimeType?: string | null
  size?: number | null
}

export type ExtractedResumePreview = {
  firstName: string
  lastName: string
  phone: string
  location: string
  linkedinUrl: string
  portfolioUrl: string
  summary: string
  experience: Array<{
    roleTitle: string
    company: string
    startDate: string
    endDate: string
    description: string
    bullets: string[]
  }>
  education: Array<{
    degree: string
    institution: string
    graduationYear: string
    fieldOfStudy: string
  }>
  skills: Array<{
    name: string
    category: 'design' | 'engineering' | 'tools' | 'soft' | 'other'
  }>
  inferredTargetRoles: string[]
}

type OnboardingSessionState = {
  source: 'upload' | 'text' | 'manual' | null
  files: PendingResumeFile[]
  resumeText: string
  extracted: ExtractedResumePreview | null
}

const state: OnboardingSessionState = {
  source: null,
  files: [],
  resumeText: '',
  extracted: null,
}

export function setOnboardingResumeFiles(files: PendingResumeFile[]) {
  state.source = 'upload'
  state.files = files
  state.resumeText = ''
  state.extracted = null
}

export function setOnboardingResumeText(text: string, source: 'text' | 'manual' = 'text') {
  state.source = source
  state.resumeText = text
  state.files = []
  state.extracted = null
}

export function setOnboardingExtracted(extracted: ExtractedResumePreview, resumeText: string) {
  state.extracted = extracted
  state.resumeText = resumeText
}

export function getOnboardingSession() {
  return state
}

export function clearOnboardingSession() {
  state.source = null
  state.files = []
  state.resumeText = ''
  state.extracted = null
}
