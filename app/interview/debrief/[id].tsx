import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Colors, FontSize, Spacing, wm, orangeAlpha } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type Debrief = {
  overallScore: number
  strengths: string[]
  improvements: string[]
  summary: string
}

type SessionDetail = {
  id: string
  status: string
  questionsAnswered: number
  avgConfidence: number | null
  durationSeconds: number | null
  startedAt: string
  completedAt: string | null
  job: { id: string; title: string; company: string } | null
  debrief: Debrief | null
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function DebriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [id])

  const load = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ session: SessionDetail }>(
        `/api/interview/sessions/${id}`,
        {},
        token
      )
      setSession(data.session)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    )
  }

  if (error || !session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Session not found'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const { debrief } = session
  const scoreColor =
    (debrief?.overallScore ?? 0) >= 80 ? Colors.green :
    (debrief?.overallScore ?? 0) >= 60 ? Colors.amber :
    Colors.orange

  const date = new Date(session.startedAt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const duration = formatDuration(session.durationSeconds)

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={10}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Sessions</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {session.job ? `${session.job.title} · ${session.job.company}` : 'General practice'}
        </Text>
        <Text style={styles.headerMeta}>{date}{duration ? ` · ${duration}` : ''} · {session.questionsAnswered} questions</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {debrief ? (
          <>
            {/* Score */}
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreNumber, { color: scoreColor }]}>{debrief.overallScore}</Text>
              <Text style={styles.scoreLabel}>Overall score</Text>
              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${debrief.overallScore}%`, backgroundColor: scoreColor }]} />
              </View>
            </View>

            {/* Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>COACH SUMMARY</Text>
              <Text style={styles.summaryText}>{debrief.summary}</Text>
            </View>

            {/* Strengths */}
            {debrief.strengths.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STRENGTHS</Text>
                <View style={styles.itemList}>
                  {debrief.strengths.map((s, i) => (
                    <View key={i} style={styles.item}>
                      <View style={[styles.itemDot, { backgroundColor: Colors.green }]} />
                      <Text style={styles.itemText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Improvements */}
            {debrief.improvements.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>AREAS TO IMPROVE</Text>
                <View style={styles.itemList}>
                  {debrief.improvements.map((s, i) => (
                    <View key={i} style={styles.item}>
                      <View style={[styles.itemDot, { backgroundColor: Colors.amber }]} />
                      <Text style={styles.itemText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noDebrief}>
            <Text style={styles.noDebriefTitle}>
              {session.status === 'completed' ? 'Debrief generating…' : 'Session in progress'}
            </Text>
            <Text style={styles.noDebriefSub}>
              {session.status === 'completed'
                ? 'Your debrief will appear here once it\'s ready.'
                : 'Complete the session to receive your AI debrief and score.'}
            </Text>
          </View>
        )}

        {/* Practice again */}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={() => {
            if (session.job) {
              router.push(`/interview/${session.job.id}`)
            } else {
              router.push('/interview/new')
            }
          }}
        >
          <Text style={styles.ctaText}>Practice again</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  centered: { flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: FontSize.md, color: wm(0.5), textAlign: 'center' },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: wm(0.1),
  },
  backBtnText: { fontSize: FontSize.base, color: wm(0.6), fontWeight: '500' },

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
  headerTitle: { fontSize: FontSize.xl, fontWeight: '600', color: wm(0.88), letterSpacing: -0.3 },
  headerMeta: { fontSize: FontSize.sm, color: wm(0.35), fontWeight: '500' },

  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 16 },

  scoreCard: {
    backgroundColor: wm(0.04),
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: wm(0.07),
    alignItems: 'center',
    gap: 6,
  },
  scoreNumber: { fontSize: 72, fontWeight: '700', letterSpacing: -3, lineHeight: 76 },
  scoreLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.35), textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: wm(0.07),
    overflow: 'hidden',
    marginTop: 8,
  },
  scoreFill: { height: '100%', borderRadius: 999 },

  section: {
    backgroundColor: wm(0.04),
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 12,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: wm(0.3),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryText: { fontSize: FontSize.md, lineHeight: 22, color: wm(0.72) },
  itemList: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  itemText: { flex: 1, fontSize: FontSize.md, lineHeight: 21, color: wm(0.72) },

  noDebrief: {
    backgroundColor: wm(0.04),
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 8,
    alignItems: 'center',
  },
  noDebriefTitle: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.7), letterSpacing: -0.2 },
  noDebriefSub: { fontSize: FontSize.md, color: wm(0.35), textAlign: 'center', lineHeight: 20 },

  cta: {
    backgroundColor: orangeAlpha(0.12),
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: orangeAlpha(0.2),
    marginTop: 4,
  },
  ctaText: { color: Colors.orange, fontSize: FontSize.lg, fontWeight: '600' },
})
