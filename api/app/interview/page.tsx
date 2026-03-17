import type { Metadata } from 'next'
import { resolveAppBaseUrl } from '../app-base-url'
import InterviewPage from './interview-page'

export const metadata: Metadata = {
  title: 'Interview Copilot — Walk into every interview knowing exactly what to say.',
  description:
    'Arro runs a full practice interview, gives you real-time coaching, and lets you pause to ask the copilot anything — personalized to the exact role you\'re applying for.',
}

export default function InterviewLandingPage() {
  return <InterviewPage appBaseUrl={resolveAppBaseUrl()} />
}
