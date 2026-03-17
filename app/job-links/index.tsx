import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type Platform = 'linkedin' | 'indeed' | 'glassdoor' | 'wellfound' | 'dice'
type JobType = 'any' | 'fulltime' | 'parttime' | 'contract' | 'internship'
type DatePosted = 'any' | 'day' | 'week' | 'month'

type QueryParams = {
  keywords: string
  location?: string
  remote?: boolean
  jobType?: JobType
  datePosted?: DatePosted
}

type QueryLink = {
  id: string
  name: string
  platform: Platform
  params: QueryParams
  url: string
  createdAt: string
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'indeed',    label: 'Indeed' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'wellfound', label: 'Wellfound' },
  { value: 'dice',      label: 'Dice' },
]

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'any',        label: 'Any' },
  { value: 'fulltime',   label: 'Full-time' },
  { value: 'parttime',   label: 'Part-time' },
  { value: 'contract',   label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

const DATE_OPTIONS: { value: DatePosted; label: string }[] = [
  { value: 'any',   label: 'Any time' },
  { value: 'day',   label: '24h' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
]

function buildPreviewUrl(platform: Platform, params: QueryParams): string {
  // Client-side preview — mirrors server logic
  const q = new URLSearchParams()
  switch (platform) {
    case 'linkedin': {
      if (params.keywords) q.set('keywords', params.keywords)
      if (params.location && !params.remote) q.set('location', params.location)
      if (params.remote) q.set('f_WT', '2')
      const jtMap: Partial<Record<JobType, string>> = { fulltime: 'F', parttime: 'P', contract: 'C', internship: 'I' }
      if (params.jobType && params.jobType !== 'any') q.set('f_JT', jtMap[params.jobType] ?? '')
      const tprMap: Partial<Record<DatePosted, string>> = { day: 'r86400', week: 'r604800', month: 'r2592000' }
      if (params.datePosted && params.datePosted !== 'any') q.set('f_TPR', tprMap[params.datePosted] ?? '')
      return `https://www.linkedin.com/jobs/search/?${q.toString()}`
    }
    case 'indeed': {
      if (params.keywords) q.set('q', params.keywords)
      if (params.location && !params.remote) q.set('l', params.location)
      if (params.remote) q.set('remotejob', '032b3046-06a3-4876-8dfd-474eb5e7ed11')
      const jtMap: Partial<Record<JobType, string>> = { fulltime: 'fulltime', parttime: 'parttime', contract: 'contract', internship: 'internship' }
      if (params.jobType && params.jobType !== 'any') q.set('jt', jtMap[params.jobType] ?? '')
      const ageMap: Partial<Record<DatePosted, string>> = { day: '1', week: '7', month: '30' }
      if (params.datePosted && params.datePosted !== 'any') q.set('fromage', ageMap[params.datePosted] ?? '')
      return `https://www.indeed.com/jobs?${q.toString()}`
    }
    case 'glassdoor': {
      if (params.keywords) q.set('sc.keyword', params.keywords)
      if (params.location && !params.remote) q.set('locKeyword', params.location)
      if (params.remote) q.set('remoteWorkType', '1')
      const jtMap: Partial<Record<JobType, string>> = { fulltime: 'fulltime', parttime: 'parttime', contract: 'contract', internship: 'internship' }
      if (params.jobType && params.jobType !== 'any') q.set('jobType', jtMap[params.jobType] ?? '')
      const ageMap: Partial<Record<DatePosted, string>> = { day: '1', week: '7', month: '30' }
      if (params.datePosted && params.datePosted !== 'any') q.set('fromAge', ageMap[params.datePosted] ?? '')
      return `https://www.glassdoor.com/Job/jobs.htm?${q.toString()}`
    }
    case 'wellfound': {
      if (params.keywords) q.set('query', params.keywords)
      if (params.remote) q.set('remote', 'true')
      if (params.location && !params.remote) q.set('location', params.location)
      return `https://wellfound.com/jobs?${q.toString()}`
    }
    case 'dice': {
      if (params.keywords) q.set('q', params.keywords)
      if (params.location && !params.remote) q.set('location', params.location)
      if (params.remote) q.set('filters.workplaceTypes', 'Remote')
      const ageMap: Partial<Record<DatePosted, string>> = { day: 'ONE', week: 'SEVEN', month: 'THIRTY' }
      if (params.datePosted && params.datePosted !== 'any') q.set('filters.postedDate', ageMap[params.datePosted] ?? '')
      return `https://www.dice.com/jobs?${q.toString()}`
    }
  }
}

export default function JobLinksScreen() {
  const { getToken } = useAuth()
  const router = useRouter()

  // Form state
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [jobType, setJobType] = useState<JobType>('any')
  const [datePosted, setDatePosted] = useState<DatePosted>('any')
  const [linkName, setLinkName] = useState('')
  const [saving, setSaving] = useState(false)

  // Saved links
  const [links, setLinks] = useState<QueryLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Keep a ref so the stable effect closure always calls the latest getToken
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken })

  const params: QueryParams = {
    keywords,
    location: location.trim() || undefined,
    remote,
    jobType,
    datePosted,
  }

  const previewUrl = keywords.trim() ? buildPreviewUrl(platform, params) : null

  async function fetchLinks() {
    try {
      const token = await getTokenRef.current()
      const data = await apiRequest<{ links: QueryLink[] }>('/api/job-query-links', {}, token)
      setLinks(data.links)
    } catch {
      // non-critical
    } finally {
      setLoadingLinks(false)
    }
  }

  // Fetch once on mount — stable, no infinite loop from getToken reference churn
  useEffect(() => {
    void fetchLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openUrl = (url: string) => {
    void Linking.openURL(url)
  }

  const handleOpen = () => {
    if (!previewUrl) return
    openUrl(previewUrl)
  }

  const handleSave = async () => {
    if (!keywords.trim() || !linkName.trim()) return
    setSaving(true)
    try {
      const token = await getTokenRef.current()
      await apiRequest('/api/job-query-links', {
        method: 'POST',
        body: JSON.stringify({ name: linkName.trim(), platform, params }),
      }, token)
      setLinkName('')
      await fetchLinks()
      if (previewUrl) openUrl(previewUrl)
    } catch {
      // non-critical
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const token = await getTokenRef.current()
      await apiRequest(`/api/job-query-links/${id}`, { method: 'DELETE' }, token)
      setLinks((prev) => prev.filter((l) => l.id !== id))
    } catch {
      // non-critical
    } finally {
      setDeletingId(null)
    }
  }

  const handleShare = (url: string, name: string) => {
    void Share.share({ message: `${name}\n${url}`, url })
  }

  const canOpen = !!keywords.trim()
  const canSave = canOpen && !!linkName.trim()

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={10}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.headerKicker}>
          <View style={styles.kickerLine} />
          <Text style={styles.kickerText}>JOB SEARCH</Text>
        </View>
        <Text style={styles.title}>Search Links</Text>
        <Text style={styles.subtitle}>Build custom deep-links for any job board with your exact filters pre-filled.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Builder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUILD A LINK</Text>

          {/* Platform picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Platform</Text>
            <View style={styles.chipRow}>
              {PLATFORMS.map((p) => (
                <Pressable
                  key={p.value}
                  style={[styles.chip, platform === p.value && styles.chipActive]}
                  onPress={() => setPlatform(p.value)}
                >
                  <Text style={[styles.chipText, platform === p.value && styles.chipTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Keywords */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Keywords</Text>
            <TextInput
              style={styles.input}
              value={keywords}
              onChangeText={setKeywords}
              placeholder="e.g. senior software engineer"
              placeholderTextColor={wm(0.22)}
              returnKeyType="next"
              selectionColor={Colors.orange}
            />
          </View>

          {/* Remote toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.fieldLabel}>Remote only</Text>
              <Text style={styles.toggleSub}>Hides the location filter</Text>
            </View>
            <Switch
              value={remote}
              onValueChange={setRemote}
              trackColor={{ true: Colors.orange, false: wm(0.1) }}
              thumbColor={Colors.white}
            />
          </View>

          {/* Location (only if not remote) */}
          {!remote && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Location <Text style={styles.optionalTag}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. San Francisco, CA"
                placeholderTextColor={wm(0.22)}
                returnKeyType="next"
                selectionColor={Colors.orange}
              />
            </View>
          )}

          {/* Job type */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Job type</Text>
            <View style={styles.chipRow}>
              {JOB_TYPES.map((jt) => (
                <Pressable
                  key={jt.value}
                  style={[styles.chipSm, jobType === jt.value && styles.chipSmActive]}
                  onPress={() => setJobType(jt.value)}
                >
                  <Text style={[styles.chipSmText, jobType === jt.value && styles.chipSmTextActive]}>{jt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Date posted */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date posted</Text>
            <View style={styles.chipRow}>
              {DATE_OPTIONS.map((d) => (
                <Pressable
                  key={d.value}
                  style={[styles.chipSm, datePosted === d.value && styles.chipSmActive]}
                  onPress={() => setDatePosted(d.value)}
                >
                  <Text style={[styles.chipSmText, datePosted === d.value && styles.chipSmTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* URL preview */}
          {previewUrl ? (
            <View style={styles.urlPreview}>
              <Text style={styles.urlPreviewLabel}>PREVIEW</Text>
              <Text style={styles.urlPreviewText} numberOfLines={2}>{previewUrl}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <Pressable
            style={({ pressed }) => [styles.openBtn, !canOpen && styles.btnDisabled, pressed && canOpen && { opacity: 0.85 }]}
            onPress={handleOpen}
            disabled={!canOpen}
          >
            <Text style={styles.openBtnText}>Open in browser</Text>
          </Pressable>

          <View style={styles.saveRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={linkName}
              onChangeText={setLinkName}
              placeholder="Name this link to save it"
              placeholderTextColor={wm(0.22)}
              returnKeyType="done"
              selectionColor={Colors.orange}
            />
            <Pressable
              style={({ pressed }) => [styles.saveBtn, !canSave && styles.btnDisabled, pressed && canSave && { opacity: 0.85 }]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Saved links */}
        {(loadingLinks || links.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SAVED LINKS</Text>

            {loadingLinks ? (
              <ActivityIndicator color={Colors.orange} style={{ marginTop: 8 }} />
            ) : (
              links.map((link) => (
                <SavedLinkCard
                  key={link.id}
                  link={link}
                  deleting={deletingId === link.id}
                  onOpen={() => openUrl(link.url)}
                  onShare={() => handleShare(link.url, link.name)}
                  onDelete={() => { void handleDelete(link.id) }}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function SavedLinkCard({
  link,
  deleting,
  onOpen,
  onShare,
  onDelete,
}: {
  link: QueryLink
  deleting: boolean
  onOpen: () => void
  onShare: () => void
  onDelete: () => void
}) {
  const platformLabel = PLATFORMS.find((p) => p.value === link.platform)?.label ?? link.platform
  const tags: string[] = []
  if (link.params.remote) tags.push('Remote')
  if (link.params.jobType && link.params.jobType !== 'any') {
    tags.push(JOB_TYPES.find((jt) => jt.value === link.params.jobType)?.label ?? link.params.jobType)
  }
  if (link.params.datePosted && link.params.datePosted !== 'any') {
    tags.push(DATE_OPTIONS.find((d) => d.value === link.params.datePosted)?.label ?? link.params.datePosted)
  }
  if (link.params.location) tags.push(link.params.location)

  return (
    <View style={styles.linkCard}>
      <View style={styles.linkCardTop}>
        <View style={styles.linkPlatformBadge}>
          <Text style={styles.linkPlatformText}>{platformLabel}</Text>
        </View>
        <Text style={styles.linkName}>{link.name}</Text>
      </View>

      <Text style={styles.linkKeywords}>{link.params.keywords}</Text>

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.linkActions}>
        <Pressable style={({ pressed }) => [styles.linkActionBtn, pressed && { opacity: 0.75 }]} onPress={onOpen}>
          <Text style={styles.linkActionBtnPrimaryText}>Open</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.linkActionBtn, styles.linkActionBtnGhost, pressed && { opacity: 0.75 }]} onPress={onShare}>
          <Text style={styles.linkActionBtnGhostText}>Share</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.linkActionBtn, styles.linkActionBtnDelete, pressed && { opacity: 0.75 }]}
          onPress={onDelete}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator size="small" color={wm(0.5)} />
            : <Text style={styles.linkActionBtnDeleteText}>Delete</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },

  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  backArrow: { fontSize: 16, color: wm(0.4), fontWeight: '600' },
  backLabel: { fontSize: FontSize.base, color: wm(0.4), fontWeight: '500' },
  headerKicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  kickerLine: { width: 20, height: 1, backgroundColor: Colors.orange },
  kickerText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.orange, letterSpacing: 0.1 },
  title: { fontSize: 28, fontWeight: '600', color: wm(0.9), letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.md, color: wm(0.4), lineHeight: 19, marginTop: 2 },

  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 24 },

  section: { gap: 14 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3), letterSpacing: 0.5, textTransform: 'uppercase' },

  field: { gap: 8 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.55) },
  optionalTag: { fontWeight: '400', color: wm(0.3) },

  input: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.08),
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: wm(0.88),
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleCopy: { gap: 2 },
  toggleSub: { fontSize: FontSize.xs, color: wm(0.3) },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.1), backgroundColor: wm(0.04),
  },
  chipActive: { backgroundColor: orangeAlpha(0.12), borderColor: orangeAlpha(0.28) },
  chipText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.45) },
  chipTextActive: { color: Colors.orange },

  chipSm: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.08), backgroundColor: wm(0.03),
  },
  chipSmActive: { backgroundColor: orangeAlpha(0.1), borderColor: orangeAlpha(0.22) },
  chipSmText: { fontSize: FontSize.xs, fontWeight: '600', color: wm(0.4) },
  chipSmTextActive: { color: Colors.orange },

  urlPreview: {
    backgroundColor: wm(0.03),
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 4,
  },
  urlPreviewLabel: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.25), letterSpacing: 0.4, textTransform: 'uppercase' },
  urlPreviewText: { fontSize: FontSize.sm, color: wm(0.5), lineHeight: 16 },

  openBtn: {
    backgroundColor: wm(0.06),
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: wm(0.1),
  },
  openBtnText: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.75) },

  saveRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  nameInput: { flex: 1 },
  saveBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  btnDisabled: { opacity: 0.35 },

  // Saved link cards
  linkCard: {
    backgroundColor: wm(0.04),
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 10,
  },
  linkCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkPlatformBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
    borderColor: orangeAlpha(0.22),
    backgroundColor: orangeAlpha(0.1),
  },
  linkPlatformText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, letterSpacing: 0.3 },
  linkName: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.82), flex: 1 },
  linkKeywords: { fontSize: FontSize.sm, color: wm(0.55), fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, backgroundColor: wm(0.06),
    borderWidth: 1, borderColor: wm(0.08),
  },
  tagText: { fontSize: FontSize.xs, color: wm(0.45), fontWeight: '500' },
  linkActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  linkActionBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 60,
  },
  linkActionBtnGhost: { backgroundColor: wm(0.05), borderWidth: 1, borderColor: wm(0.09) },
  linkActionBtnDelete: { backgroundColor: 'rgba(226,75,74,0.08)', borderWidth: 1, borderColor: 'rgba(226,75,74,0.15)', marginLeft: 'auto' },
  linkActionBtnPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  linkActionBtnGhostText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.6) },
  linkActionBtnDeleteText: { fontSize: FontSize.sm, fontWeight: '600', color: 'rgb(226,75,74)' },
})
