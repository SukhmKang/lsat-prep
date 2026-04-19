import React, { useState, useCallback, useRef } from 'react'
import HomeScreen from './components/HomeScreen'
import QuestionScreen from './components/QuestionScreen'
import TimedSession from './components/TimedSession'
import ResultsScreen from './components/ResultsScreen'
import { useProgress } from './hooks/useProgress'
import { questions, groupByPassage } from './utils/questionUtils'

const TIMED_HISTORY_KEY = 'lsat_timed_used_questions'

// Fisher-Yates shuffle (returns new array) — defined before use below

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

function buildTimedSessionQuestions(numQuestions, pool = questions) {
  const usedIds = new Set(loadTimedUsedQuestionIds())

  const lrPool = pool.filter(q => !q.passageKey)
  const rcPassages = [...groupByPassage(pool.filter(q => q.passageKey)).values()]

  const unseenLR = lrPool.filter(q => !usedIds.has(q.id))
  const unseenRC = rcPassages.filter(p => !p.some(q => usedIds.has(q.id)))

  // Each LR question and each RC passage is a "unit"; never split a passage
  const unseenUnits = shuffle([...unseenLR.map(q => [q]), ...unseenRC])
  const unseenCount = unseenUnits.reduce((s, u) => s + u.length, 0)

  if (unseenCount >= numQuestions) {
    // Greedily pick units; last RC passage may push slightly past numQuestions
    const sessionUnits = []
    let count = 0
    for (const unit of unseenUnits) {
      if (count >= numQuestions) break
      sessionUnits.push(unit)
      count += unit.length
    }
    const sessionQuestions = sessionUnits.flat()
    saveTimedUsedQuestionIds([...usedIds, ...sessionQuestions.map(q => q.id)])
    return sessionQuestions
  }

  // Pool exhausted — carry over all unseen, refill from used
  const carriedIds = new Set(unseenUnits.flatMap(u => u.map(q => q.id)))
  const usedLR = lrPool.filter(q => !carriedIds.has(q.id))
  const usedRC = rcPassages.filter(p => !p.some(q => carriedIds.has(q.id)))
  const refillUnits = shuffle([...usedLR.map(q => [q]), ...usedRC])

  const needed = numQuestions - unseenCount
  const freshUnits = []
  let freshCount = 0
  for (const unit of refillUnits) {
    if (freshCount >= needed) break
    freshUnits.push(unit)
    freshCount += unit.length
  }

  const freshQuestions = freshUnits.flat()
  saveTimedUsedQuestionIds(freshQuestions.map(q => q.id))
  return [...unseenUnits.flat(), ...freshQuestions]
}

export default function App() {
  const [screen, setScreen] = useState('home')  // 'home' | 'endless' | 'timed' | 'mistakes' | 'results'
  const [timedSession, setTimedSession] = useState(null)
  const [timedConfig, setTimedConfig] = useState(null)
  const [mistakesPool, setMistakesPool] = useState(null)

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
  const startTimed = useCallback(({ numQuestions, timeLimitSeconds, pool }) => {
    const sessionQuestions = buildTimedSessionQuestions(numQuestions, pool)

    setMistakesPool(null)
    setTimedConfig({ numQuestions, timeLimitSeconds, pool })
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

  // ── Mistakes mode ───────────────────────────────────────────────
  const startMistakes = useCallback((pool) => {
    setMistakesPool(pool)
    setTimedConfig(null)
    setTimedSession({
      questions: shuffle(pool),
      timeLimitSeconds: null,
      answers: {},
      elapsedSeconds: 0,
    })
    setScreen('mistakes')
  }, [])

  const retryMistakes = useCallback(() => {
    if (mistakesPool) startMistakes(mistakesPool)
  }, [mistakesPool, startMistakes])

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
            onStartMistakes={startMistakes}
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
                style={{ color: '#a09888' }}
                onMouseEnter={e => e.target.style.color = '#706860'}
                onMouseLeave={e => e.target.style.color = '#a09888'}
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

      {screen === 'mistakes' && timedSession && (
        <div key="mistakes-screen" className="animate-fade-slide" style={{ position: 'relative' }}>
          <TimedSession
            session={timedSession}
            onEnd={endTimed}
            onExit={goHome}
            untimed
          />
        </div>
      )}

      {screen === 'results' && timedSession && (
        <div key="results-screen" className="animate-fade-slide">
          <ResultsScreen
            session={timedSession}
            onRetry={mistakesPool ? retryMistakes : retryTimed}
            onHome={goHome}
          />
        </div>
      )}

    </div>
  )
}
