import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
import { getOnboardingSession } from '@/lib/onboarding-session'

// ─── Option sets ──────────────────────────────────────────────────────────────

const SALARY_OPTIONS = [
  '$60k', '$80k', '$100k', '$120k', '$150k', '$175k', '$200k', '$250k', '$300k+',
]

const SALARY_FLEX = ['Firm', 'Flexible', 'Negotiable']
const WORK_PREFS = ['Remote', 'Hybrid', 'On-site']
const EMP_TYPES = ['Full-time', 'Contract', 'Part-time', 'Freelance']
const TARGET_ROLES = [
  'Product Design', 'Product Management', 'UX Research', 'Engineering',
  'Design Systems', 'Marketing Tech', 'Operations', 'Consulting',
]
const SENIORITY = ['Mid-level', 'Senior', 'Staff / Principal', 'Director+']
const INDUSTRIES = ['Tech / SaaS', 'Automotive', 'Healthcare', 'Fintech', 'Agency', 'Enterprise']
const RELOCATION = ['Yes', 'No', 'Maybe']
const EQUITY = ['Important', 'Nice to have', 'Not a factor']

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

function ChipGroup({
  options,
  selected,
  multi = false,
  onToggle,
}: {
  options: string[]
  selected: string[]
  multi?: boolean
  onToggle: (val: string) => void
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <Pressable
            key={opt}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onToggle(opt)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingGapFill() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [saving, setSaving] = useState(false)

  const [salary, setSalary] = useState<string[]>([])
  const [salaryFlex, setSalaryFlex] = useState<string[]>([])
  const [workPref, setWorkPref] = useState<string[]>([])
  const [empTypes, setEmpTypes] = useState<string[]>([])
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [seniority, setSeniority] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [relocation, setRelocation] = useState<string[]>([])
  const [equity, setEquity] = useState<string[]>([])

  useEffect(() => {
    const extractedRoles = getOnboardingSession().extracted?.inferredTargetRoles ?? []
    if (extractedRoles.length > 0) {
      setTargetRoles(prev => prev.length > 0 ? prev : extractedRoles.slice(0, 4))
    }
  }, [])

  function toggleSingle(val: string, set: React.Dispatch<React.SetStateAction<string[]>>) {
    set(prev => prev.includes(val) ? [] : [val])
  }

  function toggleMulti(val: string, set: React.Dispatch<React.SetStateAction<string[]>>) {
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const onFinish = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      await apiRequest(
        '/api/onboarding',
        {
          method: 'POST',
          body: JSON.stringify({
            salary: salary[0],
            salaryFlexibility: salaryFlex[0],
            workPreference: workPref[0],
            employmentTypes: empTypes,
            targetRoles,
            seniority: seniority[0],
            industries,
            relocation: relocation[0],
            equity: equity[0],
          }),
        },
        token
      )
    } catch (err) {
      console.warn('[onboarding] failed to save preferences:', err)
      // Non-blocking — still proceed to done screen
    } finally {
      setSaving(false)
    }
    router.replace('/onboarding/done')
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '82%' }]} />
      </View>
      <Text style={styles.stepLabel}>ALMOST DONE — A FEW QUICK QUESTIONS</Text>
      <Text style={styles.title}>Just a few things we need.</Text>
      <Text style={styles.subtitle}>
        Couldn't pull these from your resume — takes 60 seconds.
      </Text>

      {/* Context panel */}
      <View style={styles.contextPanel}>
        <Text style={styles.contextText}>
          These preferences power your job feed match scores and filter defaults. The more you fill in, the better your matches.
        </Text>
        {targetRoles.length > 0 ? (
          <Text style={styles.contextHint}>
            We inferred these likely role targets from your master resume. Adjust them below before we start searching.
          </Text>
        ) : null}
      </View>

      {/* Salary */}
      <SectionLabel>Target salary</SectionLabel>
      <ChipGroup
        options={SALARY_OPTIONS}
        selected={salary}
        onToggle={v => toggleSingle(v, setSalary)}
      />

      <SectionLabel>Salary flexibility</SectionLabel>
      <ChipGroup
        options={SALARY_FLEX}
        selected={salaryFlex}
        onToggle={v => toggleSingle(v, setSalaryFlex)}
      />

      {/* Work preference */}
      <SectionLabel>Work preference</SectionLabel>
      <ChipGroup
        options={WORK_PREFS}
        selected={workPref}
        onToggle={v => toggleSingle(v, setWorkPref)}
      />

      {/* Employment type */}
      <SectionLabel>Employment type</SectionLabel>
      <ChipGroup
        options={EMP_TYPES}
        selected={empTypes}
        multi
        onToggle={v => toggleMulti(v, setEmpTypes)}
      />

      {/* Target roles */}
      <SectionLabel>Target roles</SectionLabel>
      <ChipGroup
        options={TARGET_ROLES}
        selected={targetRoles}
        multi
        onToggle={v => toggleMulti(v, setTargetRoles)}
      />

      {/* Seniority */}
      <SectionLabel>Seniority level</SectionLabel>
      <ChipGroup
        options={SENIORITY}
        selected={seniority}
        onToggle={v => toggleSingle(v, setSeniority)}
      />

      {/* Industries */}
      <SectionLabel>Industries</SectionLabel>
      <ChipGroup
        options={INDUSTRIES}
        selected={industries}
        multi
        onToggle={v => toggleMulti(v, setIndustries)}
      />

      {/* Relocation */}
      <SectionLabel>Open to relocation?</SectionLabel>
      <ChipGroup
        options={RELOCATION}
        selected={relocation}
        onToggle={v => toggleSingle(v, setRelocation)}
      />

      {/* Equity */}
      <SectionLabel>Equity importance</SectionLabel>
      <ChipGroup
        options={EQUITY}
        selected={equity}
        onToggle={v => toggleSingle(v, setEquity)}
      />

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, saving && styles.ctaDisabled]}
        onPress={onFinish}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.ctaText}>Finish setup</Text>
        }
      </Pressable>

      <Pressable onPress={() => router.replace('/onboarding/done')} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip for now →</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.dark },
  container: {
    paddingHorizontal: Spacing[7],
    paddingTop: 56,
    paddingBottom: 48,
    gap: Spacing[4],
  },
  progressBar: {
    height: 3,
    backgroundColor: wm(0.08),
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.orange,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.orange,
    letterSpacing: 0.8,
    marginBottom: -Spacing[2],
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: '600',
    color: wm(0.9),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: wm(0.4),
    marginTop: -Spacing[2],
  },
  contextPanel: {
    backgroundColor: orangeAlpha(0.07),
    borderRadius: Radius.input,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: orangeAlpha(0.15),
  },
  contextText: {
    fontSize: FontSize.base,
    color: Colors.orangeDim,
    lineHeight: 18,
  },
  contextHint: {
    marginTop: Spacing[2],
    fontSize: FontSize.sm,
    color: wm(0.55),
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: wm(0.35),
    letterSpacing: 0.5,
    marginBottom: -Spacing[2],
    marginTop: Spacing[1],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wm(0.1),
    backgroundColor: wm(0.05),
  },
  chipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  chipPressed: { transform: [{ scale: 0.94 }] },
  chipText: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: wm(0.45),
  },
  chipTextActive: { color: Colors.white },
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing[4],
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing[2] },
  skipText: { fontSize: FontSize.base, color: Colors.orange, fontWeight: '500' },
})
