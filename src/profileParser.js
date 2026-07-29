const SECTION_RULES = [
  { category: 'identity', aliases: ['identity', 'about me', 'personal information', 'background', 'about'] },
  { category: 'mission', aliases: ['mission', 'personal mission', 'mission statement', 'purpose', 'life mission', 'definition of success'] },
  { category: 'values', aliases: ['values', 'core values', 'principles', 'beliefs'] },
  { category: 'goals', aliases: ['goals', 'current goals', 'high-level priorities', 'long-term goals', 'objectives', 'priorities'] },
  { category: 'career', aliases: ['career', 'work', 'employment', 'career objectives', 'professional goals'] },
  { category: 'finances', aliases: ['finances', 'financial situation', 'financial objectives', 'money goals', 'home ownership', 'housing'] },
  { category: 'fitness', aliases: ['fitness', 'health and fitness', 'fitness goals', 'training', 'nutrition', 'health'] },
  { category: 'relationships', aliases: ['people', 'important people', 'relationships', 'family', 'personnel'] },
  { category: 'projects', aliases: ['projects', 'active projects', 'technology and product ideas', 'business ideas', 'operations'] },
  { category: 'routines', aliases: ['routines', 'daily life', 'battle rhythm', 'daily routine', 'weekly routine', 'responsibilities'] },
  { category: 'challenges', aliases: ['challenges', 'current challenges', 'constraints', 'risks', 'problems'] },
  { category: 'communication', aliases: ['assistant preferences', 'preferred assistant personality', 'assistant operating instructions', 'communication style', 'decision-making preferences'] },
]

function normalizeHeading(text) {
  return text
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/[:]+$/, '')
    .toLowerCase()
}

function splitSections(text) {
  const lines = text.split(/\r?\n/)
  const sections = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    const upperHeading = line.match(/^[A-Z][A-Z0-9\s&/()'-]+$/) && line.length > 2

    if (headingMatch) {
      if (current) sections.push(current)
      current = { heading: headingMatch[2].trim(), lines: [] }
      continue
    }

    if (upperHeading) {
      if (current) sections.push(current)
      current = { heading: line.trim(), lines: [] }
      continue
    }

    if (!line) {
      if (current) current.lines.push('')
      continue
    }

    if (!current) current = { heading: 'Untitled', lines: [] }
    current.lines.push(line)
  }

  if (current) sections.push(current)
  return sections
}

function parseBlocks(sectionLines) {
  const blocks = []
  let paragraphLines = []

  const flushParagraph = () => {
    const text = paragraphLines.join(' ').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraphLines = []
  }

  for (const line of sectionLines) {
    if (!line) {
      flushParagraph()
      continue
    }

    const bulletMatch = line.match(/^([-*]\s+|\d+[.)]\s+)(.+)$/)
    if (bulletMatch) {
      flushParagraph()
      blocks.push({ type: 'bullet', text: bulletMatch[2].trim() })
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph()
  return blocks
}

function classifySection(heading) {
  const normalized = normalizeHeading(heading)
  const exact = SECTION_RULES.find((rule) => rule.aliases.some((alias) => normalized === alias))
  if (exact) return exact.category
  const partial = SECTION_RULES.find((rule) => rule.aliases.some((alias) => normalized.includes(alias)))
  return partial?.category || null
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function cleanText(text) {
  return normalizeText(text.replace(/^[\-•*]\s*/, '').replace(/\s+([,.;:!?])/g, '$1'))
}

function makeItem(text, category, sourceSection, sourceText, confidence) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    text: cleanText(text),
    sourceSection: sourceSection || 'Untitled',
    sourceText: cleanText(sourceText || text),
    confidence,
  }
}

function splitCompactList(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  if (normalized.includes(' | ')) {
    return normalized.split('|').map((item) => item.trim()).filter(Boolean)
  }
  if (normalized.includes(' • ')) {
    return normalized.split(' • ').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function dedupeItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    const textValue = typeof item === 'string' ? item : item?.text || ''
    const key = normalizeText(textValue).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

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

function normalizeItem(value, category, sourceSection, sourceText) {
  if (typeof value === 'string') {
    return makeItem(value, category, sourceSection, sourceText, 0.8)
  }
  if (value && typeof value === 'object') {
    return {
      ...value,
      id: value.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: value.category || category,
      text: cleanText(value.text || ''),
      sourceSection: value.sourceSection || sourceSection || 'Untitled',
      sourceText: cleanText(value.sourceText || value.text || ''),
      confidence: value.confidence ?? 0.8,
    }
  }
  return null
}

function normalizeStringList(items) {
  if (!Array.isArray(items)) {
    if (typeof items === 'string' && items.trim()) return [cleanText(items)]
    return []
  }

  return items
    .map((item) => {
      if (typeof item === 'string') return cleanText(item)
      if (item && typeof item === 'object') return cleanText(item.text || item.value || '')
      return ''
    })
    .filter(Boolean)
}

function normalizeList(items = [], category, sourceSection, sourceText) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => normalizeItem(item, category, sourceSection, sourceText))
    .filter(Boolean)
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
      coreValues: normalizeStringList(profile.mission?.coreValues),
      definitionOfSuccess: profile.mission?.definitionOfSuccess ?? base.mission.definitionOfSuccess,
    },
    goals: {
      currentGoals: normalizeStringList(profile.goals?.currentGoals),
      longTermGoals: normalizeStringList(profile.goals?.longTermGoals),
      careerGoals: normalizeStringList(profile.goals?.careerGoals),
      financialGoals: normalizeStringList(profile.goals?.financialGoals),
      fitnessGoals: normalizeStringList(profile.goals?.fitnessGoals),
    },
    career: {
      currentWork: profile.career?.currentWork ?? base.career.currentWork,
      objectives: normalizeStringList(profile.career?.objectives),
    },
    finances: {
      currentSituation: profile.finances?.currentSituation ?? base.finances.currentSituation,
      objectives: normalizeStringList(profile.finances?.objectives),
    },
    relationships: {
      importantPeople: normalizeStringList(profile.relationships?.importantPeople),
    },
    projects: {
      activeProjects: normalizeStringList(profile.projects?.activeProjects),
    },
    routines: {
      dailyRoutine: profile.routines?.dailyRoutine ?? base.routines.dailyRoutine,
      responsibilities: normalizeStringList(profile.routines?.responsibilities),
    },
    challenges: normalizeStringList(profile.challenges),
    communication: {
      preferredStyle: profile.communication?.preferredStyle ?? base.communication.preferredStyle,
      assistantInstructions: profile.communication?.assistantInstructions ?? base.communication.assistantInstructions,
      preferences: normalizeStringList(profile.communication?.preferences),
    },
    uncategorizedNotes: normalizeStringList(profile.uncategorizedNotes),
    unassignedIntel: normalizeStringList(profile.unassignedIntel),
    extractedItems: normalizeList(profile.extractedItems, 'unassignedIntel', 'Extracted Items', ''),
    rawImport: profile.rawImport ?? base.rawImport,
  }
}

function extractItemsForSection(section, heading, sourceText) {
  const blocks = parseBlocks(section.lines)
  if (!blocks.length) return []

  const headingKey = normalizeHeading(heading)
  const sectionCategory = classifySection(heading)
  const items = []

  blocks.forEach((block) => {
    const text = normalizeText(block.text)
    if (!text) return

    const candidates = []
    const compactList = splitCompactList(text)
    if (compactList.length > 1) {
      compactList.forEach((entry) => candidates.push(entry))
    } else {
      candidates.push(text)
    }

    candidates.forEach((candidate) => {
      if (!candidate) return
      const category = sectionCategory || (headingKey.includes('task') ? 'tasks' : headingKey.includes('event') ? 'events' : 'unassignedIntel')
      items.push(makeItem(candidate, category, heading, sourceText, 0.9))
    })
  })

  return dedupeItems(items)
}

function assignItemToProfile(item, profile) {
  const text = cleanText(item?.text || '')
  if (!text) return

  switch (item.category) {
    case 'identity':
      profile.identity.background = profile.identity.background ? `${profile.identity.background}\n${text}` : text
      break
    case 'mission':
      profile.mission.personalMission = profile.mission.personalMission ? `${profile.mission.personalMission}\n${text}` : text
      break
    case 'values':
      profile.mission.coreValues.push(text)
      break
    case 'goals':
      profile.goals.currentGoals.push(text)
      break
    case 'career':
      profile.career.currentWork = profile.career.currentWork ? `${profile.career.currentWork}\n${text}` : text
      break
    case 'finances':
      profile.finances.currentSituation = profile.finances.currentSituation ? `${profile.finances.currentSituation}\n${text}` : text
      break
    case 'fitness':
      profile.goals.fitnessGoals.push(text)
      break
    case 'relationships':
      profile.relationships.importantPeople.push(text)
      break
    case 'projects':
      profile.projects.activeProjects.push(text)
      break
    case 'tasks':
      profile.routines.responsibilities.push(text)
      break
    case 'events':
      profile.uncategorizedNotes.push(text)
      break
    case 'communication':
      profile.communication.assistantInstructions = profile.communication.assistantInstructions ? `${profile.communication.assistantInstructions}\n${text}` : text
      break
    default:
      profile.unassignedIntel.push(text)
      break
  }
}

export function parseProfileText(text) {
  const sourceText = text || ''
  const sections = splitSections(sourceText)
  const profile = makeDefaultProfile()
  profile.rawImport = sourceText

  const extractedItems = []
  let sectionCount = 0

  sections.forEach((section) => {
    const heading = section.heading
    const blocks = parseBlocks(section.lines)
    if (!blocks.length) return

    sectionCount += 1
    const items = extractItemsForSection(section, heading, sourceText)
    items.forEach((item) => {
      extractedItems.push(item)
    })
  })

  extractedItems.forEach((item) => {
    assignItemToProfile(item, profile)
  })

  profile.extractedItems = extractedItems
  profile.mission.coreValues = dedupeItems(profile.mission.coreValues)
  profile.goals.currentGoals = dedupeItems(profile.goals.currentGoals)
  profile.goals.longTermGoals = dedupeItems(profile.goals.longTermGoals)
  profile.goals.careerGoals = dedupeItems(profile.goals.careerGoals)
  profile.goals.financialGoals = dedupeItems(profile.goals.financialGoals)
  profile.goals.fitnessGoals = dedupeItems(profile.goals.fitnessGoals)
  profile.career.objectives = dedupeItems(profile.career.objectives)
  profile.finances.objectives = dedupeItems(profile.finances.objectives)
  profile.relationships.importantPeople = dedupeItems(profile.relationships.importantPeople)
  profile.projects.activeProjects = dedupeItems(profile.projects.activeProjects)
  profile.routines.responsibilities = dedupeItems(profile.routines.responsibilities)
  profile.challenges = dedupeItems(profile.challenges)
  profile.communication.preferences = dedupeItems(profile.communication.preferences)
  profile.uncategorizedNotes = dedupeItems(profile.unassignedIntel)
  profile.unassignedIntel = dedupeItems(profile.unassignedIntel)

  return {
    profile: mergeProfileWithDefaults(profile),
    summary: {
      detectedSections: sectionCount,
      extractedFacts: extractedItems.length,
      uncategorizedNotes: profile.unassignedIntel.length,
    },
    sourceText,
  }
}
