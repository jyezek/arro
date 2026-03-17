import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, truncate } from './utils'

export async function scrapeRemoteOK(config: SearchConfig): Promise<JobListing[]> {
  // RemoteOK is remote-only — only fetch if user wants remote/hybrid
  if (!config.remote && !config.hybrid) return []

  const jobs: JobListing[] = []

  try {
    const { data } = await axios.get('https://remoteok.com/api', {
      headers: { ...JSON_HEADERS, 'Accept': 'application/json' },
      timeout: 12000,
    })

    // First item is metadata
    const items = Array.isArray(data) ? data.slice(1) : []

    for (const item of items) {
      const title = item.position
      const company = item.company
      if (!title || !company) continue

      const postedAt = item.epoch ? new Date(item.epoch * 1000) : null
      if (!isWithinDays(postedAt, config.maxDaysOld)) continue

      const text = `${title} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`
      if (!matchesKeywords(text, config)) continue

      jobs.push({
        externalId: `remoteok:${item.id ?? item.slug}`,
        source: 'remoteok',
        title,
        company,
        location: 'Remote',
        url: item.url ?? `https://remoteok.com/remote-jobs/${item.slug}`,
        postedAt,
        salary: item.salary_min
          ? `$${Math.round(item.salary_min / 1000)}k–$${Math.round((item.salary_max ?? item.salary_min) / 1000)}k`
          : null,
        jobType: 'remote',
        isRemote: true,
        description: truncate(item.description),
        tags: (item.tags ?? []).slice(0, 8),
      })
    }
  } catch (err) {
    console.error('[remoteok] failed:', (err as Error).message)
  }

  return jobs
}
