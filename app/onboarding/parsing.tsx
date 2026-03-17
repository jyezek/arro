import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, View, Text, StyleSheet, Easing, Pressable } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { Colors, FontSize, Spacing, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'
import { uploadFilesForText } from '@/lib/file-upload'
import { getOnboardingSession, setOnboardingExtracted } from '@/lib/onboarding-session'

const ITEMS = [
  { label: 'Name & contact', icon: '👤' },
  { label: 'Location', icon: '📍' },
  { label: 'Work experience', icon: '💼' },
  { label: 'Education', icon: '🎓' },
  { label: 'Skills', icon: '⚡' },
  { label: 'Role signals', icon: '🧭' },
]

type ItemState = { status: 'pending' | 'found' | 'missing'; value: string }

export default function OnboardingParsing() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [statusText, setStatusText] = useState('Reading your resume…')
  const [statusSub, setStatusSub] = useState('Extracting your work history')
  const [error, setError] = useState<string | null>(null)
  const [itemStates, setItemStates] = useState<ItemState[]>(ITEMS.map(() => ({ status: 'pending', value: '—' })))

  const progressAnim = useRef(new Animated.Value(0)).current
  const orbScale = useRef(new Animated.Value(1)).current

  // Orb pulse loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    void runExtraction()
  }, [])

  const animateProgress = (toValue: number, duration = 500) => {
    Animated.timing(progressAnim, {
      toValue,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start()
  }

  const updateItem = (index: number, next: ItemState) => {
    setItemStates(prev => prev.map((item, itemIndex) => itemIndex === index ? next : item))
  }

  const runExtraction = async () => {
    try {
      const session = getOnboardingSession()
      if (session.source !== 'upload' && session.source !== 'text') {
        router.replace('/onboarding')
        return
      }

      const token = await getToken()
      let resumeText = session.resumeText

      animateProgress(0.18, 350)
      if (session.source === 'upload') {
        setStatusText('Reading your files…')
        setStatusSub('Extracting text from your uploaded resume')

        resumeText = await uploadFilesForText({
          apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
          token,
          files: session.files.map(file => ({
            name: file.name,
            uri: file.uri,
          })),
        })
      }

      animateProgress(0.42, 500)
      setStatusText('Mapping your experience…')
      setStatusSub('Structuring your master resume')

      const data = await apiRequest<{ extracted: {
        firstName: string
        lastName: string
        phone: string
        location: string
        linkedinUrl: string
        portfolioUrl: string
        summary: string
        experience: Array<{ roleTitle: string; company: string; startDate: string; endDate: string; description: string; bullets: string[] }>
        education: Array<{ degree: string; institution: string; graduationYear: string; fieldOfStudy: string }>
        skills: Array<{ name: string; category: 'design' | 'engineering' | 'tools' | 'soft' | 'other' }>
        inferredTargetRoles: string[]
      } }>(
        '/api/onboarding/extract',
        { method: 'POST', body: JSON.stringify({ text: resumeText }) },
        token
      )

      setOnboardingExtracted(data.extracted, resumeText)

      const itemUpdates: ItemState[] = [
        {
          status: data.extracted.firstName || data.extracted.lastName ? 'found' : 'missing',
          value: `${data.extracted.firstName} ${data.extracted.lastName}`.trim() || 'Not found',
        },
        {
          status: data.extracted.location ? 'found' : 'missing',
          value: data.extracted.location || 'Not found',
        },
        {
          status: data.extracted.experience.length ? 'found' : 'missing',
          value: data.extracted.experience.length ? `${data.extracted.experience.length} roles found` : 'Not found',
        },
        {
          status: data.extracted.education.length ? 'found' : 'missing',
          value: data.extracted.education.length ? `${data.extracted.education[0].institution}${data.extracted.education[0].graduationYear ? ` · ${data.extracted.education[0].graduationYear}` : ''}` : 'Not found',
        },
        {
          status: data.extracted.skills.length ? 'found' : 'missing',
          value: data.extracted.skills.length ? `${data.extracted.skills.length} skills identified` : 'Not found',
        },
        {
          status: data.extracted.inferredTargetRoles.length ? 'found' : 'missing',
          value: data.extracted.inferredTargetRoles.length ? data.extracted.inferredTargetRoles.slice(0, 2).join(', ') : 'Needs preferences',
        },
      ]

      const STAGGER = [0, 200, 400, 600, 800, 1000]
      STAGGER.forEach((delay, i) => {
        setTimeout(() => updateItem(i, itemUpdates[i]), delay)
      })

      const lastDelay = STAGGER[STAGGER.length - 1]
      setTimeout(() => {
        setStatusText('All done — reviewing now')
        setStatusSub('Confirm what we found before we save it')
        animateProgress(1, 450)
        setTimeout(() => {
          router.replace('/onboarding/review')
        }, 700)
      }, lastDelay + 350)
    } catch (err) {
      setError((err as Error).message)
      setStatusText('We hit a parsing issue')
      setStatusSub('You can retry or switch to paste text')
    }
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.container}>
      {/* Orb */}
      <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
        <Text style={styles.orbArrow}>→</Text>
      </Animated.View>

      {/* Status */}
      <Text style={styles.statusText}>{statusText}</Text>
      <Text style={styles.statusSub}>{statusSub}</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Extraction items */}
      <View style={styles.itemList}>
        {ITEMS.map((item, i) => {
          const itemState = itemStates[i]
          const done = itemState.status !== 'pending'
          const isMissing = itemState.status === 'missing'
          return (
            <View
              key={i}
              style={[
                styles.item,
                done && !isMissing && styles.itemFound,
                isMissing && styles.itemMissing,
              ]}
            >
              <View style={[
                styles.itemIcon,
                done && !isMissing && styles.itemIconFound,
                isMissing && styles.itemIconMissing,
              ]}>
                <Text style={styles.itemEmoji}>{item.icon}</Text>
              </View>
              <Text style={[
                styles.itemLabel,
                done && styles.itemLabelDone,
              ]}>
                {item.label}
              </Text>
              <Text style={[
                styles.itemValue,
                isMissing && styles.itemValueMissing,
              ]}>
                {itemState.value}
              </Text>
            </View>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => router.replace('/onboarding')} style={styles.retryBtn}>
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[7],
    gap: Spacing[4],
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  orbArrow: { color: Colors.white, fontSize: 28, fontWeight: '700' },
  statusText: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: wm(0.9),
    letterSpacing: -0.3,
  },
  statusSub: {
    fontSize: FontSize.md,
    color: wm(0.4),
    marginTop: -Spacing[2],
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: wm(0.08),
    overflow: 'hidden',
    marginVertical: Spacing[2],
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.orange,
  },
  itemList: { width: '100%', gap: Spacing[2] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: wm(0.05),
    borderRadius: 10,
    padding: 11,
    gap: 12,
  },
  itemFound: { backgroundColor: `rgba(93,202,165,0.1)` },
  itemMissing: { backgroundColor: `rgba(239,158,39,0.1)` },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: wm(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconFound: { backgroundColor: `rgba(93,202,165,0.15)` },
  itemIconMissing: { backgroundColor: `rgba(239,158,39,0.15)` },
  itemEmoji: { fontSize: 14 },
  itemLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: wm(0.4),
  },
  itemLabelDone: { color: wm(0.8), fontWeight: '500' },
  itemValue: {
    fontSize: FontSize.sm,
    color: wm(0.3),
    fontWeight: '500',
  },
  itemValueMissing: { color: Colors.amber },
  errorWrap: {
    marginTop: Spacing[2],
    alignItems: 'center',
    gap: Spacing[2],
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.amber,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: wm(0.12),
  },
  retryText: {
    fontSize: FontSize.base,
    color: wm(0.7),
    fontWeight: '500',
  },
})
