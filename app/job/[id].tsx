import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TextInput,
} from 'react-native'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type JobDetail = {
  id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  jobType: string | null
  matchScore: number | null
  isSaved: boolean
  status: string
  notes: string | null
  nextStep: string | null
  appliedAt: string | null
  description: string | null
  url: string | null
  source: string | null
  postedAt: string | null
  isRemote: boolean
  generatedResumes: { id: string; template: string; createdAt: string }[]
  prepKits: { id: string; createdAt: string }[]
  companyResearchItems: { id: string; createdAt: string }[]
}

const STATUS_CYCLE = ['saved', 'applied', 'interviewing', 'offer'] as const
type Status = (typeof STATUS_CYCLE)[number]

const STATUS_LABELS: Record<Status, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
}

const STATUS_COLORS: Record<Status, string> = {
  saved: wm(0.35),
  applied: Colors.blue,
  interviewing: Colors.orange,
  offer: Colors.green,
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
    .replace(/\b\w/g, match => match.toUpperCase())
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [generatingKit, setGeneratingKit] = useState(false)
  const [generatingResearch, setGeneratingResearch] = useState(false)
  const matchAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    fetchJob()
  }, [id])

  const fetchJob = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ job: JobDetail }>(`/api/jobs/${id}`, {}, token)
      setJob(data.job)
      setNotes(data.job.notes ?? '')
      // Animate match bar
      Animated.timing(matchAnim, {
        toValue: (data.job.matchScore ?? 0) / 100,
        duration: 550,
        delay: 220,
        useNativeDriver: false,
      }).start()
    } catch (err) {
      console.error('Failed to fetch job:', err)
    } finally {
      setLoading(false)
    }
  }

  const cycleStatus = async () => {
    if (!job) return
    const idx = STATUS_CYCLE.indexOf(job.status as Status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setJob(prev => prev ? { ...prev, status: next } : prev)
    try {
      const token = await getToken()
      await apiRequest(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, ...(next === 'applied' ? { appliedAt: new Date().toISOString() } : {}) }),
      }, token)
    } catch {}
  }

  const handleResume = async () => {
    if (!job) return
    if (job.generatedResumes.length > 0) {
      router.push(`/resume/${job.generatedResumes[0].id}`)
      return
    }
    setGeneratingResume(true)
    try {
      const token = await getToken()
      await apiRequest<{ resumeId: string }>(
        '/api/resume',
        { method: 'POST', body: JSON.stringify({ jobId: id }) },
        token
      )
      await fetchJob()
    } catch (err: any) {
      if (err.message?.includes('Insufficient credits')) router.push('/upgrade')
    } finally {
      setGeneratingResume(false)
    }
  }

  const handlePrepKit = async () => {
    if (!job) return
    if (job.prepKits.length > 0) {
      router.push(`/prep-kit/${job.prepKits[0].id}`)
      return
    }
    setGeneratingKit(true)
    try {
      const token = await getToken()
      const data = await apiRequest<{ kitId: string }>(
        '/api/prep-kit',
        { method: 'POST', body: JSON.stringify({ jobId: id }) },
        token
      )
      router.push(`/prep-kit/${data.kitId}`)
    } catch (err: any) {
      if (err.message?.includes('Insufficient credits')) router.push('/upgrade')
    } finally {
      setGeneratingKit(false)
    }
  }

  const handleResearch = async () => {
    if (!job) return
    if (job.companyResearchItems.length > 0) {
      router.push(`/research/${job.companyResearchItems[0].id}`)
      return
    }
    setGeneratingResearch(true)
    try {
      const token = await getToken()
      const data = await apiRequest<{ researchId: string }>(
        '/api/research',
        { method: 'POST', body: JSON.stringify({ jobId: id }) },
        token
      )
      router.push(`/research/${data.researchId}`)
    } catch (err: any) {
      if (err.message?.includes('Insufficient credits')) router.push('/upgrade')
    } finally {
      setGeneratingResearch(false)
    }
  }

  const saveNotes = async () => {
    if (!job || savingNotes) return
    setSavingNotes(true)
    try {
      const token = await getToken()
      await apiRequest(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }, token)
    } catch {} finally {
      setSavingNotes(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    )
  }

  if (!job) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>Job not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </Pressable>
      </View>
    )
  }

  const status = (job.status as Status) ?? 'saved'
  const matchPct = job.matchScore ?? 0
  const hasResume = job.generatedResumes.length > 0
  const hasPrepKit = job.prepKits.length > 0
  const hasResearch = job.companyResearchItems.length > 0
  const resumeStatus = generatingResume ? 'generating…' : hasResume ? 'resume ready' : 'generate'
  const kitStatus = generatingKit ? 'generating…' : hasPrepKit ? 'ready' : 'generate'
  const researchStatus = generatingResearch ? 'generating…' : hasResearch ? 'ready' : 'generate'
  const postedLabel = formatRelativeDate(job.postedAt)

  return (
    <View style={styles.container}>
      {/* Nav header */}
      <View style={styles.navHeader}>
        <Pressable style={styles.backCircle} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{job.title}</Text>
        <Pressable style={styles.statusCycleBtn} onPress={cycleStatus}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
          <Text style={[styles.statusCycleText, { color: STATUS_COLORS[status] }]}>
            {STATUS_LABELS[status]}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Company row */}
        <View style={styles.companyRow}>
          <View style={styles.companyLogo}>
            <Text style={styles.companyLogoText}>{job.company.substring(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.companyMeta}>
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </Text>
            <Text style={styles.sourceMeta}>
              {postedLabel ? `Posted ${postedLabel}` : 'Posting date unavailable'} · {formatSource(job.source)}
              {job.isRemote ? ' · Remote' : ''}
            </Text>
            {job.salary && <Text style={styles.salary}>{job.salary}</Text>}
          </View>
        </View>

        {/* Match score */}
        {matchPct > 0 && (
          <View style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchLabel}>MATCH SCORE</Text>
              <Text style={styles.matchPct}>{matchPct}%</Text>
            </View>
            <View style={styles.matchTrack}>
              <Animated.View
                style={[
                  styles.matchFill,
                  {
                    width: matchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: matchPct >= 70 ? Colors.green : matchPct >= 50 ? Colors.amber : Colors.orange,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Applied date */}
        {job.appliedAt && (
          <View style={styles.appliedRow}>
            <Text style={styles.appliedText}>
              Applied {new Date(job.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        )}

        {/* Section cards */}
        <Text style={styles.sectionTitle}>YOUR KIT</Text>

        <SectionCard
          icon="📄"
          iconBg={orangeAlpha(0.12)}
          title="Tailored Resume"
          description={
            hasResume
              ? 'Your tailored resume is ready. Open it whenever you want to review, edit, or export it.'
              : 'Generate a resume optimised for this specific role and company.'
          }
          status={resumeStatus}
          statusColor={hasResume ? Colors.green : generatingResume ? Colors.amber : wm(0.3)}
          onPress={handleResume}
          disabled={generatingResume}
        />

        <SectionCard
          icon="📋"
          iconBg="rgba(93,202,165,0.1)"
          title="Prep Kit"
          description="Cover letter, pitch, screening answers, follow-ups, and salary strategy."
          status={kitStatus}
          statusColor={hasPrepKit ? Colors.green : generatingKit ? Colors.amber : wm(0.3)}
          onPress={handlePrepKit}
          disabled={generatingKit}
        />

        <SectionCard
          icon="🔎"
          iconBg="rgba(55,138,221,0.1)"
          title="Company Research"
          description="Role context, first 90 days, stakeholders, interview talking points, and risks."
          status={researchStatus}
          statusColor={hasResearch ? Colors.green : generatingResearch ? Colors.amber : wm(0.3)}
          onPress={handleResearch}
          disabled={generatingResearch}
        />

        <SectionCard
          icon="🎙"
          iconBg="rgba(26,20,16,0.06)"
          title="Interview Practice"
          description="Practice sessions with AI coaching and real-time debrief."
          status="start session"
          statusColor={Colors.orange}
          onPress={() => router.push(`/interview/${id}`)}
        />

        {/* Description */}
        {job.description && (
          <>
            <Text style={styles.sectionTitle}>JOB DESCRIPTION</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{job.description}</Text>
            </View>
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionTitle}>NOTES</Text>
        <View style={styles.notesCard}>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes about this role, interview tips, contacts…"
            placeholderTextColor={wm(0.25)}
            value={notes}
            onChangeText={setNotes}
            multiline
            onBlur={saveNotes}
          />
          {savingNotes && (
            <ActivityIndicator size="small" color={Colors.orange} style={styles.notesSaving} />
          )}
        </View>

        {/* Apply CTA */}
        {job.url && (
          <Pressable
            style={({ pressed }) => [styles.applyCta, pressed && styles.applyCtaPressed]}
            onPress={() => {
              import('react-native').then(({ Linking }) => Linking.openURL(job.url!))
            }}
          >
            <Text style={styles.applyCtaText}>View original posting →</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon, iconBg, title, description, status, statusColor, onPress, disabled,
}: {
  icon: string
  iconBg: string
  title: string
  description: string
  status: string
  statusColor: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.sectionCard, pressed && !disabled && styles.sectionCardPressed, disabled && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.sectionIcon, { backgroundColor: iconBg }]}>
        <Text style={styles.sectionIconEmoji}>{icon}</Text>
      </View>
      <View style={styles.sectionCardBody}>
        <View style={styles.sectionCardTop}>
          <Text style={styles.sectionCardTitle}>{title}</Text>
          <Text style={[styles.sectionCardStatus, { color: statusColor }]}>{status}</Text>
        </View>
        <Text style={styles.sectionCardDesc}>{description}</Text>
      </View>
      <Text style={styles.sectionCardArrow}>›</Text>
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark, gap: Spacing[4] },
  errorText: { fontSize: FontSize.md, color: wm(0.45) },
  backBtn: { paddingVertical: 8 },
  backBtnText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '500' },

  // Nav header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
    backgroundColor: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  backCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: wm(0.07),
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: wm(0.7), marginTop: -1 },
  navTitle: {
    flex: 1,
    fontSize: FontSize.xl, fontWeight: '600',
    color: wm(0.85), letterSpacing: -0.3,
  },
  statusCycleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wm(0.12),
    backgroundColor: wm(0.05),
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusCycleText: { fontSize: FontSize.sm, fontWeight: '600' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing[5], paddingBottom: 60, gap: Spacing[4] },

  // Company row
  companyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[4],
    backgroundColor: wm(0.04),
    borderRadius: Radius.artifact,
    padding: Spacing[5],
    borderWidth: 1, borderColor: wm(0.08),
  },
  companyLogo: {
    width: 52, height: 52, borderRadius: 15,
    backgroundColor: wm(0.07),
    alignItems: 'center', justifyContent: 'center',
  },
  companyLogoText: { fontSize: FontSize.md, fontWeight: '700', color: wm(0.4), letterSpacing: 0.5 },
  companyInfo: { flex: 1, gap: 3 },
  jobTitle: { fontSize: FontSize['2xl'], fontWeight: '600', color: wm(0.9), letterSpacing: -0.4 },
  companyMeta: { fontSize: FontSize.md, color: wm(0.45) },
  sourceMeta: { fontSize: FontSize.xs, color: wm(0.34), fontWeight: '500' },
  salary: { fontSize: FontSize.base, fontWeight: '500', color: Colors.orange, marginTop: 2 },

  // Match card
  matchCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.stat,
    padding: Spacing[4],
    borderWidth: 1, borderColor: wm(0.07),
    gap: Spacing[2],
  },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchLabel: { fontSize: FontSize.xs, fontWeight: '600', color: wm(0.3), letterSpacing: 0.6 },
  matchPct: { fontSize: FontSize.lg, fontWeight: '700', color: wm(0.85) },
  matchTrack: {
    height: 4, backgroundColor: wm(0.07),
    borderRadius: 2, overflow: 'hidden',
  },
  matchFill: { height: '100%', borderRadius: 2 },

  // Applied row
  appliedRow: { alignItems: 'center' },
  appliedText: { fontSize: FontSize.sm, color: wm(0.35), fontWeight: '500' },

  // Section title
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: wm(0.3), letterSpacing: 0.08,
    marginBottom: -Spacing[2],
    marginTop: Spacing[2],
  },

  // Section cards
  sectionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4],
    backgroundColor: wm(0.04),
    borderRadius: Radius.artifact,
    padding: Spacing[5],
    borderWidth: 1, borderColor: wm(0.08),
  },
  sectionCardPressed: { backgroundColor: wm(0.07) },
  sectionIcon: {
    width: 44, height: 44, borderRadius: Radius.inputLg,
    backgroundColor: wm(0.06),
    alignItems: 'center', justifyContent: 'center',
  },
  sectionIconEmoji: { fontSize: 18 },
  sectionCardBody: { flex: 1, gap: 3 },
  sectionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionCardTitle: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.85), letterSpacing: -0.01 },
  sectionCardStatus: { fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 0.3 },
  sectionCardDesc: { fontSize: FontSize.base, color: wm(0.4), lineHeight: 16 },
  sectionCardArrow: { fontSize: 20, color: wm(0.2) },

  // Description
  descriptionCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.artifact,
    padding: Spacing[5],
    borderWidth: 1, borderColor: wm(0.07),
  },
  descriptionText: { fontSize: FontSize.md, color: wm(0.55), lineHeight: 22 },

  // Notes
  notesCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.artifact,
    padding: Spacing[5],
    borderWidth: 1, borderColor: wm(0.07),
    minHeight: 100,
  },
  notesInput: {
    fontSize: FontSize.md, color: wm(0.75),
    lineHeight: 22, minHeight: 80,
  },
  notesSaving: { position: 'absolute', top: Spacing[4], right: Spacing[4] },

  // Apply CTA
  applyCta: {
    borderRadius: Radius.artifact,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1, borderColor: wm(0.1),
    backgroundColor: wm(0.04),
    marginTop: Spacing[2],
  },
  applyCtaPressed: { backgroundColor: wm(0.07) },
  applyCtaText: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.45) },
})
