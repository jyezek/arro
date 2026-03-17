import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { apiRequest } from '@/lib/api'
import { clearOnboardingSession, getOnboardingSession } from '@/lib/onboarding-session'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'

export default function OnboardingReview() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const session = getOnboardingSession()
  const extracted = session.extracted

  useEffect(() => {
    if (!extracted) {
      router.replace('/onboarding')
    }
  }, [extracted, router])

  if (!extracted) return null

  const continueToGapFill = async () => {
    try {
      setSaving(true)
      setError(null)
      const token = await getToken()
      await apiRequest(
        '/api/profile/import',
        {
          method: 'POST',
          body: JSON.stringify({
            source: session.source ?? 'text',
            resumeText: session.resumeText,
            extracted,
          }),
        },
        token
      )
      router.replace('/onboarding/gap-fill')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const missingBasics = [
    !extracted.location,
    !extracted.phone,
    !extracted.linkedinUrl && !extracted.portfolioUrl,
  ].filter(Boolean).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '60%' }]} />
      </View>
      <Text style={styles.kicker}>REVIEW WHAT WE FOUND</Text>
      <Text style={styles.title}>{missingBasics > 1 ? 'We found a few things.' : 'Looks good.'}</Text>
      <Text style={styles.subtitle}>
        We pulled this from your resume. Confirm it and we will use it as the source of truth for search, matching, tailored resumes, and prep.
      </Text>

      <SectionCard title="Basics">
        <ReviewRow label="Name" value={`${extracted.firstName} ${extracted.lastName}`.trim() || 'Not found'} />
        <ReviewRow label="Location" value={extracted.location || 'Not found'} />
        <ReviewRow label="Phone" value={extracted.phone || 'Not found'} />
        <ReviewRow label="LinkedIn" value={extracted.linkedinUrl || 'Not found'} />
        <ReviewRow label="Portfolio" value={extracted.portfolioUrl || 'Not found'} />
      </SectionCard>

      <SectionCard title={`Experience · ${extracted.experience.length}`}>
        {extracted.experience.length > 0 ? extracted.experience.map((item, index) => (
          <View key={`${item.company}-${index}`} style={[styles.expCard, index > 0 && styles.expCardBorder]}>
            <View style={styles.expHeader}>
              <View>
                <Text style={styles.expTitle}>{item.roleTitle}</Text>
                <Text style={styles.expMeta}>{item.company}</Text>
              </View>
              <Text style={styles.expDates}>{item.startDate}–{item.endDate || 'Present'}</Text>
            </View>
            <Text style={styles.expBullets}>
              {item.bullets.length} bullet{item.bullets.length === 1 ? '' : 's'} extracted
            </Text>
          </View>
        )) : <EmptyState text="No roles found. You can still build manually in Settings after onboarding." />}
      </SectionCard>

      <SectionCard title={`Education · ${extracted.education.length}`}>
        {extracted.education.length > 0 ? extracted.education.map((item, index) => (
          <Text key={`${item.institution}-${index}`} style={styles.listText}>
            {item.degree ? `${item.degree} · ` : ''}{item.institution}{item.graduationYear ? ` · ${item.graduationYear}` : ''}
          </Text>
        )) : <EmptyState text="No education entries found." />}
      </SectionCard>

      <SectionCard title={`Skills · ${extracted.skills.length}`}>
        {extracted.skills.length > 0 ? (
          <View style={styles.skillWrap}>
            {extracted.skills.map((skill, index) => (
              <View key={`${skill.name}-${index}`} style={styles.skillPill}>
                <Text style={styles.skillText}>{skill.name}</Text>
              </View>
            ))}
          </View>
        ) : <EmptyState text="No skills found." />}
      </SectionCard>

      <SectionCard title="Role signals">
        {extracted.inferredTargetRoles.length > 0 ? (
          <View style={styles.skillWrap}>
            {extracted.inferredTargetRoles.map((role, index) => (
              <View key={`${role}-${index}`} style={[styles.skillPill, styles.signalPill]}>
                <Text style={[styles.skillText, styles.signalText]}>{role}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="We could not infer clear target roles yet. You will set them in the next step." />
        )}
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.cta, saving && styles.ctaDisabled]} onPress={continueToGapFill} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.ctaText}>Looks right — continue</Text>}
      </Pressable>

      <Pressable
        onPress={() => {
          clearOnboardingSession()
          router.replace('/onboarding')
        }}
        style={styles.secondaryBtn}
      >
        <Text style={styles.secondaryText}>Start over</Text>
      </Pressable>
    </ScrollView>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content: {
    paddingHorizontal: Spacing[7],
    paddingTop: 56,
    paddingBottom: 48,
    gap: Spacing[4],
  },
  progressBar: {
    height: 3,
    backgroundColor: wm(0.08),
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.orange, borderRadius: 2 },
  kicker: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.orange,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: '600',
    color: wm(0.9),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: wm(0.4),
    lineHeight: 20,
    marginTop: -Spacing[2],
  },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.08),
    padding: Spacing[4],
    gap: Spacing[3],
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: wm(0.35),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  rowLabel: {
    fontSize: FontSize.sm,
    color: wm(0.3),
    width: 80,
  },
  rowValue: {
    flex: 1,
    fontSize: FontSize.base,
    color: wm(0.82),
    textAlign: 'right',
  },
  expCard: {
    gap: 4,
  },
  expCardBorder: {
    borderTopWidth: 1,
    borderTopColor: wm(0.07),
    paddingTop: Spacing[3],
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  expTitle: {
    fontSize: FontSize.base,
    color: wm(0.86),
    fontWeight: '600',
  },
  expMeta: {
    fontSize: FontSize.sm,
    color: wm(0.4),
  },
  expDates: {
    fontSize: FontSize.sm,
    color: wm(0.3),
  },
  expBullets: {
    fontSize: FontSize.sm,
    color: Colors.orangeDim,
  },
  listText: {
    fontSize: FontSize.base,
    color: wm(0.8),
    lineHeight: 20,
  },
  skillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  skillPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: wm(0.06),
    borderWidth: 1,
    borderColor: wm(0.08),
  },
  signalPill: {
    backgroundColor: orangeAlpha(0.08),
    borderColor: orangeAlpha(0.18),
  },
  skillText: {
    fontSize: FontSize.sm,
    color: wm(0.72),
  },
  signalText: {
    color: Colors.orange,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: wm(0.35),
    lineHeight: 18,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.amber,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryText: {
    fontSize: FontSize.base,
    color: wm(0.45),
  },
})
