import type { Metadata } from 'next'
import { resolveAppBaseUrl } from '../app-base-url'
import ResumePage from './resume-page'

export const metadata: Metadata = {
  title: 'Resume Builder — One resume. Tailored for every job — automatically.',
  description:
    'Upload once. Arro reads every job description and pulls the most relevant pieces of your background. Every application gets a resume that reads like it was written for that specific role.',
}

export default function ResumeLandingPage() {
  return <ResumePage appBaseUrl={resolveAppBaseUrl()} />
}
