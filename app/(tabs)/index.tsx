import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Colors, FontSize, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

type Facets = { sources: string[]; remotePolicyLabel: string }
type JobsResponse = { jobs: Job[]; facets: Facets; feedLimited?: boolean }

// ─── Filter constants ─────────────────────────────────────────────────────────

const PRIMARY_FILTERS = [
  { label: 'All',        value: 'all'        },
  { label: 'Remote',     value: 'remote'     },
  { label: 'Saved',      value: 'saved'      },
  { label: 'Applied',    value: 'applied'    },
  { label: 'High match', value: 'high_match' },
] as const

const JOB_TYPE_FILTERS = [
  { label: 'Any type',   value: 'all'        },
  { label: 'Full-time',  value: 'full-time'  },
  { label: 'Contract',   value: 'contract'   },
  { label: 'Part-time',  value: 'part-time'  },
  { label: 'Internship', value: 'internship' },
] as const

const RECENCY_FILTERS = [
  { label: 'Any time', value: 'all' },
  { label: '24h',      value: '1'   },
  { label: '3d',       value: '3'   },
  { label: '7d',       value: '7'   },
  { label: '14d',      value: '14'  },
  { label: '30d',      value: '30'  },
] as const

const SORT_FILTERS = [
  { label: 'Best match', value: 'match'  },
  { label: 'Newest',     value: 'newest' },
  { label: 'Oldest',     value: 'oldest' },
] as const

type PrimaryFilter  = (typeof PRIMARY_FILTERS)[number]['value']
type JobTypeFilter  = (typeof JOB_TYPE_FILTERS)[number]['value']
type RecencyFilter  = (typeof RECENCY_FILTERS)[number]['value']
type SortFilter     = (typeof SORT_FILTERS)[number]['value']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
}

function formatRelativeDate(ds: string | null): string | null {
  if (!ds) return null
  const diff = Date.now() - new Date(ds).getTime()
  if (!Number.isFinite(diff) || diff < 0) return null
  const m = Math.round(diff / 60000)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  const h = Math.round(diff / 3600000)
  if (h < 24) return `${h}h ago`
  const d = Math.round(diff / 86400000)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

function formatSource(source: string | null): string {
  if (!source) return 'Manual'
  return source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function descriptionPreview(text: string | null, max = 120): string | null {
  if (!text) return null
  const clean = decodeHtml(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean || null
}

// ─── Feed screen ──────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { getToken } = useAuth()
  const router       = useRouter()
  const getTokenRef  = useRef(getToken)
  const filterSheet  = useRef<BottomSheetModal>(null)

  // Data
  const [jobs,        setJobs       ] = useState<Job[]>([])
  const [facets,      setFacets     ] = useState<Facets>({ sources: [], remotePolicyLabel: '' })
  const [feedLimited, setFeedLimited] = useState(false)
  const [credits,     setCredits    ] = useState<number | null>(null)
  const [loading,     setLoading    ] = useState(true)
  const [refreshing,  setRefreshing ] = useState(false)
  const [scraping,    setScraping   ] = useState(false)

  // Filters
  const [search,          setSearch         ] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [primaryFilter,   setPrimaryFilter  ] = useState<PrimaryFilter>('all')
  const [jobTypeFilter,   setJobTypeFilter  ] = useState<JobTypeFilter>('all')
  const [recencyFilter,   setRecencyFilter  ] = useState<RecencyFilter>('all')
  const [sortFilter,      setSortFilter     ] = useState<SortFilter>('match')
  const [sourceFilter,    setSourceFilter   ] = useState('all')
  const [searchFocused,   setSearchFocused  ] = useState(false)

  useEffect(() => { getTokenRef.current = getToken }, [getToken])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Fetch credits on mount
  useEffect(() => {
    getToken()
      .then(token => apiRequest<{ credits: number }>('/api/credits', {}, token))
      .then(d => setCredits(d.credits))
      .catch(() => {})
  }, [getToken])

  const advancedCount = useMemo(() => {
    let n = 0
    if (sortFilter    !== 'match') n++
    if (recencyFilter !== 'all'  ) n++
    if (jobTypeFilter !== 'all'  ) n++
    if (sourceFilter  !== 'all'  ) n++
    return n
  }, [sortFilter, recencyFilter, jobTypeFilter, sourceFilter])

  const sourceChips = useMemo(
    () => ['all', ...facets.sources.filter(Boolean)],
    [facets.sources]
  )

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (debouncedSearch)          p.set('q',              debouncedSearch)
    if (primaryFilter !== 'all')  p.set('preset',         primaryFilter)
    if (jobTypeFilter !== 'all')  p.set('jobType',        jobTypeFilter)
    if (recencyFilter !== 'all')  p.set('postedWithinDays', recencyFilter)
    if (sortFilter    !== 'match') p.set('sort',          sortFilter)
    if (sourceFilter  !== 'all')  p.set('source',         sourceFilter)
    return p
  }, [debouncedSearch, jobTypeFilter, primaryFilter, recencyFilter, sortFilter, sourceFilter])

  const fetchJobs = useCallback(async (params: URLSearchParams) => {
    try {
      const token = await getTokenRef.current()
      const qs    = params.toString()
      const data  = await apiRequest<JobsResponse>(qs ? `/api/jobs?${qs}` : '/api/jobs', {}, token)
      setJobs(data.jobs)
      setFacets(data.facets)
      setFeedLimited(data.feedLimited ?? false)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const triggerScrape = useCallback(async () => {
    setScraping(true)
    try {
      const token = await getTokenRef.current()
      await apiRequest('/api/scrape', { method: 'POST' }, token)
      await apiRequest('/api/match',  { method: 'POST' }, token)
      await fetchJobs(buildParams())
    } catch (err) {
      console.error('Scrape failed:', err)
    } finally {
      setScraping(false)
    }
  }, [buildParams, fetchJobs])

  useEffect(() => { void fetchJobs(buildParams()) }, [buildParams, fetchJobs])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void fetchJobs(buildParams())
  }, [buildParams, fetchJobs])

  const toggleSave = async (jobId: string, saved: boolean) => {
    try {
      const token = await getToken()
      await apiRequest(`/api/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify({ isSaved: !saved }) }, token)
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, isSaved: !saved } : j))
    } catch { /* non-critical */ }
  }

  const clearAdvanced = () => {
    setSortFilter('match')
    setRecencyFilter('all')
    setJobTypeFilter('all')
    setSourceFilter('all')
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ), []
  )

  const snapPoints = useMemo(() => ['62%'], [])

  return (
    <View style={styles.container}>

      {/* ── Fixed header ─────────────────────────────────────────── */}
      <View style={styles.header}>

        {/* Logo + credits */}
        <View style={styles.topRow}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoArrow}>→</Text>
            </View>
            <Text style={styles.wordmark}>
              arr<Text style={styles.wordmarkO}>o</Text>
            </Text>
          </View>

          <Pressable
            style={[
              styles.creditPill,
              credits !== null && credits <= 5  && styles.creditPillEmpty,
              credits !== null && credits <= 20 && credits > 5 && styles.creditPillLow,
            ]}
            onPress={() => router.push('/credits')}
          >
            <View style={styles.creditDot} />
            <Text style={styles.creditText}>{credits ?? '--'} cr</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search titles, companies, descriptions..."
            placeholderTextColor={wm(0.25)}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => setDebouncedSearch(search.trim())}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            selectionColor={Colors.orange}
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setDebouncedSearch('') }} hitSlop={8}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filter strip: scrolling view chips + fixed action buttons */}
        <View style={styles.filterStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
            style={styles.filterChipsScroll}
          >
            {PRIMARY_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.viewChip, primaryFilter === f.value && styles.viewChipActive]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setPrimaryFilter(f.value)
                }}
              >
                <Text style={[styles.viewChipText, primaryFilter === f.value && styles.viewChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.filterActions}>
            <ScrapeButton scraping={scraping} onPress={() => { void triggerScrape() }} />
            <Pressable
              style={[styles.filtersPill, advancedCount > 0 && styles.filtersPillActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                filterSheet.current?.present()
              }}
            >
              <Text style={[styles.filtersPillText, advancedCount > 0 && styles.filtersPillTextActive]}>
                {advancedCount > 0 ? `Filters · ${advancedCount}` : 'Filters'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Feed ─────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonFeed />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
          }
          ListFooterComponent={
            feedLimited && jobs.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.feedGateCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/upgrade')}
              >
                <View style={styles.feedGateInner}>
                  <Text style={styles.feedGateTitle}>Showing 30 of your matches</Text>
                  <Text style={styles.feedGateSub}>Upgrade to Pro to unlock all 75 ranked results.</Text>
                </View>
                <View style={styles.feedGateCta}>
                  <Text style={styles.feedGateCtaText}>Upgrade</Text>
                </View>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              filter={primaryFilter}
              scraping={scraping}
              onSearch={() => { void triggerScrape() }}
            />
          }
          renderItem={({ item, index }) => (
            <JobCard
              job={item}
              index={index}
              onPress={() => router.push(`/job/${item.id}`)}
              onSave={() => { void toggleSave(item.id, item.isSaved) }}
            />
          )}
        />
      )}

      {/* ── Filter bottom sheet ───────────────────────────────────── */}
      <BottomSheetModal
        ref={filterSheet}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <View style={styles.sheetHeaderRight}>
              {advancedCount > 0 && (
                <Pressable onPress={clearAdvanced} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear all</Text>
                </Pressable>
              )}
              <Pressable onPress={() => filterSheet.current?.dismiss()} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>

          <SheetSection label="Sort">
            {SORT_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.sheetChip, sortFilter === f.value && styles.sheetChipActive]}
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortFilter(f.value) }}
              >
                <Text style={[styles.sheetChipText, sortFilter === f.value && styles.sheetChipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </SheetSection>

          <SheetSection label="Date posted">
            {RECENCY_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.sheetChip, recencyFilter === f.value && styles.sheetChipActive]}
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRecencyFilter(f.value) }}
              >
                <Text style={[styles.sheetChipText, recencyFilter === f.value && styles.sheetChipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </SheetSection>

          <SheetSection label="Job type">
            {JOB_TYPE_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.sheetChip, jobTypeFilter === f.value && styles.sheetChipActive]}
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setJobTypeFilter(f.value) }}
              >
                <Text style={[styles.sheetChipText, jobTypeFilter === f.value && styles.sheetChipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </SheetSection>

          {sourceChips.length > 1 && (
            <SheetSection label="Source">
              {sourceChips.map(s => (
                <Pressable
                  key={s}
                  style={[styles.sheetChip, sourceFilter === s && styles.sheetChipActive]}
                  onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSourceFilter(s) }}
                >
                  <Text style={[styles.sheetChipText, sourceFilter === s && styles.sheetChipTextActive]}>
                    {s === 'all' ? 'All sources' : formatSource(s)}
                  </Text>
                </Pressable>
              ))}
            </SheetSection>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  )
}

// ─── SheetSection ─────────────────────────────────────────────────────────────

function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.sheetSection}>
      <Text style={styles.sheetSectionLabel}>{label}</Text>
      <View style={styles.sheetChipRow}>{children}</View>
    </View>
  )
}

// ─── ScrapeButton ─────────────────────────────────────────────────────────────

function ScrapeButton({ scraping, onPress }: { scraping: boolean; onPress: () => void }) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (scraping) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1, false
      )
    } else {
      cancelAnimation(rotation)
      rotation.value = withTiming(0, { duration: 250 })
    }
  }, [scraping])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Pressable
      style={({ pressed }) => [styles.scrapeBtn, pressed && { opacity: 0.6 }]}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      disabled={scraping}
    >
      <Animated.Text style={[styles.scrapeBtnIcon, iconStyle]}>⟳</Animated.Text>
    </Pressable>
  )
}

// ─── SkeletonFeed ─────────────────────────────────────────────────────────────

function SkeletonFeed() {
  const opacity = useSharedValue(0.35)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 850, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      -1, true
    )
  }, [])

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map(i => (
        <Animated.View key={i} style={[styles.skeletonCard, pulse]}>
          <View style={styles.skeletonRail}>
            <View style={styles.skeletonChip} />
            <View style={[styles.skeletonChip, { width: 72 }]} />
          </View>
          <View style={styles.skeletonHero}>
            <View style={styles.skeletonLogo} />
            <View style={{ flex: 1, gap: 9 }}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '55%' }]} />
              <View style={[styles.skeletonLine, { width: '35%', height: 10 }]} />
            </View>
          </View>
          <View style={styles.skeletonBar} />
          <View style={[styles.skeletonLine, { width: '90%', height: 10 }]} />
          <View style={[styles.skeletonLine, { width: '65%', height: 10 }]} />
        </Animated.View>
      ))}
    </View>
  )
}

// ─── JobCard ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  index,
  onPress,
  onSave,
}: {
  job: Job
  index: number
  onPress: () => void
  onSave: () => void
}) {
  const scoreColor =
    (job.matchScore ?? 0) >= 80 ? Colors.green :
    (job.matchScore ?? 0) >= 60 ? Colors.amber :
    Colors.orange

  const [trackWidth, setTrackWidth] = useState(0)
  const barW = useSharedValue(0)

  useEffect(() => {
    if (job.matchScore != null && trackWidth > 0) {
      barW.value = withDelay(180, withTiming(trackWidth * job.matchScore / 100, {
        duration: 620,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
      }))
    }
  }, [job.matchScore, trackWidth])

  const barStyle = useAnimatedStyle(() => ({ width: barW.value }))

  const preview     = descriptionPreview(job.description)
  const postedLabel = formatRelativeDate(job.postedAt)
  const sourceLabel = formatSource(job.source)
  const statusLabel = job.status === 'saved' ? 'Tracked' : formatSource(job.status)
  const initials    = job.company.substring(0, 2).toUpperCase()

  return (
    <Animated.View
      entering={index < 12
        ? FadeInDown.delay(index * 40).duration(320)
        : undefined
      }
    >
      <Pressable
        style={({ pressed }) => [styles.jobCard, pressed && styles.jobCardPressed]}
        onPress={onPress}
      >
        {/* Rail */}
        <View style={styles.cardRail}>
          <View style={styles.cardRailLeft}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrowChipText}>{sourceLabel}</Text>
            </View>
            {postedLabel && <Text style={styles.railMeta}>Posted {postedLabel}</Text>}
          </View>
          <Pressable
            style={styles.saveBtn}
            hitSlop={10}
            onPress={e => {
              e.stopPropagation?.()
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSave()
            }}
          >
            <Text style={[styles.saveBtnText, job.isSaved && styles.saveBtnTextActive]}>
              {job.isSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.cardHero}>
          <View style={styles.companyLogo}>
            <Text style={styles.companyLogoText}>{initials}</Text>
          </View>
          <View style={styles.cardHeader}>
            <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
            <Text style={styles.jobCompany} numberOfLines={1}>{job.company}</Text>
            <View style={styles.jobSubMeta}>
              {job.location && <Text style={styles.jobSubMetaText} numberOfLines={1}>{job.location}</Text>}
              {job.location && job.salary && <Text style={styles.jobSubMetaDot}>·</Text>}
              {job.salary   && <Text style={styles.jobSubMetaText}>{job.salary}</Text>}
            </View>
          </View>
        </View>

        {/* Match + signals */}
        <View style={styles.scoreRow}>
          {job.matchScore != null ? (
            <View style={styles.matchPanel}>
              <View style={styles.matchTop}>
                <Text style={styles.matchLabel}>Match</Text>
                <Text style={[styles.matchValue, { color: scoreColor }]}>{job.matchScore}%</Text>
              </View>
              <View
                style={styles.matchTrack}
                onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View style={[styles.matchFill, barStyle, { backgroundColor: scoreColor }]} />
              </View>
            </View>
          ) : (
            <View style={styles.matchMuted}>
              <Text style={styles.matchMutedText}>Match score pending</Text>
            </View>
          )}

          <View style={styles.signals}>
            <View style={styles.signalChip}>
              <Text style={styles.signalText}>{statusLabel}</Text>
            </View>
            {job.isRemote && (
              <View style={styles.signalChip}>
                <Text style={styles.signalText}>Remote</Text>
              </View>
            )}
            {job.jobType && job.jobType !== 'remote' && (
              <View style={styles.signalChip}>
                <Text style={styles.signalText}>{job.jobType}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {preview && (
          <Text style={styles.description} numberOfLines={2}>{preview}</Text>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerMeta}>{job.url ? 'Direct apply available' : 'Tracked in Arro'}</Text>
          <View style={styles.openBtn}>
            <Text style={styles.openBtnText}>Open role</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  filter,
  scraping,
  onSearch,
}: {
  filter: PrimaryFilter
  scraping: boolean
  onSearch: () => void
}) {
  if (scraping) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.emptyTitle}>Searching job boards…</Text>
        <Text style={styles.emptySub}>Pulling fresh roles for your feed.</Text>
      </View>
    )
  }
  if (filter === 'saved') {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No saved jobs yet</Text>
        <Text style={styles.emptySub}>Save roles from the feed to track them here.</Text>
      </View>
    )
  }
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No matching jobs right now</Text>
      <Text style={styles.emptySub}>Pull fresh listings from job boards based on your profile and preferences.</Text>
      <Pressable
        style={({ pressed }) => [styles.findBtn, pressed && { opacity: 0.82 }]}
        onPress={onSearch}
      >
        <Text style={styles.findBtnText}>Find my jobs</Text>
      </Pressable>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },

  // Header
  header: {
    backgroundColor: Colors.dark,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  logoArrow: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  wordmark: { fontSize: 18, fontWeight: '600', color: wm(0.9), letterSpacing: -0.5 },
  wordmarkO: { color: Colors.orange },
  creditPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: wm(0.06),
    borderWidth: 1, borderColor: wm(0.08),
  },
  creditPillLow:  { backgroundColor: orangeAlpha(0.12), borderColor: orangeAlpha(0.2) },
  creditPillEmpty: { backgroundColor: 'rgba(226,75,74,0.1)', borderColor: 'rgba(226,75,74,0.2)' },
  creditDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.orange },
  creditText: { fontSize: FontSize.sm, fontWeight: '500', color: wm(0.65) },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: wm(0.04),
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: wm(0.08),
  },
  searchBarFocused: {
    borderColor: orangeAlpha(0.38), backgroundColor: wm(0.06),
    shadowColor: Colors.orange, shadowOpacity: 0.14,
    shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  searchGlyph: { fontSize: 16, color: wm(0.3), lineHeight: 18 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: wm(0.85) },
  searchClear: { fontSize: 12, color: wm(0.3), fontWeight: '600' },

  // Filter strip
  filterStrip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChipsScroll: { flex: 1 },
  filterChips: { gap: 6, paddingRight: 4 },
  viewChip: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.1), backgroundColor: wm(0.04),
  },
  viewChipActive: { backgroundColor: orangeAlpha(0.12), borderColor: orangeAlpha(0.28) },
  viewChipText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.45) },
  viewChipTextActive: { color: Colors.orange },
  filterActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scrapeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: wm(0.05), borderWidth: 1, borderColor: wm(0.09),
    alignItems: 'center', justifyContent: 'center',
  },
  scrapeBtnIcon: { fontSize: 16, color: wm(0.5), lineHeight: 18 },
  filtersPill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.1), backgroundColor: wm(0.04),
  },
  filtersPillActive: { backgroundColor: orangeAlpha(0.12), borderColor: orangeAlpha(0.28) },
  filtersPillText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.45) },
  filtersPillTextActive: { color: Colors.orange },

  // Feed list
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },

  // Skeleton
  skeletonList: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  skeletonCard: {
    backgroundColor: wm(0.04), borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: wm(0.06), gap: 12,
  },
  skeletonRail: { flexDirection: 'row', gap: 8 },
  skeletonChip: { height: 22, width: 52, borderRadius: 11, backgroundColor: wm(0.07) },
  skeletonHero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  skeletonLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: wm(0.07) },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: wm(0.07) },
  skeletonBar: { height: 6, borderRadius: 3, backgroundColor: wm(0.07) },

  // Job card
  jobCard: {
    backgroundColor: wm(0.04),
    borderRadius: 20, marginBottom: 10,
    padding: 16, borderWidth: 1, borderColor: wm(0.07), gap: 12,
  },
  jobCardPressed: { opacity: 0.92, transform: [{ scale: 0.987 }] },
  cardRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardRailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  eyebrowChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, backgroundColor: orangeAlpha(0.1),
    borderWidth: 1, borderColor: orangeAlpha(0.18),
  },
  eyebrowChipText: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: Colors.orange, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  railMeta: { fontSize: FontSize.xs, color: wm(0.34), fontWeight: '600' },
  saveBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.1), backgroundColor: wm(0.03),
  },
  saveBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.5), textTransform: 'uppercase', letterSpacing: 0.4 },
  saveBtnTextActive: { color: Colors.orange },
  cardHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  companyLogo: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: orangeAlpha(0.12),
    borderWidth: 1, borderColor: orangeAlpha(0.18),
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  companyLogoText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.orange, letterSpacing: 0.45 },
  cardHeader: { flex: 1, gap: 4 },
  jobTitle: { fontSize: FontSize.xl, fontWeight: '700', color: wm(0.9), letterSpacing: -0.3, lineHeight: 20 },
  jobCompany: { fontSize: FontSize.md, color: wm(0.6), fontWeight: '600' },
  jobSubMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  jobSubMetaText: { fontSize: FontSize.sm, color: wm(0.4), fontWeight: '500' },
  jobSubMetaDot: { fontSize: FontSize.sm, color: wm(0.22) },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  matchPanel: {
    flex: 1, gap: 8, padding: 12,
    borderRadius: 14, backgroundColor: wm(0.03),
    borderWidth: 1, borderColor: wm(0.06),
  },
  matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchLabel: { fontSize: FontSize.xs, color: wm(0.38), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  matchValue: { fontSize: FontSize.md, fontWeight: '800' },
  matchTrack: { height: 6, borderRadius: 999, backgroundColor: wm(0.06), overflow: 'hidden' },
  matchFill: { height: '100%', borderRadius: 999 },
  matchMuted: {
    flex: 1, padding: 12,
    borderRadius: 14, backgroundColor: wm(0.025),
    borderWidth: 1, borderColor: wm(0.05),
  },
  matchMutedText: { fontSize: FontSize.sm, color: wm(0.35), fontWeight: '600' },
  signals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: '42%' },
  signalChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: wm(0.03),
    borderWidth: 1, borderColor: wm(0.08),
  },
  signalText: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.58), textTransform: 'uppercase', letterSpacing: 0.35 },
  description: { fontSize: FontSize.md, lineHeight: 20, color: wm(0.64) },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerMeta: { fontSize: FontSize.sm, color: wm(0.34), fontWeight: '600', flex: 1 },
  openBtn: {
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, backgroundColor: wm(0.08),
    borderWidth: 1, borderColor: wm(0.12),
  },
  openBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: wm(0.86) },

  // Feed gate
  feedGateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 4, marginBottom: 16,
    backgroundColor: orangeAlpha(0.08), borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: orangeAlpha(0.2),
  },
  feedGateInner: { flex: 1, gap: 3 },
  feedGateTitle: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.85), letterSpacing: -0.2 },
  feedGateSub: { fontSize: FontSize.sm, color: wm(0.4), lineHeight: 16 },
  feedGateCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.orange },
  feedGateCtaText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  // Empty state
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 72, paddingHorizontal: 28, gap: 12,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '600', color: wm(0.7), letterSpacing: -0.3, textAlign: 'center' },
  emptySub: { fontSize: FontSize.md, color: wm(0.35), textAlign: 'center', lineHeight: 20 },
  findBtn: {
    marginTop: 8, backgroundColor: Colors.orange,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
  },
  findBtnText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600', letterSpacing: -0.2 },

  // Bottom sheet
  sheetBg: { backgroundColor: Colors.dark2 },
  sheetHandle: { backgroundColor: wm(0.15), width: 36 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48, gap: 22 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: wm(0.06),
  },
  sheetTitle: { fontSize: FontSize['2xl'], fontWeight: '700', color: wm(0.9), letterSpacing: -0.4 },
  sheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: wm(0.1),
  },
  clearBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.5) },
  doneBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, backgroundColor: Colors.orange,
  },
  doneBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  sheetSection: { gap: 10 },
  sheetSectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3),
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  sheetChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
    borderColor: wm(0.1), backgroundColor: wm(0.04),
  },
  sheetChipActive: { backgroundColor: orangeAlpha(0.12), borderColor: orangeAlpha(0.28) },
  sheetChipText: { fontSize: FontSize.base, fontWeight: '500', color: wm(0.5) },
  sheetChipTextActive: { color: Colors.orange, fontWeight: '600' },
})
