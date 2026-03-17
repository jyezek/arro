import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import Reveal from '@/components/Reveal'
import { Colors, FontSize, wm, orangeAlpha } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'
import { deleteItem } from '@/lib/storage'

type InternalUser = {
  role: string
  subscriptionStatus: string
}

export default function ProfileScreen() {
  const { signOut, getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const [internalUser, setInternalUser] = useState<InternalUser | null>(null)

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const email = user?.primaryEmailAddress?.emailAddress
  const planLabel =
    internalUser?.role === 'admin' ? 'Admin' :
    internalUser?.subscriptionStatus === 'pro' ? 'Pro' :
    'Free'

  useEffect(() => {
    void loadInternalUser()
  }, [])

  const loadInternalUser = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ user: InternalUser }>('/api/user', {}, token)
      setInternalUser(data.user)
    } catch {}
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Reveal style={styles.header} distance={12}>
        <View style={styles.headerKicker}>
          <View style={styles.kickerLine} />
          <Text style={styles.kickerText}>ACCOUNT</Text>
        </View>
        <Text style={styles.title}>Profile</Text>
      </Reveal>

      <Reveal delay={60}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityName}>{fullName}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{planLabel}</Text>
          </View>
        </View>
      </Reveal>

      <Reveal delay={120} style={styles.section}>
        <Text style={styles.sectionLabel}>PLAN & BILLING</Text>
        <View style={styles.sectionCard}>
          {internalUser?.role === 'admin' ? (
            <MenuItem
              label="Admin access"
              sub="Full platform access is enabled"
              accent
              onPress={() => router.push('/admin')}
            />
          ) : (
            <MenuItem
              label="Upgrade to Pro"
              sub="Unlimited interviews & prep kits"
              accent
              onPress={() => router.push('/upgrade')}
            />
          )}
          <MenuItem
            label="Credits"
            sub="Buy or view credit balance"
            onPress={() => router.push('/credits')}
            last
          />
        </View>
      </Reveal>

      <Reveal delay={180} style={styles.section}>
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.sectionCard}>
          <MenuItem label="Resume & profile" sub="Import, strengthen, and edit your master resume" onPress={() => router.push('/settings/resume')} />
          <MenuItem label="Job preferences" sub="Location, salary, role type" onPress={() => router.push('/settings/preferences')} />
          {internalUser?.role === 'admin' ? (
            <MenuItem label="Admin console" sub="Roles, suspension, access control" onPress={() => router.push('/admin')} />
          ) : null}
          <MenuItem label="Notifications" sub="Alerts and reminders" onPress={() => {}} last />
        </View>
      </Reveal>

      <Reveal delay={240}>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.987 }] }]}
          onPress={async () => {
            await deleteItem('onboarding_complete')
            await signOut()
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </Reveal>

      <Reveal delay={280}>
        <Text style={styles.version}>Arro · v1.0.0</Text>
      </Reveal>
    </ScrollView>
  )
}

function MenuItem({
  label,
  sub,
  accent,
  last,
  onPress,
}: {
  label: string
  sub?: string
  accent?: boolean
  last?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        !last && styles.menuItemBorder,
        pressed && styles.menuItemPressed,
        accent && styles.menuItemAccent,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuItemBody}>
        <Text style={[styles.menuLabel, accent && styles.menuLabelAccent]}>{label}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
      <Text style={[styles.menuChevron, accent && { color: Colors.orange }]}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content: { paddingBottom: 100, gap: 16 },

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
  kickerText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.orange, letterSpacing: 0.1 },
  title: { fontSize: 28, fontWeight: '600', color: wm(0.9), letterSpacing: -0.5 },

  // Identity
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    backgroundColor: wm(0.04),
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: wm(0.08),
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 9,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.white },
  identityInfo: { flex: 1, gap: 3 },
  identityName: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.85), letterSpacing: -0.2 },
  identityEmail: { fontSize: FontSize.base, color: wm(0.4) },
  planBadge: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: wm(0.07),
    borderWidth: 1, borderColor: wm(0.1),
  },
  planBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: wm(0.4) },

  // Sections
  section: { paddingHorizontal: 20, gap: 8 },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: wm(0.25), letterSpacing: 0.08,
  },
  sectionCard: {
    backgroundColor: wm(0.04),
    borderRadius: 16,
    borderWidth: 1, borderColor: wm(0.07),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1, borderBottomColor: wm(0.05),
  },
  menuItemPressed: { backgroundColor: wm(0.06), transform: [{ scale: 0.992 }] },
  menuItemAccent: { backgroundColor: orangeAlpha(0.04) },
  menuItemBody: { flex: 1, gap: 2 },
  menuLabel: { fontSize: FontSize.md, fontWeight: '500', color: wm(0.75) },
  menuLabelAccent: { color: Colors.orange },
  menuSub: { fontSize: FontSize.sm, color: wm(0.35) },
  menuChevron: { fontSize: 18, color: wm(0.2) },

  // Sign out
  signOutBtn: {
    marginHorizontal: 20,
    backgroundColor: wm(0.04),
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: wm(0.07),
  },
  signOutText: { fontSize: FontSize.md, fontWeight: '500', color: 'rgba(226,75,74,0.8)' },

  version: { textAlign: 'center', fontSize: FontSize.sm, color: wm(0.2) },
})
