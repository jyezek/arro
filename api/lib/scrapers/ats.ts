import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, normalizeJobType, truncate } from './utils'

type FeedType = 'greenhouse' | 'lever'

type AtsFeedConfig = {
  type: FeedType
  token: string
  company?: string
}

function getConfiguredAtsFeeds(): AtsFeedConfig[] {
  const raw = process.env.JOB_BOARD_FEEDS?.trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []

      const type = typeof item.type === 'string' ? item.type.trim().toLowerCase() : ''
      const token = typeof item.token === 'string' ? item.token.trim() : ''
      const company = typeof item.company === 'string' ? item.company.trim() : undefined

      if (!token || (type !== 'greenhouse' && type !== 'lever')) {
        return []
      }

      return [{ type, token, company }]
    })
  } catch (error) {
    console.error('[ats] invalid JOB_BOARD_FEEDS config:', (error as Error).message)
    return []
  }
}

function normalizeCompanyName(feed: AtsFeedConfig): string {
  return feed.company?.trim() || feed.token.replace(/[-_]+/g, ' ')
}

function normalizeLocation(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return ''
}

async function scrapeGreenhouseFeed(feed: AtsFeedConfig, config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  try {
    const { data } = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${feed.token}/jobs`, {
      params: { content: true },
      headers: JSON_HEADERS,
      timeout: 12000,
    })

    const items = Array.isArray(data?.jobs) ? data.jobs : []
    for (const item of items) {
      const title = typeof item?.title === 'string' ? item.title : ''
      if (!title) continue

      const postedAt = item?.updated_at ? new Date(item.updated_at as string) : null
      if (!isWithinDays(postedAt, config.maxDaysOld)) continue

      const location = normalizeLocation(item?.location)
      const content = typeof item?.content === 'string' ? item.content.replace(/<[^>]*>/g, ' ') : ''
      const text = `${title} ${location} ${content}`
      if (!matchesKeywords(text, config)) continue

      jobs.push({
        externalId: `greenhouse:${feed.token}:${String(item?.id ?? title).slice(0, 64)}`,
        source: 'greenhouse',
        title,
        company: normalizeCompanyName(feed),
        location,
        url: typeof item?.absolute_url === 'string' ? item.absolute_url : '',
        postedAt,
        salary: null,
        jobType: normalizeJobType(
          typeof item?.metadata?.employment_type === 'string'
            ? item.metadata.employment_type
            : typeof item?.metadata?.commitment === 'string'
              ? item.metadata.commitment
              : '',
        ),
        isRemote: /remote/i.test(location) || /remote/i.test(content),
        description: truncate(content),
        tags: [],
      })
    }
  } catch (error) {
    console.error(`[greenhouse:${feed.token}] failed:`, (error as Error).message)
  }

  return jobs
}

async function scrapeLeverFeed(feed: AtsFeedConfig, config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  try {
    const { data } = await axios.get(`https://api.lever.co/v0/postings/${feed.token}`, {
      params: { mode: 'json' },
      headers: JSON_HEADERS,
      timeout: 12000,
    })

    const items = Array.isArray(data) ? data : []
    for (const item of items) {
      const title = typeof item?.text === 'string' ? item.text : ''
      if (!title) continue

      const postedAt = item?.createdAt ? new Date(item.createdAt as number) : null
      if (!isWithinDays(postedAt, config.maxDaysOld)) continue

      const categories = item?.categories && typeof item.categories === 'object' ? item.categories : {}
      const location =
        (typeof categories?.location === 'string' && categories.location) ||
        (typeof item?.workplaceType === 'string' && item.workplaceType) ||
        ''
      const description = typeof item?.descriptionPlain === 'string'
        ? item.descriptionPlain
        : typeof item?.description === 'string'
          ? item.description.replace(/<[^>]*>/g, ' ')
          : ''
      const text = `${title} ${location} ${description}`
      if (!matchesKeywords(text, config)) continue

      jobs.push({
        externalId: `lever:${feed.token}:${String(item?.id ?? title).slice(0, 64)}`,
        source: 'lever',
        title,
        company: normalizeCompanyName(feed),
        location,
        url: typeof item?.hostedUrl === 'string' ? item.hostedUrl : '',
        postedAt,
        salary: null,
        jobType: normalizeJobType(typeof categories?.commitment === 'string' ? categories.commitment : ''),
        isRemote: /remote/i.test(location) || /remote/i.test(description),
        description: truncate(description),
        tags: [
          typeof categories?.team === 'string' ? categories.team : '',
          typeof categories?.department === 'string' ? categories.department : '',
        ].filter(Boolean),
      })
    }
  } catch (error) {
    console.error(`[lever:${feed.token}] failed:`, (error as Error).message)
  }

  return jobs
}

export async function scrapeConfiguredAtsFeeds(config: SearchConfig): Promise<JobListing[]> {
  const feeds = getConfiguredAtsFeeds()
  if (feeds.length === 0) return []

  const settled = await Promise.allSettled(
    feeds.map((feed) => (feed.type === 'greenhouse' ? scrapeGreenhouseFeed(feed, config) : scrapeLeverFeed(feed, config))),
  )

  return settled.flatMap((result) => {
    if (result.status === 'fulfilled') return result.value
    return []
  })
}
