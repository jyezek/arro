import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, normalizeJobType, truncate } from './utils'

const CATEGORIES = ['product', 'marketing', 'management', 'design', 'all-others']

export async function scrapeRemotive(config: SearchConfig): Promise<JobListing[]> {
  if (!config.remote && !config.hybrid) return []

  const jobs: JobListing[] = []

  for (const category of CATEGORIES) {
    try {
      const { data } = await axios.get('https://remotive.com/api/remote-jobs', {
        params: { category, limit: 100 },
        headers: JSON_HEADERS,
        timeout: 12000,
      })

      const items = data?.jobs ?? []

      for (const item of items) {
        const title = item.title
        const company = item.company_name
        if (!title || !company) continue

        const postedAt = item.publication_date ? new Date(item.publication_date) : null
        if (!isWithinDays(postedAt, config.maxDaysOld)) continue

        const text = `${title} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`
        if (!matchesKeywords(text, config)) continue

        const externalId = `remotive:${item.id}`
        if (jobs.find(j => j.externalId === externalId)) continue

        jobs.push({
          externalId,
          source: 'remotive',
          title,
          company,
          location: item.candidate_required_location || 'Remote',
          url: item.url,
          postedAt,
          salary: item.salary || null,
          jobType: normalizeJobType(item.job_type),
          isRemote: true,
          description: truncate(item.description?.replace(/<[^>]*>/g, '')),
          tags: (item.tags ?? []).slice(0, 6),
        })
      }
    } catch (err) {
      console.error(`[remotive] category "${category}" failed:`, (err as Error).message)
    }
  }

  return jobs
}
