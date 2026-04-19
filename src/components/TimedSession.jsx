import React, { useState, useRef, useCallback, useEffect } from 'react'
import QuestionScreen from './QuestionScreen'
import Timer from './Timer'
import { useTimer } from '../hooks/useTimer'

export default function TimedSession({ session, onEnd, onExit, untimed = false }) {
  const { questions, timeLimitSeconds } = session

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [revealed, setRevealed] = useState(false)

  // Use a ref for answers so the expire callback always has current data
  const answersRef = useRef({})

  const handleExpire = useCallback(() => {
    if (untimed) return
    onEnd({
      answers: { ...answersRef.current },
      elapsedSeconds: timeLimitSeconds,
    })
  }, [onEnd, timeLimitSeconds, untimed])

  const timer = useTimer(timeLimitSeconds ?? 999999, handleExpire)

  // Start timer on mount
  useEffect(() => {
    if (!untimed) timer.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (choice) => {
    if (revealed) return
    const q = questions[currentIndex]
    setSelectedChoice(choice)
    setRevealed(true)
    answersRef.current[q.id] = {
      selectedChoice: choice,
      wasCorrect: choice === q.answer,
    }
  }

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      // Session complete — all questions answered
      onEnd({
        answers: { ...answersRef.current },
        elapsedSeconds: timer.elapsedSeconds,
      })
      return
    }
    setCurrentIndex(i => i + 1)
    setSelectedChoice(null)
    setRevealed(false)
  }

  const question = questions[currentIndex]

  return (
    <QuestionScreen
      key={question.id}
      question={question}
      questionNumber={currentIndex + 1}
      totalQuestions={questions.length}
      mode="timed"
      onAnswer={handleAnswer}
      onNext={handleNext}
      timerNode={untimed ? null : (
        <Timer
          formattedTime={timer.formattedTime}
          isUrgent={timer.isUrgent}
          totalSeconds={timeLimitSeconds}
          secondsLeft={timer.secondsLeft}
        />
      )}
      exitNode={
        <button
          onClick={onExit}
          className="font-ui text-xs transition-colors self-center"
          style={{ color: '#a09888' }}
          onMouseEnter={e => e.target.style.color = '#706860'}
          onMouseLeave={e => e.target.style.color = '#a09888'}
        >
          End
        </button>
      }
    />
  )
}
