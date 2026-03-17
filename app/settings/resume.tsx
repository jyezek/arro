import * as DocumentPicker from 'expo-document-picker'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { apiRequest } from '@/lib/api'
import { uploadFilesForText } from '@/lib/file-upload'
import { formatUpdatedAt, splitLines, type ResumeSettingsProfile } from '@/lib/settings'
import { Colors, FontSize, Radius, Spacing, orangeAlpha, wm } from '@/constants/Colors'

type ExperienceForm = ResumeSettingsProfile['experience'][number] & { bulletsText: string }
type EducationForm = ResumeSettingsProfile['education'][number]
type AssistantResult = {
  roleSummary: string
  strongestSignals: string[]
  missingDetails: string[]
  followUpQuestions: string[]
  suggestedBullets: string[]
  improvedDescription: string
}
type AssistantPanelState = {
  open: boolean
  loading: boolean
  error: string | null
  notes: string
  result: AssistantResult | null
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

function makeDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function blankExperience(): ExperienceForm {
  return {
    id: makeDraftId('exp'),
    roleTitle: '',
    company: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
    bullets: [],
    bulletsText: '',
    detailScore: 0,
  }
}

function blankEducation(): EducationForm {
  return {
    id: makeDraftId('edu'),
    degree: '',
    institution: '',
    fieldOfStudy: '',
    graduationYear: '',
  }
}

function toExperienceForm(items: ResumeSettingsProfile['experience']): ExperienceForm[] {
  return items.map(item => ({
    ...item,
    endDate: item.endDate ?? '',
    description: item.description ?? '',
    bulletsText: item.bullets.join('\n'),
  }))
}

function dedupeLines(items: string[]): string[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

export default function ResumeSettingsScreen() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [masterResumeText, setMasterResumeText] = useState('')
  const [masterResumeSource, setMasterResumeSource] = useState('')
  const [suggestedTargetRoles, setSuggestedTargetRoles] = useState<string[]>([])
  const [strength, setStrength] = useState<ResumeSettingsProfile['strength'] | null>(null)
  const [experience, setExperience] = useState<ExperienceForm[]>([])
  const [education, setEducation] = useState<EducationForm[]>([])
  const [skillsText, setSkillsText] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [assistantPanels, setAssistantPanels] = useState<Record<string, AssistantPanelState>>({})

  useEffect(() => {
    void loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setError(null)
      const token = await getToken()
      const data = await apiRequest<{ profile: ResumeSettingsProfile }>('/api/profile', {}, token)
      hydrate(data.profile)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const hydrate = (profile: ResumeSettingsProfile) => {
    setEmail(profile.email)
    setFirstName(profile.firstName ?? '')
    setLastName(profile.lastName ?? '')
    setPhone(profile.phone ?? '')
    setLocation(profile.location ?? '')
    setLinkedinUrl(profile.linkedinUrl ?? '')
    setPortfolioUrl(profile.portfolioUrl ?? '')
    setMasterResumeText(profile.masterResumeText ?? '')
    setMasterResumeSource(profile.masterResumeSource ?? '')
    setSuggestedTargetRoles(profile.suggestedTargetRoles ?? [])
    setStrength(profile.strength)
    setExperience(toExperienceForm(profile.experience))
    setEducation(profile.education.map(item => ({
      ...item,
      degree: item.degree ?? '',
      fieldOfStudy: item.fieldOfStudy ?? '',
      graduationYear: item.graduationYear ?? '',
    })))
    setSkillsText(profile.skills.join(', '))
    setSavedAt(profile.updatedAt)
    setAssistantPanels({})
  }

  const updateExperience = (id: string, patch: Partial<ExperienceForm>) => {
    setExperience(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const updateEducation = (id: string, patch: Partial<EducationForm>) => {
    setEducation(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const updateAssistantPanel = (roleId: string, patch: Partial<AssistantPanelState>) => {
    const fallback: AssistantPanelState = {
      open: true,
      loading: false,
      error: null,
      notes: '',
      result: null,
    }
    setAssistantPanels(prev => ({
      ...prev,
      [roleId]: {
        ...fallback,
        ...(prev[roleId] ?? {}),
        ...patch,
      },
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSaved(false)
      const token = await getToken()
      const payload = {
        firstName,
        lastName,
        phone,
        location,
        linkedinUrl,
        portfolioUrl,
        masterResumeText,
        masterResumeSource: masterResumeSource || null,
        experience: experience.map(item => ({
          id: item.id.startsWith('exp-') ? null : item.id,
          roleTitle: item.roleTitle,
          company: item.company,
          startDate: item.startDate,
          endDate: item.isCurrent ? '' : item.endDate,
          isCurrent: item.isCurrent,
          description: item.description,
          bullets: splitLines(item.bulletsText),
        })),
        education: education.map(item => ({
          degree: item.degree,
          institution: item.institution,
          fieldOfStudy: item.fieldOfStudy,
          graduationYear: item.graduationYear,
        })),
        skills: skillsText
          .split(/[\n,]+/)
          .map(part => part.trim())
          .filter(Boolean),
      }

      const data = await apiRequest<{ profile: ResumeSettingsProfile }>(
        '/api/profile',
        { method: 'PUT', body: JSON.stringify(payload) },
        token
      )
      hydrate(data.profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaved(false)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const importFromText = async () => {
    if (!importText.trim()) return
    try {
      setImporting(true)
      setError(null)
      const token = await getToken()
      const data = await apiRequest<{ profile: ResumeSettingsProfile }>(
        '/api/profile/import',
        {
          method: 'POST',
          body: JSON.stringify({
            resumeText: importText,
            source: 'text',
            merge: true,
          }),
        },
        token
      )
      hydrate(data.profile)
      setImportText('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const importFromUpload = async () => {
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      })

      if (selection.canceled || selection.assets.length === 0) return

      setImporting(true)
      setError(null)
      const token = await getToken()
      const uploadedText = await uploadFilesForText({
        apiUrl: API_URL,
        token,
        files: selection.assets.map(asset => ({
          name: asset.name,
          uri: asset.uri,
        })),
      })

      const imported = await apiRequest<{ profile: ResumeSettingsProfile }>(
        '/api/profile/import',
        {
          method: 'POST',
          body: JSON.stringify({
            resumeText: uploadedText,
            source: 'upload',
            merge: true,
          }),
        },
        token
      )

      hydrate(imported.profile)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const runAssistant = async (item: ExperienceForm, roleId: string, additionalContext?: string) => {
    try {
      updateAssistantPanel(roleId, { loading: true, error: null, open: true })
      const token = await getToken()
      const data = await apiRequest<{ assistant: AssistantResult }>(
        '/api/profile/assistant',
        {
          method: 'POST',
          body: JSON.stringify({
            roleId: roleId.startsWith('exp-') ? undefined : roleId,
            role: roleId.startsWith('exp-') ? {
              roleTitle: item.roleTitle,
              company: item.company,
              startDate: item.startDate,
              endDate: item.isCurrent ? null : item.endDate,
              description: item.description,
              bullets: splitLines(item.bulletsText),
            } : undefined,
            additionalContext,
          }),
        },
        token
      )
      updateAssistantPanel(roleId, {
        loading: false,
        result: data.assistant,
      })
    } catch (err) {
      updateAssistantPanel(roleId, {
        loading: false,
        error: (err as Error).message,
      })
    }
  }

  const applyAssistantSuggestions = (roleId: string) => {
    const panel = assistantPanels[roleId]
    if (!panel?.result) return

    const item = experience.find(entry => entry.id === roleId)
    if (!item) return

    const mergedBullets = dedupeLines([
      ...splitLines(item.bulletsText),
      ...panel.result.suggestedBullets,
    ])

    updateExperience(roleId, {
      description: panel.result.improvedDescription || item.description,
      bulletsText: mergedBullets.join('\n'),
    })
  }

  const completedRoles = experience.filter(item => item.roleTitle && item.company).length
  const updatedLabel = formatUpdatedAt(savedAt)
  const strengthBars = useMemo(() => strength ? [
    { label: 'Experience', value: strength.experience },
    { label: 'Skills', value: strength.skills },
    { label: 'Achievements', value: strength.achievements },
    { label: 'Education', value: strength.education },
  ] : [], [strength])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Loading resume settings...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>MASTER RESUME</Text>
        <Text style={styles.title}>Resume & profile</Text>
        <Text style={styles.subtitle}>
          Import, strengthen, and maintain the source data used for matching, tailored resumes, interview prep, and job search defaults.
        </Text>
        <View style={styles.headerMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{completedRoles} roles saved</Text>
          </View>
          {strength ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{strength.overall}% overall strength</Text>
            </View>
          ) : null}
          {masterResumeSource ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Source: {masterResumeSource}</Text>
            </View>
          ) : null}
          {updatedLabel ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Updated {updatedLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <SectionCard title="Import & intake" subtitle="Add one or more resumes, paste raw text, or keep source text around for future re-parsing. New imports merge into your existing master resume.">
        <View style={styles.intakeActions}>
          <Pressable style={[styles.secondaryButton, importing && styles.disabledButton]} onPress={importFromUpload} disabled={importing}>
            <Text style={styles.secondaryButtonText}>Upload resumes</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, importing && styles.disabledButton]} onPress={importFromText} disabled={importing || !importText.trim()}>
            {importing ? <ActivityIndicator color={Colors.orange} /> : <Text style={styles.secondaryButtonText}>Merge pasted text</Text>}
          </Pressable>
        </View>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste your resume text, LinkedIn export, or detailed work history here..."
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textAreaLg]}
          multiline
          textAlignVertical="top"
        />
        <FieldLabel label="Stored source text" />
        <TextInput
          value={masterResumeText}
          onChangeText={setMasterResumeText}
          placeholder="Imported source text will appear here"
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textAreaLg]}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.helperText}>
          Upload multiple resumes if older versions have stronger detail on past roles. Imports merge into the current master resume and append to the stored source text.
        </Text>
      </SectionCard>

      {strength ? (
        <SectionCard title="Strength" subtitle="A quick read on how usable your current master resume is for matching and tailored generation.">
          <View style={styles.strengthHero}>
            <Text style={styles.strengthScore}>{strength.overall}%</Text>
            <Text style={styles.strengthCopy}>
              {strength.weakRoleIds.length
                ? 'Your weakest roles are limiting how precisely Arro can tailor your resume.'
                : 'Your master resume is already in strong shape for downstream tailoring.'}
            </Text>
          </View>
          {strengthBars.map(bar => (
            <View key={bar.label} style={styles.strengthRow}>
              <Text style={styles.strengthLabel}>{bar.label}</Text>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: `${bar.value}%` }]} />
              </View>
              <Text style={styles.strengthValue}>{bar.value}%</Text>
            </View>
          ))}
          {suggestedTargetRoles.length > 0 ? (
            <View style={styles.signalWrap}>
              {suggestedTargetRoles.map(role => (
                <View key={role} style={styles.signalPill}>
                  <Text style={styles.signalText}>{role}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Identity" subtitle="Contact details and profile links used across generated resumes.">
        <FieldLabel label="Email" />
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{email || 'No email available'}</Text>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.flexField}>
            <FieldLabel label="First name" />
            <TextInput value={firstName} onChangeText={setFirstName} placeholder="Josh" placeholderTextColor={wm(0.2)} style={styles.input} />
          </View>
          <View style={styles.flexField}>
            <FieldLabel label="Last name" />
            <TextInput value={lastName} onChangeText={setLastName} placeholder="Yezek" placeholderTextColor={wm(0.2)} style={styles.input} />
          </View>
        </View>

        <FieldLabel label="Phone" />
        <TextInput value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" placeholderTextColor={wm(0.2)} style={styles.input} />

        <FieldLabel label="Location" />
        <TextInput value={location} onChangeText={setLocation} placeholder="Phoenix, AZ" placeholderTextColor={wm(0.2)} style={styles.input} />

        <FieldLabel label="LinkedIn URL" />
        <TextInput value={linkedinUrl} onChangeText={setLinkedinUrl} placeholder="https://linkedin.com/in/..." placeholderTextColor={wm(0.2)} style={styles.input} autoCapitalize="none" />

        <FieldLabel label="Portfolio URL" />
        <TextInput value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="https://your-site.com" placeholderTextColor={wm(0.2)} style={styles.input} autoCapitalize="none" />
      </SectionCard>

      <SectionCard title="Experience" subtitle="This is the highest leverage area. Strong bullets here improve matching, tailored resumes, and company prep.">
        {experience.length === 0 ? (
          <EmptyState text="No roles yet. Import a resume or add your current role first." />
        ) : null}

        {experience.map((item, index) => {
          const panel = assistantPanels[item.id]
          const canStrengthen = Boolean(item.roleTitle && item.company && item.startDate)

          return (
            <View key={item.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View>
                  <Text style={styles.entryTitle}>Role {index + 1}</Text>
                  <Text style={styles.entryMeta}>{item.detailScore}/100 detail score</Text>
                </View>
                <View style={styles.entryActions}>
                  <Pressable
                    onPress={() => canStrengthen && runAssistant(item, item.id)}
                    disabled={!canStrengthen}
                    style={[styles.tinyPill, !canStrengthen && styles.disabledButton]}
                  >
                    <Text style={styles.tinyPillText}>Strengthen</Text>
                  </Pressable>
                  <Pressable onPress={() => setExperience(prev => prev.filter(exp => exp.id !== item.id))}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>

              <FieldLabel label="Role title" />
              <TextInput value={item.roleTitle} onChangeText={value => updateExperience(item.id, { roleTitle: value })} placeholder="Senior Product Manager" placeholderTextColor={wm(0.2)} style={styles.input} />

              <FieldLabel label="Company" />
              <TextInput value={item.company} onChangeText={value => updateExperience(item.id, { company: value })} placeholder="Acme" placeholderTextColor={wm(0.2)} style={styles.input} />

              <View style={styles.twoCol}>
                <View style={styles.flexField}>
                  <FieldLabel label="Start date" />
                  <TextInput value={item.startDate} onChangeText={value => updateExperience(item.id, { startDate: value })} placeholder="Jan 2022" placeholderTextColor={wm(0.2)} style={styles.input} />
                </View>
                <View style={styles.flexField}>
                  <FieldLabel label={item.isCurrent ? 'Current role' : 'End date'} />
                  <TextInput
                    value={item.isCurrent ? 'Present' : (item.endDate ?? '')}
                    onChangeText={value => updateExperience(item.id, { endDate: value })}
                    placeholder="Present"
                    placeholderTextColor={wm(0.2)}
                    style={[styles.input, item.isCurrent && styles.inputDisabled]}
                    editable={!item.isCurrent}
                  />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Current role</Text>
                <Pressable
                  style={[styles.togglePill, item.isCurrent && styles.togglePillActive]}
                  onPress={() => updateExperience(item.id, { isCurrent: !item.isCurrent, endDate: !item.isCurrent ? '' : item.endDate })}
                >
                  <Text style={[styles.togglePillText, item.isCurrent && styles.togglePillTextActive]}>
                    {item.isCurrent ? 'Yes' : 'No'}
                  </Text>
                </Pressable>
              </View>

              <FieldLabel label="Scope / context" />
              <TextInput
                value={item.description ?? ''}
                onChangeText={value => updateExperience(item.id, { description: value })}
                placeholder="What team, product, or scope did you own?"
                placeholderTextColor={wm(0.2)}
                style={[styles.input, styles.textArea]}
                multiline
              />

              <FieldLabel label="Achievement bullets" />
              <TextInput
                value={item.bulletsText}
                onChangeText={value => updateExperience(item.id, { bulletsText: value })}
                placeholder={'Led...\nLaunched...\nReduced...'}
                placeholderTextColor={wm(0.2)}
                style={[styles.input, styles.textAreaLg]}
                multiline
              />

              {panel?.open ? (
                <View style={styles.assistantCard}>
                  <Text style={styles.assistantTitle}>AI resume coach</Text>
                  {panel.loading ? <ActivityIndicator color={Colors.orange} /> : null}
                  {panel.error ? <Text style={styles.errorText}>{panel.error}</Text> : null}
                  {panel.result?.roleSummary ? <Text style={styles.assistantSummary}>{panel.result.roleSummary}</Text> : null}

                  {panel.result?.missingDetails.length ? (
                    <>
                      <Text style={styles.assistantLabel}>Missing details</Text>
                      {panel.result.missingDetails.map((detail, detailIndex) => (
                        <Text key={`${item.id}-gap-${detailIndex}`} style={styles.assistantBullet}>• {detail}</Text>
                      ))}
                    </>
                  ) : null}

                  {panel.result?.followUpQuestions.length ? (
                    <>
                      <Text style={styles.assistantLabel}>Follow-up questions</Text>
                      {panel.result.followUpQuestions.map((question, questionIndex) => (
                        <Text key={`${item.id}-question-${questionIndex}`} style={styles.assistantBullet}>{questionIndex + 1}. {question}</Text>
                      ))}
                    </>
                  ) : null}

                  <TextInput
                    value={panel.notes}
                    onChangeText={value => updateAssistantPanel(item.id, { notes: value })}
                    placeholder="Add answers, numbers, ownership details, collaborators, scale, or outcomes here..."
                    placeholderTextColor={wm(0.2)}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={styles.assistantActions}>
                    <Pressable
                      style={[styles.secondaryButton, panel.loading && styles.disabledButton]}
                      disabled={panel.loading}
                      onPress={() => runAssistant(item, item.id, panel.notes)}
                    >
                      <Text style={styles.secondaryButtonText}>Generate stronger bullets</Text>
                    </Pressable>
                    {panel.result?.suggestedBullets.length ? (
                      <Pressable style={styles.secondaryButton} onPress={() => applyAssistantSuggestions(item.id)}>
                        <Text style={styles.secondaryButtonText}>Apply suggestions</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {panel.result?.suggestedBullets.length ? (
                    <View style={styles.suggestionList}>
                      <Text style={styles.assistantLabel}>Suggested bullets</Text>
                      {panel.result.suggestedBullets.map((bullet, bulletIndex) => (
                        <Text key={`${item.id}-bullet-${bulletIndex}`} style={styles.assistantBullet}>• {bullet}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}

        <Pressable style={styles.secondaryButton} onPress={() => setExperience(prev => [...prev, blankExperience()])}>
          <Text style={styles.secondaryButtonText}>Add role</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Education" subtitle="Degrees, schools, and graduation years used in tailored resume generation.">
        {education.length === 0 ? (
          <EmptyState text="No education entries yet." />
        ) : null}

        {education.map((item, index) => (
          <View key={item.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTitle}>Education {index + 1}</Text>
              <Pressable onPress={() => setEducation(prev => prev.filter(edu => edu.id !== item.id))}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>

            <FieldLabel label="Institution" />
            <TextInput value={item.institution} onChangeText={value => updateEducation(item.id, { institution: value })} placeholder="University of Iowa" placeholderTextColor={wm(0.2)} style={styles.input} />

            <FieldLabel label="Degree" />
            <TextInput value={item.degree ?? ''} onChangeText={value => updateEducation(item.id, { degree: value })} placeholder="BBA" placeholderTextColor={wm(0.2)} style={styles.input} />

            <View style={styles.twoCol}>
              <View style={styles.flexField}>
                <FieldLabel label="Field of study" />
                <TextInput value={item.fieldOfStudy ?? ''} onChangeText={value => updateEducation(item.id, { fieldOfStudy: value })} placeholder="Marketing" placeholderTextColor={wm(0.2)} style={styles.input} />
              </View>
              <View style={styles.flexField}>
                <FieldLabel label="Graduation year" />
                <TextInput value={item.graduationYear ?? ''} onChangeText={value => updateEducation(item.id, { graduationYear: value })} placeholder="2015" placeholderTextColor={wm(0.2)} style={styles.input} keyboardType="number-pad" />
              </View>
            </View>
          </View>
        ))}

        <Pressable style={styles.secondaryButton} onPress={() => setEducation(prev => [...prev, blankEducation()])}>
          <Text style={styles.secondaryButtonText}>Add education</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Skills" subtitle="Comma-separated skills become match keywords, role signals, and interview context.">
        <FieldLabel label="Skills" />
        <TextInput
          value={skillsText}
          onChangeText={setSkillsText}
          placeholder="Product strategy, React Native, SQL, Design systems"
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textArea]}
          multiline
        />
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saved ? <Text style={styles.successText}>Resume settings saved.</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Save resume settings</Text>}
      </Pressable>
    </ScrollView>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: Colors.dark, justifyContent: 'center', alignItems: 'center', gap: 10 },
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
  headerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: orangeAlpha(0.08),
    borderWidth: 1,
    borderColor: orangeAlpha(0.16),
  },
  metaPillText: { fontSize: FontSize.base, color: Colors.orange, fontWeight: '500' },

  sectionCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: wm(0.07),
  },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '600', color: wm(0.88) },
  sectionSubtitle: { fontSize: FontSize.base, color: wm(0.4), marginTop: 4, lineHeight: 18 },
  sectionBody: { gap: 10, marginTop: 14 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.32), letterSpacing: 0.4, marginTop: 2 },
  helperText: { fontSize: FontSize.sm, color: wm(0.32), lineHeight: 16 },
  input: {
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.09),
    backgroundColor: wm(0.03),
    color: wm(0.9),
    fontSize: FontSize.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDisabled: { opacity: 0.5 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  textAreaLg: { minHeight: 148, textAlignVertical: 'top' },
  readOnlyField: {
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.07),
    backgroundColor: wm(0.02),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyText: { fontSize: FontSize.md, color: wm(0.72) },
  twoCol: { flexDirection: 'row', gap: 10 },
  flexField: { flex: 1, gap: 0 },

  intakeActions: { flexDirection: 'row', gap: 10 },
  disabledButton: { opacity: 0.55 },

  strengthHero: {
    backgroundColor: orangeAlpha(0.07),
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: orangeAlpha(0.14),
    padding: 14,
    gap: 6,
  },
  strengthScore: { fontSize: 30, fontWeight: '700', color: Colors.orange },
  strengthCopy: { fontSize: FontSize.base, color: wm(0.65), lineHeight: 18 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthLabel: { width: 86, fontSize: FontSize.base, color: wm(0.55) },
  strengthTrack: {
    flex: 1,
    height: 6,
    backgroundColor: wm(0.08),
    borderRadius: 999,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.orange },
  strengthValue: { width: 40, textAlign: 'right', fontSize: FontSize.sm, color: wm(0.4) },
  signalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: orangeAlpha(0.08),
    borderWidth: 1,
    borderColor: orangeAlpha(0.18),
  },
  signalText: { fontSize: FontSize.sm, color: Colors.orange, fontWeight: '500' },

  entryCard: {
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.07),
    backgroundColor: wm(0.03),
    padding: 14,
    gap: 8,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryTitle: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.86) },
  entryMeta: { fontSize: FontSize.base, color: wm(0.32) },
  entryActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeText: { fontSize: FontSize.base, color: Colors.red, fontWeight: '600' },
  tinyPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: orangeAlpha(0.1),
    borderWidth: 1,
    borderColor: orangeAlpha(0.18),
  },
  tinyPillText: { fontSize: FontSize.sm, color: Colors.orange, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  toggleLabel: { fontSize: FontSize.base, color: wm(0.55) },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: wm(0.05),
    borderWidth: 1,
    borderColor: wm(0.1),
  },
  togglePillActive: {
    backgroundColor: orangeAlpha(0.12),
    borderColor: orangeAlpha(0.24),
  },
  togglePillText: { fontSize: FontSize.base, color: wm(0.5), fontWeight: '600' },
  togglePillTextActive: { color: Colors.orange },

  assistantCard: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: orangeAlpha(0.14),
    padding: 12,
    gap: 8,
  },
  assistantTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.orange },
  assistantSummary: { fontSize: FontSize.base, color: wm(0.76), lineHeight: 18 },
  assistantLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.45), marginTop: 4 },
  assistantBullet: { fontSize: FontSize.base, color: wm(0.68), lineHeight: 18 },
  assistantActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  suggestionList: { gap: 4 },

  emptyState: {
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: wm(0.07),
    borderStyle: 'dashed',
    padding: 16,
    backgroundColor: wm(0.02),
  },
  emptyStateText: { fontSize: FontSize.md, color: wm(0.35), lineHeight: 18 },

  secondaryButton: {
    borderRadius: Radius.inputLg,
    borderWidth: 1,
    borderColor: orangeAlpha(0.2),
    backgroundColor: orangeAlpha(0.06),
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '600' },

  errorText: { fontSize: FontSize.base, color: Colors.red, textAlign: 'center' },
  successText: { fontSize: FontSize.base, color: Colors.green, textAlign: 'center' },
  saveButton: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
})
