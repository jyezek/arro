import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Colors, FontSize, Radius, Spacing, wm, orangeAlpha } from '@/constants/Colors'
import { apiRequest } from '@/lib/api'

type CompanyBrief = {
  overview: string
  culture: string
  recentNews: string
  whyThisCompany: string
}

type ScreeningAnswer = { question: string; answer: string }
type FollowUpEmail = { stage: string; sendAfter: string; subject: string; body: string }

type PrepFieldKey =
  | 'coverLetter'
  | 'whyInterested'
  | 'biggestStrength'
  | 'elevatorPitch'
  | 'preparationNotes'
  | 'companyBrief'
  | 'screeningAnswers'
  | 'followUpEmails'
  | 'salaryApproach'

type PrepKit = {
  id: string
  status: string
  coverLetter: string | null
  whyInterested: string | null
  biggestStrength: string | null
  elevatorPitch: string | null
  preparationNotes: string | null
  companyResearch: string | null
  screeningAnswers: string | null
  followUpEmails: string | null
  negotiationNotes: string | null
  job: { title: string; company: string } | null
}

type Tab = 'cover' | 'hook' | 'pitch' | 'company' | 'screening' | 'followup' | 'salary'

const FIELD_LABELS: Record<PrepFieldKey, string> = {
  coverLetter: 'Cover Letter',
  whyInterested: 'Why This Role',
  biggestStrength: 'Biggest Strength',
  elevatorPitch: 'Elevator Pitch',
  preparationNotes: 'Preparation Notes',
  companyBrief: 'Company Brief',
  screeningAnswers: 'Screening Answers',
  followUpEmails: 'Follow-Up Emails',
  salaryApproach: 'Salary Approach',
}

const FIELD_HELP: Record<PrepFieldKey, string> = {
  coverLetter: 'Polish the final draft directly or regenerate only the letter.',
  whyInterested: 'Tighten the role-specific hook.',
  biggestStrength: 'Reframe the strongest positioning point for this job.',
  elevatorPitch: 'Keep this crisp and interview-ready.',
  preparationNotes: 'One note per line.',
  companyBrief: 'Edit the research summary blocks directly.',
  screeningAnswers: 'Use Question / Answer blocks, separated by ---',
  followUpEmails: 'Use Stage / Send after / Subject / Body blocks, separated by ---',
  salaryApproach: 'Keep this practical and specific to the role.',
}

export default function PrepKitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [kit, setKit] = useState<PrepKit | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('cover')
  const [editingField, setEditingField] = useState<PrepFieldKey | null>(null)
  const [editorText, setEditorText] = useState('')
  const [savingField, setSavingField] = useState<PrepFieldKey | null>(null)
  const [regeneratingField, setRegeneratingField] = useState<PrepFieldKey | 'all' | null>(null)

  useEffect(() => {
    void fetchKit()
  }, [id])

  const companyBrief = useMemo(
    () =>
      parseJson<CompanyBrief>(kit?.companyResearch, {
        overview: '',
        culture: '',
        recentNews: '',
        whyThisCompany: '',
      }),
    [kit?.companyResearch],
  )
  const screeningAnswers = useMemo(
    () => parseJson<ScreeningAnswer[]>(kit?.screeningAnswers, []),
    [kit?.screeningAnswers],
  )
  const followUpEmails = useMemo(
    () => parseJson<FollowUpEmail[]>(kit?.followUpEmails, []),
    [kit?.followUpEmails],
  )
  const prepNotes = useMemo(() => parseJson<string[]>(kit?.preparationNotes, []), [kit?.preparationNotes])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cover', label: 'Cover' },
    { key: 'hook', label: 'Why you' },
    { key: 'pitch', label: 'Pitch' },
    { key: 'company', label: 'Company' },
    { key: 'screening', label: 'Q&A' },
    { key: 'followup', label: 'Follow-ups' },
    { key: 'salary', label: 'Salary' },
  ]

  const fetchKit = async () => {
    try {
      const token = await getToken()
      const data = await apiRequest<{ kit: PrepKit }>(`/api/prep-kit/${id}`, {}, token)
      setKit(data.kit)
    } catch (err) {
      console.error('Failed to fetch prep kit:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!kit) return

    const payload =
      activeTab === 'cover'
        ? kit.coverLetter ?? ''
        : activeTab === 'hook'
          ? `${kit.whyInterested ?? ''}\n\n${kit.biggestStrength ?? ''}`.trim()
          : activeTab === 'pitch'
            ? `${kit.elevatorPitch ?? ''}\n\n${prepNotes.join('\n')}`.trim()
            : activeTab === 'company'
              ? serializeCompanyBrief(companyBrief)
              : activeTab === 'screening'
                ? serializeScreeningAnswers(screeningAnswers)
                : activeTab === 'followup'
                  ? serializeFollowUpEmails(followUpEmails)
                  : kit.negotiationNotes ?? ''

    if (!payload) return
    await Share.share({ message: payload, title: 'Prep kit' })
  }

  const startEditing = (field: PrepFieldKey) => {
    setEditingField(field)
    setEditorText(serializeField(field, {
      kit,
      companyBrief,
      screeningAnswers,
      followUpEmails,
      prepNotes,
    }))
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditorText('')
  }

  const saveField = async (field: PrepFieldKey) => {
    if (!kit) return

    try {
      const payload = parseFieldPayload(field, editorText)
      setSavingField(field)
      const token = await getToken()
      const data = await apiRequest<{ kit: PrepKit }>(
        `/api/prep-kit/${kit.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        token,
      )
      setKit(data.kit)
      cancelEditing()
    } catch (err) {
      console.error('Failed to save field:', err)
      Alert.alert('Could not save section', err instanceof Error ? err.message : 'Please check the format and try again.')
    } finally {
      setSavingField(null)
    }
  }

  const regenerateField = async (field: PrepFieldKey | 'all') => {
    if (!kit) return

    try {
      setRegeneratingField(field)
      const token = await getToken()
      const data = await apiRequest<{ kit: PrepKit }>(
        `/api/prep-kit/${kit.id}`,
        {
          method: 'POST',
          body: JSON.stringify({ section: field }),
        },
        token,
      )
      setKit(data.kit)
      if (editingField === field) cancelEditing()
    } catch (err) {
      console.error('Failed to regenerate field:', err)
      Alert.alert('Could not regenerate section', 'Try again in a moment.')
    } finally {
      setRegeneratingField(null)
    }
  }

  if (loading || kit?.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>{loading ? 'Loading…' : 'Generating your prep kit…'}</Text>
        {!loading ? <Text style={styles.loadingSubtext}>This takes about 20 seconds</Text> : null}
      </View>
    )
  }

  if (!kit) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Prep kit not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Prep Kit</Text>
          {kit.job ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {kit.job.title} · {kit.job.company}
            </Text>
          ) : null}
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
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Application Prep</Text>
              <Text style={styles.heroTitle}>Edit or regenerate only what changed</Text>
              <Text style={styles.heroText}>
                Keep the rest of the kit stable while you refine the parts that need a stronger pass.
              </Text>
            </View>
            <Pressable
              style={styles.heroAction}
              onPress={() => regenerateField('all')}
              disabled={regeneratingField === 'all'}
            >
              <Text style={styles.heroActionText}>
                {regeneratingField === 'all' ? 'Regenerating…' : 'Regenerate all'}
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'cover' ? (
          <EditableCard
            label={FIELD_LABELS.coverLetter}
            help={FIELD_HELP.coverLetter}
            field="coverLetter"
            text={kit.coverLetter ?? ''}
            editingField={editingField}
            editorText={editorText}
            setEditorText={setEditorText}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={saveField}
            onRegenerate={regenerateField}
            savingField={savingField}
            regeneratingField={regeneratingField}
          />
        ) : null}

        {activeTab === 'hook' ? (
          <>
            <EditableCard
              label={FIELD_LABELS.whyInterested}
              help={FIELD_HELP.whyInterested}
              field="whyInterested"
              text={kit.whyInterested ?? ''}
              editingField={editingField}
              editorText={editorText}
              setEditorText={setEditorText}
              onEdit={startEditing}
              onCancel={cancelEditing}
              onSave={saveField}
              onRegenerate={regenerateField}
              savingField={savingField}
              regeneratingField={regeneratingField}
            />
            <EditableCard
              label={FIELD_LABELS.biggestStrength}
              help={FIELD_HELP.biggestStrength}
              field="biggestStrength"
              text={kit.biggestStrength ?? ''}
              editingField={editingField}
              editorText={editorText}
              setEditorText={setEditorText}
              onEdit={startEditing}
              onCancel={cancelEditing}
              onSave={saveField}
              onRegenerate={regenerateField}
              savingField={savingField}
              regeneratingField={regeneratingField}
            />
          </>
        ) : null}

        {activeTab === 'pitch' ? (
          <>
            <EditableCard
              label={FIELD_LABELS.elevatorPitch}
              help={FIELD_HELP.elevatorPitch}
              field="elevatorPitch"
              text={kit.elevatorPitch ?? ''}
              editingField={editingField}
              editorText={editorText}
              setEditorText={setEditorText}
              onEdit={startEditing}
              onCancel={cancelEditing}
              onSave={saveField}
              onRegenerate={regenerateField}
              savingField={savingField}
              regeneratingField={regeneratingField}
            />
            <EditableListCard
              label={FIELD_LABELS.preparationNotes}
              help={FIELD_HELP.preparationNotes}
              field="preparationNotes"
              items={prepNotes}
              editingField={editingField}
              editorText={editorText}
              setEditorText={setEditorText}
              onEdit={startEditing}
              onCancel={cancelEditing}
              onSave={saveField}
              onRegenerate={regenerateField}
              savingField={savingField}
              regeneratingField={regeneratingField}
            />
          </>
        ) : null}

        {activeTab === 'company' ? (
          <EditableCompanyCard
            field="companyBrief"
            brief={companyBrief}
            editingField={editingField}
            editorText={editorText}
            setEditorText={setEditorText}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={saveField}
            onRegenerate={regenerateField}
            savingField={savingField}
            regeneratingField={regeneratingField}
          />
        ) : null}

        {activeTab === 'screening' ? (
          <EditableScreeningCard
            field="screeningAnswers"
            items={screeningAnswers}
            editingField={editingField}
            editorText={editorText}
            setEditorText={setEditorText}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={saveField}
            onRegenerate={regenerateField}
            savingField={savingField}
            regeneratingField={regeneratingField}
          />
        ) : null}

        {activeTab === 'followup' ? (
          <EditableEmailCard
            field="followUpEmails"
            items={followUpEmails}
            editingField={editingField}
            editorText={editorText}
            setEditorText={setEditorText}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={saveField}
            onRegenerate={regenerateField}
            savingField={savingField}
            regeneratingField={regeneratingField}
          />
        ) : null}

        {activeTab === 'salary' ? (
          <EditableCard
            label={FIELD_LABELS.salaryApproach}
            help={FIELD_HELP.salaryApproach}
            field="salaryApproach"
            text={kit.negotiationNotes ?? ''}
            editingField={editingField}
            editorText={editorText}
            setEditorText={setEditorText}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={saveField}
            onRegenerate={regenerateField}
            savingField={savingField}
            regeneratingField={regeneratingField}
          />
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

type CardActionsProps = {
  field: PrepFieldKey
  editingField: PrepFieldKey | null
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}

function CardActions(props: CardActionsProps) {
  const editing = props.editingField === props.field

  return (
    <View style={styles.cardActions}>
      {editing ? (
        <>
          <Pressable style={[styles.actionBtn, styles.actionBtnGhost]} onPress={props.onCancel}>
            <Text style={styles.actionGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => props.onSave(props.field)}
            disabled={props.savingField === props.field}
          >
            <Text style={styles.actionPrimaryText}>
              {props.savingField === props.field ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnGhost]}
            onPress={() => props.onRegenerate(props.field)}
            disabled={props.regeneratingField === props.field}
          >
            <Text style={styles.actionGhostText}>
              {props.regeneratingField === props.field ? 'Working…' : 'Regenerate'}
            </Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => props.onEdit(props.field)}>
            <Text style={styles.actionPrimaryText}>Edit</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

function EditableCard({
  label,
  help,
  field,
  text,
  editingField,
  editorText,
  setEditorText,
  onEdit,
  onCancel,
  onSave,
  onRegenerate,
  savingField,
  regeneratingField,
}: {
  label: string
  help: string
  field: PrepFieldKey
  text: string
  editingField: PrepFieldKey | null
  editorText: string
  setEditorText: (value: string) => void
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}) {
  const editing = editingField === field

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
          <Text style={styles.cardHint}>{help}</Text>
        </View>
        <CardActions
          field={field}
          editingField={editingField}
          onEdit={onEdit}
          onCancel={onCancel}
          onSave={onSave}
          onRegenerate={onRegenerate}
          savingField={savingField}
          regeneratingField={regeneratingField}
        />
      </View>

      {editing ? (
        <TextInput
          value={editorText}
          onChangeText={setEditorText}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          placeholderTextColor={wm(0.22)}
        />
      ) : (
        <Text style={styles.cardText}>{text || 'Nothing generated yet.'}</Text>
      )}
    </View>
  )
}

function EditableListCard(props: {
  label: string
  help: string
  field: PrepFieldKey
  items: string[]
  editingField: PrepFieldKey | null
  editorText: string
  setEditorText: (value: string) => void
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}) {
  const editing = props.editingField === props.field

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.sectionLabel}>{props.label.toUpperCase()}</Text>
          <Text style={styles.cardHint}>{props.help}</Text>
        </View>
        <CardActions {...props} />
      </View>

      {editing ? (
        <TextInput
          value={props.editorText}
          onChangeText={props.setEditorText}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          placeholderTextColor={wm(0.22)}
        />
      ) : props.items.length ? (
        props.items.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={styles.listDot}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Nothing generated yet.</Text>
      )}
    </View>
  )
}

function EditableCompanyCard(props: {
  field: PrepFieldKey
  brief: CompanyBrief
  editingField: PrepFieldKey | null
  editorText: string
  setEditorText: (value: string) => void
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}) {
  const editing = props.editingField === props.field

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.sectionLabel}>{FIELD_LABELS.companyBrief.toUpperCase()}</Text>
          <Text style={styles.cardHint}>{FIELD_HELP.companyBrief}</Text>
        </View>
        <CardActions {...props} />
      </View>

      {editing ? (
        <TextInput
          value={props.editorText}
          onChangeText={props.setEditorText}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          placeholderTextColor={wm(0.22)}
        />
      ) : (
        <View style={styles.previewStack}>
          {props.brief.overview ? <ResearchBlock label="Overview" text={props.brief.overview} /> : null}
          {props.brief.culture ? <ResearchBlock label="Culture & Values" text={props.brief.culture} /> : null}
          {props.brief.recentNews ? <ResearchBlock label="Recent News" text={props.brief.recentNews} /> : null}
          {props.brief.whyThisCompany ? <ResearchBlock label="Why This Company" text={props.brief.whyThisCompany} /> : null}
          {!props.brief.overview && !props.brief.culture && !props.brief.recentNews && !props.brief.whyThisCompany ? (
            <Text style={styles.emptyText}>Nothing generated yet.</Text>
          ) : null}
        </View>
      )}
    </View>
  )
}

function EditableScreeningCard(props: {
  field: PrepFieldKey
  items: ScreeningAnswer[]
  editingField: PrepFieldKey | null
  editorText: string
  setEditorText: (value: string) => void
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}) {
  const editing = props.editingField === props.field

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.sectionLabel}>{FIELD_LABELS.screeningAnswers.toUpperCase()}</Text>
          <Text style={styles.cardHint}>{FIELD_HELP.screeningAnswers}</Text>
        </View>
        <CardActions {...props} />
      </View>

      {editing ? (
        <TextInput
          value={props.editorText}
          onChangeText={props.setEditorText}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          placeholderTextColor={wm(0.22)}
        />
      ) : props.items.length ? (
        props.items.map((qa, index) => (
          <View key={`${qa.question}-${index}`} style={styles.qaCard}>
            <Text style={styles.qaQuestion}>{qa.question}</Text>
            <Text style={styles.qaAnswer}>{qa.answer}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Nothing generated yet.</Text>
      )}
    </View>
  )
}

function EditableEmailCard(props: {
  field: PrepFieldKey
  items: FollowUpEmail[]
  editingField: PrepFieldKey | null
  editorText: string
  setEditorText: (value: string) => void
  onEdit: (field: PrepFieldKey) => void
  onCancel: () => void
  onSave: (field: PrepFieldKey) => void
  onRegenerate: (field: PrepFieldKey) => void
  savingField: PrepFieldKey | null
  regeneratingField: PrepFieldKey | 'all' | null
}) {
  const editing = props.editingField === props.field

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.sectionLabel}>{FIELD_LABELS.followUpEmails.toUpperCase()}</Text>
          <Text style={styles.cardHint}>{FIELD_HELP.followUpEmails}</Text>
        </View>
        <CardActions {...props} />
      </View>

      {editing ? (
        <TextInput
          value={props.editorText}
          onChangeText={props.setEditorText}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          placeholderTextColor={wm(0.22)}
        />
      ) : props.items.length ? (
        props.items.map((email, index) => (
          <View key={`${email.subject}-${index}`} style={styles.emailCard}>
            <View style={styles.emailHeader}>
              <Text style={styles.emailTiming}>{email.stage}</Text>
              <Text style={styles.emailSendAfter}>{email.sendAfter}</Text>
            </View>
            <Text style={styles.emailSubject}>{email.subject}</Text>
            <Text style={styles.emailBody}>{email.body}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Nothing generated yet.</Text>
      )}
    </View>
  )
}

function ResearchBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.researchBlock}>
      <Text style={styles.researchLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.researchText}>{text}</Text>
    </View>
  )
}

function serializeField(
  field: PrepFieldKey,
  source: {
    kit: PrepKit | null
    companyBrief: CompanyBrief
    screeningAnswers: ScreeningAnswer[]
    followUpEmails: FollowUpEmail[]
    prepNotes: string[]
  },
): string {
  switch (field) {
    case 'coverLetter':
      return source.kit?.coverLetter ?? ''
    case 'whyInterested':
      return source.kit?.whyInterested ?? ''
    case 'biggestStrength':
      return source.kit?.biggestStrength ?? ''
    case 'elevatorPitch':
      return source.kit?.elevatorPitch ?? ''
    case 'preparationNotes':
      return source.prepNotes.join('\n')
    case 'companyBrief':
      return serializeCompanyBrief(source.companyBrief)
    case 'screeningAnswers':
      return serializeScreeningAnswers(source.screeningAnswers)
    case 'followUpEmails':
      return serializeFollowUpEmails(source.followUpEmails)
    case 'salaryApproach':
      return source.kit?.negotiationNotes ?? ''
  }
}

function serializeCompanyBrief(brief: CompanyBrief): string {
  return [
    'Overview:',
    brief.overview,
    '',
    '---',
    '',
    'Culture:',
    brief.culture,
    '',
    '---',
    '',
    'Recent News:',
    brief.recentNews,
    '',
    '---',
    '',
    'Why This Company:',
    brief.whyThisCompany,
  ].join('\n').trim()
}

function serializeScreeningAnswers(items: ScreeningAnswer[]): string {
  return items
    .map((item) => [`Question: ${item.question}`, `Answer: ${item.answer}`].join('\n'))
    .join('\n\n---\n\n')
}

function serializeFollowUpEmails(items: FollowUpEmail[]): string {
  return items
    .map((item) =>
      [
        `Stage: ${item.stage}`,
        `Send after: ${item.sendAfter}`,
        `Subject: ${item.subject}`,
        'Body:',
        item.body,
      ].join('\n'),
    )
    .join('\n\n---\n\n')
}

function parseFieldPayload(field: PrepFieldKey, raw: string): Record<string, unknown> {
  switch (field) {
    case 'coverLetter':
      return { coverLetter: raw.trim() }
    case 'whyInterested':
      return { whyInterested: raw.trim() }
    case 'biggestStrength':
      return { biggestStrength: raw.trim() }
    case 'elevatorPitch':
      return { elevatorPitch: raw.trim() }
    case 'preparationNotes':
      return {
        preparationNotes: raw
          .split('\n')
          .map((line) => line.replace(/^[-•]\s*/, '').trim())
          .filter(Boolean),
      }
    case 'companyBrief':
      return { companyBrief: parseCompanyBrief(raw) }
    case 'screeningAnswers':
      return { screeningAnswers: parseScreeningAnswers(raw) }
    case 'followUpEmails':
      return { followUpEmails: parseFollowUpEmails(raw) }
    case 'salaryApproach':
      return { salaryApproach: raw.trim() }
  }
}

function parseCompanyBrief(raw: string): CompanyBrief {
  const parts = raw.split(/\n\s*---+\s*\n/g).map((part) => part.trim())
  const values: CompanyBrief = {
    overview: '',
    culture: '',
    recentNews: '',
    whyThisCompany: '',
  }

  for (const part of parts) {
    if (/^Overview:/i.test(part)) values.overview = part.replace(/^Overview:\s*/i, '').trim()
    if (/^Culture:/i.test(part)) values.culture = part.replace(/^Culture:\s*/i, '').trim()
    if (/^Recent News:/i.test(part)) values.recentNews = part.replace(/^Recent News:\s*/i, '').trim()
    if (/^Why This Company:/i.test(part)) {
      values.whyThisCompany = part.replace(/^Why This Company:\s*/i, '').trim()
    }
  }

  return values
}

function parseScreeningAnswers(raw: string): ScreeningAnswer[] {
  if (!raw.trim()) return []

  return raw
    .split(/\n\s*---+\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const question = block.match(/^Question:\s*(.+)$/im)?.[1]?.trim() ?? ''
      const answer = block.match(/^Answer:\s*([\s\S]+)$/im)?.[1]?.trim() ?? ''
      if (!question || !answer) {
        throw new Error('Each screening block needs Question and Answer lines.')
      }
      return { question, answer }
    })
}

function parseFollowUpEmails(raw: string): FollowUpEmail[] {
  if (!raw.trim()) return []

  return raw
    .split(/\n\s*---+\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const stage = block.match(/^Stage:\s*(.+)$/im)?.[1]?.trim() ?? ''
      const sendAfter = block.match(/^Send after:\s*(.+)$/im)?.[1]?.trim() ?? ''
      const subject = block.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? ''
      const body = block.match(/^Body:\s*([\s\S]+)$/im)?.[1]?.trim() ?? ''
      if (!stage || !subject || !body) {
        throw new Error('Each email block needs Stage, Subject, and Body.')
      }
      return { stage, sendAfter, subject, body }
    })
}

function parseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
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
  heroCard: {
    backgroundColor: Colors.dark2,
    borderRadius: Radius.artifact,
    borderWidth: 1,
    borderColor: orangeAlpha(0.18),
    padding: Spacing[6],
  },
  heroHeader: { gap: Spacing[4] },
  heroCopy: { gap: Spacing[2] },
  heroEyebrow: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, letterSpacing: 0.8 },
  heroTitle: { fontSize: FontSize['2xl'], fontWeight: '700', color: wm(0.92) },
  heroText: { fontSize: FontSize.base, color: wm(0.58), lineHeight: 18 },
  heroAction: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.orange,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  card: {
    backgroundColor: wm(0.04),
    borderRadius: Radius.card,
    padding: Spacing[6],
    borderWidth: 1,
    borderColor: wm(0.07),
    gap: Spacing[4],
  },
  cardHeader: { gap: Spacing[3] },
  cardHeaderCopy: { gap: 4 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3), letterSpacing: 0.5 },
  cardHint: { fontSize: FontSize.sm, color: wm(0.36), lineHeight: 16 },
  cardText: { fontSize: FontSize.md, color: wm(0.8), lineHeight: 22 },
  emptyText: { fontSize: FontSize.base, color: wm(0.35), lineHeight: 18 },
  editor: {
    minHeight: 220,
    fontSize: FontSize.base,
    color: wm(0.86),
    lineHeight: 21,
  },
  actionBtn: {
    borderRadius: Radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  actionBtnGhost: { borderColor: wm(0.09), backgroundColor: wm(0.03) },
  actionBtnPrimary: { borderColor: orangeAlpha(0.2), backgroundColor: Colors.orange },
  actionGhostText: { fontSize: FontSize.sm, fontWeight: '600', color: wm(0.62) },
  actionPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  previewStack: { gap: Spacing[3] },
  researchBlock: { gap: Spacing[2], paddingVertical: Spacing[2], borderTopWidth: 1, borderTopColor: wm(0.06) },
  researchLabel: { fontSize: FontSize.xs, fontWeight: '700', color: wm(0.3), letterSpacing: 0.5 },
  researchText: { fontSize: FontSize.md, color: wm(0.8), lineHeight: 20 },
  qaCard: {
    backgroundColor: wm(0.03),
    borderRadius: Radius.card,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: wm(0.06),
    gap: Spacing[3],
  },
  qaQuestion: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.85) },
  qaAnswer: { fontSize: FontSize.md, color: wm(0.6), lineHeight: 20 },
  emailCard: {
    backgroundColor: wm(0.03),
    borderRadius: Radius.card,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: wm(0.06),
    gap: Spacing[3],
  },
  emailHeader: { gap: Spacing[1] },
  emailTiming: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.orange, letterSpacing: 0.5 },
  emailSendAfter: { fontSize: FontSize.xs, color: wm(0.35) },
  emailSubject: { fontSize: FontSize.md, fontWeight: '600', color: wm(0.85) },
  emailBody: { fontSize: FontSize.base, color: wm(0.55), lineHeight: 20 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listDot: { fontSize: FontSize.base, color: Colors.orange },
  listText: { flex: 1, fontSize: FontSize.base, color: wm(0.78), lineHeight: 20 },
})
