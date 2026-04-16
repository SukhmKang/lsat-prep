import React, { useState, useRef, useCallback, useEffect } from 'react'
import QuestionScreen from './QuestionScreen'
import Timer from './Timer'
import { useTimer } from '../hooks/useTimer'

export default function TimedSession({ session, onEnd, onExit }) {
  const { questions, timeLimitSeconds } = session

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [revealed, setRevealed] = useState(false)

  // Use a ref for answers so the expire callback always has current data
  const answersRef = useRef({})

  const handleExpire = useCallback(() => {
    onEnd({
      answers: { ...answersRef.current },
      elapsedSeconds: timeLimitSeconds,
    })
  }, [onEnd, timeLimitSeconds])

  const timer = useTimer(timeLimitSeconds, handleExpire)

  // Start timer on mount
  useEffect(() => {
    timer.start()
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
      timerNode={
        <Timer
          formattedTime={timer.formattedTime}
          isUrgent={timer.isUrgent}
          totalSeconds={timeLimitSeconds}
          secondsLeft={timer.secondsLeft}
        />
      }
      exitNode={
        <button
          onClick={onExit}
          className="font-ui text-xs transition-colors self-center"
          style={{ color: '#5a5448' }}
          onMouseEnter={e => e.target.style.color = '#8a8070'}
          onMouseLeave={e => e.target.style.color = '#5a5448'}
        >
          End
        </button>
      }
    />
  )
}
