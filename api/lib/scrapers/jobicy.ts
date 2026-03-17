import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, truncate } from './utils'

const TAGS = ['product-manager', 'product-designer', 'ux-designer', 'marketing', 'operations', 'engineering']

export async function scrapeJobicy(config: SearchConfig): Promise<JobListing[]> {
  if (!config.remote && !config.hybrid) return []

  const jobs: JobListing[] = []

  for (const tag of TAGS) {
    try {
      const { data } = await axios.get('https://jobicy.com/api/v2/remote-jobs', {
        params: { tag, count: 50 },
        headers: JSON_HEADERS,
        timeout: 12000,
      })

      const items = data?.jobs ?? []

      for (const item of items) {
        const title = item.jobTitle
        const company = item.companyName
        if (!title || !company) continue

        const postedAt = item.pubDate ? new Date(item.pubDate) : null
        if (!isWithinDays(postedAt, config.maxDaysOld)) continue

        const text = `${title} ${item.jobDescription ?? ''}`
        if (!matchesKeywords(text, config)) continue

        const externalId = `jobicy:${item.id}`
        if (jobs.find(j => j.externalId === externalId)) continue

        jobs.push({
          externalId,
          source: 'jobicy',
          title,
          company,
          location: item.jobGeo ?? 'Remote',
          url: item.url,
          postedAt,
          salary: item.annualSalaryMin
            ? `$${Math.round(item.annualSalaryMin / 1000)}k–$${Math.round(item.annualSalaryMax / 1000)}k`
            : null,
          jobType: item.jobType ?? 'remote',
          isRemote: true,
          description: truncate(item.jobDescription?.replace(/<[^>]*>/g, '')),
          tags: item.jobIndustry ?? [],
        })
      }
    } catch (err) {
      console.error(`[jobicy] tag "${tag}" failed:`, (err as Error).message)
    }
  }

  return jobs
}
