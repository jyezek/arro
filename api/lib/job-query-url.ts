export type Platform = 'linkedin' | 'indeed' | 'glassdoor' | 'wellfound' | 'dice'
export type JobType = 'any' | 'fulltime' | 'parttime' | 'contract' | 'internship'
export type DatePosted = 'any' | 'day' | 'week' | 'month'

export type QueryParams = {
  keywords: string
  location?: string
  remote?: boolean
  jobType?: JobType
  datePosted?: DatePosted
}

export function buildQueryUrl(platform: Platform, params: QueryParams): string {
  switch (platform) {
    case 'linkedin':  return buildLinkedIn(params)
    case 'indeed':    return buildIndeed(params)
    case 'glassdoor': return buildGlassdoor(params)
    case 'wellfound': return buildWellfound(params)
    case 'dice':      return buildDice(params)
  }
}

function buildLinkedIn(p: QueryParams): string {
  const q = new URLSearchParams()
  if (p.keywords) q.set('keywords', p.keywords)
  if (p.location && !p.remote) q.set('location', p.location)
  if (p.remote) q.set('f_WT', '2')
  const jtMap: Partial<Record<JobType, string>> = { fulltime: 'F', parttime: 'P', contract: 'C', internship: 'I' }
  if (p.jobType && p.jobType !== 'any') q.set('f_JT', jtMap[p.jobType] ?? '')
  const tprMap: Partial<Record<DatePosted, string>> = { day: 'r86400', week: 'r604800', month: 'r2592000' }
  if (p.datePosted && p.datePosted !== 'any') q.set('f_TPR', tprMap[p.datePosted] ?? '')
  return `https://www.linkedin.com/jobs/search/?${q.toString()}`
}

function buildIndeed(p: QueryParams): string {
  const q = new URLSearchParams()
  if (p.keywords) q.set('q', p.keywords)
  if (p.location && !p.remote) q.set('l', p.location)
  if (p.remote) q.set('remotejob', '032b3046-06a3-4876-8dfd-474eb5e7ed11')
  const jtMap: Partial<Record<JobType, string>> = { fulltime: 'fulltime', parttime: 'parttime', contract: 'contract', internship: 'internship' }
  if (p.jobType && p.jobType !== 'any') q.set('jt', jtMap[p.jobType] ?? '')
  const ageMap: Partial<Record<DatePosted, string>> = { day: '1', week: '7', month: '30' }
  if (p.datePosted && p.datePosted !== 'any') q.set('fromage', ageMap[p.datePosted] ?? '')
  return `https://www.indeed.com/jobs?${q.toString()}`
}

function buildGlassdoor(p: QueryParams): string {
  const q = new URLSearchParams()
  if (p.keywords) q.set('sc.keyword', p.keywords)
  if (p.location && !p.remote) q.set('locKeyword', p.location)
  if (p.remote) q.set('remoteWorkType', '1')
  const jtMap: Partial<Record<JobType, string>> = { fulltime: 'fulltime', parttime: 'parttime', contract: 'contract', internship: 'internship' }
  if (p.jobType && p.jobType !== 'any') q.set('jobType', jtMap[p.jobType] ?? '')
  const ageMap: Partial<Record<DatePosted, string>> = { day: '1', week: '7', month: '30' }
  if (p.datePosted && p.datePosted !== 'any') q.set('fromAge', ageMap[p.datePosted] ?? '')
  return `https://www.glassdoor.com/Job/jobs.htm?${q.toString()}`
}

function buildWellfound(p: QueryParams): string {
  const q = new URLSearchParams()
  if (p.keywords) q.set('query', p.keywords)
  if (p.remote) q.set('remote', 'true')
  if (p.location && !p.remote) q.set('location', p.location)
  return `https://wellfound.com/jobs?${q.toString()}`
}

function buildDice(p: QueryParams): string {
  const q = new URLSearchParams()
  if (p.keywords) q.set('q', p.keywords)
  if (p.location && !p.remote) q.set('location', p.location)
  if (p.remote) q.set('filters.workplaceTypes', 'Remote')
  const ageMap: Partial<Record<DatePosted, string>> = { day: 'ONE', week: 'SEVEN', month: 'THIRTY' }
  if (p.datePosted && p.datePosted !== 'any') q.set('filters.postedDate', ageMap[p.datePosted] ?? '')
  return `https://www.dice.com/jobs?${q.toString()}`
}
