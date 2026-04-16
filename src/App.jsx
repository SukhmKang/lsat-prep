import React, { useState, useCallback, useRef } from 'react'
import HomeScreen from './components/HomeScreen'
import QuestionScreen from './components/QuestionScreen'
import TimedSession from './components/TimedSession'
import ResultsScreen from './components/ResultsScreen'
import { useProgress } from './hooks/useProgress'
import { questions } from './utils/questionUtils'

const TIMED_HISTORY_KEY = 'lsat_timed_used_questions'

// Fisher-Yates shuffle (returns new array)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadTimedUsedQuestionIds() {
  try {
    const raw = localStorage.getItem(TIMED_HISTORY_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTimedUsedQuestionIds(questionIds) {
  try {
    localStorage.setItem(TIMED_HISTORY_KEY, JSON.stringify(questionIds))
  } catch {
    // localStorage quota — fail silently
  }
}

function buildTimedSessionQuestions(numQuestions) {
  const usedIds = new Set(loadTimedUsedQuestionIds())
  const unseenQuestions = questions.filter(question => !usedIds.has(question.id))

  if (unseenQuestions.length >= numQuestions) {
    const sessionQuestions = shuffle(unseenQuestions).slice(0, numQuestions)
    const nextUsedIds = [...usedIds, ...sessionQuestions.map(question => question.id)]

    saveTimedUsedQuestionIds(nextUsedIds)
    return sessionQuestions
  }

  const carriedOverQuestions = shuffle(unseenQuestions)
  const carriedOverIds = new Set(carriedOverQuestions.map(question => question.id))
  const refillPool = questions.filter(question => !carriedOverIds.has(question.id))
  const freshCycleQuestions = shuffle(refillPool).slice(0, numQuestions - carriedOverQuestions.length)

  saveTimedUsedQuestionIds(freshCycleQuestions.map(question => question.id))
  return [...carriedOverQuestions, ...freshCycleQuestions]
}

export default function App() {
  const [screen, setScreen] = useState('home')  // 'home' | 'endless' | 'timed' | 'results'
  const [timedSession, setTimedSession] = useState(null)
  const [timedConfig, setTimedConfig] = useState(null)

  const progress = useProgress()

  // ── Endless mode ───────────────────────────────────────────────
  // Store the pending choice so we can record it on Next press
  const pendingChoiceRef = useRef(null)

  const startEndless = useCallback(() => {
    pendingChoiceRef.current = null
    setScreen('endless')
  }, [])

  /**
   * Called when user taps a choice card.
   * Just stores the choice — don't advance the index yet so feedback can show.
   */
  const handleEndlessAnswer = useCallback((choice) => {
    pendingChoiceRef.current = choice
  }, [])

  /**
   * Called when user presses "Next Question".
   * Records the answer + advances index, which changes the question key → QuestionScreen remounts.
   */
  const handleEndlessNext = useCallback(() => {
    if (!progress.currentQuestion) return
    const choice = pendingChoiceRef.current
    if (choice) {
      progress.recordAnswer(
        progress.currentQuestion.id,
        choice,
        progress.currentQuestion.answer
      )
    }
    pendingChoiceRef.current = null
  }, [progress])

  // ── Timed mode ─────────────────────────────────────────────────
  const startTimed = useCallback(({ numQuestions, timeLimitSeconds }) => {
    const sessionQuestions = buildTimedSessionQuestions(numQuestions)

    setTimedConfig({ numQuestions, timeLimitSeconds })
    setTimedSession({
      questions: sessionQuestions,
      timeLimitSeconds,
      answers: {},
      elapsedSeconds: 0,
    })
    setScreen('timed')
  }, [])

  const endTimed = useCallback(({ answers, elapsedSeconds }) => {
    setTimedSession(prev => ({ ...prev, answers, elapsedSeconds }))
    setScreen('results')
  }, [])

  const retryTimed = useCallback(() => {
    if (timedConfig) startTimed(timedConfig)
  }, [timedConfig, startTimed])

  const goHome = useCallback(() => {
    setScreen('home')
    pendingChoiceRef.current = null
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', minHeight: '100dvh' }}>

      {screen === 'home' && (
        <div key="home" className="animate-fade-slide">
          <HomeScreen
            onStartEndless={startEndless}
            onStartTimed={startTimed}
            endlessState={{
              currentIndex: progress.currentIndex,
              totalQuestions: progress.totalQuestions,
              totalAnswered: progress.totalAnswered,
            }}
            onResetProgress={progress.resetProgress}
          />
        </div>
      )}

      {screen === 'endless' && progress.currentQuestion && (
        <div key="endless-screen" style={{ position: 'relative' }}>
          <QuestionScreen
            key={progress.currentQuestion.id}
            question={progress.currentQuestion}
            questionNumber={progress.currentIndex + 1}
            totalQuestions={progress.totalQuestions}
            mode="endless"
            onAnswer={handleEndlessAnswer}
            onNext={handleEndlessNext}
            timerNode={null}
            exitNode={
              <button
                onClick={goHome}
                className="font-ui text-xs transition-colors self-center"
                style={{ color: '#5a5448' }}
                onMouseEnter={e => e.target.style.color = '#8a8070'}
                onMouseLeave={e => e.target.style.color = '#5a5448'}
              >
                ✕
              </button>
            }
          />
        </div>
      )}

      {screen === 'timed' && timedSession && (
        <div key="timed-screen" className="animate-fade-slide" style={{ position: 'relative' }}>
          <TimedSession
            session={timedSession}
            onEnd={endTimed}
            onExit={goHome}
          />
        </div>
      )}

      {screen === 'results' && timedSession && (
        <div key="results-screen" className="animate-fade-slide">
          <ResultsScreen
            session={timedSession}
            onRetry={retryTimed}
            onHome={goHome}
          />
        </div>
      )}

    </div>
  )
}
