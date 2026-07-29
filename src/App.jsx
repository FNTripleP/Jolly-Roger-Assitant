import { useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import { parseProfileText } from './profileParser.js'

const STORAGE_KEY = 'jrb-command-deck'
const SOURCE_STORAGE_KEY = 'jrb_profile_source_text'
const DRAFT_STORAGE_KEY = 'jrb_battalion_profile_draft'

const analysisStages = [
  'Parsing the command notes',
  'Prioritizing objectives and values',
  'Mapping active operations',
  'Detecting daily rhythm',
  'Establishing communication rules',
  'Preparing the Battalion Profile',
]

function makeDefaultProfile() {
  return {
    identity: { preferredName: '', background: '' },
    mission: { personalMission: '', coreValues: [], definitionOfSuccess: '' },
    goals: { currentGoals: [], longTermGoals: [], careerGoals: [], financialGoals: [], fitnessGoals: [] },
    career: { currentWork: '', objectives: [] },
    finances: { currentSituation: '', objectives: [] },
    relationships: { importantPeople: [] },
    projects: { activeProjects: [] },
    routines: { dailyRoutine: '', responsibilities: [] },
    challenges: [],
    communication: { preferredStyle: '', assistantInstructions: '', preferences: [] },
    uncategorizedNotes: [],
    unassignedIntel: [],
    extractedItems: [],
    rawImport: '',
  }
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (entry && typeof entry === 'object') return entry.text?.trim() || entry.value?.trim() || ''
        return ''
      })
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function mergeProfileWithDefaults(profile) {
  const base = makeDefaultProfile()
  if (!profile || typeof profile !== 'object') return base

  return {
    ...base,
    ...profile,
    identity: {
      preferredName: profile.identity?.preferredName ?? base.identity.preferredName,
      background: profile.identity?.background ?? base.identity.background,
    },
    mission: {
      personalMission: profile.mission?.personalMission ?? base.mission.personalMission,
      coreValues: normalizeTextArray(profile.mission?.coreValues),
      definitionOfSuccess: profile.mission?.definitionOfSuccess ?? base.mission.definitionOfSuccess,
    },
    goals: {
      currentGoals: normalizeTextArray(profile.goals?.currentGoals),
      longTermGoals: normalizeTextArray(profile.goals?.longTermGoals),
      careerGoals: normalizeTextArray(profile.goals?.careerGoals),
      financialGoals: normalizeTextArray(profile.goals?.financialGoals),
      fitnessGoals: normalizeTextArray(profile.goals?.fitnessGoals),
    },
    career: {
      currentWork: profile.career?.currentWork ?? base.career.currentWork,
      objectives: normalizeTextArray(profile.career?.objectives),
    },
    finances: {
      currentSituation: profile.finances?.currentSituation ?? base.finances.currentSituation,
      objectives: normalizeTextArray(profile.finances?.objectives),
    },
    relationships: {
      importantPeople: normalizeTextArray(profile.relationships?.importantPeople),
    },
    projects: {
      activeProjects: normalizeTextArray(profile.projects?.activeProjects),
    },
    routines: {
      dailyRoutine: profile.routines?.dailyRoutine ?? base.routines.dailyRoutine,
      responsibilities: normalizeTextArray(profile.routines?.responsibilities),
    },
    challenges: normalizeTextArray(profile.challenges),
    communication: {
      preferredStyle: profile.communication?.preferredStyle ?? base.communication.preferredStyle,
      assistantInstructions: profile.communication?.assistantInstructions ?? base.communication.assistantInstructions,
      preferences: normalizeTextArray(profile.communication?.preferences),
    },
    uncategorizedNotes: normalizeTextArray(profile.uncategorizedNotes),
    unassignedIntel: normalizeTextArray(profile.unassignedIntel),
    extractedItems: Array.isArray(profile.extractedItems) ? profile.extractedItems : base.extractedItems,
    rawImport: profile.rawImport ?? base.rawImport,
  }
}

function hasProfileContent(profile) {
  if (!profile || typeof profile !== 'object') return false

  return Boolean(
    profile.rawImport ||
    profile.identity?.preferredName ||
    profile.mission?.personalMission ||
    profile.goals?.currentGoals?.length ||
    profile.relationships?.importantPeople?.length ||
    profile.projects?.activeProjects?.length ||
    profile.routines?.dailyRoutine ||
    profile.challenges?.length ||
    profile.uncategorizedNotes?.length
  )
}

function createInitialState() {
  if (typeof window === 'undefined') {
    return { step: 'welcome', pastedText: '', error: '', profile: makeDefaultProfile(), sourceText: '', parsedSummary: null }
  }

  try {
    const storedState = window.localStorage.getItem(STORAGE_KEY)
    if (!storedState) {
      return { step: 'welcome', pastedText: '', error: '', profile: makeDefaultProfile(), sourceText: '', parsedSummary: null }
    }

    const parsedState = JSON.parse(storedState)
    const profile = mergeProfileWithDefaults(parsedState?.profile)
    const requestedStep = parsedState?.step || 'welcome'
    const normalizedStep = ['active', 'review'].includes(requestedStep) && !hasProfileContent(profile) ? 'intake' : requestedStep

    return {
      step: normalizedStep,
      pastedText: parsedState?.pastedText || '',
      error: parsedState?.error || '',
      profile,
      sourceText: parsedState?.sourceText || window.localStorage.getItem(SOURCE_STORAGE_KEY) || '',
      parsedSummary: parsedState?.parsedSummary || null,
    }
  } catch {
    return { step: 'welcome', pastedText: '', error: '', profile: makeDefaultProfile(), sourceText: '', parsedSummary: null }
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_TEXT':
      return { ...state, pastedText: action.value, error: '' }
    case 'SET_ERROR':
      return { ...state, error: action.value }
    case 'START_ANALYZE':
      return {
        ...state,
        profile: makeDefaultProfile(),
        step: 'analysis',
        sourceText: action.rawText || state.pastedText,
        error: '',
      }
    case 'FINALIZE_ANALYZE':
      return {
        ...state,
        profile: mergeProfileWithDefaults(action.profile),
        step: 'review',
        sourceText: action.sourceText || state.sourceText,
        parsedSummary: action.summary || null,
        error: '',
      }
    case 'UPDATE_PROFILE':
      return { ...state, profile: mergeProfileWithDefaults(action.profile) }
    case 'RESET':
      return { step: 'welcome', pastedText: '', error: '', profile: makeDefaultProfile(), sourceText: '', parsedSummary: null }
    default:
      return state
  }
}

function toTextValue(value) {
  if (Array.isArray(value)) return value.join('\n')
  return value ?? ''
}

function toArrayValue(value) {
  if (Array.isArray(value)) return value
  return `${value ?? ''}`.split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

function updateProfileValue(profile, path, value) {
  if (!profile) return profile
  const segments = path.split('.')
  if (segments.length === 1) {
    return { ...profile, [segments[0]]: value }
  }

  const [head, ...rest] = segments
  return {
    ...profile,
    [head]: updateProfileValue(profile[head], rest.join('.'), value),
  }
}

function getContextHighlights(text) {
  if (!text) return []
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
}

function extractContextActions(text) {
  if (!text) return []
  return text
    .split(/[.!?\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => /goal|focus|plan|build|improve|protect|launch|save|train|learn|create|care|review|lead/i.test(segment))
    .slice(0, 4)
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([
    { id: 1, sender: 'Ops', text: 'Command channel ready. The profile will shape the next briefing.' },
  ])
  const [review, setReview] = useState({
    wins: 'The command window closed cleanly.',
    needs: 'The midday briefing ran long.',
    lesson: 'Trim briefings to preserve recovery time.',
    priority: 'Protect the evening reset window.',
  })
  const [saveState, setSaveState] = useState('Awaiting seal')
  const [showRawImport, setShowRawImport] = useState(false)
  const [reviewForm, setReviewForm] = useState(makeDefaultProfile)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.localStorage.setItem(SOURCE_STORAGE_KEY, state.sourceText || '')
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(reviewForm))
  }, [state, reviewForm])

  useEffect(() => {
    if (state.step === 'review' && state.profile) {
      setReviewForm(mergeProfileWithDefaults(state.profile))
    }
  }, [state.step, state.profile])

  useEffect(() => {
    if (state.step !== 'analysis') return undefined

    const timer = window.setInterval(() => {
      setAnalysisStep((current) => {
        if (current >= analysisStages.length - 1) {
          window.clearInterval(timer)
          const rawText = state.pastedText.trim() || state.sourceText || ''
          const parsedResult = parseProfileText(rawText)
          const parsedProfile = mergeProfileWithDefaults(parsedResult.profile)
          setReviewForm(parsedProfile)
          dispatch({ type: 'FINALIZE_ANALYZE', profile: parsedProfile, sourceText: rawText, summary: parsedResult.summary })
          return current
        }
        return current + 1
      })
    }, 900)

    return () => window.clearInterval(timer)
  }, [state.step, state.pastedText, state.sourceText])

  const importedContextText = useMemo(() => state.profile?.rawImport || state.sourceText || state.pastedText || '', [state.profile, state.sourceText, state.pastedText])
  const contextHighlights = useMemo(() => getContextHighlights(importedContextText), [importedContextText])
  const greetingName = useMemo(() => state.profile?.identity?.preferredName || 'Commander', [state.profile])
  const missionText = useMemo(() => {
    const missionValue = state.profile?.mission?.personalMission || reviewForm.mission.personalMission
    if (missionValue) return missionValue
    return contextHighlights[0] || 'Lead with clarity and preserve calm momentum.'
  }, [state.profile, reviewForm, contextHighlights])

  const currentGoals = useMemo(() => {
    const goals = state.profile?.goals?.currentGoals || reviewForm.goals.currentGoals || []
    return goals.slice(0, 3).map((goal, index) => ({ id: `${goal}-${index}`, text: goal, include: true }))
  }, [state.profile, reviewForm])

  const activeOperations = useMemo(() => {
    const projects = state.profile?.projects?.activeProjects || reviewForm.projects.activeProjects || []
    const responsibilities = state.profile?.routines?.responsibilities || reviewForm.routines.responsibilities || []
    return [...projects, ...responsibilities].slice(0, 4).map((item, index) => ({ id: `${item}-${index}`, text: item, include: true }))
  }, [state.profile, reviewForm])

  const upcomingEvents = useMemo(() => {
    const routine = state.profile?.routines?.dailyRoutine || reviewForm.routines.dailyRoutine || ''
    return routine ? [{ id: 'routine', text: routine, include: true }] : []
  }, [state.profile, reviewForm])

  const readinessMetrics = useMemo(() => [
    { label: 'Sleep', value: 88 },
    { label: 'Training', value: 81 },
    { label: 'Nutrition', value: 74 },
    { label: 'Focus', value: 91 },
  ], [])

  const overallReadiness = useMemo(() => {
    const sum = readinessMetrics.reduce((total, metric) => total + metric.value, 0)
    return Math.round(sum / readinessMetrics.length)
  }, [readinessMetrics])

  const suggestedActions = useMemo(() => {
    const derived = currentGoals.slice(0, 3).map((item) => item.text)
    if (derived.length) return derived
    return extractContextActions(importedContextText).slice(0, 3)
  }, [currentGoals, importedContextText])

  const summary = state.profile?.parsedSummary || state.parsedSummary
  const effectiveStep = state.step === 'active' && !hasProfileContent(state.profile) ? 'intake' : state.step

  const handleAnalyze = () => {
    if (!state.pastedText.trim()) {
      dispatch({ type: 'SET_ERROR', value: 'Paste a personal summary before continuing.' })
      return
    }

    setAnalysisStep(0)
    dispatch({ type: 'START_ANALYZE', rawText: state.pastedText })
  }

  const handleReviewChange = (path, value) => {
    const nextProfile = updateProfileValue(reviewForm, path, value)
    setReviewForm(nextProfile)
    dispatch({ type: 'UPDATE_PROFILE', profile: nextProfile })
  }

  const handleReviewArrayChange = (path, value) => {
    handleReviewChange(path, toArrayValue(value))
  }

  const sendMessage = (text, sender = 'You') => {
    const nextText = text.trim()
    if (!nextText) return
    setMessages((current) => [...current, { id: Date.now() + Math.random(), sender, text: nextText }])
    setDraft('')
  }

  const handleQuickCommand = (label, response) => {
    sendMessage(label, 'You')
    sendMessage(response, 'Ops')
  }

  const saveReview = () => {
    setSaveState('Review archived to command log')
  }

  const exportProfile = () => {
    const payload = { exportedAt: new Date().toISOString(), profile: reviewForm }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'jrb-command-deck.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetProfile = () => {
    const nextProfile = makeDefaultProfile()
    setReviewForm(nextProfile)
    dispatch({ type: 'RESET' })
  }

  const useFullTextAsContext = () => {
    if (!state.sourceText) return
    const nextProfile = { ...reviewForm, rawImport: state.sourceText }
    setReviewForm(nextProfile)
    dispatch({ type: 'UPDATE_PROFILE', profile: nextProfile })
  }

  const debugSummary = useMemo(() => ({
    parsedName: reviewForm.identity.preferredName || '—',
    parsedMissionLength: (reviewForm.mission.personalMission || '').length,
    goalCount: reviewForm.goals.currentGoals.length,
    importantPeopleCount: reviewForm.relationships.importantPeople.length,
    projectCount: reviewForm.projects.activeProjects.length,
    rawImportLength: (reviewForm.rawImport || '').length,
  }), [reviewForm])

  return (
    <div className="command-shell">
      {effectiveStep === 'welcome' && (
        <section className="onboarding-card">
          <div className="title-block">
            <p className="eyebrow">Jolly Roger Battalion</p>
            <h1>Command Deck</h1>
            <p className="intro-copy">
              Build a tactical profile from a personal summary. Everything stays local, transparent, and reviewable before activation.
            </p>
          </div>

          <div className="welcome-actions">
            <button type="button" className="primary-action" onClick={() => dispatch({ type: 'SET_STEP', step: 'intake' })}>
              Begin profile setup
            </button>
          </div>
        </section>
      )}

      {effectiveStep === 'intake' && (
        <section className="onboarding-card">
          <div className="panel-heading">
            <p className="label">Character Intel</p>
            <span className="status-tag">Local prototype</span>
          </div>

          <label className="field-block">
            <span>Paste your personal profile, goals, routines, relationships, projects, and preferences</span>
            <textarea
              value={state.pastedText}
              onChange={(event) => dispatch({ type: 'SET_TEXT', value: event.target.value })}
              placeholder="Paste a ChatGPT-generated summary, a personal profile, goals, routines, relationships, projects, or preferences here."
            />
          </label>

          <p className="privacy-note">Paste a detailed summary for better personalization. You can update or replace it later.</p>
          {state.error ? <p className="error-text">{state.error}</p> : null}

          <div className="welcome-actions">
            <button type="button" className="primary-action" onClick={handleAnalyze}>Build My Battalion Profile</button>
            <button type="button" className="secondary-action" onClick={() => dispatch({ type: 'SET_TEXT', value: '' })}>Clear</button>
          </div>
        </section>
      )}

      {effectiveStep === 'analysis' && (
        <section className="onboarding-card analysis-card">
          <div className="panel-heading">
            <p className="label">Analysis</p>
            <span className="status-tag">Processing locally</span>
          </div>
          <div className="analysis-steps">
            {analysisStages.map((stage, index) => (
              <div key={stage} className={`analysis-step ${index <= analysisStep ? 'active' : ''}`}>
                <span className="analysis-dot" />
                <span>{stage}</span>
              </div>
            ))}
          </div>
          <div className="analysis-progress">
            <div style={{ width: `${((analysisStep + 1) / analysisStages.length) * 100}%` }} />
          </div>
          <p className="privacy-note">The parser is building a structured profile from the raw text and preparing the review form.</p>
        </section>
      )}

      {effectiveStep === 'review' && reviewForm && (
        <section className="onboarding-card review-card">
          <div className="panel-heading">
            <p className="label">Profile Review</p>
            <span className="status-tag">Editable</span>
          </div>
          <div className="warning-box">Imported or inferred details should be reviewed before activation. Exclude anything that feels outdated or incorrect.</div>

          <div className="summary-box">
            <strong>Extraction summary</strong>
            <ul>
              <li>{summary?.detectedSections ?? 0} sections detected</li>
              <li>{summary?.extractedFacts ?? 0} goals or facts extracted</li>
              <li>{summary?.uncategorizedNotes ?? 0} uncategorized notes</li>
            </ul>
          </div>

          <div className="debug-summary">
            <div>Parsed name: {debugSummary.parsedName}</div>
            <div>Parsed mission length: {debugSummary.parsedMissionLength}</div>
            <div>Goals: {debugSummary.goalCount}</div>
            <div>Important people: {debugSummary.importantPeopleCount}</div>
            <div>Projects: {debugSummary.projectCount}</div>
            <div>Raw import length: {debugSummary.rawImportLength}</div>
          </div>

          <div className="source-actions">
            <button type="button" className="secondary-action" onClick={() => setShowRawImport((current) => !current)}>
              {showRawImport ? 'Hide Raw Import' : 'Show Raw Import'}
            </button>
            <button type="button" className="primary-action" onClick={useFullTextAsContext}>Use Full Text as Assistant Context</button>
          </div>

          {showRawImport ? (
            <div className="raw-import-box">
              <div className="panel-heading">
                <p className="label">Imported Source</p>
              </div>
              <pre>{reviewForm.rawImport || state.sourceText || state.pastedText}</pre>
            </div>
          ) : null}

          <div className="review-form-grid">
            <label className="review-field-block">
              <span>Preferred Name</span>
              <input value={reviewForm.identity.preferredName ?? ''} onChange={(event) => handleReviewChange('identity.preferredName', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Background</span>
              <textarea value={reviewForm.identity.background ?? ''} onChange={(event) => handleReviewChange('identity.background', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Personal Mission</span>
              <textarea value={reviewForm.mission.personalMission ?? ''} onChange={(event) => handleReviewChange('mission.personalMission', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Core Values</span>
              <textarea value={toTextValue(reviewForm.mission.coreValues)} onChange={(event) => handleReviewArrayChange('mission.coreValues', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Definition of Success</span>
              <textarea value={reviewForm.mission.definitionOfSuccess ?? ''} onChange={(event) => handleReviewChange('mission.definitionOfSuccess', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Current Goals</span>
              <textarea value={toTextValue(reviewForm.goals.currentGoals)} onChange={(event) => handleReviewArrayChange('goals.currentGoals', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Long-Term Goals</span>
              <textarea value={toTextValue(reviewForm.goals.longTermGoals)} onChange={(event) => handleReviewArrayChange('goals.longTermGoals', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Career Goals</span>
              <textarea value={toTextValue(reviewForm.goals.careerGoals)} onChange={(event) => handleReviewArrayChange('goals.careerGoals', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Financial Goals</span>
              <textarea value={toTextValue(reviewForm.goals.financialGoals)} onChange={(event) => handleReviewArrayChange('goals.financialGoals', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Fitness Goals</span>
              <textarea value={toTextValue(reviewForm.goals.fitnessGoals)} onChange={(event) => handleReviewArrayChange('goals.fitnessGoals', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Current Work</span>
              <textarea value={reviewForm.career.currentWork ?? ''} onChange={(event) => handleReviewChange('career.currentWork', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Career Objectives</span>
              <textarea value={toTextValue(reviewForm.career.objectives)} onChange={(event) => handleReviewArrayChange('career.objectives', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Financial Situation</span>
              <textarea value={reviewForm.finances.currentSituation ?? ''} onChange={(event) => handleReviewChange('finances.currentSituation', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Financial Objectives</span>
              <textarea value={toTextValue(reviewForm.finances.objectives)} onChange={(event) => handleReviewArrayChange('finances.objectives', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Important People</span>
              <textarea value={toTextValue(reviewForm.relationships.importantPeople)} onChange={(event) => handleReviewArrayChange('relationships.importantPeople', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Active Projects</span>
              <textarea value={toTextValue(reviewForm.projects.activeProjects)} onChange={(event) => handleReviewArrayChange('projects.activeProjects', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Daily Routine</span>
              <textarea value={reviewForm.routines.dailyRoutine ?? ''} onChange={(event) => handleReviewChange('routines.dailyRoutine', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Responsibilities</span>
              <textarea value={toTextValue(reviewForm.routines.responsibilities)} onChange={(event) => handleReviewArrayChange('routines.responsibilities', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Challenges</span>
              <textarea value={toTextValue(reviewForm.challenges)} onChange={(event) => handleReviewArrayChange('challenges', event.target.value)} />
            </label>
            <label className="review-field-block">
              <span>Preferred Style</span>
              <input value={reviewForm.communication.preferredStyle ?? ''} onChange={(event) => handleReviewChange('communication.preferredStyle', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Assistant Instructions</span>
              <textarea value={reviewForm.communication.assistantInstructions ?? ''} onChange={(event) => handleReviewChange('communication.assistantInstructions', event.target.value)} />
            </label>
            <label className="review-field-block review-span-2">
              <span>Uncategorized Notes</span>
              <textarea value={toTextValue(reviewForm.uncategorizedNotes)} onChange={(event) => handleReviewArrayChange('uncategorizedNotes', event.target.value)} />
            </label>
          </div>

          <div className="welcome-actions">
            <button type="button" className="primary-action" onClick={() => dispatch({ type: 'SET_STEP', step: 'active' })}>Activate Personal Command</button>
            <button type="button" className="secondary-action" onClick={exportProfile}>Export Profile</button>
          </div>
        </section>
      )}

      {effectiveStep === 'active' && state.profile && (
        <>
          <header className="hero-card">
            <div className="hero-copy">
              <p className="eyebrow">Jolly Roger Battalion</p>
              <h1>Personal Assistant</h1>
              <p className="date-line">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</p>
            </div>
            <div className="hero-meta">
              <div className="status-pill">
                <span className="dot" />
                ONLINE
              </div>
              <div className="readiness-pill">
                <span>Readiness</span>
                <strong>{overallReadiness}%</strong>
              </div>
            </div>
          </header>

          <section className="panel directive-panel">
            <div className="panel-heading">
              <p className="label">Daily Directive</p>
              <span className="status-tag">Personalized</span>
            </div>
            <h2>Good evening, {greetingName}</h2>
            <p className="briefing">{missionText}</p>
            {contextHighlights.length ? <p className="context-snippet">Imported context: {contextHighlights.slice(0, 2).join(' • ')}</p> : null}
            <blockquote>“A disciplined crew turns intention into routine before the night closes in.”</blockquote>
          </section>

          <main className="dashboard-grid">
            <section className="panel objectives-panel">
              <div className="panel-heading">
                <p className="label">Today&apos;s Objectives</p>
                <span className="status-tag">Aligned</span>
              </div>
              <ul className="objective-list">
                {currentGoals.map((objective) => (
                  <li key={objective.id}>
                    <label>
                      <input type="checkbox" defaultChecked={objective.include} />
                      <span>{objective.text}</span>
                    </label>
                    <span className="priority-badge">Priority</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel terminal-panel">
              <div className="panel-heading">
                <p className="label">Assistant Terminal</p>
                <span className="status-tag">Adaptive</span>
              </div>
              <div className="chat-history">
                {messages.map((message) => (
                  <div key={message.id} className={`chat-bubble ${message.sender === 'You' ? 'self' : ''}`}>
                    <strong>{message.sender}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <div className="quick-actions">
                <button type="button" onClick={() => handleQuickCommand('Build my day', 'Your day is queued around recovery, focus, and review.')}>Build my day</button>
                <button type="button" onClick={() => handleQuickCommand('Review objectives', 'Objectives are aligned with the current profile.')}>Review objectives</button>
                <button type="button" onClick={() => handleQuickCommand('Add reminder', 'Reminder logged: prepare the next block before dusk.')}>Add reminder</button>
              </div>
              <div className="terminal-input-row">
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Issue a command…"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') sendMessage(draft)
                  }}
                />
                <button type="button" className="icon-button" onClick={() => sendMessage(draft)}>Send</button>
              </div>
            </section>

            <section className="panel rhythm-panel">
              <div className="panel-heading">
                <p className="label">Active Operations</p>
                <span className="status-tag">Live</span>
              </div>
              <ul className="reminder-list">
                {activeOperations.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.text}</strong>
                    </div>
                    <span className="tag">Active</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel reminders-panel">
              <div className="panel-heading">
                <p className="label">Upcoming Events</p>
                <span className="status-tag">Scheduled</span>
              </div>
              <ul className="reminder-list">
                {upcomingEvents.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.text}</strong>
                      <p>Profile-guided cadence</p>
                    </div>
                    <span className="tag">Ready</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel readiness-panel">
              <div className="panel-heading">
                <p className="label">Readiness Panel</p>
                <span className="status-tag">Balanced</span>
              </div>
              <div className="readiness-metrics">
                {readinessMetrics.map((metric) => (
                  <div key={metric.label} className="metric-card">
                    <div className="metric-top">
                      <span>{metric.label}</span>
                      <strong>{metric.value}%</strong>
                    </div>
                    <div className="meter">
                      <div style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel review-panel">
              <div className="panel-heading">
                <p className="label">After-Action Review</p>
                <span className="status-tag">{saveState}</span>
              </div>
              <div className="review-fields">
                <label>
                  What went well?
                  <textarea value={review.wins} onChange={(event) => setReview((current) => ({ ...current, wins: event.target.value }))} />
                </label>
                <label>
                  What needs improvement?
                  <textarea value={review.needs} onChange={(event) => setReview((current) => ({ ...current, needs: event.target.value }))} />
                </label>
                <label>
                  Lesson learned
                  <textarea value={review.lesson} onChange={(event) => setReview((current) => ({ ...current, lesson: event.target.value }))} />
                </label>
                <label>
                  Tomorrow&apos;s main priority
                  <textarea value={review.priority} onChange={(event) => setReview((current) => ({ ...current, priority: event.target.value }))} />
                </label>
              </div>
              <button type="button" className="save-button" onClick={saveReview}>Save Review</button>
            </section>

            <section className="panel intel-panel">
              <div className="panel-heading">
                <p className="label">Suggested Actions</p>
                <span className="status-tag">Profile-led</span>
              </div>
              <ul className="reminder-list">
                {suggestedActions.map((action) => (
                  <li key={action}>
                    <div>
                      <strong>{action}</strong>
                    </div>
                    <span className="tag">Next</span>
                  </li>
                ))}
              </ul>
            </section>
          </main>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <p className="label">Battalion Profile</p>
              <span className="status-tag">Controls</span>
            </div>
            <div className="settings-actions">
              <button type="button" className="secondary-action" onClick={() => dispatch({ type: 'SET_STEP', step: 'review' })}>Edit profile</button>
              <button type="button" className="secondary-action" onClick={() => dispatch({ type: 'SET_STEP', step: 'intake' })}>Re-enter details</button>
              <button type="button" className="secondary-action" onClick={exportProfile}>Export profile</button>
              <button type="button" className="secondary-action" onClick={resetProfile}>Start over</button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default App
