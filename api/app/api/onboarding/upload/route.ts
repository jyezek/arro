import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { extractTextFromUpload } from '@/lib/master-resume'

type UploadedFilePayload = {
  name?: string
  base64?: string
}

export async function POST(req: NextRequest) {
  try {
    await getOrCreateUser()
    const texts: string[] = []
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const body = await req.json() as { files?: UploadedFilePayload[] }
      const files = Array.isArray(body.files) ? body.files : []
      if (!files.length) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 })
      }

      for (const file of files) {
        const name = typeof file.name === 'string' ? file.name : ''
        const base64 = typeof file.base64 === 'string' ? file.base64 : ''
        if (!name || !base64) continue
        const buffer = Buffer.from(base64, 'base64')
        const text = await extractTextFromUpload(buffer, name)
        if (text.trim()) texts.push(text.trim())
      }
    } else {
      const formData = await req.formData()
      const files = formData.getAll('files') as Array<{ name?: string; arrayBuffer?: () => Promise<ArrayBuffer> }>
      if (!files.length) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 })
      }

      for (const file of files) {
        if (typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string') continue
        const buffer = Buffer.from(await file.arrayBuffer())
        const text = await extractTextFromUpload(buffer, file.name)
        if (text.trim()) texts.push(text.trim())
      }
    }

    if (!texts.length) {
      return NextResponse.json({ error: 'No text could be extracted from the uploaded files' }, { status: 400 })
    }

    return NextResponse.json({ text: texts.join('\n\n---\n\n') })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/onboarding/upload]', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Upload failed' }, { status: 500 })
  }
}
