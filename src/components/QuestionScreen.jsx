import React, { useState } from 'react'

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E']

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ChoiceCard({ label, text, state, onClick, disabled }) {
  // state: 'default' | 'correct' | 'incorrect' | 'correct-reveal'
  const isCorrect = state === 'correct'
  const isIncorrect = state === 'incorrect'
  const isReveal = state === 'correct-reveal'

  const getBg = () => {
    if (isCorrect || isReveal) return '#162018'
    if (isIncorrect) return '#201212'
    return '#1a1d24'
  }

  const getBorder = () => {
    if (isCorrect || isReveal) return '#2a4a30'
    if (isIncorrect) return '#4a2020'
    return '#2a2d35'
  }

  const getLabelBg = () => {
    if (isCorrect || isReveal) return '#5a8a6a'
    if (isIncorrect) return '#b84a4a'
    return '#2a2d35'
  }

  const getLabelColor = () => {
    if (isCorrect || isReveal || isIncorrect) return '#111318'
    return '#8a8070'
  }

  const getTextColor = () => {
    if (isCorrect || isReveal) return '#a8d4b0'
    if (isIncorrect) return '#d4a0a0'
    return '#e8dfc8'
  }

  const icon = isCorrect || isReveal
    ? <CheckIcon />
    : isIncorrect
      ? <XIcon />
      : null

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-xl p-4 transition-all duration-150 flex items-start gap-3 group ${
        !disabled ? 'active:scale-[0.985]' : ''
      } ${(isCorrect || isReveal) ? 'animate-choice-bounce' : ''}`}
      style={{
        backgroundColor: getBg(),
        border: `1.5px solid ${getBorder()}`,
        cursor: disabled ? 'default' : 'pointer',
        minHeight: 56,
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.borderColor = '#3a3d4a'
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.borderColor = getBorder()
      }}
    >
      {/* Letter badge */}
      <span
        className="font-ui font-semibold text-xs rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-150"
        style={{
          width: 28,
          height: 28,
          backgroundColor: getLabelBg(),
          color: getLabelColor(),
          marginTop: 1,
        }}
      >
        {label}
      </span>
      {/* Text */}
      <span
        className="font-ui text-sm leading-relaxed flex-1 transition-colors duration-150"
        style={{ color: getTextColor() }}
      >
        {text}
      </span>
      {/* Icon */}
      {icon && (
        <span
          className="flex-shrink-0 mt-0.5 transition-colors duration-150"
          style={{ color: isCorrect || isReveal ? '#5a8a6a' : '#b84a4a' }}
        >
          {icon}
        </span>
      )}
    </button>
  )
}

export default function QuestionScreen({
  question,
  questionNumber,
  totalQuestions,
  mode,
  onAnswer,
  onNext,
  timerNode,
  exitNode,
}) {
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const handleChoiceTap = (choice) => {
    if (revealed) return
    setSelectedChoice(choice)
    setRevealed(true)
    onAnswer(choice)
  }

  const getChoiceState = (label) => {
    if (!revealed) return 'default'
    if (label === question.answer) {
      return selectedChoice === label ? 'correct' : 'correct-reveal'
    }
    if (label === selectedChoice) return 'incorrect'
    return 'default'
  }

  const isCorrect = revealed && selectedChoice === question.answer
  const progress = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0

  return (
    <div key={question.id} className="animate-fade-slide min-h-dvh flex flex-col" style={{ backgroundColor: '#111318' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#111318', borderBottom: '1px solid #1e2028' }}
      >
        <div className="flex items-center gap-3">
          {/* Progress bar + counter */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-ui text-xs font-semibold" style={{ color: '#b8952a' }}>
                {questionNumber}
              </span>
              <span className="font-ui text-xs" style={{ color: '#5a5448' }}>
                / {totalQuestions}
              </span>
            </div>
            {/* Thin progress bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 140, height: 2, backgroundColor: '#1e2028' }}
            >
              <div
                className="h-full rounded-full animate-progress-fill"
                style={{
                  width: `${progress}%`,
                  backgroundColor: '#b8952a',
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          {timerNode}
          {exitNode}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Stimulus */}
        {question.hasStimulus && (
          <div
            className="mt-6 mb-4 p-4 rounded-xl"
            style={{
              backgroundColor: '#141720',
              border: '1px solid #1e2228',
            }}
          >
            <p
              className="font-body text-sm leading-[1.8] italic"
              style={{ color: '#c8c0ac' }}
            >
              {question.stimulus}
            </p>
          </div>
        )}

        {/* Question stem */}
        <div className={question.hasStimulus ? 'mb-5' : 'mt-6 mb-5'}>
          <p
            className="font-ui text-base leading-relaxed font-medium"
            style={{ color: '#e8dfc8' }}
          >
            {question.question}
          </p>
        </div>

        {/* Choices */}
        <div className="flex flex-col gap-2.5">
          {CHOICE_LABELS.map((label, i) => (
            <div
              key={label}
              className="animate-fade-slide"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <ChoiceCard
                label={label}
                text={question.choices[label]}
                state={getChoiceState(label)}
                onClick={() => handleChoiceTap(label)}
                disabled={revealed}
              />
            </div>
          ))}
        </div>

        {/* Explanation */}
        {revealed && (
          <div
            className="mt-5 animate-fade-slide-up"
            style={{ animationDelay: '80ms' }}
          >
            {/* Result banner */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl"
              style={{
                backgroundColor: isCorrect ? '#162018' : '#201212',
                border: `1px solid ${isCorrect ? '#2a4a30' : '#4a2020'}`,
                borderBottom: 'none',
              }}
            >
              <span style={{ color: isCorrect ? '#5a8a6a' : '#b84a4a', fontSize: 18 }}>
                {isCorrect ? '✓' : '✗'}
              </span>
              <span
                className="font-ui text-sm font-semibold"
                style={{ color: isCorrect ? '#5a8a6a' : '#b84a4a' }}
              >
                {isCorrect ? 'Correct' : `Incorrect — Answer is ${question.answer}`}
              </span>
            </div>

            {/* Explanation body */}
            {question.explanation && (
              <details open>
                <summary
                  className="px-4 py-3 flex items-center justify-between font-ui text-xs font-semibold tracking-wider uppercase"
                  style={{
                    backgroundColor: '#161920',
                    border: '1px solid #1e2228',
                    color: '#5a5448',
                    userSelect: 'none',
                  }}
                >
                  Explanation
                  <span className="text-base" style={{ color: '#2a2d35' }}>↕</span>
                </summary>
                <div
                  className="px-4 py-4 rounded-b-xl"
                  style={{
                    backgroundColor: '#141720',
                    border: '1px solid #1e2228',
                    borderTop: 'none',
                  }}
                >
                  <p
                    className="font-body text-sm leading-[1.8]"
                    style={{ color: '#a09888' }}
                  >
                    {question.explanation}
                  </p>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Sticky Next button */}
      {revealed && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4 animate-fade-slide-up"
          style={{
            background: 'linear-gradient(to top, #111318 60%, transparent)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={onNext}
            className="w-full py-4 rounded-2xl font-ui font-semibold text-base transition-all duration-150 active:scale-[0.98]"
            style={{
              backgroundColor: '#b8952a',
              color: '#111318',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d4ab32'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#b8952a'}
          >
            Next Question →
          </button>
        </div>
      )}
    </div>
  )
}
