import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import Reveal from '@/components/Reveal'
import { Colors, FontSize, Radius, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type Job = {
  id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  jobType: string | null
  matchScore: number | null
  isSaved: boolean
  source: string | null
  savedAt: string
  postedAt: string | null
  description: string | null
  isRemote: boolean
  status: string
  url: string | null
  appliedAt: string | null
  nextStep: string | null
}

type Stats = {
  newToday: number
  applied: number
  saved: number
}

type JobsResponse = {
  jobs: Job[]
  stats: Stats
}

const PIPELINE_FILTERS = [
  { label: 'All saved', value: 'all' },
  { label: 'Saved', value: 'saved' },
  { label: 'Applied', value: 'applied' },
  { label: 'Interviewing', value: 'interviewing' },
  { label: 'Offer', value: 'offer' },
] as const

const STATUS_CYCLE = ['saved', 'applied', 'interviewing', 'offer'] as const
type Status = (typeof STATUS_CYCLE)[number]
type FilterValue = (typeof PIPELINE_FILTERS)[number]['value']

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  saved: { label: 'Saved', color: wm(0.7), bg: wm(0.08) },
  applied: { label: 'Applied', color: Colors.blue, bg: 'rgba(55,138,221,0.12)' },
  interviewing: { label: 'Interviewing', color: Colors.orange, bg: orangeAlpha(0.12) },
  offer: { label: 'Offer', color: Colors.green, bg: 'rgba(93,202,165,0.12)' },
}

function formatRelativeDate(dateString: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  const diff = Date.now() - date.getTime()
  if (!Number.isFinite(diff) || diff < 0) return null

  const hours = Math.round(diff / 3600000)
  if (hours < 24) return `${Math.max(hours, 1)}h ago`

  const days = Math.round(diff / 86400000)
  if (days < 30) return `${days}d ago`

  const months = Math.round(days / 30)
  return `${Math.max(months, 1)}mo ago`
}

function formatSource(source: string | null): string {
  if (!source) return 'Manual'
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function descriptionPreview(text: string | null, maxLength = 120): string | null {
  if (!text) return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized
}

export default function JobsScreen() {
  const { getToken } = useAuth()
  const router = useRouter()
  const getTokenRef = useRef(getToken)

  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({ newToday: 0, applied: 0, saved: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null)
  const [togglingSaveId, setTogglingSaveId] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

  getTokenRef.current = getToken

  const fetchJobs = useCallback(async () => {
    try {
      const token = await getTokenRef.current()
      const params = new URLSearchParams()
      params.set('preset', 'saved')
      if (filter !== 'all') params.set('status', filter)
      if (search.trim()) params.set('q', search.trim())

      const data = await apiRequest<JobsResponse>(`/api/jobs?${params.toString()}`, {}, token)
      setJobs(data.jobs)
      setStats(data.stats)
    } catch (err) {
      console.error('Failed to fetch saved jobs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, search])

  useFocusEffect(
    useCallback(() => {
      void fetchJobs()
    }, [fetchJobs]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void fetchJobs()
  }, [fetchJobs])

  const cycleStatus = async (job: Job) => {
    const current = (job.status as Status) ?? 'saved'
    const currentIndex = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]

    setChangingStatusId(job.id)
    setJobs((prev) =>
      prev.map((item) =>
        item.id === job.id
          ? {
              ...item,
              status: next,
              appliedAt: next === 'applied' && !item.appliedAt ? new Date().toISOString() : item.appliedAt,
            }
          : item,
      ),
    )

    try {
      const token = await getToken()
      await apiRequest(
        `/api/jobs/${job.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: next,
            ...(next === 'applied' && !job.appliedAt ? { appliedAt: new Date().toISOString() } : {}),
          }),
        },
        token,
      )
      await fetchJobs()
    } catch (err) {
      console.error('Failed to change job status:', err)
      await fetchJobs()
    } finally {
      setChangingStatusId(null)
    }
  }

  const toggleSaved = async (job: Job) => {
    setTogglingSaveId(job.id)
    setJobs((prev) => prev.filter((item) => item.id !== job.id))

    try {
      const token = await getToken()
      await apiRequest(
        `/api/jobs/${job.id}`,
        { method: 'PATCH', body: JSON.stringify({ isSaved: !job.isSaved }) },
        token,
      )
      await fetchJobs()
    } catch (err) {
      console.error('Failed to toggle saved state:', err)
      await fetchJobs()
    } finally {
      setTogglingSaveId(null)
    }
  }

  const filteredCountLabel = useMemo(() => {
    if (filter === 'all') return `${jobs.length} tracked roles`
    const label = PIPELINE_FILTERS.find((item) => item.value === filter)?.label ?? 'Filtered'
    return `${jobs.length} ${label.toLowerCase()} roles`
  }, [filter, jobs.length])

  return (
    <View style={styles.container}>
      <Reveal style={styles.header} distance={12}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.headerKicker}>
              <View style={styles.kickerLine} />
              <Text style={styles.kickerText}>PIPELINE</Text>
            </View>
            <Text style={styles.title}>Jobs</Text>
          </View>
          <Pressable style={styles.linksBtn} onPress={() => router.push('/job-links')}>
            <Text style={styles.linksBtnText}>Search links</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Saved roles, application status, and quick tracking in one place.</Text>

        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved jobs..."
            placeholderTextColor={wm(0.25)}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            selectionColor={Colors.orange}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Saved" value={stats.saved} />
          <StatCard label="Applied" value={stats.applied} />
          <StatCard label="Visible" value={jobs.length} />
        </View>
      </Reveal>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        ListHeaderComponent={
          <Reveal delay={80}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{filteredCountLabel}</Text>
              <ScrollFilterRow
                filter={filter}
                onChange={setFilter}
              />
            </View>
          </Reveal>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.orange} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tracked jobs</Text>
              <Text style={styles.emptyText}>
                Save jobs from the feed and they’ll appear here for status tracking, resume generation, and follow-up work.
              </Text>
              <Pressable style={styles.emptyButton} onPress={() => router.push('/')}>
                <Text style={styles.emptyButtonText}>Go to feed</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Reveal delay={Math.min(index * 45, 240) + 100}>
            <PipelineCard
              job={item}
              changingStatus={changingStatusId === item.id}
              togglingSave={togglingSaveId === item.id}
              onOpen={() => router.push(`/job/${item.id}`)}
              onCycleStatus={() => {
                void cycleStatus(item)
              }}
              onToggleSaved={() => {
                void toggleSaved(item)
              }}
            />
          </Reveal>
        )}
      />
    </View>
  )
}

function ScrollFilterRow({
  filter,
  onChange,
}: {
  filter: FilterValue
  onChange: (value: FilterValue) => void
}) {
  return (
    <FlatList
      data={PIPELINE_FILTERS}
      keyExtractor={(item) => item.value}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      renderItem={({ item }) => {
        const active = item.value === filter
        return (
          <Pressable
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onChange(item.value)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
          </Pressable>
        )
      }}
    />
  )
}

function PipelineCard({
  job,
  changingStatus,
  togglingSave,
  onOpen,
  onCycleStatus,
  onToggleSaved,
}: {
  job: Job
  changingStatus: boolean
  togglingSave: boolean
  onOpen: () => void
  onCycleStatus: () => void
  onToggleSaved: () => void
}) {
  const status = ((STATUS_CYCLE as readonly string[]).includes(job.status) ? job.status : 'saved') as Status
  const statusMeta = STATUS_META[status]
  const preview = descriptionPreview(job.description)
  const posted = formatRelativeDate(job.postedAt)
  const applied = formatRelativeDate(job.appliedAt)

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onOpen}>
      <View style={styles.cardRail}>
        <View style={styles.cardRailLeft}>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
              {changingStatus ? 'Updating…' : statusMeta.label}
            </Text>
          </View>
          <Text style={styles.timelineText}>{formatSource(job.source)}</Text>
        </View>

        <Pressable
          style={[styles.savedBtn, togglingSave && styles.savedBtnPending]}
          onPress={(event) => {
            event.stopPropagation?.()
            onToggleSaved()
          }}
        >
          <Text style={styles.savedBtnText}>{togglingSave ? '...' : 'Unsave'}</Text>
        </Pressable>
      </View>

      <View style={styles.cardHeader}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>{job.company.slice(0, 2).toUpperCase()}</Text>
        </View>

        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {job.company}
            {job.location ? ` · ${job.location}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {job.matchScore != null ? (
          <View style={styles.matchPanel}>
            <View style={styles.matchPanelTop}>
              <Text style={styles.matchPanelLabel}>Match</Text>
              <Text style={styles.matchPanelValue}>{job.matchScore}%</Text>
            </View>
            <View style={styles.matchBarTrack}>
              <View style={[styles.matchBarFill, { width: `${Math.min(Math.max(job.matchScore, 0), 100)}%` }]} />
            </View>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          {job.isRemote ? (
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>Remote</Text>
            </View>
          ) : null}
          {job.jobType && job.jobType !== 'remote' ? (
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{job.jobType}</Text>
            </View>
          ) : null}
          {job.salary ? (
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{job.salary}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.timelineRow}>
        <Text style={styles.timelineText}>
          {posted ? `Posted ${posted}` : 'Posting date unavailable'}
        </Text>
        {applied ? <Text style={styles.timelineText}>Applied {applied}</Text> : null}
        <Text style={styles.timelineText}>{formatSource(job.source)}</Text>
      </View>

      {preview ? <Text style={styles.previewText}>{preview}</Text> : null}
      {job.nextStep ? (
        <View style={styles.nextStepPanel}>
          <Text style={styles.nextStepLabel}>Next step</Text>
          <Text style={styles.nextStepText}>{job.nextStep}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.footerCaption}>Open artifacts, drafts, and follow-up work</Text>

        <View style={styles.footerActions}>
          <Pressable
            style={[styles.footerButton, styles.footerButtonGhost]}
            onPress={(event) => {
              event.stopPropagation?.()
              onCycleStatus()
            }}
          >
            <Text style={styles.footerButtonGhostText}>Cycle status</Text>
          </Pressable>
          <Pressable
            style={[styles.footerButton, styles.footerButtonPrimary]}
            onPress={(event) => {
              event.stopPropagation?.()
              onOpen()
            }}
          >
            <Text style={styles.footerButtonPrimaryText}>Open</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  linksBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: wm(0.05),
    borderWidth: 1,
    borderColor: wm(0.09),
  },
  linksBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.5) },
  headerKicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  kickerLine: { width: 20, height: 1, backgroundColor: Colors.orange },
  kickerText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.orange, letterSpacing: 0.1 },
  title: { fontSize: 28, fontWeight: '600', color: wm(0.9), letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.md, color: wm(0.4), lineHeight: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: wm(0.04),
    borderRadius: Radius.template,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: wm(0.08),
  },
  searchBarFocused: {
    borderColor: orangeAlpha(0.34),
    backgroundColor: wm(0.06),
    shadowColor: Colors.orange,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  searchGlyph: { fontSize: 16, color: wm(0.3), lineHeight: 18 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: wm(0.85) },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: wm(0.04),
    borderRadius: Radius.stat,
    borderWidth: 1,
    borderColor: wm(0.07),
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  statValue: { fontSize: FontSize['2xl'], fontWeight: '700', color: wm(0.9) },
  statLabel: { fontSize: FontSize.sm, color: wm(0.38) },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 14, paddingBottom: 96 },
  filterSection: { gap: 10, marginBottom: 4 },
  filterLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.4) },
  filterRow: { gap: 8, paddingRight: 20 },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: wm(0.04),
    borderWidth: 1,
    borderColor: wm(0.08),
  },
  filterChipActive: {
    backgroundColor: orangeAlpha(0.12),
    borderColor: orangeAlpha(0.22),
  },
  filterChipText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.48) },
  filterChipTextActive: { color: Colors.orange },
  loadingWrap: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: wm(0.72) },
  emptyText: { fontSize: FontSize.md, color: wm(0.38), textAlign: 'center', lineHeight: 20 },
  emptyButton: {
    marginTop: 6,
    borderRadius: Radius.inputLg,
    backgroundColor: Colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: 22,
    borderWidth: 1,
    borderColor: wm(0.07),
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardPressed: { backgroundColor: wm(0.06), transform: [{ scale: 0.987 }] },
  cardRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardRailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: orangeAlpha(0.12),
    borderWidth: 1,
    borderColor: orangeAlpha(0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.orange },
  cardHeaderCopy: { flex: 1, gap: 4 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '700', color: wm(0.9), lineHeight: 20, letterSpacing: -0.25 },
  cardMeta: { fontSize: FontSize.base, color: wm(0.44) },
  savedBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: wm(0.1),
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: wm(0.02),
  },
  savedBtnPending: { opacity: 0.65 },
  savedBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.5), textTransform: 'uppercase', letterSpacing: 0.35 },
  metricsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, maxWidth: '42%' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: { fontSize: FontSize.sm, fontWeight: '700' },
  matchPanel: {
    flex: 1,
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: wm(0.03),
    borderWidth: 1,
    borderColor: wm(0.06),
  },
  matchPanelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchPanelLabel: { fontSize: FontSize.xs, color: wm(0.38), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.35 },
  matchPanelValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.green },
  matchBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: wm(0.06),
    overflow: 'hidden',
  },
  matchBarFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.green },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: wm(0.05),
  },
  tagText: { fontSize: FontSize.sm, color: wm(0.6), fontWeight: '500' },
  timelineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timelineText: { fontSize: FontSize.sm, color: wm(0.34) },
  previewText: { fontSize: FontSize.base, lineHeight: 19, color: wm(0.58) },
  nextStepPanel: {
    gap: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: orangeAlpha(0.08),
    borderWidth: 1,
    borderColor: orangeAlpha(0.16),
  },
  nextStepLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, textTransform: 'uppercase', letterSpacing: 0.35 },
  nextStepText: { fontSize: FontSize.base, lineHeight: 18, color: wm(0.8) },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  footerCaption: { flex: 1, fontSize: FontSize.sm, color: wm(0.34), fontWeight: '600', lineHeight: 18 },
  footerActions: { flexDirection: 'row', gap: 8 },
  footerButton: {
    borderRadius: Radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  footerButtonGhost: { borderColor: wm(0.09), backgroundColor: wm(0.03) },
  footerButtonPrimary: { borderColor: orangeAlpha(0.18), backgroundColor: Colors.orange },
  footerButtonGhostText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.62) },
  footerButtonPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
})
