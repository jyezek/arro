function normalizeBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function resolveAppBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.EXPO_ORIGIN)
}
