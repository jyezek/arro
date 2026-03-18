import type { Metadata } from 'next'
import { resolveAppBaseUrl, resolveWaitlistMode } from '../app-base-url'
import PrepKitPage from './prep-kit-page'

export const metadata: Metadata = {
  title: 'Prep Kit — Everything your application needs. One tap.',
  description:
    'Cover letter, screening answers, follow-up emails — all generated from your master profile and the job description. A full application kit for every role, in seconds.',
}

export default function PrepKitLandingPage() {
  return <PrepKitPage appBaseUrl={resolveAppBaseUrl()} waitlistMode={resolveWaitlistMode()} />
}
