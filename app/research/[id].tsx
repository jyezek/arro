import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type ResearchContent = {
  companySnapshot: string
  businessModel: string
  productEcosystem: string
  roleContext: string
  dayInTheLife: string[]
  first90DaysPlan: string[]
  keyStakeholders: string[]
  interviewTalkingPoints: string[]
  questionsToAsk: string[]
  risksAndWatchouts: string[]
  prepChecklist: string[]
}

type ResearchRecord = {
  id: string
  status: string
  content: string
  job: { title: string; company: string } | null
}

type Tab = 'snapshot' | 'role' | 'days' | 'stakeholders' | 'interview' | 'questions' | 'risks'

export default function ResearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()
  const [record, setRecord] = useState<ResearchRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('snapshot')

  useEffect(() => {
    void fetchResearch()
  }, [id])

  const fetchResearch = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ research: ResearchRecord }>(`/api/research/${id}`, {}, token)
      setRecord(data.research)
    } catch (err) {
      console.error('Failed to fetch research:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || record?.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>{loading ? 'Loading research…' : 'Generating company research…'}</Text>
        {!loading ? <Text style={styles.loadingSubtext}>This takes about 20 seconds</Text> : null}
      </View>
    )
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Research brief not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const content: ResearchContent = (() => {
    try { return JSON.parse(record.content) } catch { return {} as ResearchContent }
  })()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'snapshot', label: 'Snapshot' },
    { key: 'role', label: 'Role' },
    { key: 'days', label: '90 days' },
    { key: 'stakeholders', label: 'People' },
    { key: 'interview', label: 'Interview' },
    { key: 'questions', label: 'Questions' },
    { key: 'risks', label: 'Risks' },
  ]

  const handleShare = async () => {
    try {
      await Share.share({ message: buildResearchShareText(record, content), title: 'Company research' })
    } catch {}
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Company Research</Text>
          {record.job ? <Text style={styles.headerSub}>{record.job.title} · {record.job.company}</Text> : null}
        </View>
        <Pressable onPress={handleShare} style={styles.shareBtn} hitSlop={10}>
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'snapshot' ? (
          <>
            <TextCard label="Company Snapshot" text={content.companySnapshot} />
            <TextCard label="Business Model" text={content.businessModel} />
            <TextCard label="Product Ecosystem" text={content.productEcosystem} />
          </>
        ) : null}

        {activeTab === 'role' ? (
          <>
            <TextCard label="Role Context" text={content.roleContext} />
            <ListCard label="Day In The Life" items={content.dayInTheLife ?? []} />
          </>
        ) : null}

        {activeTab === 'days' ? (
          <>
            <ListCard label="First 90 Days" items={content.first90DaysPlan ?? []} />
            <ListCard label="Prep Checklist" items={content.prepChecklist ?? []} />
          </>
        ) : null}

        {activeTab === 'stakeholders' ? (
          <ListCard label="Key Stakeholders" items={content.keyStakeholders ?? []} />
        ) : null}

        {activeTab === 'interview' ? (
          <ListCard label="Interview Talking Points" items={content.interviewTalkingPoints ?? []} />
        ) : null}

        {activeTab === 'questions' ? (
          <ListCard label="Questions To Ask" items={content.questionsToAsk ?? []} />
        ) : null}

        {activeTab === 'risks' ? (
          <ListCard label="Risks & Watchouts" items={content.risksAndWatchouts ?? []} />
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function TextCard({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.cardText}>{text || 'No research available yet.'}</Text>
    </View>
  )
}

function ListCard({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {items.length > 0 ? items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listRow}>
          <Text style={styles.listDot}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      )) : (
        <Text style={styles.cardText}>No items available yet.</Text>
      )}
    </View>
  )
}

function buildResearchShareText(record: ResearchRecord, content: ResearchContent): string {
  return [
    record.job ? `${record.job.title} · ${record.job.company}` : 'Company research',
    '',
    content.companySnapshot,
    '',
    ...(content.interviewTalkingPoints ?? []).map((item) => `• ${item}`),
  ].filter(Boolean).join('\n')
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[4], backgroundColor: Colors.dark },
  loadingText: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.85) },
  loadingSubtext: { fontSize: FontSize.md, color: wm(0.4) },
  backLink: { marginTop: Spacing[3] },
  backLinkText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
  },
  backBtn: { width: 36 },
  backIcon: { fontSize: 24, color: wm(0.7), fontWeight: '300' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: wm(0.9) },
  headerSub: { fontSize: FontSize.sm, color: wm(0.4), marginTop: 1 },
  shareBtn: { width: 40, alignItems: 'flex-end' },
  shareBtnText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '500' },
  tabScroll: {
    borderBottomWidth: 1,
    borderBottomColor: wm(0.06),
    backgroundColor: Colors.dark,
    flexGrow: 0,
  },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.orange },
  tabText: { fontSize: FontSize.md, fontWeight: '500', color: wm(0.35) },
  tabTextActive: { color: Colors.orange, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[7], gap: Spacing[5] },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: Spacing[6],
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: Spacing[3],
  },
  label: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3), letterSpacing: 0.5 },
  cardText: { fontSize: FontSize.md, color: wm(0.8), lineHeight: 22 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listDot: { fontSize: FontSize.base, color: Colors.orange },
  listText: { flex: 1, fontSize: FontSize.base, color: wm(0.78), lineHeight: 20 },
})
