import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type Session = {
  id: string
  status: string
  questionsAnswered: number
  avgConfidence: number | null
  startedAt: string
  completedAt: string | null
  job: { id: string; title: string; company: string } | null
}

export default function InterviewTab() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      fetchSessions()
    }, [])
  )

  const fetchSessions = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ sessions: Session[] }>('/api/interview/sessions', {}, token)
      setSessions(data.sessions)
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerKicker}>
          <View style={styles.kickerLine} />
          <Text style={styles.kickerText}>AI INTERVIEW</Text>
        </View>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Real-time voice interview with copilot cues</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main CTA */}
        <Pressable
          style={({ pressed }) => [styles.startCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/interview/new')}
        >
          {/* Orb with rings */}
          <View style={styles.orbWrap}>
            <View style={styles.orbRing} />
            <View style={styles.orb}>
              <View style={styles.orbInner} />
            </View>
          </View>

          <View style={styles.startBody}>
            <Text style={styles.startTitle}>Start a session</Text>
            <Text style={styles.startDesc}>
              AI hiring manager asks questions. Copilot guides your answers in real time.
            </Text>
          </View>

          <View style={styles.startArrowWrap}>
            <Text style={styles.startArrow}>→</Text>
          </View>
        </Pressable>

        {/* Cost note */}
        <View style={styles.costRow}>
          <View style={styles.costDot} />
          <Text style={styles.costText}>20 credits · Free for Pro</Text>
        </View>

        {/* Copilot feature callout */}
        <View style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={styles.featureDot} />
            <Text style={styles.featureLabel}>INTERVIEW COPILOT</Text>
          </View>
          <Text style={styles.featureTitle}>Live cues while you answer</Text>
          <Text style={styles.featureDesc}>
            The copilot classifies each question, suggests a framework, and shows real-time guidance — structure, impact, wrap-up — without breaking your flow.
          </Text>

          <View style={styles.cuePreviewRow}>
            {(['SET CONTEXT', 'SHOW IMPACT', 'LAND THE RESULT'] as const).map((cue, i) => (
              <View key={i} style={[styles.cueChip, i === 1 && styles.cueChipActive]}>
                <Text style={[styles.cueChipText, i === 1 && styles.cueChipTextActive]}>{cue}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Past sessions */}
        {!loading && sessions.length > 0 && (
          <View style={styles.pastSection}>
            <Text style={styles.pastLabel}>PAST SESSIONS</Text>
            {sessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </View>
        )}

        {loading && <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />}
      </ScrollView>
    </View>
  )
}

function SessionCard({ session }: { session: Session }) {
  const router = useRouter()
  const date = new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isComplete = session.status === 'completed'

  return (
    <Pressable
      style={({ pressed }) => [styles.sessionCard, pressed && { opacity: 0.82 }]}
      onPress={() => router.push(`/interview/debrief/${session.id}`)}
    >
      <View style={styles.sessionLeft}>
        <Text style={styles.sessionDate}>{date}</Text>
        <Text style={styles.sessionTitle} numberOfLines={1}>
          {session.job ? `${session.job.title} · ${session.job.company}` : 'General practice'}
        </Text>
        <Text style={styles.sessionMeta}>
          {session.questionsAnswered} questions{session.avgConfidence ? ` · ${session.avgConfidence}% confidence` : ''}
        </Text>
      </View>
      <View style={styles.sessionRight}>
        <View style={[styles.sessionBadge, isComplete ? styles.badgeComplete : styles.badgeActive]}>
          <Text style={[styles.sessionBadgeText, isComplete ? styles.badgeCompleteText : styles.badgeActiveText]}>
            {session.status}
          </Text>
        </View>
        <Text style={styles.sessionArrow}>›</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },

  // Header
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  headerKicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  kickerLine: { width: 20, height: 1, backgroundColor: Colors.orange },
  kickerText: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: Colors.orange, letterSpacing: 0.1,
  },
  title: {
    fontSize: 28, fontWeight: '600',
    color: wm(0.9), letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.md, color: wm(0.4), letterSpacing: -0.01 },

  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 16 },

  // Start card
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: wm(0.05),
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: wm(0.1),
  },
  orbWrap: { position: 'relative', width: 52, height: 52, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  orbRing: {
    position: 'absolute',
    width: 52, height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: orangeAlpha(0.25),
  },
  orb: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  orbInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  startBody: { flex: 1, gap: 4 },
  startTitle: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.85), letterSpacing: -0.2 },
  startDesc: { fontSize: FontSize.base, color: wm(0.4), lineHeight: 17 },
  startArrowWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: wm(0.07),
    alignItems: 'center', justifyContent: 'center',
  },
  startArrow: { fontSize: 14, color: wm(0.5), fontWeight: '600' },

  // Cost note
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  costDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: wm(0.2) },
  costText: { fontSize: FontSize.sm, color: wm(0.3), fontWeight: '500' },

  // Feature card
  featureCard: {
    backgroundColor: wm(0.04),
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 10,
    // Subtle orange top accent line
    overflow: 'hidden',
  },
  featureHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.orange,
  },
  featureLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: Colors.orange, letterSpacing: 0.08,
  },
  featureTitle: {
    fontSize: FontSize.lg, fontWeight: '600',
    color: wm(0.85), letterSpacing: -0.25,
  },
  featureDesc: {
    fontSize: FontSize.base, color: wm(0.4),
    lineHeight: 18, letterSpacing: -0.01,
  },
  cuePreviewRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 4 },
  cueChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: wm(0.1),
    backgroundColor: wm(0.04),
  },
  cueChipActive: {
    backgroundColor: orangeAlpha(0.12),
    borderColor: orangeAlpha(0.25),
  },
  cueChipText: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: wm(0.3), letterSpacing: 0.04,
  },
  cueChipTextActive: { color: Colors.orange },

  // Past sessions
  pastSection: { gap: 10, marginTop: 8 },
  pastLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    color: wm(0.25), letterSpacing: 0.08,
    marginBottom: 2,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: wm(0.04),
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 12,
  },
  sessionLeft: { flex: 1, gap: 2 },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionArrow: { fontSize: 18, color: wm(0.2), fontWeight: '300' },
  sessionDate: { fontSize: FontSize.xs, fontWeight: '600', color: wm(0.3) },
  sessionTitle: { fontSize: FontSize.md, fontWeight: '500', color: wm(0.75) },
  sessionMeta: { fontSize: FontSize.sm, color: wm(0.3) },
  sessionBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeComplete: { backgroundColor: 'rgba(93,202,165,0.12)' },
  badgeActive: { backgroundColor: 'rgba(239,158,39,0.12)' },
  sessionBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  badgeCompleteText: { color: Colors.green },
  badgeActiveText: { color: Colors.amber },
})
