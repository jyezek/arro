import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { Colors, FontSize, Radius, Spacing, wm, orangeAlpha } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

const FEATURES_FREE = [
  { label: 'AI job match scoring', included: true },
  { label: 'Job feed (manual refresh)', included: true },
  { label: '20 credits / month', included: true },
  { label: 'Tailored resumes', included: false },
  { label: 'Full prep kits', included: false },
  { label: 'Interview practice (20 credits each)', included: false },
  { label: 'Unlimited scraping', included: false },
]

const FEATURES_PRO = [
  { label: 'Everything in Free', included: true },
  { label: 'Tailored resumes (unlimited)', included: true },
  { label: 'Full prep kits (unlimited)', included: true },
  { label: '5 interview sessions / month', included: true },
  { label: 'Auto-scrape daily', included: true },
  { label: 'Priority AI queue', included: true },
]

const PLAN_CONFIG = {
  pro_monthly: { label: 'Pro — Monthly', price: '$24', per: '/mo', cadence: 'Billed monthly · cancel anytime' },
  pro_annual:  { label: 'Pro — Annual',  price: '$18', per: '/mo', cadence: 'Billed $216/year · save 25%' },
} as const

type PlanKey = keyof typeof PLAN_CONFIG

export default function UpgradeScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { plan: planParam, cancelled } = useLocalSearchParams<{ plan?: string; cancelled?: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const plan: PlanKey = (planParam && planParam in PLAN_CONFIG) ? planParam as PlanKey : 'pro_monthly'
  const config = PLAN_CONFIG[plan]

  useEffect(() => {
    void getToken().then(token =>
      apiRequest('/api/track', { method: 'POST', body: JSON.stringify({ event: 'upgrade_prompted', plan }) }, token)
    ).catch(() => {})
  }, [])

  const handleUpgrade = async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const data = await apiRequest<{ url: string }>(
        '/api/stripe/create-checkout-session',
        { method: 'POST', body: JSON.stringify({ plan }) },
        token
      )
      const { Linking } = await import('react-native')
      await Linking.openURL(data.url)
    } catch (err) {
      console.error('Checkout failed:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      {/* Handle */}
      <View style={styles.handle} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>Upgrade to Pro</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited AI tools and get hired faster.
        </Text>

        {cancelled === 'true' ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>Checkout cancelled — no charge was made.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>{error}</Text>
          </View>
        ) : null}

        {/* Plan toggle */}
        <View style={styles.planToggle}>
          {(Object.keys(PLAN_CONFIG) as PlanKey[]).map((key) => (
            <Pressable
              key={key}
              style={[styles.planToggleBtn, plan === key && styles.planToggleBtnActive]}
              onPress={() => router.setParams({ plan: key })}
            >
              <Text style={[styles.planToggleBtnText, plan === key && styles.planToggleBtnTextActive]}>
                {key === 'pro_monthly' ? 'Monthly' : 'Annual'}
              </Text>
              {key === 'pro_annual' ? <Text style={styles.savePill}>Save 25%</Text> : null}
            </Pressable>
          ))}
        </View>

        {/* Price */}
        <View style={styles.priceCard}>
          <Text style={styles.price}>{config.price}</Text>
          <Text style={styles.pricePer}>{config.per}</Text>
        </View>
        <Text style={styles.cadence}>{config.cadence}</Text>

        {/* Feature list */}
        <View style={styles.featureSection}>
          <Text style={styles.featureHeading}>Pro includes</Text>
          {FEATURES_PRO.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={[styles.featureCheck, f.included ? styles.checkGreen : styles.checkMuted]}>
                {f.included ? '✓' : '–'}
              </Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, loading && styles.ctaDisabled]}
          onPress={handleUpgrade}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.ctaText}>{config.label} — {config.price}{config.per}</Text>
          }
        </Pressable>

        <Text style={styles.finePrint}>Cancel anytime. No hidden fees.</Text>

        <Pressable onPress={() => router.back()} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: wm(0.1),
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: { paddingHorizontal: 24, paddingBottom: 48, gap: Spacing[6] },

  title: {
    fontSize: FontSize.hero,
    fontWeight: '700',
    color: wm(0.9),
    letterSpacing: -0.5,
    marginTop: Spacing[4],
  },
  subtitle: { fontSize: FontSize.md, color: wm(0.4), lineHeight: 20, marginTop: -Spacing[4] },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    backgroundColor: orangeAlpha(0.07),
    borderRadius: Radius.card,
    padding: Spacing[6],
    borderWidth: 1,
    borderColor: orangeAlpha(0.15),
  },
  price: { fontSize: 48, fontWeight: '700', color: Colors.orange, lineHeight: 52 },
  pricePer: { fontSize: FontSize.lg, color: Colors.orangeDim, fontWeight: '500', marginBottom: 8 },

  featureSection: { gap: Spacing[3] },
  featureHeading: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: wm(0.3),
    letterSpacing: 0.5,
    marginBottom: Spacing[1],
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4] },
  featureCheck: { fontSize: FontSize.md, fontWeight: '700', width: 16, textAlign: 'center' },
  checkGreen: { color: Colors.green },
  checkMuted: { color: wm(0.2) },
  featureLabel: { fontSize: FontSize.md, color: wm(0.75), flex: 1 },

  cta: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '700' },

  cadence: { textAlign: 'center', fontSize: FontSize.sm, color: wm(0.35), marginTop: -Spacing[4] },
  planToggle: { flexDirection: 'row', gap: 8 },
  planToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: Radius.card,
    backgroundColor: wm(0.05), borderWidth: 1, borderColor: wm(0.08),
  },
  planToggleBtnActive: { backgroundColor: orangeAlpha(0.1), borderColor: orangeAlpha(0.25) },
  planToggleBtnText: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.4) },
  planToggleBtnTextActive: { color: Colors.orange },
  savePill: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange,
    backgroundColor: orangeAlpha(0.12), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  cancelledBanner: {
    backgroundColor: 'rgba(226,75,74,0.08)', borderRadius: Radius.input,
    padding: Spacing[4], borderWidth: 1, borderColor: 'rgba(226,75,74,0.15)',
  },
  cancelledText: { color: 'rgb(226,75,74)', fontSize: FontSize.sm },
  finePrint: { textAlign: 'center', fontSize: FontSize.sm, color: wm(0.25) },
  dismissBtn: { alignItems: 'center', paddingVertical: Spacing[2] },
  dismissText: { fontSize: FontSize.md, color: wm(0.35), fontWeight: '500' },
})
