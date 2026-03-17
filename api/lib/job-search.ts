const DEFAULT_REMOTE_ALLOWED_REGIONS = ['US']

const FOREIGN_LOCATION_PATTERNS = [
  /\b(?:germany|deutschland|berlin|munich|muenchen|hamburg|frankfurt|cologne|köln|düsseldorf|dusseldorf|stuttgart|dach)\b/i,
  /\b(?:united kingdom|uk|england|scotland|wales|london|manchester|birmingham|glasgow|edinburgh|bristol|leeds)\b/i,
  /\b(?:canada|toronto|vancouver|montreal|ottawa|calgary|winnipeg)\b/i,
  /\b(?:ireland|dublin|cork|limerick)\b/i,
  /\b(?:netherlands|amsterdam|rotterdam|the hague|eindhoven|utrecht)\b/i,
  /\b(?:france|paris|lyon|marseille|toulouse|bordeaux|nantes)\b/i,
  /\b(?:spain|madrid|barcelona|valencia|seville|bilbao)\b/i,
  /\b(?:italy|milan|rome|turin|naples|florence|bologna)\b/i,
  /\b(?:portugal|lisbon|porto|braga)\b/i,
  /\b(?:sweden|stockholm|gothenburg|malmö|malmo)\b/i,
  /\b(?:denmark|copenhagen|aarhus|odense)\b/i,
  /\b(?:norway|oslo|bergen|trondheim)\b/i,
  /\b(?:finland|helsinki|tampere|espoo)\b/i,
  /\b(?:poland|warsaw|krakow|wroclaw|gdansk|poznan)\b/i,
  /\b(?:romania|bucharest|cluj|timisoara|iasi)\b/i,
  /\b(?:hungary|budapest|debrecen)\b/i,
  /\b(?:czech republic|czechia|prague|brno)\b/i,
  /\b(?:switzerland|zurich|geneva|bern|basel)\b/i,
  /\b(?:austria|vienna|graz|linz)\b/i,
  /\b(?:belgium|brussels|antwerp|ghent)\b/i,
  /\b(?:ukraine|kyiv|kiev|kharkiv|lviv)\b/i,
  /\b(?:israel|tel aviv|jerusalem|haifa)\b/i,
  /\b(?:india|bangalore|bengaluru|hyderabad|pune|mumbai|new delhi|chennai|kolkata|noida|gurugram|gurgaon)\b/i,
  /\b(?:singapore)\b/i,
  /\b(?:australia|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/i,
  /\b(?:new zealand|auckland|wellington|christchurch)\b/i,
  /\b(?:mexico|mexico city|guadalajara|monterrey|puebla)\b/i,
  /\b(?:brazil|sao paulo|são paulo|rio de janeiro|belo horizonte|brasilia|curitiba)\b/i,
  /\b(?:argentina|buenos aires|cordoba|rosario)\b/i,
  /\b(?:colombia|bogota|bogotá|medellín|medellin)\b/i,
  /\b(?:chile|santiago)\b/i,
  /\b(?:latam|latin america|europe|emea|apac|eu only|europe only)\b/i,
  /\b(?:philippines|manila|cebu)\b/i,
  /\b(?:japan|tokyo|osaka|kyoto)\b/i,
  /\b(?:south korea|korea|seoul|busan)\b/i,
  /\b(?:china|beijing|shanghai|shenzhen|guangzhou)\b/i,
  /\b(?:taiwan|taipei)\b/i,
  /\b(?:hong kong)\b/i,
  /\b(?:malaysia|kuala lumpur)\b/i,
  /\b(?:indonesia|jakarta|bali)\b/i,
  /\b(?:thailand|bangkok)\b/i,
  /\b(?:vietnam|ho chi minh|hanoi)\b/i,
  /\b(?:pakistan|karachi|lahore|islamabad)\b/i,
  /\b(?:nigeria|lagos|abuja)\b/i,
  /\b(?:south africa|cape town|johannesburg|durban)\b/i,
  /\b(?:egypt|cairo|alexandria)\b/i,
  /\b(?:turkey|istanbul|ankara|izmir)\b/i,
  /\b(?:saudi arabia|riyadh|jeddah)\b/i,
  /\b(?:uae|dubai|abu dhabi|united arab emirates)\b/i,
]

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
  'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
  'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
]

export type RemoteRegionPolicy = {
  allowedRegions: string[]
  allowUnspecifiedRemote: boolean
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseAllowedRegionsEnv(value: string | undefined): string[] {
  const raw = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return raw && raw.length > 0 ? raw : DEFAULT_REMOTE_ALLOWED_REGIONS
}

function matchesUnitedStates(text: string): boolean {
  if (!text) return false

  const normalized = normalizeText(text)
  if (!normalized) return false

  if (
    /\b(united states|united states only|usa|u s a|u s|us only|u s only|american|remote us|remote usa)\b/.test(normalized)
  ) {
    return true
  }

  if (US_STATE_NAMES.some((name) => normalized.includes(name))) {
    return true
  }

  const upper = text.toUpperCase()
  if (US_STATE_CODES.some((code) => new RegExp(`\\b${code}\\b`).test(upper))) {
    return true
  }

  return false
}

function matchesRegionToken(text: string, token: string): boolean {
  const normalizedToken = normalizeText(token)
  if (!normalizedToken) return false

  if (['us', 'usa', 'united states'].includes(normalizedToken)) {
    return matchesUnitedStates(text)
  }

  return normalizeText(text).includes(normalizedToken)
}

function buildSearchableText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(' ')
    .trim()
}

function matchesForeignLocation(text: string): boolean {
  if (!text) return false
  return FOREIGN_LOCATION_PATTERNS.some((pattern) => pattern.test(text))
}

// Remotive, Jobicy etc. often set candidate_required_location to one of these
// for genuinely open remote roles — treat as unspecified (US-eligible)
const WORLDWIDE_PATTERNS = /\b(?:worldwide|global|anywhere|international|remote only|fully remote|all countries|no restriction)\b/i

function isWorldwideRemote(text: string): boolean {
  if (!text) return false
  return WORLDWIDE_PATTERNS.test(text)
}

export function getRemoteRegionPolicy(): RemoteRegionPolicy {
  return {
    allowedRegions: parseAllowedRegionsEnv(process.env.REMOTE_JOB_ALLOWED_REGIONS),
    allowUnspecifiedRemote: parseBooleanEnv(process.env.REMOTE_JOB_ALLOW_UNSPECIFIED, false),
  }
}

export function buildRemoteRegionPolicyLabel(policy = getRemoteRegionPolicy()): string {
  const regions = policy.allowedRegions.join(', ')
  if (policy.allowUnspecifiedRemote) {
    return `US-focused feed. Remote jobs are limited to ${regions} or unspecified remote listings, and explicit non-US roles are filtered out.`
  }
  return `US-focused feed. Remote jobs are limited to ${regions}, and explicit non-US roles are filtered out.`
}

export function isAllowedRemoteJob(params: {
  isRemote: boolean
  location?: string | null
  description?: string | null
  tags?: string[]
  policy?: RemoteRegionPolicy
}): boolean {
  if (!params.isRemote) return true

  const policy = params.policy ?? getRemoteRegionPolicy()
  const searchable = buildSearchableText([params.location, params.description, ...(params.tags ?? [])])

  if (!searchable) {
    return policy.allowUnspecifiedRemote
  }

  return policy.allowedRegions.some((region) => matchesRegionToken(searchable, region))
}

export function isAllowedJobListing(params: {
  isRemote: boolean
  location?: string | null
  description?: string | null
  tags?: string[]
  policy?: RemoteRegionPolicy
}): boolean {
  const loc = params.location?.trim() ?? ''
  const descAndTags = buildSearchableText([params.description, ...(params.tags ?? [])])

  // Step 1: If location explicitly names a foreign place, reject immediately.
  // Do this BEFORE any US check so that e.g. "Berlin — US clients welcome" is rejected.
  if (loc && matchesForeignLocation(loc)) return false

  // Step 2: If location clearly identifies a US place, allow.
  if (loc && matchesUnitedStates(loc)) return true

  // Step 3: Location is empty, "Remote", "Worldwide", etc. — use description/tags as signal.
  if (params.isRemote) {
    // "Worldwide" / "Global" / "Anywhere" explicitly means all countries welcome — allow
    if (isWorldwideRemote(loc)) return true
    // Reject if description/tags name a foreign location
    if (matchesForeignLocation(descAndTags)) return false
    // Allow if description confirms US
    if (matchesUnitedStates(descAndTags)) return true
    // Otherwise apply unspecified-remote policy
    const policy = params.policy ?? getRemoteRegionPolicy()
    return policy.allowUnspecifiedRemote
  }

  // Non-remote with ambiguous/empty location: reject only if foreign signals found
  return !matchesForeignLocation(descAndTags)
}
