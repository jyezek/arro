import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, truncate } from './utils'

const CATEGORIES = ['Product', 'Design', 'Marketing and PR', 'Operations', 'Data and Analytics', 'Project and Program Management']

export async function scrapeTheMuse(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  for (const category of CATEGORIES) {
    try {
      const params: Record<string, string | number> = {
        category,
        page: 1,
        api_key: process.env.THE_MUSE_API_KEY ?? '',
      }

      if (config.remote) {
        params['location'] = 'Flexible / Remote'
      } else if (config.location) {
        params['location'] = `${config.location.city}, ${config.location.state}`
      }

      const { data } = await axios.get('https://www.themuse.com/api/public/jobs', {
        params,
        headers: JSON_HEADERS,
        timeout: 12000,
      })

      const items = data?.results ?? []

      for (const item of items) {
        const title = item.name
        const company = item.company?.name
        if (!title || !company) continue

        const postedAt = item.publication_date ? new Date(item.publication_date) : null
        if (!isWithinDays(postedAt, config.maxDaysOld)) continue

        const text = `${title} ${item.contents ?? ''}`
        if (!matchesKeywords(text, config)) continue

        const locationText = item.locations?.[0]?.name ?? (config.remote ? 'Remote' : '')
        const isRemote = locationText.toLowerCase().includes('remote') || locationText.toLowerCase().includes('flexible')

        jobs.push({
          externalId: `themuse:${item.id}`,
          source: 'themuse',
          title,
          company,
          location: locationText,
          url: item.refs?.landing_page ?? `https://www.themuse.com/jobs/${item.id}`,
          postedAt,
          salary: null,
          jobType: item.type ?? null,
          isRemote,
          description: truncate(item.contents?.replace(/<[^>]*>/g, '')),
          tags: item.categories?.map((c: { name: string }) => c.name) ?? [],
        })
      }
    } catch (err) {
      console.error(`[themuse] category "${category}" failed:`, (err as Error).message)
    }
  }

  return jobs
}
