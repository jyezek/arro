import { useRouter } from 'expo-router'
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
import { CreditCosts } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type UserInfo = {
  creditBalance: number
  subscriptionStatus: string
  creditsIncludedMonthly: number
  role?: string
}

type LedgerEntry = {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
}

const CREDIT_PACKS = [
  { credits: 10, price: 4, label: '10 credits' },
  { credits: 25, price: 9, label: '25 credits', popular: true },
  { credits: 50, price: 16, label: '50 credits' },
  { credits: 100, price: 29, label: '100 credits' },
]

const FEATURE_COSTS = [
  { label: 'Tailored resume', cost: CreditCosts.tailored_resume, icon: '📄' },
  { label: 'Full prep kit', cost: CreditCosts.full_prep_kit, icon: '📚' },
  { label: 'Interview practice', cost: CreditCosts.practice_interview, icon: '🎤' },
  { label: 'Company overview', cost: CreditCosts.company_overview, icon: '🏢' },
  { label: 'Deep dive (per role)', cost: CreditCosts.deep_dive_per_role, icon: '🔍' },
  { label: 'AI bullet batch', cost: CreditCosts.ai_bullet_batch, icon: '✨' },
]

export default function CreditsScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ user: UserInfo }>('/api/user', {}, token)
      setUser(data.user)
    } catch (err) {
      console.error('Failed to fetch user:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (pack: typeof CREDIT_PACKS[0]) => {
    setPurchasing(pack.credits)
    try {
      const token = await getToken()
      const data = await apiRequest<{ url: string }>(
        '/api/stripe/create-checkout-session',
        {
          method: 'POST',
          body: JSON.stringify({ plan: 'credits', credits: pack.credits }),
        },
        token
      )
      const { Linking } = await import('react-native')
      await Linking.openURL(data.url)
    } catch (err) {
      console.error('Purchase failed:', err)
    } finally {
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} />
      </View>
    )
  }

  const hasFullAccess = user?.subscriptionStatus === 'pro' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  return (
    <View style={styles.root}>
      <View style={styles.handle} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Credits & Billing</Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceNumber}>{user?.creditBalance ?? 0}</Text>
            <Text style={styles.balanceLabel}>Credits remaining</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRight}>
            <Text style={styles.planBadgeText}>{isAdmin ? 'Admin' : hasFullAccess ? 'Pro' : 'Free'}</Text>
            <Text style={styles.planReset}>
              {isAdmin ? 'Full platform access' : `${user?.creditsIncludedMonthly ?? 20}/month included`}
            </Text>
          </View>
        </View>

        {/* Upgrade CTA for free users */}
        {!hasFullAccess && (
          <Pressable style={styles.upgradeBanner} onPress={() => router.replace('/upgrade')}>
            <Text style={styles.upgradeBannerText}>Upgrade to Pro for unlimited resumes & prep kits →</Text>
          </Pressable>
        )}

        {/* What things cost */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CREDIT COSTS</Text>
          <View style={styles.card}>
            {FEATURE_COSTS.map((f, i) => (
              <View key={i} style={[styles.costRow, i > 0 && styles.costRowBorder]}>
                <Text style={styles.costIcon}>{f.icon}</Text>
                <Text style={styles.costLabel}>{f.label}</Text>
                <Text style={[styles.costValue, hasFullAccess && styles.costFree]}>
                  {hasFullAccess && ['tailored_resume', 'full_prep_kit', 'company_overview'].includes(f.label.toLowerCase().replace(/ /g, '_'))
                    ? 'Free'
                    : `${f.cost} cr`
                  }
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Buy credits */}
        {!isAdmin ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BUY CREDITS</Text>
            <View style={styles.packsGrid}>
              {CREDIT_PACKS.map(pack => (
                <Pressable
                  key={pack.credits}
                  style={({ pressed }) => [
                    styles.packCard,
                    pack.popular && styles.packCardPopular,
                    pressed && styles.packCardPressed,
                  ]}
                  onPress={() => handlePurchase(pack)}
                  disabled={purchasing !== null}
                >
                  {pack.popular && <Text style={styles.popularTag}>POPULAR</Text>}
                  {purchasing === pack.credits
                    ? <ActivityIndicator color={pack.popular ? Colors.white : Colors.orange} />
                    : (
                      <>
                        <Text style={[styles.packCredits, pack.popular && styles.packCreditsPopular]}>
                          {pack.credits}
                        </Text>
                        <Text style={[styles.packLabel, pack.popular && styles.packLabelPopular]}>credits</Text>
                        <Text style={[styles.packPrice, pack.popular && styles.packPricePopular]}>
                          ${pack.price}
                        </Text>
                      </>
                    )
                  }
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Close</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: wm(0.1),
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: Spacing[6] },

  title: { fontSize: FontSize.hero, fontWeight: '700', color: wm(0.9), letterSpacing: -0.5, marginTop: Spacing[4] },

  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: Spacing[6],
    gap: Spacing[6],
    borderWidth: 1,
    borderColor: wm(0.07),
  },
  balanceLeft: { flex: 1, alignItems: 'center', gap: 2 },
  balanceNumber: { fontSize: 48, fontWeight: '700', color: wm(0.9), lineHeight: 52 },
  balanceLabel: { fontSize: FontSize.sm, color: wm(0.35), fontWeight: '500' },
  balanceDivider: { width: 1, height: 48, backgroundColor: wm(0.08) },
  balanceRight: { flex: 1, alignItems: 'center', gap: 2 },
  planBadgeText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.orange },
  planReset: { fontSize: FontSize.sm, color: wm(0.35), textAlign: 'center' },

  upgradeBanner: {
    backgroundColor: orangeAlpha(0.08),
    borderRadius: Radius.card,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: orangeAlpha(0.15),
  },
  upgradeBannerText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '600', textAlign: 'center' },

  section: { gap: Spacing[3] },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3), letterSpacing: 0.5 },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.07),
    overflow: 'hidden',
  },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], padding: Spacing[5] },
  costRowBorder: { borderTopWidth: 1, borderTopColor: wm(0.06) },
  costIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  costLabel: { flex: 1, fontSize: FontSize.md, color: wm(0.75), fontWeight: '500' },
  costValue: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.4) },
  costFree: { color: Colors.green },

  packsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  packCard: {
    width: '47%',
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.08),
    padding: Spacing[5],
    alignItems: 'center',
    gap: 2,
    minHeight: 90,
    justifyContent: 'center',
  },
  packCardPopular: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  packCardPressed: { opacity: 0.8 },
  popularTag: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white, letterSpacing: 0.5, marginBottom: 2 },
  packCredits: { fontSize: 32, fontWeight: '700', color: wm(0.9), lineHeight: 36 },
  packCreditsPopular: { color: Colors.white },
  packLabel: { fontSize: FontSize.sm, color: wm(0.35), fontWeight: '500' },
  packLabelPopular: { color: 'rgba(255,255,255,0.7)' },
  packPrice: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.orange, marginTop: 4 },
  packPricePopular: { color: Colors.white },

  dismissBtn: { alignItems: 'center', paddingVertical: Spacing[3] },
  dismissText: { fontSize: FontSize.md, color: wm(0.35), fontWeight: '500' },
})
