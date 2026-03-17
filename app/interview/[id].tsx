import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Audio } from 'expo-av'
import { File, Paths } from 'expo-file-system'
import { Colors, FontSize, Radius, orangeAlpha, whiteAlpha, wm } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type Phase =
  | 'connecting'
  | 'ready'
  | 'ai_speaking'
  | 'listening'
  | 'processing'
  | 'completed'

type CopilotStatus =
  | 'on_track'
  | 'needs_structure'
  | 'missing_outcome'
  | 'drifting'
  | 'wrap_up'
  | 'suggest_topic'

type CopilotMode = 'live_assist' | 'practice'

type CopilotCue = {
  questionType: string
  likelyIntent: string
  recommendedAnswerFramework: string
  status: CopilotStatus
  primaryCue: string
  secondaryCues: string[]
  relevantThemes: string[]
  relevantStories: string[]
}

type CopilotApiResponse = {
  cue?: CopilotCue
  source?: 'openai' | 'fallback'
  warning?: string
  error?: string
}

type Debrief = {
  overallScore: number
  strengths: string[]
  improvements: string[]
  summary: string
}

type TranscriptEntry = { role: 'ai' | 'user'; text: string }

type RealtimeEvent = {
  type?: string
  [key: string]: unknown
}

type QuestionFrame = {
  id: number
  questionText: string
  questionType: string
  framework: string
}

function extractPCMFromCAF(bytes: Uint8Array): Uint8Array {
  let offset = 8
  while (offset < bytes.length - 12) {
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
    const sizeLo =
      ((bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11]) >>> 0
    const dataStart = offset + 12
    if (type === 'data') return bytes.slice(dataStart + 4, dataStart + sizeLo)
    offset = dataStart + sizeLo
  }
  return bytes
}

function buildWAV(pcmBytes: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const setStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }

  setStr(0, 'RIFF')
  view.setUint32(4, 36 + pcmBytes.length, true)
  setStr(8, 'WAVE')
  setStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  setStr(36, 'data')
  view.setUint32(40, pcmBytes.length, true)

  const wav = new Uint8Array(44 + pcmBytes.length)
  wav.set(new Uint8Array(header), 0)
  wav.set(pcmBytes, 44)
  return wav
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk))
  }
  return btoa(binary)
}

function concatB64Chunks(chunks: string[]): Uint8Array {
  const arrays = chunks.map(b64ToBytes)
  const totalLength = arrays.reduce((sum, value) => sum + value.length, 0)
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const array of arrays) {
    out.set(array, offset)
    offset += array.length
  }
  return out
}

function safeJsonParse(value: string): RealtimeEvent | null {
  try {
    return JSON.parse(value) as RealtimeEvent
  } catch {
    return null
  }
}

const IOS_PCM_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.caf',
    audioQuality: Audio.IOSAudioQuality.MAX,
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 384000,
  },
  web: {},
}

const QUESTION_FRAMEWORK_BY_TYPE: Record<string, string> = {
  behavioral: 'STAR',
  conflict_challenge: 'STAR + conflict',
  leadership: 'Situation -> leadership move -> outcome',
  product_strategy: 'Context -> bet -> impact',
  technical: 'Problem -> tradeoff -> decision',
  collaboration: 'Context -> alignment -> execution -> result',
  prioritization: 'Goal -> options -> criteria -> tradeoff',
  failure_learning: 'Failure -> learning -> changed behavior',
  why_role_company: 'Motivation -> fit -> value',
  tell_me_about_yourself: 'Present -> past proof -> why now',
  general: 'STAR-lite',
}

const DEFAULT_CUE: CopilotCue = {
  questionType: 'general',
  likelyIntent: 'Wait for the interviewer question, then choose the best story quickly.',
  recommendedAnswerFramework: 'STAR-lite',
  status: 'suggest_topic',
  primaryCue: 'LISTEN FOR THE ASK',
  secondaryCues: ['CHOOSE STORY', 'SET CONTEXT'],
  relevantThemes: [],
  relevantStories: [],
}

function formatQuestionTypeLabel(value: string) {
  if (!value) return 'General'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function classifyQuestionType(questionText: string): string {
  const q = questionText.toLowerCase()
  if (!q.trim()) return 'general'
  if (/tell me about yourself|walk me through your background/.test(q)) return 'tell_me_about_yourself'
  if (/why (this role|this company|you want)|why us/.test(q)) return 'why_role_company'
  if (/failure|mistake|learned|what went wrong/.test(q)) return 'failure_learning'
  if (/prioriti|trade[- ]?off|limited resources|roadmap/.test(q)) return 'prioritization'
  if (/cross[- ]?functional|stakeholder|partner|align/.test(q)) return 'collaboration'
  if (/system|architecture|technical|api|scal|debug|implementation/.test(q)) return 'technical'
  if (/strategy|vision|market|product/.test(q)) return 'product_strategy'
  if (/led|leadership|manage|mentor/.test(q)) return 'leadership'
  if (/conflict|disagree|challenge|pushback/.test(q)) return 'conflict_challenge'
  if (/behavior|example|time when|situation/.test(q)) return 'behavioral'
  return 'general'
}

function createQuestionFrame(questionText: string): QuestionFrame {
  const questionType = classifyQuestionType(questionText)
  return {
    id: Date.now(),
    questionText,
    questionType,
    framework: QUESTION_FRAMEWORK_BY_TYPE[questionType] ?? QUESTION_FRAMEWORK_BY_TYPE.general,
  }
}

function buildLocalReactiveCue(
  frame: QuestionFrame | null,
  questionText: string,
  answerText: string,
  previousCue: CopilotCue,
): CopilotCue {
  const type = frame?.questionType ?? previousCue.questionType ?? classifyQuestionType(questionText)
  const framework = frame?.framework ?? QUESTION_FRAMEWORK_BY_TYPE[type] ?? previousCue.recommendedAnswerFramework
  const normalizedAnswer = answerText.trim()
  const words = normalizedAnswer.split(/\s+/).filter(Boolean)

  if (!normalizedAnswer) {
    return {
      questionType: type,
      likelyIntent: previousCue.likelyIntent,
      recommendedAnswerFramework: framework,
      status: 'suggest_topic',
      primaryCue: 'CHOOSE STORY FAST',
      secondaryCues: ['SET CONTEXT', 'YOUR ROLE'],
      relevantThemes: previousCue.relevantThemes,
      relevantStories: previousCue.relevantStories,
    }
  }

  const hasMetric = /\b\d+(?:\.\d+)?%?\b|kpi|metric|revenue|impact|result|reduced|increased|improved|saved/i.test(normalizedAnswer)
  const hasOwnership = /\bI\s+(led|owned|drove|built|launched|prioritized|implemented|aligned|partnered|created|shipped|delivered)\b/i.test(normalizedAnswer)
  const hasRoleTie = /\b(product|pm|design|engineer|roadmap|stakeholder|cross[- ]?functional|customer|strategy|role)\b/i.test(normalizedAnswer)
  const repetitive = (() => {
    const counts = new Map<string, number>()
    for (const token of words) {
      const key = token.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (key.length < 4) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.values()).filter((count) => count >= 4).length
  })()

  let status: CopilotStatus = 'on_track'
  if (words.length < 28) status = 'needs_structure'
  else if (words.length >= 200 || repetitive >= 3) status = 'drifting'
  else if (!hasMetric && words.length >= 45) status = 'missing_outcome'
  else if (words.length >= 110 && hasOwnership) status = 'wrap_up'

  const primaryByStatus: Record<CopilotStatus, string> = {
    on_track: 'KEEP IT SPECIFIC',
    needs_structure: 'USE STAR ORDER',
    missing_outcome: 'LAND THE RESULT',
    drifting: 'CUT TO THE POINT',
    wrap_up: 'CLOSE WITH IMPACT',
    suggest_topic: 'CHOOSE STORY FAST',
  }

  const secondaryCues: string[] = []
  if (!hasOwnership) secondaryCues.push('OWN THE ACTION')
  if (!hasMetric) secondaryCues.push('RESULT + METRIC')
  if (!hasRoleTie) secondaryCues.push('TIE TO ROLE')

  return {
    questionType: type,
    likelyIntent: previousCue.likelyIntent || 'Show clear ownership, impact, and relevance to the role.',
    recommendedAnswerFramework: framework,
    status,
    primaryCue: primaryByStatus[status],
    secondaryCues: secondaryCues.length ? secondaryCues.slice(0, 3) : previousCue.secondaryCues.slice(0, 3),
    relevantThemes: previousCue.relevantThemes,
    relevantStories: previousCue.relevantStories,
  }
}

function getStatusMeta(status: CopilotStatus) {
  switch (status) {
    case 'on_track':
      return { label: 'On track', color: Colors.green, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
    case 'needs_structure':
      return { label: 'Needs structure', color: Colors.blue, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
    case 'missing_outcome':
      return { label: 'Missing outcome', color: Colors.amber, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
    case 'drifting':
      return { label: 'Drifting', color: Colors.red, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
    case 'wrap_up':
      return { label: 'Wrap up', color: Colors.orange, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
    case 'suggest_topic':
    default:
      return { label: 'Choose story', color: Colors.orange, bg: whiteAlpha(0.04), border: whiteAlpha(0.08) }
  }
}

function PresenceOrb({
  label,
  caption,
  accentColor,
  active,
  pulse,
  kind,
}: {
  label: string
  caption: string
  accentColor: string
  active: boolean
  pulse: Animated.Value
  kind: 'ai' | 'user'
}) {
  return (
    <View style={styles.orbColumn}>
      <View style={styles.orbWrap}>
        <Animated.View
          style={[
            styles.orbRing,
            {
              borderColor: active ? accentColor : whiteAlpha(0.08),
              opacity: active ? 0.5 : 0.16,
              transform: [{ scale: pulse }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.orbCore,
            {
              backgroundColor: active ? orangeAlpha(kind === 'ai' ? 0.18 : 0.1) : whiteAlpha(0.05),
              borderColor: active ? accentColor : whiteAlpha(0.08),
              transform: [{ scale: pulse.interpolate({ inputRange: [0.86, 1.12], outputRange: [0.98, 1.02] }) }],
            },
          ]}
        >
          {kind === 'ai' ? (
            <View style={styles.aiGlyph}>
              <View style={[styles.aiDot, { width: 9, height: 9, borderRadius: 4.5, backgroundColor: Colors.white }]} />
              <View style={[styles.aiMiniDot, { top: 11, left: 27 }]} />
              <View style={[styles.aiMiniDot, { bottom: 11, left: 27 }]} />
              <View style={[styles.aiMiniDot, { left: 11, top: 27 }]} />
              <View style={[styles.aiMiniDot, { right: 11, top: 27 }]} />
            </View>
          ) : (
            <View style={styles.userGlyph}>
              <View style={[styles.userBar, { height: 10, opacity: active ? 1 : 0.55 }]} />
              <View style={[styles.userBar, { height: 18, opacity: active ? 1 : 0.65 }]} />
              <View style={[styles.userBar, { height: 24, opacity: active ? 1 : 0.8 }]} />
              <View style={[styles.userBar, { height: 18, opacity: active ? 1 : 0.65 }]} />
              <View style={[styles.userBar, { height: 10, opacity: active ? 1 : 0.55 }]} />
            </View>
          )}
        </Animated.View>
      </View>
      <Text style={[styles.orbLabel, { color: active ? accentColor : wm(0.45) }]}>{label}</Text>
      <Text style={styles.orbCaption}>{caption}</Text>
    </View>
  )
}

function CueChip({ label, accent }: { label: string; accent?: string }) {
  return (
    <View style={[styles.cueChip, accent ? { borderColor: `${accent}55`, backgroundColor: `${accent}16` } : null]}>
      <Text style={[styles.cueChipText, accent ? { color: accent } : null]}>{label}</Text>
    </View>
  )
}

export default function InterviewScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()
  const isWebInterview = Platform.OS === 'web'
  const { width } = useWindowDimensions()
  const isWideLayout = width >= 1040

  const [phase, setPhase] = useState<Phase>('connecting')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState('')
  const [userTranscript, setUserTranscript] = useState('')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [focusNote, setFocusNote] = useState('')
  const [cue, setCue] = useState<CopilotCue>(DEFAULT_CUE)
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('live_assist')
  const [copilotAnalyzing, setCopilotAnalyzing] = useState(false)
  const [copilotSource, setCopilotSource] = useState<'openai' | 'fallback' | null>(null)
  const [copilotLastUpdated, setCopilotLastUpdated] = useState<number | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const audioChunksRef = useRef<string[]>([])
  const webAiTranscriptRef = useRef('')
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const currentQuestionRef = useRef('')
  const currentAnswerRef = useRef('')
  const questionFrameRef = useRef<QuestionFrame | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const startTimeRef = useRef(Date.now())

  const cueAnim = useRef(new Animated.Value(1)).current
  const aiOrbAnim = useRef(new Animated.Value(1)).current
  const userOrbAnim = useRef(new Animated.Value(1)).current

  const copilotSeqRef = useRef(0)
  const copilotLastCallAtRef = useRef(0)
  const copilotLastSignatureRef = useRef('')
  const copilotStableCueRef = useRef<CopilotCue>(DEFAULT_CUE)
  const copilotStableUpdatedAtRef = useRef(0)
  const connectRef = useRef<() => Promise<void>>(async () => {})

  const closeWebRealtimeSession = useCallback(() => {
    dcRef.current?.close()
    dcRef.current = null

    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop()
      localStreamRef.current = null
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!isWebInterview || typeof document === 'undefined') return

    const audioElement = document.createElement('audio')
    audioElement.autoplay = true
    ;(audioElement as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
    audioElement.style.display = 'none'
    document.body.appendChild(audioElement)
    remoteAudioRef.current = audioElement

    return () => {
      audioElement.srcObject = null
      remoteAudioRef.current = null
      audioElement.remove()
    }
  }, [isWebInterview])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (phase === 'ai_speaking' || phase === 'connecting' || phase === 'processing') {
      aiOrbAnim.setValue(0.9)
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(aiOrbAnim, { toValue: 1.1, duration: 850, useNativeDriver: true }),
          Animated.timing(aiOrbAnim, { toValue: 0.92, duration: 850, useNativeDriver: true }),
        ]),
      )
      animation.start()
    } else {
      Animated.timing(aiOrbAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    }
    return () => animation?.stop()
  }, [aiOrbAnim, phase])

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (phase === 'listening') {
      userOrbAnim.setValue(0.9)
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(userOrbAnim, { toValue: 1.12, duration: 520, useNativeDriver: true }),
          Animated.timing(userOrbAnim, { toValue: 0.92, duration: 520, useNativeDriver: true }),
        ]),
      )
      animation.start()
    } else {
      Animated.timing(userOrbAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    }
    return () => animation?.stop()
  }, [phase, userOrbAnim])

  const applyCopilotCue = useCallback((nextCue: CopilotCue) => {
    const prev = copilotStableCueRef.current
    const now = Date.now()
    const majorChange =
      prev.primaryCue !== nextCue.primaryCue ||
      prev.status !== nextCue.status ||
      prev.recommendedAnswerFramework !== nextCue.recommendedAnswerFramework

    if (!majorChange && now - copilotStableUpdatedAtRef.current < 2200) return

    copilotStableCueRef.current = nextCue
    copilotStableUpdatedAtRef.current = now

    cueAnim.setValue(0.74)
    setCue(nextCue)
    setCopilotLastUpdated(now)
    Animated.spring(cueAnim, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }, [cueAnim])

  const runCopilotAnalysis = useCallback(async (
    questionText?: string,
    answerText?: string,
    force = false,
  ) => {
    const sid = sessionIdRef.current
    if (!sid) return

    const nextQuestion = (questionText ?? currentQuestionRef.current).trim()
    const nextAnswer = (answerText ?? currentAnswerRef.current).trim()
    if (!nextQuestion || !nextAnswer) return

    const signature = `${copilotMode}\n${nextQuestion}\n---\n${nextAnswer}`
    const now = Date.now()
    if (!force && signature === copilotLastSignatureRef.current) return
    if (!force && now - copilotLastCallAtRef.current < 1500) return

    copilotLastSignatureRef.current = signature
    copilotLastCallAtRef.current = now

    const seq = copilotSeqRef.current + 1
    copilotSeqRef.current = seq
    setCopilotAnalyzing(true)
    setCopilotError(null)

    try {
      const token = await getToken()
      const data = await apiRequest<CopilotApiResponse>(
        '/api/interview/copilot',
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: sid,
            mode: copilotMode,
            questionText: nextQuestion,
            answerText: nextAnswer,
            additionalContext: focusNote.trim() || undefined,
            transcript: transcriptRef.current.slice(-18).map((item) => ({
              speaker: item.role === 'ai' ? 'interviewer' : 'candidate',
              text: item.text,
            })),
          }),
        },
        token,
      )

      if (copilotSeqRef.current !== seq) return

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.cue) applyCopilotCue(data.cue)
      setCopilotSource(data.source ?? null)
      setCopilotError(data.warning ?? null)
    } catch (err) {
      if (copilotSeqRef.current !== seq) return
      setCopilotError(err instanceof Error ? err.message : 'Failed to refresh copilot cues')
    } finally {
      if (copilotSeqRef.current === seq) setCopilotAnalyzing(false)
    }
  }, [applyCopilotCue, copilotMode, focusNote, getToken])

  const primeCueForQuestion = useCallback((questionText: string) => {
    const frame = createQuestionFrame(questionText)
    questionFrameRef.current = frame
    currentQuestionRef.current = questionText
    currentAnswerRef.current = ''
    setAiMessage(questionText)
    setUserTranscript('')
    copilotLastSignatureRef.current = ''

    applyCopilotCue({
      questionType: frame.questionType,
      likelyIntent: 'Choose the best relevant story, then answer with clear ownership and impact.',
      recommendedAnswerFramework: frame.framework,
      status: 'suggest_topic',
      primaryCue: 'CHOOSE STORY FAST',
      secondaryCues: ['SET CONTEXT', 'YOUR ROLE'],
      relevantThemes: copilotStableCueRef.current.relevantThemes,
      relevantStories: copilotStableCueRef.current.relevantStories,
    })
  }, [applyCopilotCue])

  const playAIAudio = useCallback(async (chunks: string[]) => {
    if (chunks.length === 0) return
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }

      const pcmBytes = concatB64Chunks(chunks)
      const wavBytes = buildWAV(pcmBytes)
      const wavFile = new File(Paths.cache, 'ai_response.wav')
      wavFile.write(wavBytes)

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync({ uri: wavFile.uri })
      soundRef.current = sound
      await sound.playAsync()
    } catch (err) {
      console.error('AI audio playback error:', err)
    }
  }, [])

  const handleRealtimeMessage = useCallback((msg: RealtimeEvent) => {
    const type = msg.type as string

    if (type === 'error') {
      const errorMessage =
        typeof msg.error === 'object' && msg.error && 'message' in msg.error
          ? String((msg.error as { message?: unknown }).message ?? 'Realtime error')
          : 'Realtime error'
      setError(errorMessage)
      return
    }

    if (type === 'response.audio.delta') {
      audioChunksRef.current.push(msg.delta as string)
      return
    }

    if (type === 'response.audio.done') {
      void playAIAudio(audioChunksRef.current)
      audioChunksRef.current = []
      return
    }

    if (type === 'response.created') {
      setPhase('processing')
      setAiMessage('')
      return
    }

    if (type === 'response.audio_transcript.delta') {
      setAiMessage((prev) => prev + (msg.delta as string))
      setPhase('ai_speaking')
      return
    }

    if (type === 'response.output_audio_transcript.delta' || type === 'response.text.delta') {
      const delta = typeof msg.delta === 'string' ? msg.delta : ''
      if (!delta) return
      webAiTranscriptRef.current += delta
      setAiMessage(webAiTranscriptRef.current)
      setPhase('ai_speaking')
      return
    }

    if (type === 'response.audio_transcript.done') {
      const text = (msg.transcript as string)?.trim()
      if (text) {
        transcriptRef.current.push({ role: 'ai', text })
        setQuestionsAnswered((value) => value + 1)
        primeCueForQuestion(text)
      }
      return
    }

    if (type === 'response.output_audio_transcript.done' || type === 'response.text.done') {
      const text = (
        (typeof msg.transcript === 'string' ? msg.transcript : '') ||
        (typeof msg.text === 'string' ? msg.text : '') ||
        webAiTranscriptRef.current
      ).trim()
      webAiTranscriptRef.current = ''
      if (text) {
        transcriptRef.current.push({ role: 'ai', text })
        setQuestionsAnswered((value) => value + 1)
        primeCueForQuestion(text)
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const text =
        typeof msg.delta === 'string'
          ? msg.delta
          : typeof msg.transcript === 'string'
            ? msg.transcript
            : ''
      if (text) setUserTranscript((prev) => `${prev}${text}`.trim())
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const text = (msg.transcript as string)?.trim()
      if (text) {
        setUserTranscript(text)
        currentAnswerRef.current = text
        transcriptRef.current.push({ role: 'user', text })

        const localCue = buildLocalReactiveCue(
          questionFrameRef.current,
          currentQuestionRef.current,
          text,
          copilotStableCueRef.current,
        )
        applyCopilotCue(localCue)
        void runCopilotAnalysis(currentQuestionRef.current, text)
      }
      return
    }

    if (type === 'input_audio_buffer.speech_started') {
      setUserTranscript('')
      setPhase('listening')
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      setPhase('processing')
      return
    }

    if (type === 'response.done') {
      setPhase('ready')
    }
  }, [applyCopilotCue, playAIAudio, primeCueForQuestion, runCopilotAnalysis])

  const connect = useCallback(async () => {
    try {
      const token = await getToken()
      setError(null)
      wsRef.current?.close(1000)
      closeWebRealtimeSession()
      webAiTranscriptRef.current = ''

      if (isWebInterview) {
        const data = await apiRequest<{
          clientSecret: string
          sessionId: string
          expiresAt: number | null
        }>(
          '/api/interview/token',
          {
            method: 'POST',
            body: JSON.stringify({ jobId }),
          },
          token,
        )

        setSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
          throw new Error('Your browser does not support realtime voice interview in this app.')
        }

        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = localStream

        const pc = new RTCPeerConnection()
        pcRef.current = pc

        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream)
        }

        pc.ontrack = (event) => {
          if (!remoteAudioRef.current) return
          const remoteStream = event.streams[0] ?? new MediaStream([event.track])
          remoteAudioRef.current.srcObject = remoteStream
          void remoteAudioRef.current.play().catch(() => {})
        }

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setError('Connection lost. Please try again.')
          }
        }

        const dc = pc.createDataChannel('oai-events')
        dcRef.current = dc

        dc.onmessage = (event) => {
          const parsed = safeJsonParse(event.data)
          if (parsed) handleRealtimeMessage(parsed)
        }

        dc.onopen = () => {
          setPhase('processing')
          dc.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                output_modalities: ['audio'],
                instructions:
                  'Start the mock interview now. Introduce yourself very briefly as the interviewer, then ask the first interview question.',
              },
            }),
          )
        }

        dc.onclose = () => {}

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp ?? '',
        })

        if (!sdpResponse.ok) {
          throw new Error(await sdpResponse.text())
        }

        const answerSdp = await sdpResponse.text()
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        })
        return
      }

      const data = await apiRequest<{
        clientSecret: string
        sessionId: string
        expiresAt: number
      }>('/api/interview/token', { method: 'POST', body: JSON.stringify({ jobId }) }, token)

      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId

      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      })

      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        ['realtime', `openai-insecure-api-key.${data.clientSecret}`, 'openai-beta.realtime-v1'],
      )

      ws.onopen = () => {
        setPhase('processing')
        ws.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              output_modalities: ['audio'],
              instructions:
                'Start the mock interview now. Introduce yourself very briefly, then ask the first interview question.',
            },
          }),
        )
      }

      ws.onmessage = (event) => handleRealtimeMessage(JSON.parse(event.data))
      ws.onerror = () => setError('Connection error. Please try again.')
      ws.onclose = (event) => {
        if (event.code !== 1000) setError('Connection lost. Please try again.')
      }

      wsRef.current = ws
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('Insufficient credits')) {
        router.replace('/upgrade')
        return
      }
      setError(message || (isWebInterview ? 'Failed to start interview. Please try again.' : 'Failed to start session. Please try again.'))
    }
  }, [closeWebRealtimeSession, getToken, handleRealtimeMessage, isWebInterview, jobId, router])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    void connectRef.current()
    return () => {
      wsRef.current?.close(1000)
      closeWebRealtimeSession()
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync().catch(() => {})
      }
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => {})
      }
    }
  }, [closeWebRealtimeSession])

  useEffect(() => {
    if (!sessionIdRef.current || !currentQuestionRef.current) return
    const timeout = setTimeout(() => {
      void runCopilotAnalysis(currentQuestionRef.current, currentAnswerRef.current, true)
    }, 220)
    return () => clearTimeout(timeout)
  }, [copilotMode, focusNote, runCopilotAnalysis])

  const startRecording = useCallback(async () => {
    if (isWebInterview) return
    if (phase === 'listening' || phase === 'ai_speaking' || phase === 'processing') return
    try {
      await soundRef.current?.stopAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })

      const { recording } = await Audio.Recording.createAsync(IOS_PCM_OPTIONS)
      recordingRef.current = recording
      setPhase('listening')
    } catch (err) {
      console.error('Recording start error:', err)
    }
  }, [isWebInterview, phase])

  const stopRecording = useCallback(async () => {
    if (isWebInterview) return
    if (!recordingRef.current) return
    try {
      setPhase('processing')
      const recording = recordingRef.current
      recordingRef.current = null
      await recording.stopAndUnloadAsync()

      const uri = recording.getURI()
      if (!uri || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

      const audioFile = new File(uri)
      const b64 = await audioFile.base64()

      let audioB64 = b64
      if (Platform.OS === 'ios') {
        const bytes = b64ToBytes(b64)
        const pcm = extractPCMFromCAF(bytes)
        audioB64 = bytesToB64(pcm)
      }

      wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: audioB64 }))
      wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      wsRef.current.send(JSON.stringify({ type: 'response.create' }))
    } catch (err) {
      console.error('Recording stop error:', err)
      setPhase('ready')
    }
  }, [isWebInterview])

  const submitWebAnswer = useCallback(async () => {
    const answer = draftAnswer.trim()
    if (!isWebInterview || !answer || phase === 'processing' || !dcRef.current || dcRef.current.readyState !== 'open') return

    try {
      setPhase('processing')
      setUserTranscript(answer)
      currentAnswerRef.current = answer
      transcriptRef.current.push({ role: 'user', text: answer })
      setDraftAnswer('')

      const localCue = buildLocalReactiveCue(
        questionFrameRef.current,
        currentQuestionRef.current,
        answer,
        copilotStableCueRef.current,
      )
      applyCopilotCue(localCue)

      dcRef.current.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: answer }],
          },
        }),
      )
      dcRef.current.send(JSON.stringify({ type: 'response.create' }))
    } catch (err) {
      console.error('Web interview response error:', err)
      setError('Connection lost. Please try again.')
    }
  }, [
    applyCopilotCue,
    draftAnswer,
    isWebInterview,
    phase,
    runCopilotAnalysis,
  ])

  const endSession = useCallback(async () => {
    wsRef.current?.close(1000)
    closeWebRealtimeSession()
    const sid = sessionIdRef.current
    if (!sid) {
      router.back()
      return
    }

    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    const transcriptText = transcriptRef.current
      .map((item) => `${item.role === 'ai' ? 'Interviewer' : 'You'}: ${item.text}`)
      .join('\n\n')

    setPhase('completed')

    try {
      const token = await getToken()
      const data = await apiRequest<{ debrief: Debrief }>(
        '/api/interview/complete',
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: sid,
            transcript: transcriptText,
            durationSeconds: elapsed,
            questionsAnswered,
          }),
        },
        token,
      )
      setDebrief(data.debrief)
    } catch {
      setDebrief({
        overallScore: 70,
        strengths: ['Completed the session', 'Stayed engaged through the mock interview'],
        improvements: ['Keep sharpening your structure', 'Land each answer with a concrete result'],
        summary: 'Solid practice session. Keep tightening ownership and measurable impact in each answer.',
      })
    }
  }, [closeWebRealtimeSession, getToken, questionsAnswered, router])

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Interview unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setError(null); setPhase('connecting'); void connect() }}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    )
  }

  if (debrief) {
    return <DebriefScreen debrief={debrief} questionsAnswered={questionsAnswered} onDone={() => router.back()} />
  }

  if (phase === 'connecting') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.connectingEyebrow}>VOICE INTERVIEW</Text>
        <Text style={styles.connectingTitle}>Wiring up interviewer and copilot...</Text>
      </View>
    )
  }

  const phaseLabel: Record<Phase, string> = {
    connecting: 'Connecting',
    ready: isWebInterview ? 'Mic is live' : 'Hold to answer',
    ai_speaking: 'Interviewer speaking',
    listening: 'You are speaking',
    processing: 'Refreshing cues',
    completed: 'Completed',
  }

  const statusMeta = getStatusMeta(cue.status)
  const hasSupportContent = cue.relevantThemes.length > 0 || cue.relevantStories.length > 0
  const cueUpdatedText = copilotAnalyzing
    ? 'Refreshing cues...'
    : copilotLastUpdated
      ? `Updated ${Math.max(0, Math.round((Date.now() - copilotLastUpdated) / 1000))}s ago`
      : 'Waiting for your first answer'

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Interview Practice</Text>
          <Text style={styles.headerSub}>
            {questionsAnswered} {questionsAnswered === 1 ? 'question' : 'questions'} · {copilotMode === 'live_assist' ? 'Live assist' : 'Practice mode'}
          </Text>
        </View>
        {questionsAnswered >= 2 ? (
          <Pressable onPress={endSession} hitSlop={12}>
            <Text style={styles.finishText}>Finish</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.presenceCard}>
          <PresenceOrb
            label="ARRO AI"
            caption={phase === 'ai_speaking' ? 'speaking' : 'ready'}
            accentColor={Colors.orange}
            active={phase === 'ai_speaking' || phase === 'processing'}
            pulse={aiOrbAnim}
            kind="ai"
          />
          <View style={styles.presenceCenter}>
            <Text style={styles.presenceEyebrow}>Realtime mock interview</Text>
            <Text style={styles.presenceHeadline}>{phaseLabel[phase]}</Text>
            <Text style={styles.presenceSub}>
              {copilotAnalyzing
                ? 'Copilot is refreshing the cue stack.'
                : copilotSource === 'fallback'
                  ? 'Using fallback heuristics.'
                  : 'Copilot is tuned to your resume context.'}
            </Text>
          </View>
          <PresenceOrb
            label="YOU"
            caption={phase === 'listening' ? 'speaking' : 'ready'}
            accentColor={Colors.white}
            active={phase === 'listening'}
            pulse={userOrbAnim}
            kind="user"
          />
        </View>

        <View style={[styles.stageLayout, isWideLayout && styles.stageLayoutWide]}>
          <View style={styles.mainColumn}>
            <View style={styles.conversationStage}>
              <View style={styles.stageStatusRow}>
                <View style={styles.stageBadge}>
                  <Text style={styles.stageBadgeText}>LIVE INTERVIEW</Text>
                </View>
                <Text style={styles.stageMetaText}>
                  {phase === 'listening'
                    ? 'Answering now'
                    : phase === 'ai_speaking'
                      ? 'Interviewer turn'
                      : 'Your next response'}
                </Text>
              </View>

              <View style={styles.stageTranscriptStack}>
                <View style={[styles.stageBubble, styles.stageBubbleAi]}>
                  <Text style={styles.stageBubbleLabel}>INTERVIEWER</Text>
                  <Text style={styles.stageBubbleText}>
                    {aiMessage || 'The interviewer will appear here once the session starts.'}
                  </Text>
                </View>

                <View style={[styles.stageBubble, styles.stageBubbleUser]}>
                  <Text style={[styles.stageBubbleLabel, styles.stageBubbleLabelUser]}>YOU</Text>
                  <Text style={styles.stageBubbleText}>
                    {userTranscript || 'Your live or latest answer will appear here.'}
                  </Text>
                </View>
              </View>
            </View>

            {hasSupportContent ? (
              <View style={[styles.supportRow, isWideLayout && styles.supportRowTight]}>
                <View style={styles.supportCard}>
                  <Text style={styles.supportLabel}>Relevant themes</Text>
                  <View style={styles.supportChipWrap}>
                    {cue.relevantThemes.slice(0, 4).map((item, index) => (
                      <CueChip key={`${item}-${index}`} label={item} accent={Colors.blue} />
                    ))}
                  </View>
                </View>

                <View style={styles.supportCard}>
                  <Text style={styles.supportLabel}>Story prompts</Text>
                  <View style={styles.storyList}>
                    {cue.relevantStories.slice(0, 3).map((item, index) => (
                      <Text key={`${item}-${index}`} style={styles.storyItem}>{item}</Text>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.asideColumn, isWideLayout && styles.asideColumnWide]}>
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeChip, copilotMode === 'live_assist' && styles.modeChipActive]}
                onPress={() => setCopilotMode('live_assist')}
              >
                <Text style={[styles.modeChipText, copilotMode === 'live_assist' && styles.modeChipTextActive]}>Live assist</Text>
              </Pressable>
              <Pressable
                style={[styles.modeChip, copilotMode === 'practice' && styles.modeChipActive]}
                onPress={() => setCopilotMode('practice')}
              >
                <Text style={[styles.modeChipText, copilotMode === 'practice' && styles.modeChipTextActive]}>Practice</Text>
              </Pressable>
            </View>

            <Animated.View style={[styles.cuePanel, { opacity: cueAnim, transform: [{ scale: cueAnim }] }]}>
              <View style={styles.cueTopRow}>
                <View style={[styles.statusPill, { borderColor: statusMeta.border, backgroundColor: statusMeta.bg }]}>
                  <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                </View>
                <CueChip label={formatQuestionTypeLabel(cue.questionType)} />
                <CueChip label={cue.recommendedAnswerFramework || 'STAR-lite'} accent={Colors.orange} />
              </View>

              <Text style={styles.cuePrimary}>{cue.primaryCue || 'SET CONTEXT'}</Text>

              <View style={styles.secondaryWrap}>
                {cue.secondaryCues.slice(0, 3).map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.secondaryCard}>
                    <Text style={styles.secondaryCardText}>{item}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.intentLabel}>Intent</Text>
              <Text style={styles.intentText}>{cue.likelyIntent}</Text>

              <Text style={styles.updatedText}>{cueUpdatedText}</Text>
            </Animated.View>

            <View style={styles.focusCard}>
              <Text style={styles.focusLabel}>Copilot focus</Text>
              <TextInput
                value={focusNote}
                onChangeText={setFocusNote}
                placeholder="Optional: remind copilot what role, stories, or themes to prioritize..."
                placeholderTextColor={wm(0.26)}
                multiline
                style={styles.focusInput}
              />
            </View>

            {copilotError ? (
              <View style={styles.alertCard}>
                <Text style={styles.alertLabel}>Copilot note</Text>
                <Text style={styles.alertText}>{copilotError}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomDock}>
        <Text style={styles.bottomStatus}>
          {isWebInterview
            ? phase === 'processing'
              ? 'Interviewer is thinking...'
              : phase === 'ai_speaking'
                ? 'Interviewer speaking...'
                : 'Mic is live. Speak naturally, or type a reply.'
            : phase === 'listening'
              ? 'Release when done'
              : phase === 'ai_speaking'
                ? 'Wait for the interviewer to finish'
                : 'Hold to speak'}
        </Text>

        {isWebInterview ? (
          <View style={styles.textDockRow}>
            <TextInput
              value={draftAnswer}
              onChangeText={setDraftAnswer}
              placeholder="Type your answer..."
              placeholderTextColor={wm(0.26)}
              style={styles.answerInput}
              multiline
              editable={phase !== 'processing'}
            />
            <Pressable
              onPress={submitWebAnswer}
              disabled={!draftAnswer.trim() || phase === 'processing'}
              style={[
                styles.sendBtn,
                (!draftAnswer.trim() || phase === 'processing') && styles.micBtnDisabled,
              ]}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={phase === 'ai_speaking' || phase === 'processing'}
          >
            <View
              style={[
                styles.micBtn,
                phase === 'listening' && styles.micBtnActive,
                (phase === 'ai_speaking' || phase === 'processing') && styles.micBtnDisabled,
              ]}
            >
              <MicIcon active={phase === 'listening'} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <View style={styles.micIcon}>
      <View style={[styles.micBody, active && styles.micBodyActive]} />
      <View style={[styles.micBase, active && styles.micBaseActive]} />
      <View style={[styles.micStand, active && styles.micStandActive]} />
    </View>
  )
}

function DebriefScreen({
  debrief,
  questionsAnswered,
  onDone,
}: {
  debrief: Debrief
  questionsAnswered: number
  onDone: () => void
}) {
  const scoreColor =
    debrief.overallScore >= 80 ? Colors.green :
    debrief.overallScore >= 60 ? Colors.amber :
    Colors.red

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.debriefContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.debriefTitle}>Session Complete</Text>
      <Text style={styles.debriefSub}>
        {questionsAnswered} {questionsAnswered === 1 ? 'question' : 'questions'} answered
      </Text>

      <View style={[styles.scoreCard, { borderColor: scoreColor }]}>
        <Text style={[styles.scoreNumber, { color: scoreColor }]}>{debrief.overallScore}</Text>
        <Text style={styles.scoreLabel}>Overall score</Text>
      </View>

      <View style={styles.debriefCard}>
        <Text style={styles.debriefCardLabel}>SUMMARY</Text>
        <Text style={styles.debriefCardText}>{debrief.summary}</Text>
      </View>

      {debrief.strengths?.length > 0 && (
        <View style={styles.debriefCard}>
          <Text style={[styles.debriefCardLabel, { color: Colors.green }]}>STRENGTHS</Text>
          {debrief.strengths.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.debriefItem}>
              <Text style={[styles.debriefDot, { color: Colors.green }]}>✓</Text>
              <Text style={styles.debriefCardText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {debrief.improvements?.length > 0 && (
        <View style={styles.debriefCard}>
          <Text style={[styles.debriefCardLabel, { color: Colors.amber }]}>AREAS TO IMPROVE</Text>
          {debrief.improvements.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.debriefItem}>
              <Text style={[styles.debriefDot, { color: Colors.amber }]}>→</Text>
              <Text style={styles.debriefCardText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.interview.bg,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 148,
    gap: 16,
  },

  stageLayout: {
    gap: 16,
  },

  stageLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  mainColumn: {
    flex: 1,
    gap: 16,
  },

  asideColumn: {
    gap: 16,
  },

  asideColumnWide: {
    width: 360,
    flexShrink: 0,
  },

  centered: {
    flex: 1,
    backgroundColor: Colors.interview.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },

  connectingEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.orange,
  },

  connectingTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.interview.textPrimary,
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.interview.textPrimary,
  },

  errorText: {
    color: Colors.interview.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.card,
    backgroundColor: Colors.orange,
  },

  retryText: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.interview.border,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.interview.textPrimary,
  },

  headerSub: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.interview.textSecondary,
  },

  exitText: {
    width: 44,
    fontSize: FontSize.md,
    color: wm(0.42),
    fontWeight: '500',
  },

  finishText: {
    width: 44,
    textAlign: 'right',
    fontSize: FontSize.md,
    color: Colors.orange,
    fontWeight: '600',
  },

  headerSpacer: {
    width: 44,
  },

  presenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    gap: 12,
  },

  presenceCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  presenceEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.orange,
    textTransform: 'uppercase',
  },

  presenceHeadline: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.interview.textPrimary,
    textAlign: 'center',
  },

  presenceSub: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    color: Colors.interview.textSecondary,
    textAlign: 'center',
  },

  conversationStage: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: '#1b1511',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 16,
    minHeight: 360,
  },

  stageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: orangeAlpha(0.14),
    borderWidth: 1,
    borderColor: orangeAlpha(0.2),
  },

  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.orange,
  },

  stageMetaText: {
    fontSize: FontSize.sm,
    color: Colors.interview.textSecondary,
    fontWeight: '500',
  },

  stageTranscriptStack: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },

  stageBubble: {
    maxWidth: '88%',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    gap: 7,
  },

  stageBubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: whiteAlpha(0.05),
    borderColor: whiteAlpha(0.08),
  },

  stageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: orangeAlpha(0.13),
    borderColor: orangeAlpha(0.18),
  },

  stageBubbleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: wm(0.42),
  },

  stageBubbleLabelUser: {
    color: Colors.orange,
  },

  stageBubbleText: {
    fontSize: FontSize.md,
    lineHeight: 23,
    color: Colors.interview.textPrimary,
  },

  orbColumn: {
    alignItems: 'center',
    width: 86,
  },

  orbWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orbRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
  },

  orbCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiGlyph: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiDot: {
    position: 'absolute',
  },

  aiMiniDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: whiteAlpha(0.65),
  },

  userGlyph: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  userBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },

  orbLabel: {
    marginTop: 8,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  orbCaption: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.interview.textTertiary,
    textTransform: 'uppercase',
  },

  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },

  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    alignItems: 'center',
  },

  modeChipActive: {
    borderColor: orangeAlpha(0.4),
    backgroundColor: orangeAlpha(0.12),
  },

  modeChipText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.interview.textSecondary,
  },

  modeChipTextActive: {
    color: Colors.orange,
  },

  cuePanel: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
    backgroundColor: Colors.interview.surface,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },

  cueTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },

  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  statusPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  cuePrimary: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.interview.textPrimary,
    textAlign: 'center',
    marginTop: 10,
  },

  cueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
    backgroundColor: whiteAlpha(0.04),
  },

  cueChipText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.interview.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  secondaryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },

  secondaryCard: {
    minWidth: '30%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: whiteAlpha(0.05),
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
  },

  secondaryCardText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.interview.textPrimary,
    textAlign: 'center',
  },

  intentLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: wm(0.38),
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  intentText: {
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.interview.textSecondary,
    textAlign: 'center',
  },

  updatedText: {
    fontSize: FontSize.sm,
    color: Colors.interview.textTertiary,
    textAlign: 'center',
  },

  supportRow: {
    gap: 12,
  },

  supportRowTight: {
    flexDirection: 'row',
    gap: 12,
  },

  supportCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    padding: 16,
    gap: 12,
  },

  supportLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.interview.textSecondary,
    textTransform: 'uppercase',
  },

  supportChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  storyList: {
    gap: 8,
  },

  storyItem: {
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.interview.textPrimary,
  },

  focusCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    padding: 16,
    gap: 10,
  },

  focusLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.interview.textSecondary,
    textTransform: 'uppercase',
  },

  focusInput: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
    backgroundColor: whiteAlpha(0.04),
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.interview.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 20,
    textAlignVertical: 'top',
  },

  transcriptCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    padding: 16,
    gap: 8,
  },

  transcriptLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.interview.textSecondary,
  },

  transcriptText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.interview.textPrimary,
  },

  alertCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${Colors.amber}55`,
    backgroundColor: `${Colors.amber}14`,
    padding: 14,
    gap: 6,
  },

  alertLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.amber,
    textTransform: 'uppercase',
  },

  alertText: {
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.interview.textPrimary,
  },

  bottomDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
    backgroundColor: Colors.dark,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 12,
  },

  bottomStatus: {
    fontSize: FontSize.sm,
    color: Colors.interview.textSecondary,
    fontWeight: '500',
  },

  textDockRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },

  answerInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: whiteAlpha(0.08),
    backgroundColor: Colors.interview.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.interview.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 20,
    textAlignVertical: 'top',
  },

  sendBtn: {
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  micBtn: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: whiteAlpha(0.12),
    backgroundColor: Colors.interview.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  micBtnActive: {
    borderColor: Colors.orange,
    backgroundColor: orangeAlpha(0.18),
  },

  micBtnDisabled: {
    opacity: 0.38,
  },

  micIcon: {
    alignItems: 'center',
    gap: 3,
  },

  micBody: {
    width: 18,
    height: 24,
    borderRadius: 9,
    backgroundColor: wm(0.72),
  },

  micBodyActive: {
    backgroundColor: Colors.white,
  },

  micBase: {
    width: 28,
    height: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: wm(0.72),
  },

  micBaseActive: {
    borderColor: Colors.white,
  },

  micStand: {
    width: 2,
    height: 7,
    borderRadius: 2,
    backgroundColor: wm(0.72),
  },

  micStandActive: {
    backgroundColor: Colors.white,
  },

  debriefContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    gap: 14,
  },

  debriefTitle: {
    fontSize: FontSize.hero,
    fontWeight: '700',
    color: Colors.interview.textPrimary,
    textAlign: 'center',
  },

  debriefSub: {
    marginTop: -6,
    fontSize: FontSize.md,
    color: Colors.interview.textSecondary,
    textAlign: 'center',
  },

  scoreCard: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: Radius.card,
    borderWidth: 2,
    backgroundColor: Colors.interview.surface,
  },

  scoreNumber: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '700',
  },

  scoreLabel: {
    fontSize: FontSize.md,
    color: Colors.interview.textSecondary,
    fontWeight: '500',
  },

  debriefCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.interview.border,
    backgroundColor: Colors.interview.surface,
    padding: 16,
    gap: 10,
  },

  debriefCardLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.interview.textSecondary,
  },

  debriefCardText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.interview.textPrimary,
  },

  debriefItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },

  debriefDot: {
    width: 16,
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  doneBtn: {
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: Radius.card,
    backgroundColor: Colors.orange,
    alignItems: 'center',
  },

  doneBtnText: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '600',
  },
})
