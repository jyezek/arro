import React from 'react'

export default function ResumePreviewFrame({
  html,
  loading,
}: {
  html: string | null
  loading?: boolean
}) {
  if (!html) {
    return (
      <div
        style={{
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(245,240,234,0.55)',
          border: '1px solid rgba(245,240,234,0.08)',
          borderRadius: 16,
          background: 'rgba(245,240,234,0.03)',
        }}
      >
        {loading ? 'Rendering preview…' : 'Preview unavailable'}
      </div>
    )
  }

  return (
    <iframe
      title="Resume preview"
      srcDoc={html}
      style={{
        width: '100%',
        height: 1120,
        border: '1px solid rgba(245,240,234,0.08)',
        borderRadius: 16,
        background: '#f4efe7',
      }}
    />
  )
}
