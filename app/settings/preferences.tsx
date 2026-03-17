import { useEffect, useState } from 'react'
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
import {
  EMPLOYMENT_TYPE_OPTIONS,
  EQUITY_IMPORTANCE_OPTIONS,
  INDUSTRY_SUGGESTIONS,
  joinTags,
  RELOCATION_OPTIONS,
  ROLE_TYPE_SUGGESTIONS,
  SALARY_FLEXIBILITY_OPTIONS,
  SENIORITY_SUGGESTIONS,
  splitTags,
  type UserSettings,
  WORK_PREFERENCE_OPTIONS,
} from '@/lib/settings'
import { Colors, FontSize, Radius, orangeAlpha, wm } from '@/constants/Colors'

function appendTag(text: string, value: string) {
  const tags = splitTags(text)
  if (tags.includes(value)) return text
  return joinTags([...tags, value])
}

export default function PreferencesSettingsScreen() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [targetSalary, setTargetSalary] = useState('')
  const [salaryFlexibility, setSalaryFlexibility] = useState<string | null>(null)
  const [workPreference, setWorkPreference] = useState<string | null>(null)
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([])
  const [targetRoleText, setTargetRoleText] = useState('')
  const [seniorityText, setSeniorityText] = useState('')
  const [industryText, setIndustryText] = useState('')
  const [willingToRelocate, setWillingToRelocate] = useState<boolean | null>(null)
  const [equityImportance, setEquityImportance] = useState<string | null>(null)

  useEffect(() => {
    void loadUser()
  }, [])

  const loadUser = async () => {
    try {
      setError(null)
      const token = await getToken()
      const data = await apiRequest<{ user: UserSettings }>('/api/user', {}, token)
      hydrate(data.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const hydrate = (user: UserSettings) => {
    setLocation(user.location ?? '')
    setTargetSalary(user.targetSalary ? String(user.targetSalary) : '')
    setSalaryFlexibility(user.salaryFlexibility)
    setWorkPreference(user.workPreference)
    setEmploymentTypes(user.employmentTypes ?? [])
    setTargetRoleText(joinTags(user.targetRoleTypes ?? []))
    setSeniorityText(joinTags(user.targetSeniority ?? []))
    setIndustryText(joinTags(user.targetIndustries ?? []))
    setWillingToRelocate(user.willingToRelocate ?? null)
    setEquityImportance(user.equityImportance)
  }

  const toggleEmploymentType = (value: string) => {
    setEmploymentTypes(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value])
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSaved(false)
      const token = await getToken()
      await apiRequest<{ user: UserSettings }>(
        '/api/user',
        {
          method: 'PATCH',
          body: JSON.stringify({
            location,
            targetSalary: targetSalary ? parseInt(targetSalary, 10) : null,
            salaryFlexibility,
            workPreference,
            employmentTypes,
            targetRoleTypes: splitTags(targetRoleText),
            targetSeniority: splitTags(seniorityText),
            targetIndustries: splitTags(industryText),
            willingToRelocate,
            equityImportance,
          }),
        },
        token
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaved(false)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Loading preference settings...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>MATCHING</Text>
        <Text style={styles.title}>Job preferences</Text>
        <Text style={styles.subtitle}>
          These fields tune what Arro scrapes, scores, and prioritizes in your feed.
        </Text>
      </View>

      <SectionCard title="Search baseline" subtitle="Used as the default location and compensation context.">
        <FieldLabel label="Search location" />
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Phoenix, AZ"
          placeholderTextColor={wm(0.2)}
          style={styles.input}
        />

        <View style={styles.twoCol}>
          <View style={styles.flexField}>
            <FieldLabel label="Target salary (in thousands)" />
            <TextInput
              value={targetSalary}
              onChangeText={setTargetSalary}
              placeholder="160"
              placeholderTextColor={wm(0.2)}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flexField}>
            <FieldLabel label="Salary flexibility" />
            <OptionRow
              options={SALARY_FLEXIBILITY_OPTIONS}
              selected={salaryFlexibility}
              onSelect={setSalaryFlexibility}
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Work setup" subtitle="Remote/hybrid and contract filters feed directly into search config.">
        <FieldLabel label="Work preference" />
        <OptionRow
          options={WORK_PREFERENCE_OPTIONS}
          selected={workPreference}
          onSelect={setWorkPreference}
        />

        <FieldLabel label="Employment types" />
        <MultiOptionRow
          options={EMPLOYMENT_TYPE_OPTIONS}
          selected={employmentTypes}
          onToggle={toggleEmploymentType}
        />

        <FieldLabel label="Open to relocation" />
        <BooleanOptionRow
          selected={willingToRelocate}
          onSelect={setWillingToRelocate}
        />
      </SectionCard>

      <SectionCard title="Targeting" subtitle="Use commas for custom entries, or tap a suggestion to add it.">
        <FieldLabel label="Target role types" />
        <TextInput
          value={targetRoleText}
          onChangeText={setTargetRoleText}
          placeholder="Product Management, Design Systems"
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textArea]}
          multiline
        />
        <SuggestionRow values={ROLE_TYPE_SUGGESTIONS} onAdd={value => setTargetRoleText(prev => appendTag(prev, value))} />

        <FieldLabel label="Seniority" />
        <TextInput
          value={seniorityText}
          onChangeText={setSeniorityText}
          placeholder="Senior, Staff / Principal"
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textAreaSm]}
          multiline
        />
        <SuggestionRow values={SENIORITY_SUGGESTIONS} onAdd={value => setSeniorityText(prev => appendTag(prev, value))} />

        <FieldLabel label="Industries" />
        <TextInput
          value={industryText}
          onChangeText={setIndustryText}
          placeholder="Tech / SaaS, Healthcare"
          placeholderTextColor={wm(0.2)}
          style={[styles.input, styles.textAreaSm]}
          multiline
        />
        <SuggestionRow values={INDUSTRY_SUGGESTIONS} onAdd={value => setIndustryText(prev => appendTag(prev, value))} />
      </SectionCard>

      <SectionCard title="Offer tradeoffs" subtitle="Used for fit explanations and offer framing.">
        <FieldLabel label="Equity importance" />
        <OptionRow
          options={EQUITY_IMPORTANCE_OPTIONS}
          selected={equityImportance}
          onSelect={setEquityImportance}
        />
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saved ? <Text style={styles.successText}>Job preferences saved.</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Save job preferences</Text>}
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

function OptionRow({
  options,
  selected,
  onSelect,
}: {
  options: ReadonlyArray<{ label: string; value: string }>
  selected: string | null
  onSelect: (value: string | null) => void
}) {
  return (
    <View style={styles.optionRow}>
      {options.map(option => {
        const active = selected === option.value
        return (
          <Pressable
            key={option.value}
            style={[styles.optionChip, active && styles.optionChipActive]}
            onPress={() => onSelect(active ? null : option.value)}
          >
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function MultiOptionRow({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<{ label: string; value: string }>
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <View style={styles.optionRow}>
      {options.map(option => {
        const active = selected.includes(option.value)
        return (
          <Pressable
            key={option.value}
            style={[styles.optionChip, active && styles.optionChipActive]}
            onPress={() => onToggle(option.value)}
          >
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function BooleanOptionRow({
  selected,
  onSelect,
}: {
  selected: boolean | null
  onSelect: (value: boolean | null) => void
}) {
  return (
    <View style={styles.optionRow}>
      {RELOCATION_OPTIONS.map(option => {
        const active = selected === option.value
        return (
          <Pressable
            key={option.label}
            style={[styles.optionChip, active && styles.optionChipActive]}
            onPress={() => onSelect(active ? null : option.value)}
          >
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SuggestionRow({
  values,
  onAdd,
}: {
  values: string[]
  onAdd: (value: string) => void
}) {
  return (
    <View style={styles.optionRow}>
      {values.map(value => (
        <Pressable key={value} style={styles.suggestionChip} onPress={() => onAdd(value)}>
          <Text style={styles.suggestionChipText}>{value}</Text>
        </Pressable>
      ))}
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
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.32), letterSpacing: 0.4 },
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
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  textAreaSm: { minHeight: 68, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: wm(0.1),
    backgroundColor: wm(0.04),
  },
  optionChipActive: {
    backgroundColor: orangeAlpha(0.12),
    borderColor: orangeAlpha(0.24),
  },
  optionChipText: { fontSize: FontSize.base, color: wm(0.52), fontWeight: '600' },
  optionChipTextActive: { color: Colors.orange },
  suggestionChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: wm(0.03),
    borderWidth: 1,
    borderColor: wm(0.07),
  },
  suggestionChipText: { fontSize: FontSize.base, color: wm(0.42) },
  twoCol: { flexDirection: 'row', gap: 10 },
  flexField: { flex: 1, gap: 8 },

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
