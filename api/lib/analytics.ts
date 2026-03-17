// PostHog server-side analytics
import { PostHog } from 'posthog-node'

let _client: PostHog | null = null

function getClient(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST ?? 'https://app.posthog.com',
    })
  }
  return _client
}

export function track(userId: string, event: string, properties?: Record<string, unknown>) {
  const client = getClient()
  if (!client) return
  client.capture({ distinctId: userId, event, properties })
}

export async function shutdown() {
  await _client?.shutdown()
}
