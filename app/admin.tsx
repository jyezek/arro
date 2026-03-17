import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { apiRequest } from '@/lib/api'
import { Colors, FontSize, Radius, wm, orangeAlpha } from '@/constants/Colors'

type AdminUserRow = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  suspended: boolean
  subscriptionStatus: string
  creditBalance: number
  createdAt: string
}

export default function AdminScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setError(null)
      const token = await getToken()
      const data = await apiRequest<{ users: AdminUserRow[] }>('/api/admin/users', {}, token)
      setUsers(data.users)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const updateUser = async (userId: string, patch: Partial<Pick<AdminUserRow, 'role' | 'suspended'>>) => {
    try {
      setSavingId(userId)
      setError(null)
      const token = await getToken()
      const data = await apiRequest<{ user: AdminUserRow }>(
        `/api/admin/users/${userId}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        token
      )
      setUsers(prev => prev.map(user => user.id === userId ? data.user : user))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Loading admin console...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadUsers() }} tintColor={Colors.orange} />}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>ADMIN</Text>
        <Text style={styles.title}>Access control</Text>
        <Text style={styles.subtitle}>
          Promote admins, suspend accounts, and verify platform access from one surface.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {users.map(user => {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
        const isSaving = savingId === user.id
        return (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{fullName || 'Unnamed user'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <View style={styles.badgeRow}>
                <Badge label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'accent' : 'neutral'} />
                <Badge label={user.subscriptionStatus.toUpperCase()} tone={user.subscriptionStatus === 'pro' ? 'success' : 'neutral'} />
                {user.suspended ? <Badge label="SUSPENDED" tone="danger" /> : null}
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{user.creditBalance} credits</Text>
              <Text style={styles.metaText}>Joined {new Date(user.createdAt).toLocaleDateString()}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionBtn, user.role === 'admin' && styles.actionBtnActive]}
                onPress={() => updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })}
                disabled={isSaving}
              >
                <Text style={[styles.actionBtnText, user.role === 'admin' && styles.actionBtnTextActive]}>
                  {user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, user.suspended && styles.actionBtnDanger]}
                onPress={() => updateUser(user.id, { suspended: !user.suspended })}
                disabled={isSaving}
              >
                <Text style={[styles.actionBtnText, user.suspended && styles.actionBtnDangerText]}>
                  {user.suspended ? 'Reactivate' : 'Suspend'}
                </Text>
              </Pressable>
            </View>

            {isSaving ? <ActivityIndicator color={Colors.orange} style={styles.inlineSpinner} /> : null}
          </View>
        )
      })}
    </ScrollView>
  )
}

function Badge({ label, tone }: { label: string; tone: 'accent' | 'success' | 'danger' | 'neutral' }) {
  const toneStyle =
    tone === 'accent' ? styles.badgeAccent :
    tone === 'success' ? styles.badgeSuccess :
    tone === 'danger' ? styles.badgeDanger :
    styles.badgeNeutral

  const textStyle =
    tone === 'accent' ? styles.badgeAccentText :
    tone === 'success' ? styles.badgeSuccessText :
    tone === 'danger' ? styles.badgeDangerText :
    styles.badgeNeutralText

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.badgeText, textStyle]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: FontSize.md, color: wm(0.45) },

  header: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: 8,
  },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backBtnText: { fontSize: FontSize.base, color: Colors.orange, fontWeight: '600' },
  kicker: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.orange, letterSpacing: 0.8 },
  title: { fontSize: 28, fontWeight: '600', color: wm(0.92), letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.md, color: wm(0.4), lineHeight: 19 },

  errorText: { fontSize: FontSize.base, color: Colors.red, textAlign: 'center' },

  userCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.07),
    padding: 16,
    gap: 12,
  },
  userHeader: { gap: 10 },
  userInfo: { gap: 2 },
  userName: { fontSize: FontSize.xl, fontWeight: '600', color: wm(0.88) },
  userEmail: { fontSize: FontSize.base, color: wm(0.42) },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: FontSize.sm, fontWeight: '700' },
  badgeAccent: { backgroundColor: orangeAlpha(0.1), borderColor: orangeAlpha(0.24) },
  badgeAccentText: { color: Colors.orange },
  badgeSuccess: { backgroundColor: Colors.greenBg, borderColor: wm(0.08) },
  badgeSuccessText: { color: Colors.green },
  badgeDanger: { backgroundColor: Colors.redBg, borderColor: wm(0.08) },
  badgeDangerText: { color: Colors.red },
  badgeNeutral: { backgroundColor: wm(0.03), borderColor: wm(0.08) },
  badgeNeutralText: { color: wm(0.5) },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaText: { fontSize: FontSize.base, color: wm(0.36) },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.1),
    backgroundColor: wm(0.03),
  },
  actionBtnActive: {
    backgroundColor: orangeAlpha(0.08),
    borderColor: orangeAlpha(0.2),
  },
  actionBtnDanger: {
    backgroundColor: Colors.redBg,
    borderColor: wm(0.08),
  },
  actionBtnText: { fontSize: FontSize.md, color: wm(0.6), fontWeight: '600' },
  actionBtnTextActive: { color: Colors.orange },
  actionBtnDangerText: { color: Colors.red },
  inlineSpinner: { marginTop: 4 },
})
