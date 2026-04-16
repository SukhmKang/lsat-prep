/**
 * Compute score and per-type breakdown from a timed session.
 *
 * @param {Array}  questions  - The session's question array (each has .effectiveType)
 * @param {Object} answers    - { [questionId]: { selectedChoice, wasCorrect } }
 * @returns {{ score, typeBreakdown, unansweredCount }}
 */
export function computeResults(questions, answers) {
  let correct = 0
  let answered = 0
  const byType = {}

  for (const q of questions) {
    const a = answers[q.id]
    if (!a) continue  // timer expired before this question was answered

    answered++
    if (a.wasCorrect) correct++

    const type = q.effectiveType
    if (!byType[type]) byType[type] = { type, correct: 0, total: 0 }
    byType[type].total++
    if (a.wasCorrect) byType[type].correct++
  }

  const typeBreakdown = Object.values(byType)
    .map(t => ({ ...t, pct: t.total > 0 ? Math.round(100 * t.correct / t.total) : 0 }))
    .sort((a, b) => a.pct - b.pct)  // worst first

  return {
    score: { correct, total: questions.length, answered },
    typeBreakdown,
    unansweredCount: questions.length - answered,
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
