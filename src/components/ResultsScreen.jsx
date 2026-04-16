import React, { useState } from 'react'
import { computeResults, formatTime } from '../utils/computeResults'

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E']

function QuestionReviewItem({ question, answer, index }) {
  const [open, setOpen] = useState(false)
  const wasCorrect = answer?.wasCorrect
  const isUnanswered = !answer

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: '#1a1d24',
        border: `1px solid ${wasCorrect ? '#2a4a30' : isUnanswered ? '#2a2d35' : '#4a2020'}`,
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {/* Number */}
        <span
          className="font-ui text-xs font-semibold flex-shrink-0 rounded-md flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            backgroundColor: wasCorrect ? '#162018' : isUnanswered ? '#1a1d24' : '#201212',
            color: wasCorrect ? '#5a8a6a' : isUnanswered ? '#5a5448' : '#b84a4a',
            border: `1px solid ${wasCorrect ? '#2a4a30' : isUnanswered ? '#2a2d35' : '#4a2020'}`,
          }}
        >
          {index + 1}
        </span>

        {/* Question snippet */}
        <span
          className="font-ui text-sm flex-1 truncate"
          style={{ color: '#8a8070' }}
        >
          {question.question.slice(0, 80)}{question.question.length > 80 ? '…' : ''}
        </span>

        {/* Status badge */}
        <span
          className="font-ui text-xs flex-shrink-0 font-semibold"
          style={{
            color: wasCorrect ? '#5a8a6a' : isUnanswered ? '#5a5448' : '#b84a4a',
          }}
        >
          {isUnanswered ? '—' : wasCorrect ? '✓' : `✗ ${answer.selectedChoice}→${question.answer}`}
        </span>

        <span style={{ color: '#2a2d35', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 animate-fade-slide"
          style={{ borderTop: '1px solid #1e2228' }}
        >
          {/* Stimulus */}
          {question.hasStimulus && (
            <div
              className="mt-3 p-3 rounded-lg mb-3"
              style={{ backgroundColor: '#141720', border: '1px solid #1e2228' }}
            >
              <p className="font-body text-xs leading-relaxed italic" style={{ color: '#8a8070' }}>
                {question.stimulus}
              </p>
            </div>
          )}

          {/* Question */}
          <p className="font-ui text-sm leading-relaxed mb-3 mt-3" style={{ color: '#c8c0ac' }}>
            {question.question}
          </p>

          {/* Choices */}
          <div className="flex flex-col gap-1.5 mb-3">
            {CHOICE_LABELS.map(label => {
              const isCorrectAnswer = label === question.answer
              const isSelected = answer?.selectedChoice === label
              const style = isCorrectAnswer
                ? { bg: '#162018', border: '#2a4a30', color: '#a8d4b0', labelBg: '#5a8a6a', labelColor: '#111318' }
                : isSelected && !isCorrectAnswer
                  ? { bg: '#201212', border: '#4a2020', color: '#d4a0a0', labelBg: '#b84a4a', labelColor: '#111318' }
                  : { bg: '#141720', border: '#1e2228', color: '#5a5448', labelBg: '#1e2228', labelColor: '#5a5448' }

              return (
                <div
                  key={label}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                >
                  <span
                    className="font-ui font-semibold text-xs rounded flex-shrink-0 flex items-center justify-center"
                    style={{ width: 22, height: 22, backgroundColor: style.labelBg, color: style.labelColor, marginTop: 1 }}
                  >
                    {label}
                  </span>
                  <span className="font-ui text-xs leading-relaxed" style={{ color: style.color }}>
                    {question.choices[label]}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div
              className="px-3 py-3 rounded-lg"
              style={{ backgroundColor: '#141720', border: '1px solid #1e2228' }}
            >
              <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#5a5448' }}>
                Explanation
              </p>
              <p className="font-body text-xs leading-relaxed" style={{ color: '#8a8070' }}>
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResultsScreen({ session, onRetry, onHome }) {
  const { questions, answers, elapsedSeconds, timeLimitSeconds } = session
  const { score, typeBreakdown, unansweredCount } = computeResults(questions, answers)

  const pct = score.answered > 0
    ? Math.round((score.correct / score.answered) * 100)
    : 0

  const scoreColor = pct >= 70 ? '#5a8a6a' : pct >= 50 ? '#b8952a' : '#b84a4a'

  return (
    <div className="animate-fade-slide min-h-dvh" style={{ backgroundColor: '#111318' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#111318', borderBottom: '1px solid #1e2028' }}
      >
        <button
          onClick={onHome}
          className="font-ui text-sm transition-colors"
          style={{ color: '#5a5448' }}
          onMouseEnter={e => e.target.style.color = '#e8dfc8'}
          onMouseLeave={e => e.target.style.color = '#5a5448'}
        >
          ← Home
        </button>
        <button
          onClick={onRetry}
          className="font-ui text-xs font-semibold px-4 py-2 rounded-full transition-all"
          style={{ backgroundColor: '#1a1d24', color: '#b8952a', border: '1px solid #2a2d35' }}
        >
          Retry
        </button>
      </div>

      <div className="px-4 pb-24">
        {/* Score hero */}
        <div className="text-center pt-10 pb-8 animate-fade-slide-up">
          <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#5a5448' }}>
            Session Complete
          </p>
          <div
            className="font-display inline-block mb-1"
            style={{ fontSize: 80, fontWeight: 700, lineHeight: 1, color: scoreColor, letterSpacing: '-0.02em' }}
          >
            {score.correct}
            <span className="font-display" style={{ fontSize: 40, color: '#2a2d35', fontWeight: 400 }}>
              /{score.total}
            </span>
          </div>
          <div className="font-ui text-lg font-semibold mb-1" style={{ color: scoreColor }}>
            {pct}%
          </div>
          <div className="font-ui text-sm" style={{ color: '#5a5448' }}>
            {unansweredCount > 0 && `${unansweredCount} unanswered · `}
            {formatTime(elapsedSeconds)} / {formatTime(timeLimitSeconds)}
          </div>
        </div>

        {/* Type breakdown */}
        {typeBreakdown.length > 0 && (
          <div
            className="mb-5 rounded-xl overflow-hidden animate-fade-slide delay-100"
            style={{ border: '1px solid #2a2d35' }}
          >
            <div
              className="px-4 py-3"
              style={{ backgroundColor: '#141720', borderBottom: '1px solid #1e2228' }}
            >
              <p className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#5a5448' }}>
                By Question Type
              </p>
            </div>
            <div style={{ backgroundColor: '#1a1d24' }}>
              {typeBreakdown.map(({ type, correct, total, pct: typePct }, i) => (
                <div
                  key={type}
                  className="px-4 py-3"
                  style={{ borderBottom: i < typeBreakdown.length - 1 ? '1px solid #1e2228' : 'none' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-ui text-sm" style={{ color: '#c8c0ac' }}>{type}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-xs" style={{ color: '#5a5448' }}>
                        {correct}/{total}
                      </span>
                      <span
                        className="font-ui text-sm font-semibold"
                        style={{ color: typePct >= 70 ? '#5a8a6a' : typePct >= 50 ? '#b8952a' : '#b84a4a', minWidth: 36, textAlign: 'right' }}
                      >
                        {typePct}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 3, backgroundColor: '#1e2028' }}
                  >
                    <div
                      className="h-full rounded-full animate-progress-fill"
                      style={{
                        width: `${typePct}%`,
                        backgroundColor: typePct >= 70 ? '#5a8a6a' : typePct >= 50 ? '#b8952a' : '#b84a4a',
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question review */}
        <div className="animate-fade-slide delay-200">
          <p
            className="font-ui text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: '#5a5448' }}
          >
            Question Review
          </p>
          <div className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <QuestionReviewItem
                key={q.id}
                question={q}
                answer={answers[q.id]}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 flex gap-3"
        style={{
          background: 'linear-gradient(to top, #111318 60%, transparent)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onHome}
          className="flex-1 py-3.5 rounded-2xl font-ui font-semibold text-sm transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#1a1d24', color: '#8a8070', border: '1px solid #2a2d35' }}
        >
          Home
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-3.5 rounded-2xl font-ui font-semibold text-sm transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#b8952a', color: '#111318' }}
        >
          New Session →
        </button>
      </div>
    </div>
  )
}
