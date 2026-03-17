import axios from 'axios'
import * as cheerio from 'cheerio'
import type { JobListing, SearchConfig } from './types'
import { BROWSER_HEADERS, sleep, isWithinDays, truncate } from './utils'

const BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const DETAIL_BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting'
const MAX_DETAILS = parseInt(process.env.LINKEDIN_MAX_DETAILS ?? '20')

export async function scrapeLinkedIn(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []
  // First pass: past 24h sorted by date (fewest applicants, freshest)
  // Second pass: past week sorted by date (broader net)
  const passes = [
    { f_TPR: 'r86400', sortBy: 'DD' },
    { f_TPR: 'r604800', sortBy: 'DD' },
  ]

  for (const pass of passes) {
    const pagesPerPass = config.remote ? 1 : 2
    for (let page = 0; page < pagesPerPass; page++) {
    try {
      const params: Record<string, string> = {
        keywords: config.booleanKeywords,
        start: String(page * 25),
        f_TPR: pass.f_TPR,
        sortBy: pass.sortBy,
        // No f_E filter — experience level filtering is better handled by keyword matching
        // and Claude Haiku scoring rather than cutting results at scrape time
      }

      if (config.remote) {
        params.f_WT = '2' // remote
      } else if (config.hybrid) {
        params.f_WT = '3' // hybrid
      } else if (config.location) {
        params.location = config.location.fullName
        params.distance = String(config.location.radiusMiles)
      }

      const { data } = await axios.get(BASE, {
        params,
        headers: BROWSER_HEADERS,
        timeout: 15000,
      })

      const $ = cheerio.load(data)
      const cards = $('li')

      cards.each((_, el) => {
        const $el = $(el)
        const titleEl = $el.find('.base-search-card__title, h3.base-search-card__title')
        const companyEl = $el.find('.base-search-card__subtitle, h4.base-search-card__subtitle')
        const locationEl = $el.find('.job-search-card__location')
        const linkEl = $el.find('a.base-card__full-link, a[data-tracking-id]')
        const timeEl = $el.find('time')
        const easyApply = $el.find('.job-search-card__easy-apply-label').length > 0

        const title = titleEl.text().trim()
        const company = companyEl.text().trim()
        const location = locationEl.text().trim()
        const url = linkEl.attr('href')?.split('?')[0] ?? ''
        const dateText = timeEl.attr('datetime') ?? timeEl.text().trim()
        const postedAt = dateText ? new Date(dateText) : null

        if (!title || !company || !url) return
        if (!isWithinDays(postedAt, config.maxDaysOld)) return

        const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/)
        const externalId = jobIdMatch ? `linkedin:${jobIdMatch[1]}` : `linkedin:${Buffer.from(url).toString('base64').slice(0, 16)}`

        jobs.push({
          externalId,
          source: 'linkedin',
          title,
          company,
          location,
          url,
          postedAt,
          salary: null,
          jobType: null,
          isRemote: location.toLowerCase().includes('remote') || config.remote,
          description: null,
          tags: easyApply ? ['easy-apply'] : [],
        })
      })

      if (page < pagesPerPass - 1) await sleep(1200)
    } catch (err) {
      console.error(`[linkedin] pass ${pass.f_TPR} page ${page} failed:`, (err as Error).message)
    }
    } // end page loop
    await sleep(800) // brief pause between passes
  } // end passes loop

  // Deduplicate by externalId across passes
  const seen = new Set<string>()
  const unique = jobs.filter(j => {
    if (seen.has(j.externalId)) return false
    seen.add(j.externalId)
    return true
  })

  // Fetch details for top N jobs (prioritize fresh ones)
  const toDetail = unique.slice(0, MAX_DETAILS)
  await Promise.allSettled(
    toDetail.map(async (job, i) => {
      await sleep(i * 300)
      const jobIdMatch = job.url.match(/\/jobs\/view\/(\d+)/)
      if (!jobIdMatch) return
      try {
        const { data } = await axios.get(`${DETAIL_BASE}/${jobIdMatch[1]}`, {
          headers: BROWSER_HEADERS,
          timeout: 10000,
        })
        const $ = cheerio.load(data)
        const desc = $('.description__text').text().trim()
        const salary = $('.compensation__salary').text().trim() || null
        const jobType = $('.job-criteria__text').first().text().trim() || null
        const applicantCount = $('.num-applicants__caption, .jobs-unified-top-card__applicant-count')
          .text().trim().match(/(\d[\d,]*)/)?.[1]?.replace(',', '') ?? null
        if (desc) job.description = truncate(desc)
        if (salary) job.salary = salary
        if (jobType) job.jobType = jobType
        // Tag low-competition jobs (< 25 applicants) so they surface higher in scoring
        if (applicantCount && parseInt(applicantCount) < 25) {
          job.tags = [...job.tags, 'few-applicants']
        }
      } catch {}
    })
  )

  return unique
}
