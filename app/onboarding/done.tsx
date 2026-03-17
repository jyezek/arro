import { useRouter } from 'expo-router'
import { clearOnboardingSession } from '@/lib/onboarding-session'
import { setItem } from '@/lib/storage'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, View, Text, Pressable, StyleSheet, Easing } from 'react-native'
import { apiRequest } from '@/lib/api'
import { Colors, FontSize, Radius, Spacing, wm } from '@/constants/Colors'
import type { ResumeSettingsProfile } from '@/lib/settings'

export default function OnboardingDone() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const [profile, setProfile] = useState<ResumeSettingsProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const checkScale = useRef(new Animated.Value(0)).current
  const barAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]

  useEffect(() => {
    clearOnboardingSession()
    setItem('onboarding_complete', 'true')
    void loadProfile()
    void getToken().then(token =>
      apiRequest('/api/track', { method: 'POST', body: JSON.stringify({ event: 'onboarding_completed' }) }, token)
    ).catch(() => {})
  }, [])

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    if (!profile) return
    const barAnimations = barAnims.map((anim, i) => Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      delay: 300 + i * 130,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }))
    Animated.parallel(barAnimations).start()
  }, [profile])

  const loadProfile = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ profile: ResumeSettingsProfile }>('/api/profile', {}, token)
      setProfile(data.profile)
    } catch (err) {
      console.warn('[onboarding/done] failed to load profile', err)
    } finally {
      setLoading(false)
    }
  }

  const goToFeed = () => {
    router.replace('/(tabs)')
  }

  const strengthBars = profile ? [
    { label: 'Experience', pct: profile.strength.experience },
    { label: 'Skills', pct: profile.strength.skills },
    { label: 'Achievements', pct: profile.strength.achievements },
    { label: 'Education', pct: profile.strength.education },
  ] : []

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '100%' }]} />
      </View>
      <Text style={styles.stepLabel}>ALL SET</Text>

      {/* Check circle */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Text style={styles.checkMark}>✓</Text>
      </Animated.View>

      <Text style={styles.title}>You're in, {firstName}.</Text>
      <Text style={styles.subtitle}>
        {profile
          ? `Your master resume is live with ${profile.strength.completedRoles} role${profile.strength.completedRoles === 1 ? '' : 's'} and ${profile.strength.totalBullets} bullet${profile.strength.totalBullets === 1 ? '' : 's'}.`
          : `Your master resume is live. Let's find you some great roles.`}
      </Text>

      {/* Strength card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>MASTER RESUME STRENGTH</Text>
        {loading ? (
          <ActivityIndicator color={Colors.orange} />
        ) : strengthBars.map((bar, i) => (
          <View key={bar.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{bar.label}</Text>
            <View style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width: barAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', `${bar.pct}%`],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.barPct}>{bar.pct}%</Text>
          </View>
        ))}
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>
            {profile?.strength.weakRoleIds.length
              ? 'Use Resume Settings to strengthen your thinnest roles before generating tailored resumes.'
              : 'Your master resume is in good shape. Keep it current as you add new work.'}
          </Text>
          <Text style={styles.nudgeLink}>You can keep improving it from Profile → Resume Settings.</Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={goToFeed}
      >
        <Text style={styles.ctaText}>Go to my feed</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
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
    marginBottom: Spacing[2],
  },
  progressFill: { height: '100%', backgroundColor: Colors.orange, borderRadius: 2 },
  stepLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.orange,
    letterSpacing: 0.8,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: Spacing[3],
  },
  checkMark: { color: Colors.white, fontSize: 32, fontWeight: '700' },
  title: {
    fontSize: FontSize.hero,
    fontWeight: '600',
    color: wm(0.9),
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: wm(0.4),
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -Spacing[2],
  },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: Spacing[3],
  },
  cardLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: wm(0.3),
    letterSpacing: 0.8,
    marginBottom: Spacing[1],
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    fontSize: FontSize.base,
    color: wm(0.5),
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: wm(0.08),
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.orange,
    borderRadius: 3,
  },
  barPct: {
    fontSize: FontSize.sm,
    color: wm(0.35),
    width: 28,
    textAlign: 'right',
  },
  nudge: {
    borderTopWidth: 1,
    borderTopColor: wm(0.07),
    paddingTop: Spacing[3],
    marginTop: Spacing[1],
    gap: 4,
  },
  nudgeText: {
    fontSize: FontSize.sm,
    color: wm(0.35),
    lineHeight: 16,
  },
  nudgeLink: {
    fontSize: FontSize.sm,
    color: Colors.orange,
    fontWeight: '500',
  },
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 'auto',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
})
