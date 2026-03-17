import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
} from 'docx'
import type { ResumeContent } from '@/lib/application-artifacts'

export type ResumeTemplate = 'classic' | 'modern' | 'minimal'

type ResumeOwner = {
  firstName: string | null
  lastName: string | null
  email: string
  phone: string | null
  location: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
}

export type ResumeDocumentData = {
  name: string
  contact: {
    email: string
    phone?: string
    location?: string
    linkedin?: string
    website?: string
  }
  summary: string
  experience: {
    title: string
    company: string
    dates: string
    location?: string
    highlights: string[]
  }[]
  keyProducts: {
    name: string
    tagline: string
    highlights: string[]
  }[]
  skillGroups: {
    category: string
    skills: string[]
  }[]
  education: {
    degree: string
    school: string
    year: string
    details?: string
  }[]
  certifications: string[]
  template: ResumeTemplate
}

export function buildResumeDocumentData(params: {
  owner: ResumeOwner
  content: ResumeContent
  template: ResumeTemplate
}): ResumeDocumentData {
  const { owner, content, template } = params
  const name = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || owner.email.split('@')[0]

  return {
    name,
    contact: {
      email: owner.email,
      phone: owner.phone ?? undefined,
      location: owner.location ?? undefined,
      linkedin: owner.linkedinUrl ?? undefined,
      website: owner.portfolioUrl ?? undefined,
    },
    summary: content.summary,
    experience: content.experience.map((item) => ({
      title: item.roleTitle,
      company: item.company,
      dates: [item.startDate, item.endDate].filter(Boolean).join(' – '),
      location: item.location,
      highlights: item.bullets,
    })),
    keyProducts: content.keyProducts.map((item) => ({
      name: item.name,
      tagline: item.tagline,
      highlights: item.highlights,
    })),
    skillGroups: content.skillGroups,
    education: content.education.map((item) => ({
      degree: item.degree,
      school: item.institution,
      year: item.graduationYear,
      details: item.fieldOfStudy,
    })),
    certifications: content.certifications.map((item) =>
      item.issuer ? `${item.name} — ${item.issuer}` : item.name,
    ),
    template,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function contactLine(contact: ResumeDocumentData['contact']) {
  return [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
    contact.website,
  ]
    .filter(Boolean)
    .join('  |  ')
}

function renderSummary(data: ResumeDocumentData) {
  if (!data.summary) return ''
  return `
    <section>
      <h2>Professional Summary</h2>
      <p class="summary">${escapeHtml(data.summary)}</p>
    </section>
  `
}

function renderExperience(data: ResumeDocumentData) {
  if (!data.experience.length) return ''
  return `
    <section>
      <h2>Experience</h2>
      <div class="stack">
        ${data.experience
          .map(
            (item) => `
              <div class="entry">
                <div class="row">
                  <div>
                    <div class="primary">${escapeHtml(item.title)}</div>
                    <div class="secondary">
                      ${escapeHtml(item.company)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}
                    </div>
                  </div>
                  <div class="dates">${escapeHtml(item.dates)}</div>
                </div>
                <ul>
                  ${item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}
                </ul>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderKeyProducts(data: ResumeDocumentData) {
  if (!data.keyProducts.length) return ''
  return `
    <section>
      <h2>Key Products</h2>
      <div class="stack">
        ${data.keyProducts
          .map(
            (item) => `
              <div class="entry">
                <div class="primary">${escapeHtml(item.name)}</div>
                <div class="secondary italic">${escapeHtml(item.tagline)}</div>
                <ul>
                  ${item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}
                </ul>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderSkillGroups(data: ResumeDocumentData) {
  if (!data.skillGroups.length) return ''
  return `
    <section>
      <h2>Skills</h2>
      <div class="stack compact">
        ${data.skillGroups
          .map(
            (item) => `
              <div class="skill-row">
                <span class="skill-category">${escapeHtml(item.category)}:</span>
                <span>${escapeHtml(item.skills.join(', '))}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderEducation(data: ResumeDocumentData) {
  if (!data.education.length) return ''
  return `
    <section>
      <h2>Education</h2>
      <div class="stack compact">
        ${data.education
          .map(
            (item) => `
              <div class="entry compact">
                <div class="primary">${escapeHtml(item.degree)}</div>
                <div class="secondary">
                  ${escapeHtml(item.school)}${item.details ? ` · ${escapeHtml(item.details)}` : ''}${item.year ? ` · ${escapeHtml(item.year)}` : ''}
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderCertifications(data: ResumeDocumentData) {
  if (!data.certifications.length) return ''
  return `
    <section>
      <h2>Certifications</h2>
      <ul class="plain-list">
        ${data.certifications.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `
}

function baseStyles(template: ResumeTemplate) {
  const theme =
    template === 'modern'
      ? {
          pageBackground: '#ffffff',
          surface: '#173b66',
          accent: '#295fa7',
          accentSoft: '#dbe8f7',
          text: '#1f2937',
          muted: '#6b7280',
          font: 'Inter, Arial, sans-serif',
          headingFont: 'Inter, Arial, sans-serif',
          summaryStyle: 'font-style: normal;',
        }
      : template === 'classic'
        ? {
            pageBackground: '#ffffff',
            surface: '#ffffff',
            accent: '#1f2937',
            accentSoft: '#d1d5db',
            text: '#111827',
            muted: '#4b5563',
            font: '"Times New Roman", Georgia, serif',
            headingFont: '"Times New Roman", Georgia, serif',
            summaryStyle: 'font-style: normal;',
          }
        : {
            pageBackground: '#ffffff',
            surface: '#ffffff',
            accent: '#111827',
            accentSoft: '#e5e7eb',
            text: '#1f2937',
            muted: '#6b7280',
            font: 'Inter, Arial, sans-serif',
            headingFont: 'Inter, Arial, sans-serif',
            summaryStyle: 'font-style: italic;',
          }

  const headerStyles =
    template === 'modern'
      ? `
        .resume-header {
          background: ${theme.surface};
          color: #ffffff;
          padding: 34px 40px 28px;
        }
        .resume-header .contact { color: rgba(255,255,255,0.84); }
      `
      : template === 'classic'
        ? `
          .resume-header {
            text-align: center;
            padding: 0 0 18px;
            border-bottom: 2px solid ${theme.accent};
            margin-bottom: 24px;
          }
        `
        : `
          .resume-header {
            padding: 0 0 18px;
            border-bottom: 1px solid ${theme.accentSoft};
            margin-bottom: 24px;
          }
        `

  const h1Styles =
    template === 'minimal'
      ? 'font-size: 33px; font-weight: 300; letter-spacing: -0.04em;'
      : 'font-size: 30px; font-weight: 700; letter-spacing: -0.03em;'

  const sectionHeadingBorder =
    template === 'minimal'
      ? 'border-bottom: none;'
      : `border-bottom: 1px solid ${theme.accentSoft};`

  return `
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #f4efe7;
        color: ${theme.text};
        font-family: ${theme.font};
      }
      body {
        padding: 24px;
      }
      .resume-page {
        width: 8.5in;
        min-height: 11in;
        margin: 0 auto;
        background: ${theme.pageBackground};
        box-shadow: 0 24px 60px rgba(15, 13, 11, 0.18);
      }
      .resume-inner {
        padding: ${template === 'modern' ? '28px 40px 36px' : '34px 42px 38px'};
      }
      ${headerStyles}
      .resume-header h1 {
        margin: 0;
        ${h1Styles}
        font-family: ${theme.headingFont};
      }
      .contact {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.55;
        color: ${theme.muted};
        white-space: pre-wrap;
      }
      section {
        margin-top: 18px;
      }
      h2 {
        margin: 0 0 10px;
        padding-bottom: 6px;
        font-size: ${template === 'minimal' ? '10px' : '11px'};
        line-height: 1;
        font-weight: 700;
        color: ${template === 'modern' ? theme.accent : theme.text};
        text-transform: uppercase;
        letter-spacing: ${template === 'minimal' ? '0.18em' : '0.14em'};
        ${sectionHeadingBorder}
      }
      .summary {
        margin: 0;
        font-size: 12px;
        line-height: 1.65;
        color: ${theme.text};
        ${theme.summaryStyle}
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .stack.compact {
        gap: 8px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
      }
      .entry.compact { gap: 2px; }
      .primary {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        color: ${theme.text};
      }
      .secondary {
        font-size: 11px;
        line-height: 1.45;
        color: ${template === 'modern' ? theme.muted : '#6b7280'};
      }
      .secondary.italic { font-style: italic; }
      .dates {
        font-size: 10px;
        line-height: 1.4;
        color: #9ca3af;
        white-space: nowrap;
      }
      ul {
        margin: 6px 0 0 16px;
        padding: 0;
      }
      li {
        margin: 0 0 4px;
        font-size: 11px;
        line-height: 1.55;
        color: ${theme.text};
      }
      .plain-list {
        margin-top: 0;
      }
      .skill-row {
        font-size: 11px;
        line-height: 1.5;
        color: ${theme.text};
      }
      .skill-category {
        font-weight: 700;
        color: ${template === 'modern' ? theme.accent : theme.text};
      }
      @page {
        size: letter;
        margin: 0.45in;
      }
      @media print {
        html, body {
          background: white;
          padding: 0;
        }
        .resume-page {
          width: auto;
          min-height: auto;
          box-shadow: none;
          margin: 0;
        }
      }
    </style>
  `
}

export function renderResumeHtml(data: ResumeDocumentData, options?: { showBranding?: boolean }) {
  const bodyClass = `template-${data.template}`
  const header = `
    <header class="resume-header">
      <h1>${escapeHtml(data.name)}</h1>
      <div class="contact">${escapeHtml(contactLine(data.contact))}</div>
    </header>
  `

  const sectionMarkup = `
    ${renderSummary(data)}
    ${renderExperience(data)}
    ${renderKeyProducts(data)}
    ${renderSkillGroups(data)}
    ${renderEducation(data)}
    ${renderCertifications(data)}
  `

  const pageMarkup =
    data.template === 'modern'
      ? `
          ${header}
          <div class="resume-inner">
            ${sectionMarkup}
          </div>
        `
      : `
          <div class="resume-inner">
            ${header}
            ${sectionMarkup}
          </div>
        `

  const brandingFooter = options?.showBranding
    ? `<footer style="text-align:center;margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <span style="font-size:10px;color:#c4b8a8;">Resume tailored by Arro &middot; arro.tools</span>
      </footer>`
    : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${baseStyles(data.template)}
      </head>
      <body class="${bodyClass}">
        <div class="resume-page">
          ${pageMarkup}
          ${brandingFooter}
        </div>
      </body>
    </html>
  `
}

function sectionHeading(title: string, color: string, borderColor?: string) {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 20,
        allCaps: true,
        color,
      }),
    ],
    spacing: { before: 180, after: 80 },
    border: borderColor
      ? {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
        }
      : undefined,
  })
}

export function buildResumeDocx(data: ResumeDocumentData, options?: { showBranding?: boolean }): Promise<Buffer> {
  const theme =
    data.template === 'modern'
      ? {
          headerBg: '173B66',
          headerText: 'FFFFFF',
          accent: '295FA7',
          accentSoft: 'DBE8F7',
          body: '1F2937',
          muted: '6B7280',
          font: 'Arial',
          centerHeader: false,
        }
      : data.template === 'classic'
        ? {
            headerBg: undefined,
            headerText: '111827',
            accent: '1F2937',
            accentSoft: '1F2937',
            body: '111827',
            muted: '4B5563',
            font: 'Times New Roman',
            centerHeader: true,
          }
        : {
            headerBg: undefined,
            headerText: '111827',
            accent: '111827',
            accentSoft: 'E5E7EB',
            body: '1F2937',
            muted: '6B7280',
            font: 'Arial',
            centerHeader: false,
          }

  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.name,
          bold: data.template !== 'minimal',
          size: data.template === 'minimal' ? 42 : 38,
          color: theme.headerText,
          font: theme.font,
        }),
      ],
      alignment: theme.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 50 },
      shading: theme.headerBg
        ? { fill: theme.headerBg, type: ShadingType.CLEAR, color: 'auto' }
        : undefined,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: contactLine(data.contact),
          size: 18,
          color: theme.headerBg ? 'E5E7EB' : theme.muted,
          font: theme.font,
        }),
      ],
      alignment: theme.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 140 },
      border: theme.headerBg
        ? {
            bottom: { style: BorderStyle.THICK, size: 12, color: theme.accent },
          }
        : {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.accentSoft },
          },
      shading: theme.headerBg
        ? { fill: theme.headerBg, type: ShadingType.CLEAR, color: 'auto' }
        : undefined,
    }),
  )

  if (data.summary) {
    children.push(
      sectionHeading('Professional Summary', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft),
      new Paragraph({
        children: [
          new TextRun({
            text: data.summary,
            size: 20,
            color: theme.body,
            italics: data.template === 'minimal',
            font: theme.font,
          }),
        ],
      }),
    )
  }

  if (data.experience.length) {
    children.push(sectionHeading('Experience', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft))
    for (const item of data.experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.title, bold: true, size: 20, color: theme.body, font: theme.font }),
            new TextRun({ text: `  ·  ${item.company}`, size: 20, color: theme.muted, font: theme.font }),
          ],
          spacing: { before: 120, after: 30 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: item.dates, size: 17, color: '9CA3AF', font: theme.font }),
            ...(item.location
              ? [new TextRun({ text: `  ·  ${item.location}`, size: 17, color: '9CA3AF', font: theme.font })]
              : []),
          ],
          spacing: { after: 40 },
        }),
      )
      for (const bullet of item.highlights) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: bullet, size: 18, color: theme.body, font: theme.font })],
            bullet: { level: 0 },
            spacing: { after: 30 },
          }),
        )
      }
    }
  }

  if (data.keyProducts.length) {
    children.push(sectionHeading('Key Products', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft))
    for (const item of data.keyProducts) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.name, bold: true, size: 20, color: theme.body, font: theme.font })],
          spacing: { before: 120, after: 20 },
        }),
        new Paragraph({
          children: [new TextRun({ text: item.tagline, size: 18, color: theme.muted, italics: true, font: theme.font })],
          spacing: { after: 35 },
        }),
      )
      for (const highlight of item.highlights) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: highlight, size: 18, color: theme.body, font: theme.font })],
            bullet: { level: 0 },
            spacing: { after: 30 },
          }),
        )
      }
    }
  }

  if (data.skillGroups.length) {
    children.push(sectionHeading('Skills', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft))
    for (const item of data.skillGroups) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${item.category}: `, bold: true, size: 18, color: theme.accent, font: theme.font }),
            new TextRun({ text: item.skills.join(', '), size: 18, color: theme.body, font: theme.font }),
          ],
          spacing: { after: 35 },
        }),
      )
    }
  }

  if (data.education.length) {
    children.push(sectionHeading('Education', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft))
    for (const item of data.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.degree, bold: true, size: 18, color: theme.body, font: theme.font }),
            new TextRun({ text: `  ·  ${item.school}`, size: 18, color: theme.muted, font: theme.font }),
            ...(item.details ? [new TextRun({ text: `  ·  ${item.details}`, size: 18, color: theme.muted, font: theme.font })] : []),
            ...(item.year ? [new TextRun({ text: `  ·  ${item.year}`, size: 18, color: '9CA3AF', font: theme.font })] : []),
          ],
          spacing: { after: 35 },
        }),
      )
    }
  }

  if (data.certifications.length) {
    children.push(sectionHeading('Certifications', theme.accent, data.template === 'minimal' ? undefined : theme.accentSoft))
    for (const item of data.certifications) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item, size: 18, color: theme.body, font: theme.font })],
          bullet: { level: 0 },
          spacing: { after: 30 },
        }),
      )
    }
  }

  if (options?.showBranding) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Resume tailored by Arro · arro.tools',
            size: 14,
            color: 'C4B8A8',
            font: theme.font,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 480 },
      }),
    )
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: theme.font, size: 20 },
        },
      },
    },
  })

  return Packer.toBuffer(document)
}
