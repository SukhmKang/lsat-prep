import rawQuestions from '../questions.json'

// Canonical display labels for known lsat_type values
const TYPE_CANONICAL = {
  'reading_comprehension': 'Reading Comprehension',
  'must_be_true':          'Must Be True',
  'cannot_be_true':        'Cannot Be True',
  'inference':             'Must Be True',
  'main_point':            'Main Point',
  'assumption':            'Assumption',
  'necessary_assumption':  'Necessary Assumption',
  'sufficient_assumption': 'Sufficient Assumption',
  'sufficient_necessary':  'Sufficient/Necessary',
  'strengthen':            'Strengthen',
  'weaken':                'Weaken',
  'flaw':                  'Flaw',
  'evaluate':              'Evaluate',
  'parallel':              'Parallel Reasoning',
  'parallel_reasoning':    'Parallel Reasoning',
  'parallel_flaw':         'Parallel Flaw',
  'paradox':               'Resolve Paradox',
  'resolve_paradox':       'Resolve Paradox',
  'conclusion':            'Conclusion',
  'principle':             'Principle',
  'method of argument':    'Method of Argument',
  'method_of_reasoning':   'Method of Argument',
  'role of fact':          'Role of a Fact',
  'point of contention':   'Point of Disagreement',
  'point_of_disagreement': 'Point of Disagreement',
  'except':                'EXCEPT Variant',
}

function inferTypeFromQuestion(questionText) {
  if (!questionText) return 'Unclassified'
  const q = questionText.toLowerCase()
  if (q.includes('most weakens') || (q.includes('weaken') && !q.includes('strengthen'))) return 'Weaken'
  if (q.includes('most strengthens') || (q.includes('strengthen') && !q.includes('weaken'))) return 'Strengthen'
  if (q.includes('assumption') || q.includes('assumes')) return 'Assumption'
  if (q.includes('flaw') || q.includes('vulnerable to criticism') || q.includes('questionable reasoning') || q.includes('reasoning is flawed')) return 'Flaw'
  if (q.includes('main conclusion') || q.includes('main point') || q.includes('overall conclusion')) return 'Main Point'
  if (q.includes('must be true') || q.includes('most strongly supported') || q.includes('most strongly support') || q.includes('can be properly inferred')) return 'Must Be True'
  if (q.includes('cannot be true') || q.includes('must be false')) return 'Cannot Be True'
  if (q.includes('conclusion') || q.includes('concludes') || q.includes('is arguing')) return 'Conclusion'
  if (q.includes('parallel')) return 'Parallel Reasoning'
  if (q.includes('resolve') || q.includes('explain') && q.includes('discrepancy') || q.includes('explain the') && q.includes('paradox')) return 'Resolve Paradox'
  if (q.includes('principle') || q.includes('conforms to the principle')) return 'Principle'
  if (q.includes('method') || q.includes('technique') || q.includes('proceeds by') || q.includes('is structured')) return 'Method of Argument'
  if (q.includes('role') && (q.includes('statement') || q.includes('claim') || q.includes('serves'))) return 'Role of a Fact'
  if (q.includes('disagree') || q.includes('contention') || q.includes('at issue') || q.includes('point of disagreement')) return 'Point of Disagreement'
  if (q.includes('evaluate') || q.includes('most useful to know')) return 'Evaluate'
  if (q.includes('except')) return 'EXCEPT Variant'
  return 'Unclassified'
}

const VALID_CHOICES = new Set(['A', 'B', 'C', 'D', 'E'])

// Pre-pass: map each RC passage stimulus to the first question ID that shares it
const stimulusFirstId = new Map()
rawQuestions.forEach(q => {
  if (q.lsat_type === 'reading_comprehension' && q.stimulus && !stimulusFirstId.has(q.stimulus)) {
    stimulusFirstId.set(q.stimulus, q.id)
  }
})

export const questions = rawQuestions
  .filter(q => q.answer && VALID_CHOICES.has(q.answer))
  .map(q => {
    const rawType = (q.lsat_type || '').trim().toLowerCase()
    const effectiveType = rawType
      ? (TYPE_CANONICAL[rawType] ?? q.lsat_type)
      : inferTypeFromQuestion(q.question)

    const stimulus = q.stimulus?.replace(/^Question Prompt Passage\s*\n\n?/, '').trim() ?? ''
    const passageKey = q.lsat_type === 'reading_comprehension'
      ? (stimulusFirstId.get(q.stimulus) ?? null)
      : null
    return {
      ...q,
      stimulus,
      effectiveType,
      hasStimulus: Boolean(stimulus),
      passageKey,
    }
  })

export function groupByPassage(pool) {
  const groups = new Map()
  for (const q of pool) {
    if (!q.passageKey) continue
    if (!groups.has(q.passageKey)) groups.set(q.passageKey, [])
    groups.get(q.passageKey).push(q)
  }
  return groups
}

export const wrongQuestions = questions.filter(q => q.correct === false)

export const allSources = [...new Set(questions.map(q => q.source).filter(Boolean))].sort()

export function formatSourceLabel(source) {
  const match = source.match(/(\d+)$/)
  return match ? `PT ${match[1]}` : source
}
