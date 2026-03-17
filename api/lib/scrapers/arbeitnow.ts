import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, normalizeJobType, truncate } from './utils'

export async function scrapeArbeitnow(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  try {
    for (let page = 1; page <= 3; page++) {
      const params: Record<string, string | number> = { page }
      if (config.remote) params.remote = 'true'

      const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
        params,
        headers: JSON_HEADERS,
        timeout: 12000,
      })

      const items: Array<Record<string, unknown>> = data?.data ?? []
      if (!items.length) break

      for (const item of items) {
        const title = item.title as string
        const company = item.company_name as string
        if (!title || !company) continue

        const postedAt = item.created_at ? new Date((item.created_at as number) * 1000) : null
        if (!isWithinDays(postedAt, config.maxDaysOld)) break // sorted by date

        const text = `${title} ${item.description ?? ''} ${(item.tags as string[] ?? []).join(' ')}`
        if (!matchesKeywords(text, config)) continue

        jobs.push({
          externalId: `arbeitnow:${item.slug ?? Buffer.from(item.url as string).toString('base64').slice(0, 16)}`,
          source: 'arbeitnow',
          title,
          company,
          location: (item.location as string) ?? (config.remote ? 'Remote' : ''),
          url: item.url as string,
          postedAt,
          salary: null,
          jobType: normalizeJobType((item.job_types as string[] | undefined)?.[0] ?? ''),
          isRemote: (item.remote as boolean) ?? config.remote,
          description: truncate((item.description as string)?.replace(/<[^>]*>/g, '')),
          tags: (item.tags as string[] ?? []).slice(0, 6),
        })
      }
    }
  } catch (err) {
    console.error('[arbeitnow] failed:', (err as Error).message)
  }

  return jobs
}
