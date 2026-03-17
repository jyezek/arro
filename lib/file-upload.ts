import { Platform } from 'react-native'
import { readAsStringAsync } from 'expo-file-system/legacy'

export type UploadableFile = {
  name: string
  uri: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

async function readFileAsBase64(file: UploadableFile): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri)
    if (!response.ok) throw new Error(`Failed to read ${file.name}`)
    const buffer = await response.arrayBuffer()
    return arrayBufferToBase64(buffer)
  }

  return readAsStringAsync(file.uri, {
    encoding: 'base64',
  })
}

export async function uploadFilesForText(params: {
  apiUrl: string
  token?: string | null
  files: UploadableFile[]
}): Promise<string> {
  const payloadFiles = await Promise.all(
    params.files.map(async (file) => ({
      name: file.name,
      base64: await readFileAsBase64(file),
    })),
  )

  const response = await fetch(`${params.apiUrl}/api/onboarding/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    body: JSON.stringify({ files: payloadFiles }),
  })

  const data = await response.json().catch(() => ({ error: 'Upload failed' }))
  if (!response.ok) {
    throw new Error(data.error ?? 'Upload failed')
  }

  return data.text as string
}
