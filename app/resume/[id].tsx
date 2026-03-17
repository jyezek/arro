import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import ResumePreviewFrame from '@/components/ResumePreviewFrame'
import { Colors, FontSize, Radius, Spacing, wm, orangeAlpha } from '@/constants/Colors'
import { API_URL, apiRequest } from '@/lib/api'

type ResumeContent = {
  summary: string
  experience: {
    roleTitle: string
    company: string
    startDate: string
    endDate: string
    location?: string
    bullets: string[]
  }[]
  keyProducts: {
    name: string
    tagline: string
    highlights: string[]
  }[]
  education: {
    degree: string
    institution: string
    graduationYear: string
    fieldOfStudy?: string
  }[]
  skillGroups: {
    category: string
    skills: string[]
  }[]
  certifications: {
    name: string
    issuer?: string
  }[]
}

type ResumeSectionKey =
  | 'summary'
  | 'experience'
  | 'keyProducts'
  | 'skillGroups'
  | 'education'
  | 'certifications'

type ResumeTemplate = 'classic' | 'modern' | 'minimal'

type GeneratedResume = {
  id: string
  status: string
  content: string
  template: ResumeTemplate
  tailoredSections: string | null
  tailoringReason: string | null
  createdAt: string
  job: { title: string; company: string } | null
}

const TEMPLATE_OPTIONS: { key: ResumeTemplate; label: string; description: string }[] = [
  { key: 'classic', label: 'Classic', description: 'Recruiter-safe, strong hierarchy, ATS-friendly.' },
  { key: 'modern', label: 'Modern', description: 'Sharper section treatment with a stronger visual rhythm.' },
  { key: 'minimal', label: 'Minimal', description: 'Cleaner, tighter, and stripped back for senior roles.' },
]

const SECTION_ORDER: ResumeSectionKey[] = [
  'summary',
  'experience',
  'keyProducts',
  'skillGroups',
  'education',
  'certifications',
]

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  experience: 'Experience',
  keyProducts: 'Key Products',
  skillGroups: 'Skills',
  education: 'Education',
  certifications: 'Certifications',
}

const SECTION_HELP: Record<ResumeSectionKey, string> = {
  summary: 'Edit the summary directly.',
  experience: 'Use blocks with Role, Company, Dates, optional Location, then bullet lines. Separate roles with ---',
  keyProducts: 'Use blocks with Name, Tagline, and bullet lines. Separate products with ---',
  skillGroups: 'Use one line per group in the format Category: skill, skill, skill',
  education: 'Use blocks with Degree, Institution, Year, and optional Field. Separate entries with ---',
  certifications: 'Use one line per certification in the format Name | Issuer',
}

export default function ResumeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [resume, setResume] = useState<GeneratedResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingSection, setEditingSection] = useState<ResumeSectionKey | null>(null)
  const [editorText, setEditorText] = useState('')
  const [savingSection, setSavingSection] = useState<ResumeSectionKey | null>(null)
  const [regeneratingSection, setRegeneratingSection] = useState<ResumeSectionKey | 'all' | null>(null)
  const [updatingTemplate, setUpdatingTemplate] = useState<ResumeTemplate | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    void fetchResume()
  }, [id])

  const content = useMemo(() => parseResumeContent(resume?.content), [resume?.content])
  const tailoredSections = useMemo(() => parseStringArray(resume?.tailoredSections), [resume?.tailoredSections])

  useEffect(() => {
    if (!resume) return

    let cancelled = false
    const loadPreview = async () => {
      try {
        setLoadingPreview(true)
        const token = await getToken()
        const data = await apiRequest<{ html: string }>(
          `/api/resume/${resume.id}/preview`,
          {
            method: 'POST',
            body: JSON.stringify({
              content,
              template: resume.template,
            }),
          },
          token,
        )
        if (!cancelled) setPreviewHtml(data.html)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to render preview:', err)
          setPreviewHtml(null)
        }
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [resume, content, getToken])

  const fetchResume = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ resume: GeneratedResume }>(`/api/resume/${id}`, {}, token)
      setResume(data.resume)
    } catch (err) {
      console.error('Failed to fetch resume:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!resume) return
    try {
      await Share.share({ message: buildPlainText(parseResumeContent(resume.content)), title: 'Tailored resume' })
    } catch {}
  }

  const startEditing = (section: ResumeSectionKey) => {
    setEditingSection(section)
    setEditorText(serializeSection(section, content))
  }

  const cancelEditing = () => {
    setEditingSection(null)
    setEditorText('')
  }

  const saveSection = async (section: ResumeSectionKey) => {
    if (!resume) return

    try {
      const nextContent = parseSection(section, editorText, content)
      setSavingSection(section)

      const token = await getToken()
      const data = await apiRequest<{ resume: GeneratedResume }>(
        `/api/resume/${resume.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            content: nextContent,
            status: 'draft',
          }),
        },
        token,
      )

      setResume(data.resume)
      cancelEditing()
    } catch (err) {
      console.error('Failed to save section:', err)
      Alert.alert('Could not save section', err instanceof Error ? err.message : 'Please check the format and try again.')
    } finally {
      setSavingSection(null)
    }
  }

  const regenerateSection = async (section: ResumeSectionKey | 'all') => {
    if (!resume) return

    try {
      setRegeneratingSection(section)
      const token = await getToken()
      const data = await apiRequest<{ resume: GeneratedResume }>(
        `/api/resume/${resume.id}`,
        {
          method: 'POST',
          body: JSON.stringify({ section }),
        },
        token,
      )
      setResume(data.resume)
      if (editingSection === section) cancelEditing()
    } catch (err) {
      console.error('Failed to regenerate section:', err)
      Alert.alert('Could not regenerate section', 'Try again in a moment.')
    } finally {
      setRegeneratingSection(null)
    }
  }

  const updateTemplate = async (template: ResumeTemplate) => {
    if (!resume || template === resume.template) return

    try {
      setUpdatingTemplate(template)
      const token = await getToken()
      const data = await apiRequest<{ resume: GeneratedResume }>(
        `/api/resume/${resume.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ template }),
        },
        token,
      )
      setResume(data.resume)
    } catch (err) {
      console.error('Failed to update template:', err)
      Alert.alert('Could not update template', 'Try again in a moment.')
    } finally {
      setUpdatingTemplate(null)
    }
  }

  const handleDownloadDocx = async () => {
    if (!resume) return
    if (editingSection) {
      Alert.alert('Save edits first', 'Export uses the saved resume state. Save or cancel your current edits first.')
      return
    }
    if (Platform.OS !== 'web') {
      Alert.alert('Web export only', 'DOCX export is currently available on web.')
      return
    }

    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/resume/${resume.id}/docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content,
          template: resume.template,
        }),
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      link.download = match?.[1] ?? 'resume.docx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export DOCX:', err)
      Alert.alert('Could not export DOCX', 'Try again in a moment.')
    }
  }

  const handleExportPdf = async () => {
    if (editingSection) {
      Alert.alert('Save edits first', 'Save or cancel your current edits before exporting PDF.')
      return
    }
    if (Platform.OS !== 'web' || !previewHtml) {
      Alert.alert('Web export only', 'PDF export is currently available on web.')
      return
    }

    const popup = window.open('', '_blank')
    if (!popup) {
      Alert.alert('Popup blocked', 'Allow popups for this site and try again.')
      return
    }

    popup.document.open()
    popup.document.write(previewHtml)
    popup.document.close()
    popup.focus()
    window.setTimeout(() => {
      popup.print()
    }, 250)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Loading resume…</Text>
      </View>
    )
  }

  if (!resume || resume.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Generating your tailored resume…</Text>
        <Text style={styles.loadingSubtext}>This takes about 15 seconds</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Tailored Resume</Text>
          {resume.job ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {resume.job.title} · {resume.job.company}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={handleShare} style={styles.shareBtn} hitSlop={10}>
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Resume Draft</Text>
              <Text style={styles.heroTitle}>Preview, templates, and export</Text>
              <Text style={styles.heroText}>
                This preview is the export source. Switch templates here, save edits below, then export the same document as Word or PDF.
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                style={[styles.heroAction, editingSection && styles.heroActionDisabled]}
                onPress={handleDownloadDocx}
                disabled={!!editingSection}
              >
                <Text style={styles.heroActionText}>Word</Text>
              </Pressable>
              <Pressable
                style={[styles.heroAction, editingSection && styles.heroActionDisabled]}
                onPress={handleExportPdf}
                disabled={!!editingSection}
              >
                <Text style={styles.heroActionText}>PDF</Text>
              </Pressable>
              <Pressable
                style={styles.heroActionSecondary}
                onPress={() => regenerateSection('all')}
                disabled={regeneratingSection === 'all'}
              >
                <Text style={styles.heroActionSecondaryText}>
                  {regeneratingSection === 'all' ? 'Regenerating…' : 'Regenerate all'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.templateGrid}>
            {TEMPLATE_OPTIONS.map((option) => {
              const selected = resume.template === option.key
              const pending = updatingTemplate === option.key
              return (
                <Pressable
                  key={option.key}
                  style={[styles.templateCard, selected && styles.templateCardActive]}
                  onPress={() => updateTemplate(option.key)}
                  disabled={!!updatingTemplate}
                >
                  <View style={styles.templateHeader}>
                    <Text style={[styles.templateLabel, selected && styles.templateLabelActive]}>{option.label}</Text>
                    {selected ? <Text style={styles.templateSelected}>Selected</Text> : null}
                    {pending ? <Text style={styles.templatePending}>Saving…</Text> : null}
                  </View>
                  <Text style={[styles.templateDescription, selected && styles.templateDescriptionActive]}>
                    {option.description}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {resume.tailoringReason ? (
          <View style={styles.tailoringBanner}>
            <Text style={styles.tailoringLabel}>TAILORED FOR THIS ROLE</Text>
            <Text style={styles.tailoringText}>{resume.tailoringReason}</Text>
            {tailoredSections.length > 0 ? (
              <View style={styles.tailoredPills}>
                {tailoredSections.map((item) => (
                  <View key={item} style={styles.tailoredPill}>
                    <Text style={styles.tailoredPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderCopy}>
              <Text style={styles.previewLabel}>Document Preview</Text>
              <Text style={styles.previewText}>
                The template preview matches the exported layout. Save section edits before exporting.
              </Text>
            </View>
            {editingSection ? (
              <View style={styles.unsavedBadge}>
                <Text style={styles.unsavedBadgeText}>Save current edit to refresh preview</Text>
              </View>
            ) : null}
          </View>
          <ResumePreviewFrame html={previewHtml} loading={loadingPreview} />
        </View>

        {SECTION_ORDER.map((section) => (
          <View key={section} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>{SECTION_LABELS[section]}</Text>
                <Text style={styles.sectionHint}>{SECTION_HELP[section]}</Text>
              </View>
              <View style={styles.sectionActions}>
                {tailoredSections.includes(section) ? (
                  <View style={styles.tailoredBadge}>
                    <Text style={styles.tailoredBadgeText}>Tailored</Text>
                  </View>
                ) : null}
                {editingSection === section ? (
                  <>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnGhost]}
                      onPress={cancelEditing}
                      disabled={savingSection === section}
                    >
                      <Text style={styles.actionGhostText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => saveSection(section)}
                      disabled={savingSection === section}
                    >
                      <Text style={styles.actionPrimaryText}>
                        {savingSection === section ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnGhost]}
                      onPress={() => regenerateSection(section)}
                      disabled={regeneratingSection === section}
                    >
                      <Text style={styles.actionGhostText}>
                        {regeneratingSection === section ? 'Working…' : 'Regenerate'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => startEditing(section)}
                    >
                      <Text style={styles.actionPrimaryText}>Edit</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            <View style={styles.sectionCard}>
              {editingSection === section ? (
                <TextInput
                  value={editorText}
                  onChangeText={setEditorText}
                  multiline
                  autoCapitalize="sentences"
                  textAlignVertical="top"
                  style={styles.editor}
                  placeholderTextColor={wm(0.22)}
                />
              ) : (
                <ResumeSectionPreview section={section} content={content} />
              )}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function ResumeSectionPreview({
  section,
  content,
}: {
  section: ResumeSectionKey
  content: ResumeContent
}) {
  if (section === 'summary') {
    return <Text style={styles.bodyText}>{content.summary || 'No summary yet.'}</Text>
  }

  if (section === 'experience') {
    if (!content.experience.length) return <EmptyState text="No experience entries yet." />
    return (
      <View style={styles.previewStack}>
        {content.experience.map((item, index) => (
          <View key={`${item.company}-${index}`} style={[styles.expItem, index > 0 && styles.itemBorder]}>
            <View style={styles.expHeader}>
              <Text style={styles.expRole}>{item.roleTitle}</Text>
              <Text style={styles.expDate}>{item.startDate}–{item.endDate}</Text>
            </View>
            <Text style={styles.expCompany}>
              {item.company}{item.location ? ` · ${item.location}` : ''}
            </Text>
            {item.bullets.map((bullet, bulletIndex) => (
              <View key={`${bulletIndex}-${bullet}`} style={styles.bullet}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (section === 'keyProducts') {
    if (!content.keyProducts.length) return <EmptyState text="No key products yet." />
    return (
      <View style={styles.previewStack}>
        {content.keyProducts.map((item, index) => (
          <View key={`${item.name}-${index}`} style={[styles.productItem, index > 0 && styles.itemBorder]}>
            <Text style={styles.expRole}>{item.name}</Text>
            <Text style={styles.productTagline}>{item.tagline}</Text>
            {item.highlights.map((highlight, highlightIndex) => (
              <View key={`${highlightIndex}-${highlight}`} style={styles.bullet}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (section === 'skillGroups') {
    if (!content.skillGroups.length) return <EmptyState text="No skill groups yet." />
    return (
      <View style={styles.previewStack}>
        {content.skillGroups.map((group) => (
          <View key={group.category} style={styles.skillGroup}>
            <Text style={styles.skillCat}>{group.category}</Text>
            <Text style={styles.skillList}>{group.skills.join(', ')}</Text>
          </View>
        ))}
      </View>
    )
  }

  if (section === 'education') {
    if (!content.education.length) return <EmptyState text="No education entries yet." />
    return (
      <View style={styles.previewStack}>
        {content.education.map((item, index) => (
          <View key={`${item.institution}-${index}`} style={[styles.eduItem, index > 0 && styles.itemBorder]}>
            <Text style={styles.expRole}>{item.degree}</Text>
            <Text style={styles.expCompany}>
              {item.institution}
              {item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}
              {item.graduationYear ? ` · ${item.graduationYear}` : ''}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  if (!content.certifications.length) return <EmptyState text="No certifications yet." />
  return (
    <View style={styles.previewStack}>
      {content.certifications.map((item, index) => (
        <View key={`${item.name}-${index}`} style={[styles.eduItem, index > 0 && styles.itemBorder]}>
          <Text style={styles.expRole}>{item.name}</Text>
          {item.issuer ? <Text style={styles.expCompany}>{item.issuer}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>
}

function parseResumeContent(raw?: string | null): ResumeContent {
  try {
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      summary: parsed.summary ?? '',
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      keyProducts: Array.isArray(parsed.keyProducts) ? parsed.keyProducts : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      skillGroups: Array.isArray(parsed.skillGroups) ? parsed.skillGroups : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    }
  } catch {
    return {
      summary: '',
      experience: [],
      keyProducts: [],
      education: [],
      skillGroups: [],
      certifications: [],
    }
  }
}

function parseStringArray(raw?: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function serializeSection(section: ResumeSectionKey, content: ResumeContent): string {
  switch (section) {
    case 'summary':
      return content.summary
    case 'experience':
      return content.experience
        .map((item) =>
          [
            `Role: ${item.roleTitle}`,
            `Company: ${item.company}`,
            `Dates: ${item.startDate} -> ${item.endDate}`,
            item.location ? `Location: ${item.location}` : null,
            'Bullets:',
            ...item.bullets.map((bullet) => `- ${bullet}`),
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n---\n\n')
    case 'keyProducts':
      return content.keyProducts
        .map((item) =>
          [
            `Name: ${item.name}`,
            `Tagline: ${item.tagline}`,
            'Highlights:',
            ...item.highlights.map((highlight) => `- ${highlight}`),
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n---\n\n')
    case 'skillGroups':
      return content.skillGroups.map((group) => `${group.category}: ${group.skills.join(', ')}`).join('\n')
    case 'education':
      return content.education
        .map((item) =>
          [
            `Degree: ${item.degree}`,
            `Institution: ${item.institution}`,
            `Year: ${item.graduationYear}`,
            item.fieldOfStudy ? `Field: ${item.fieldOfStudy}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n---\n\n')
    case 'certifications':
      return content.certifications.map((item) => `${item.name}${item.issuer ? ` | ${item.issuer}` : ''}`).join('\n')
  }
}

function parseSection(section: ResumeSectionKey, raw: string, current: ResumeContent): ResumeContent {
  switch (section) {
    case 'summary':
      return { ...current, summary: raw.trim() }
    case 'experience':
      return { ...current, experience: parseExperience(raw) }
    case 'keyProducts':
      return { ...current, keyProducts: parseKeyProducts(raw) }
    case 'skillGroups':
      return { ...current, skillGroups: parseSkillGroups(raw) }
    case 'education':
      return { ...current, education: parseEducation(raw) }
    case 'certifications':
      return { ...current, certifications: parseCertifications(raw) }
  }
}

function splitBlocks(raw: string): string[] {
  return raw
    .split(/\n\s*---+\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function getLineValue(block: string, label: string): string {
  const match = block.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() ?? ''
}

function parseBullets(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-•]/.test(line))
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}

function parseExperience(raw: string): ResumeContent['experience'] {
  if (!raw.trim()) return []

  return splitBlocks(raw).map((block) => {
    const roleTitle = getLineValue(block, 'Role')
    const company = getLineValue(block, 'Company')
    const dates = getLineValue(block, 'Dates')
    const [startDate = '', endDate = ''] = dates.split(/\s*->\s*/)
    const location = getLineValue(block, 'Location')
    const bullets = parseBullets(block)

    if (!roleTitle || !company) {
      throw new Error('Each experience block needs both Role and Company.')
    }

    return {
      roleTitle,
      company,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      location: location || undefined,
      bullets,
    }
  })
}

function parseKeyProducts(raw: string): ResumeContent['keyProducts'] {
  if (!raw.trim()) return []

  return splitBlocks(raw).map((block) => {
    const name = getLineValue(block, 'Name')
    const tagline = getLineValue(block, 'Tagline')
    const highlights = parseBullets(block)

    if (!name) throw new Error('Each product block needs a Name.')

    return {
      name,
      tagline,
      highlights,
    }
  })
}

function parseSkillGroups(raw: string): ResumeContent['skillGroups'] {
  if (!raw.trim()) return []

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [category, ...rest] = line.split(':')
      if (!category || rest.length === 0) {
        throw new Error('Each skill group line must look like "Category: skill, skill".')
      }
      return {
        category: category.trim(),
        skills: rest
          .join(':')
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      }
    })
}

function parseEducation(raw: string): ResumeContent['education'] {
  if (!raw.trim()) return []

  return splitBlocks(raw).map((block) => {
    const degree = getLineValue(block, 'Degree')
    const institution = getLineValue(block, 'Institution')
    const graduationYear = getLineValue(block, 'Year')
    const fieldOfStudy = getLineValue(block, 'Field')

    if (!institution) throw new Error('Each education block needs an Institution.')

    return {
      degree,
      institution,
      graduationYear,
      fieldOfStudy: fieldOfStudy || undefined,
    }
  })
}

function parseCertifications(raw: string): ResumeContent['certifications'] {
  if (!raw.trim()) return []

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, issuer] = line.split('|').map((part) => part.trim())
      if (!name) throw new Error('Each certification line needs a name.')
      return { name, issuer: issuer || undefined }
    })
}

function buildPlainText(content: ResumeContent): string {
  const lines: string[] = []
  if (content.summary) lines.push(content.summary, '')
  content.experience.forEach((item) => {
    lines.push(`${item.roleTitle} — ${item.company} (${item.startDate}–${item.endDate})`)
    item.bullets.forEach((bullet) => lines.push(`• ${bullet}`))
    lines.push('')
  })
  content.keyProducts.forEach((item) => {
    lines.push(`${item.name} — ${item.tagline}`)
    item.highlights.forEach((highlight) => lines.push(`• ${highlight}`))
    lines.push('')
  })
  content.education.forEach((item) => lines.push(`${item.degree} — ${item.institution} (${item.graduationYear})`))
  content.skillGroups.forEach((group) => lines.push(`${group.category}: ${group.skills.join(', ')}`))
  content.certifications.forEach((item) => lines.push(item.issuer ? `${item.name} — ${item.issuer}` : item.name))
  return lines.join('\n')
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[4], backgroundColor: Colors.dark },
  loadingText: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.85) },
  loadingSubtext: { fontSize: FontSize.md, color: wm(0.4) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  backBtn: { width: 36 },
  backIcon: { fontSize: 24, color: wm(0.7), fontWeight: '300' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.9) },
  headerSub: { fontSize: FontSize.sm, color: wm(0.4), marginTop: 1 },
  shareBtn: { width: 40, alignItems: 'flex-end' },
  shareBtnText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[7], gap: Spacing[5] },
  heroCard: {
    backgroundColor: Colors.dark2,
    borderRadius: Radius.artifact,
    borderWidth: 1,
    borderColor: orangeAlpha(0.18),
    padding: Spacing[6],
    gap: Spacing[5],
  },
  heroHeader: { gap: Spacing[4] },
  heroCopy: { gap: Spacing[2] },
  heroEyebrow: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, letterSpacing: 0.8 },
  heroTitle: { fontSize: FontSize['2xl'], fontWeight: '700', color: wm(0.92) },
  heroText: { fontSize: FontSize.base, color: wm(0.58), lineHeight: 18 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  heroAction: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.orange,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  heroActionDisabled: { opacity: 0.5 },
  heroActionSecondary: {
    alignSelf: 'flex-start',
    backgroundColor: wm(0.04),
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: wm(0.08),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionSecondaryText: { fontSize: FontSize.sm, fontWeight: '700', color: wm(0.72) },
  templateGrid: { gap: Spacing[3] },
  templateCard: {
    backgroundColor: wm(0.03),
    borderRadius: Radius.template,
    borderWidth: 1,
    borderColor: wm(0.08),
    padding: Spacing[5],
    gap: Spacing[2],
  },
  templateCardActive: {
    borderColor: orangeAlpha(0.34),
    backgroundColor: orangeAlpha(0.08),
  },
  templateHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing[2] },
  templateLabel: { fontSize: FontSize.md, fontWeight: '700', color: wm(0.86) },
  templateLabelActive: { color: Colors.orange },
  templateSelected: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, textTransform: 'uppercase' },
  templatePending: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.42), textTransform: 'uppercase' },
  templateDescription: { fontSize: FontSize.base, color: wm(0.52), lineHeight: 18 },
  templateDescriptionActive: { color: wm(0.72) },
  tailoringBanner: {
    backgroundColor: orangeAlpha(0.08),
    borderRadius: Radius.card,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: orangeAlpha(0.15),
    gap: Spacing[3],
  },
  tailoringLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, letterSpacing: 0.6 },
  tailoringText: { fontSize: FontSize.base, color: wm(0.76), lineHeight: 18 },
  tailoredPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  tailoredPill: { backgroundColor: Colors.orange, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tailoredPillText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.white, textTransform: 'capitalize' },
  previewCard: {
    backgroundColor: Colors.dark2,
    borderRadius: Radius.artifact,
    borderWidth: 1,
    borderColor: wm(0.08),
    padding: Spacing[5],
    gap: Spacing[4],
  },
  previewHeader: { gap: Spacing[3] },
  previewHeaderCopy: { gap: 4 },
  previewLabel: { fontSize: FontSize.md, fontWeight: '700', color: wm(0.9) },
  previewText: { fontSize: FontSize.base, color: wm(0.5), lineHeight: 18 },
  unsavedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: orangeAlpha(0.1),
    borderWidth: 1,
    borderColor: orangeAlpha(0.16),
    borderRadius: Radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unsavedBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange },
  section: { gap: Spacing[3] },
  sectionHeader: { gap: Spacing[3] },
  sectionHeaderCopy: { gap: 4 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: wm(0.9), letterSpacing: -0.2 },
  sectionHint: { fontSize: FontSize.sm, color: wm(0.36), lineHeight: 16 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing[2] },
  tailoredBadge: {
    backgroundColor: orangeAlpha(0.12),
    borderColor: orangeAlpha(0.18),
    borderWidth: 1,
    borderRadius: Radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tailoredBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.orange },
  actionBtn: {
    borderRadius: Radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  actionBtnGhost: { borderColor: wm(0.09), backgroundColor: wm(0.03) },
  actionBtnPrimary: { borderColor: orangeAlpha(0.2), backgroundColor: Colors.orange },
  actionGhostText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.62) },
  actionPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  sectionCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: Spacing[6],
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: Spacing[4],
  },
  editor: {
    minHeight: 220,
    fontSize: FontSize.base,
    color: wm(0.86),
    lineHeight: 21,
  },
  previewStack: { gap: Spacing[4] },
  bodyText: { fontSize: FontSize.md, color: wm(0.8), lineHeight: 22 },
  emptyText: { fontSize: FontSize.base, color: wm(0.35), lineHeight: 18 },
  expItem: { gap: Spacing[2] },
  productItem: { gap: Spacing[2] },
  itemBorder: { borderTopWidth: 1, borderTopColor: wm(0.07), paddingTop: Spacing[4] },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing[3] },
  expRole: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: wm(0.88) },
  expDate: { fontSize: FontSize.sm, color: wm(0.4), fontWeight: '500' },
  expCompany: { fontSize: FontSize.base, color: wm(0.52) },
  productTagline: { fontSize: FontSize.base, color: Colors.orange },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { fontSize: FontSize.base, color: Colors.orange, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: FontSize.base, color: wm(0.78), lineHeight: 20 },
  skillGroup: { gap: 4 },
  skillCat: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.orange, textTransform: 'uppercase', letterSpacing: 0.4 },
  skillList: { fontSize: FontSize.base, color: wm(0.76), lineHeight: 20 },
  eduItem: { gap: 4 },
})
