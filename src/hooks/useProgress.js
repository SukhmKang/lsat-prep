import { useState, useRef, useCallback } from 'react'
import { questions } from '../utils/questionUtils'

const STORAGE_KEY = 'lsat_endless_progress'
const SCHEMA_VERSION = 1

function getDefault() {
  return {
    currentIndex: 0,
    history: {},
    version: SCHEMA_VERSION,
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefault()
    const parsed = JSON.parse(raw)
    if (parsed.version !== SCHEMA_VERSION) return getDefault()
    return parsed
  } catch {
    return getDefault()
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage quota — fail silently
  }
}

export function useProgress() {
  const [progress, setProgressState] = useState(loadFromStorage)
  // Keep a ref for use in callbacks to avoid stale closures
  const progressRef = useRef(progress)

  const save = useCallback((next) => {
    progressRef.current = next
    setProgressState(next)
    saveToStorage(next)
  }, [])

  const totalQuestions = questions.length
  const safeIndex = totalQuestions === 0
    ? 0
    : Math.min(progress.currentIndex, totalQuestions - 1)

  const currentQuestion = questions[safeIndex] ?? null

  /**
   * Record a completed answer and advance to the next question.
   * Call this when user presses "Next" (not when they tap a choice).
   */
  const recordAnswer = useCallback((questionId, selectedChoice, correctAnswer) => {
    const prev = progressRef.current
    const idx = Math.min(prev.currentIndex, Math.max(0, questions.length - 1))
    const nextIndex = idx + 1 >= questions.length ? 0 : idx + 1
    save({
      ...prev,
      currentIndex: nextIndex,
      history: {
        ...prev.history,
        [questionId]: {
          answered: true,
          wasCorrect: selectedChoice === correctAnswer,
          selectedChoice,
          timestamp: Date.now(),
        },
      },
    })
  }, [save])

  const resetProgress = useCallback(() => {
    save(getDefault())
  }, [save])

  // Stats for HomeScreen
  const history = progress.history
  const totalAnswered = Object.keys(history).length
  const totalCorrect = Object.values(history).filter(h => h.wasCorrect).length

  return {
    currentQuestion,
    currentIndex: safeIndex,
    totalQuestions,
    history,
    totalAnswered,
    totalCorrect,
    recordAnswer,
    resetProgress,
  }
}
