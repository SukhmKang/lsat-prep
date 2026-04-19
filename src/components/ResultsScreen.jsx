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
        backgroundColor: '#ffffff',
        border: `1px solid ${wasCorrect ? '#b8dcc0' : isUnanswered ? '#d8d3cc' : '#f0c0c0'}`,
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
            backgroundColor: wasCorrect ? '#f0faf2' : isUnanswered ? '#f7f4f0' : '#fef2f2',
            color: wasCorrect ? '#2a6635' : isUnanswered ? '#a09888' : '#8a2828',
            border: `1px solid ${wasCorrect ? '#b8dcc0' : isUnanswered ? '#d8d3cc' : '#f0c0c0'}`,
          }}
        >
          {index + 1}
        </span>

        {/* Question snippet */}
        <span
          className="font-ui text-sm flex-1 truncate"
          style={{ color: '#706860' }}
        >
          {question.question.slice(0, 80)}{question.question.length > 80 ? '…' : ''}
        </span>

        {/* Status badge */}
        <span
          className="font-ui text-xs flex-shrink-0 font-semibold"
          style={{
            color: wasCorrect ? '#2a6635' : isUnanswered ? '#a09888' : '#8a2828',
          }}
        >
          {isUnanswered ? '—' : wasCorrect ? '✓' : `✗ ${answer.selectedChoice}→${question.answer}`}
        </span>

        <span style={{ color: '#d8d3cc', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 animate-fade-slide"
          style={{ borderTop: '1px solid #e8e4de' }}
        >
          {/* Stimulus */}
          {question.hasStimulus && (
            <div
              className="mt-3 p-3 rounded-lg mb-3"
              style={{ backgroundColor: '#efece7', border: '1px solid #e0dbd4' }}
            >
              <p className="font-body text-xs leading-relaxed" style={{ color: '#706860' }}>
                {question.stimulus}
              </p>
            </div>
          )}

          {/* Question */}
          <p className="font-ui text-sm leading-relaxed mb-3 mt-3" style={{ color: '#1a1714' }}>
            {question.question}
          </p>

          {/* Choices */}
          <div className="flex flex-col gap-1.5 mb-3">
            {CHOICE_LABELS.map(label => {
              const isCorrectAnswer = label === question.answer
              const isSelected = answer?.selectedChoice === label
              const style = isCorrectAnswer
                ? { bg: '#f0faf2', border: '#b8dcc0', color: '#2a6635', labelBg: '#2a6635', labelColor: '#ffffff' }
                : isSelected && !isCorrectAnswer
                  ? { bg: '#fef2f2', border: '#f0c0c0', color: '#8a2828', labelBg: '#8a2828', labelColor: '#ffffff' }
                  : { bg: '#f7f4f0', border: '#e8e4de', color: '#a09888', labelBg: '#e8e4de', labelColor: '#a09888' }

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
              style={{ backgroundColor: '#efece7', border: '1px solid #e0dbd4' }}
            >
              <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#a09888' }}>
                Explanation
              </p>
              <p className="font-body text-xs leading-relaxed" style={{ color: '#605850' }}>
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

  const scoreColor = pct >= 70 ? '#2a6635' : pct >= 50 ? '#1d4ed8' : '#8a2828'

  return (
    <div className="animate-fade-slide min-h-dvh" style={{ backgroundColor: '#f7f4f0' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#f7f4f0', borderBottom: '1px solid #e0dbd4' }}
      >
        <button
          onClick={onHome}
          className="font-ui text-sm transition-colors"
          style={{ color: '#a09888' }}
          onMouseEnter={e => e.target.style.color = '#1a1714'}
          onMouseLeave={e => e.target.style.color = '#a09888'}
        >
          ← Home
        </button>
        <button
          onClick={onRetry}
          className="font-ui text-xs font-semibold px-4 py-2 rounded-full transition-all"
          style={{ backgroundColor: '#ffffff', color: '#1d4ed8', border: '1px solid #d8d3cc' }}
        >
          Retry
        </button>
      </div>

      <div className="px-4 pb-24">
        {/* Score hero */}
        <div className="text-center pt-10 pb-8 animate-fade-slide-up">
          <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#a09888' }}>
            Session Complete
          </p>
          <div
            className="font-display inline-block mb-1"
            style={{ fontSize: 80, fontWeight: 700, lineHeight: 1, color: scoreColor, letterSpacing: '-0.02em' }}
          >
            {score.correct}
            <span className="font-display" style={{ fontSize: 40, color: '#d8d3cc', fontWeight: 400 }}>
              /{score.total}
            </span>
          </div>
          <div className="font-ui text-lg font-semibold mb-1" style={{ color: scoreColor }}>
            {pct}%
          </div>
          <div className="font-ui text-sm" style={{ color: '#a09888' }}>
            {unansweredCount > 0 && `${unansweredCount} unanswered · `}
            {formatTime(elapsedSeconds)} / {formatTime(timeLimitSeconds)}
          </div>
        </div>

        {/* Type breakdown */}
        {typeBreakdown.length > 0 && (
          <div
            className="mb-5 rounded-xl overflow-hidden animate-fade-slide delay-100"
            style={{ border: '1px solid #d8d3cc' }}
          >
            <div
              className="px-4 py-3"
              style={{ backgroundColor: '#efece7', borderBottom: '1px solid #e0dbd4' }}
            >
              <p className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#a09888' }}>
                By Question Type
              </p>
            </div>
            <div style={{ backgroundColor: '#ffffff' }}>
              {typeBreakdown.map(({ type, correct, total, pct: typePct }, i) => (
                <div
                  key={type}
                  className="px-4 py-3"
                  style={{ borderBottom: i < typeBreakdown.length - 1 ? '1px solid #e8e4de' : 'none' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-ui text-sm" style={{ color: '#1a1714' }}>{type}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-xs" style={{ color: '#a09888' }}>
                        {correct}/{total}
                      </span>
                      <span
                        className="font-ui text-sm font-semibold"
                        style={{ color: typePct >= 70 ? '#2a6635' : typePct >= 50 ? '#1d4ed8' : '#8a2828', minWidth: 36, textAlign: 'right' }}
                      >
                        {typePct}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 3, backgroundColor: '#e8e4de' }}
                  >
                    <div
                      className="h-full rounded-full animate-progress-fill"
                      style={{
                        width: `${typePct}%`,
                        backgroundColor: typePct >= 70 ? '#2a6635' : typePct >= 50 ? '#1d4ed8' : '#8a2828',
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
            style={{ color: '#a09888' }}
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
          background: 'linear-gradient(to top, #f7f4f0 60%, transparent)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onHome}
          className="flex-1 py-3.5 rounded-2xl font-ui font-semibold text-sm transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#ffffff', color: '#706860', border: '1px solid #d8d3cc' }}
        >
          Home
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-3.5 rounded-2xl font-ui font-semibold text-sm transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }}
        >
          New Session →
        </button>
      </div>
    </div>
  )
}
