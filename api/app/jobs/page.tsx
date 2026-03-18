import type { Metadata } from 'next'
import { resolveAppBaseUrl, resolveWaitlistMode } from '../app-base-url'
import JobsPage from './jobs-page'

export const metadata: Metadata = {
  title: 'Smart Job Feed — Your personalized job feed from 50+ sources.',
  description:
    'Aggregated from LinkedIn, Indeed, Dice, and dozens more — then ranked by how well each role actually matches your background. See the jobs most likely to want you, first.',
}

export default function JobsLandingPage() {
  return <JobsPage appBaseUrl={resolveAppBaseUrl()} waitlistMode={resolveWaitlistMode()} />
}
