import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native'
import { Colors, FontSize, Radius, Spacing, wm, orangeAlpha } from '@/constants/Colors'
import { clearOnboardingSession, setOnboardingResumeFiles, setOnboardingResumeText } from '@/lib/onboarding-session'

interface PickedFile {
  name: string
  uri: string
  size?: number
  mimeType?: string
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileInitials(name: string) {
  const ext = name.split('.').pop()?.toUpperCase() ?? 'FILE'
  return ext.slice(0, 3)
}

export default function OnboardingWelcome() {
  const router = useRouter()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const [resumeText, setResumeText] = useState('')
  const [linkedInMode, setLinkedInMode] = useState(false)

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ],
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      const newFiles: PickedFile[] = result.assets.map(a => ({
        name: a.name,
        uri: a.uri,
        size: a.size,
        mimeType: a.mimeType,
      }))
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.name))
        return [...prev, ...newFiles.filter(f => !existing.has(f.name))]
      })
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const onAnalyse = () => {
    if (mode === 'upload') {
      setOnboardingResumeFiles(files)
    } else {
      setOnboardingResumeText(resumeText, linkedInMode ? 'linkedin' : 'text')
    }
    router.push('/onboarding/parsing')
  }

  const onImportLinkedIn = () => {
    setLinkedInMode(true)
    setMode('paste')
  }

  const onSkip = () => {
    clearOnboardingSession()
    router.push('/onboarding/gap-fill')
  }

  const hasFiles = files.length > 0
  const hasText = resumeText.trim().length > 80
  const canAnalyse = mode === 'upload' ? hasFiles : hasText

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoArrow}>→</Text>
        </View>
        <Text style={styles.wordmark}>
          arr<Text style={styles.wordmarkO}>o</Text>
        </Text>
      </View>

      <Text style={styles.title}>Let's get you set up.</Text>
      <Text style={styles.subtitle}>
        Upload one or more resumes and we'll merge the details into a single master resume automatically.
      </Text>

      <View style={styles.modeRow}>
        <Pressable style={[styles.modePill, mode === 'upload' && styles.modePillActive]} onPress={() => setMode('upload')}>
          <Text style={[styles.modePillText, mode === 'upload' && styles.modePillTextActive]}>Upload file</Text>
        </Pressable>
        <Pressable style={[styles.modePill, mode === 'paste' && styles.modePillActive]} onPress={() => setMode('paste')}>
          <Text style={[styles.modePillText, mode === 'paste' && styles.modePillTextActive]}>Paste text</Text>
        </Pressable>
      </View>

      {mode === 'upload' ? (
        <>
          <Pressable
            style={[styles.dropZone, hasFiles && styles.dropZoneReady]}
            onPress={pickFiles}
          >
            <View style={[styles.uploadIconWrap, hasFiles && styles.uploadIconWrapReady]}>
              <Text style={styles.uploadIcon}>{hasFiles ? '✓' : '↑'}</Text>
            </View>
            <Text style={[styles.dropTitle, hasFiles && styles.dropTitleReady]}>
              {hasFiles ? `${files.length} file${files.length > 1 ? 's' : ''} ready` : 'Tap to upload resume'}
            </Text>
            <Text style={styles.dropSub}>
              {hasFiles ? 'Tap to add another resume' : 'PDF, DOCX, or TXT. Multiple files supported.'}
            </Text>
          </Pressable>

          {files.length > 0 && (
            <View style={styles.fileList}>
              {files.map((file, i) => (
                <View key={i} style={styles.filePill}>
                  <View style={styles.fileIconWrap}>
                    <Text style={styles.fileIconText}>{FileInitials(file.name)}</Text>
                  </View>
                  <View style={styles.fileMeta}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    {file.size ? (
                      <Text style={styles.fileSize}>{formatBytes(file.size)}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeFile(i)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.pasteCard}>
          <Text style={styles.pasteTitle}>{linkedInMode ? 'Import from LinkedIn' : 'Paste your resume text'}</Text>
          <Text style={styles.pasteSub}>
            {linkedInMode
              ? 'Go to your LinkedIn profile → More → Save to PDF, then copy and paste the text here. Or manually copy your About, Experience, and Education sections.'
              : 'Paste a raw resume, LinkedIn export, or detailed work history. We will structure it into your master resume.'}
          </Text>
          <TextInput
            value={resumeText}
            onChangeText={setResumeText}
            placeholder={linkedInMode ? 'Paste your LinkedIn profile text here...' : 'Paste your resume text here...'}
            placeholderTextColor={wm(0.2)}
            style={styles.pasteInput}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.pasteHint}>
            {linkedInMode
              ? 'Include your About, all Experience entries with dates, and Skills. The more detail, the better the result.'
              : 'Aim for at least one role with dates, bullets, and a skills section.'}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or start from scratch</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Secondary paths */}
      <View style={styles.secondaryRow}>
        <Pressable style={styles.secondaryBtn} onPress={onSkip}>
          <Text style={styles.secondaryBtnText}>Build manually</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onImportLinkedIn}>
          <Text style={styles.secondaryBtnText}>Import LinkedIn</Text>
        </Pressable>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.cta,
          !canAnalyse && styles.ctaDisabled,
          pressed && canAnalyse && styles.ctaPressed,
        ]}
        onPress={onAnalyse}
        disabled={!canAnalyse}
      >
        <Text style={styles.ctaText}>Build my master resume</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.dark },
  container: {
    paddingHorizontal: Spacing[7],
    paddingTop: 64,
    paddingBottom: 48,
    gap: Spacing[4],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoArrow: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  wordmark: {
    fontSize: FontSize['3xl'],
    fontWeight: '600',
    color: wm(0.9),
    letterSpacing: -0.6,
  },
  wordmarkO: { color: Colors.orange },
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
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: wm(0.1),
    backgroundColor: wm(0.04),
  },
  modePillActive: {
    borderColor: orangeAlpha(0.35),
    backgroundColor: orangeAlpha(0.08),
  },
  modePillText: {
    fontSize: FontSize.base,
    color: wm(0.45),
    fontWeight: '500',
  },
  modePillTextActive: {
    color: Colors.orange,
  },
  dropZone: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.1),
    borderStyle: 'dashed',
    paddingVertical: 36,
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  dropZoneReady: {
    borderColor: orangeAlpha(0.35),
    borderStyle: 'solid',
    backgroundColor: orangeAlpha(0.06),
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: wm(0.07),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadIconWrapReady: {
    backgroundColor: orangeAlpha(0.12),
  },
  uploadIcon: {
    fontSize: 22,
    color: wm(0.35),
    fontWeight: '600',
  },
  dropTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: wm(0.5),
  },
  dropTitleReady: { color: Colors.orange },
  dropSub: { fontSize: FontSize.base, color: wm(0.25) },
  fileList: { gap: Spacing[2] },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: wm(0.04),
    borderRadius: Radius.inputLg,
    padding: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: wm(0.08),
    gap: 12,
  },
  fileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: orangeAlpha(0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.orange,
    letterSpacing: 0.3,
  },
  fileMeta: { flex: 1 },
  fileName: { fontSize: FontSize.md, fontWeight: '500', color: wm(0.8) },
  fileSize: { fontSize: FontSize.sm, color: wm(0.3), marginTop: 1 },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: wm(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 16, color: wm(0.35), lineHeight: 18 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: Spacing[2],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: wm(0.08) },
  dividerText: { fontSize: FontSize.sm, color: wm(0.25) },
  secondaryRow: { flexDirection: 'row', gap: Spacing[3] },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: wm(0.1),
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: wm(0.45),
  },
  pasteCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.08),
    padding: Spacing[4],
    gap: Spacing[3],
  },
  pasteTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: wm(0.85),
  },
  pasteSub: {
    fontSize: FontSize.base,
    color: wm(0.35),
    lineHeight: 18,
  },
  pasteInput: {
    minHeight: 220,
    borderRadius: Radius.inputLg,
    backgroundColor: wm(0.03),
    borderWidth: 1,
    borderColor: wm(0.09),
    padding: 14,
    color: wm(0.88),
    fontSize: FontSize.base,
    lineHeight: 20,
  },
  pasteHint: {
    fontSize: FontSize.sm,
    color: wm(0.28),
    lineHeight: 16,
  },
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  ctaDisabled: { opacity: 0.35 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
})
