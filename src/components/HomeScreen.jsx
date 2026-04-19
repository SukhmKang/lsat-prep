import React, { useState, useMemo } from 'react'
import { questions, wrongQuestions, allSources, formatSourceLabel } from '../utils/questionUtils'

export default function HomeScreen({
  onStartEndless,
  onStartTimed,
  onStartMistakes,
  endlessState,        // { currentIndex, totalQuestions, totalAnswered }
  onResetProgress,
}) {
  const [mode, setMode] = useState('endless')
  const [numQuestions, setNumQuestions] = useState(20)
  const [showReset, setShowReset] = useState(false)
  const [selectedSources, setSelectedSources] = useState(() => new Set(allSources))

  const allSelected = selectedSources.size === allSources.length

  const toggleSource = (source) => {
    setSelectedSources(prev => {
      const next = new Set(prev)
      if (next.has(source)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedSources(new Set([allSources[0]]))
    } else {
      setSelectedSources(new Set(allSources))
    }
  }

  // Filtered pools based on selected sources
  const filteredPool = useMemo(
    () => questions.filter(q => selectedSources.has(q.source)),
    [selectedSources]
  )
  const filteredWrongPool = useMemo(
    () => wrongQuestions.filter(q => selectedSources.has(q.source)),
    [selectedSources]
  )

  const cappedNum = Math.min(numQuestions, filteredPool.length)
  const autoTimeLimitMin = Math.round(cappedNum * 1.33)
  const [timeLimitMin, setTimeLimitMin] = useState(autoTimeLimitMin)
  const [userOverrodeTime, setUserOverrodeTime] = useState(false)

  const handleNumChange = (val) => {
    const n = Math.max(5, Math.min(val, filteredPool.length))
    setNumQuestions(n)
    if (!userOverrodeTime) {
      setTimeLimitMin(Math.round(n * 1.33))
    }
  }

  const handleTimeLimitChange = (val) => {
    setTimeLimitMin(Math.max(1, val))
    setUserOverrodeTime(true)
  }

  const handleStartTimed = () => {
    onStartTimed({
      numQuestions: cappedNum,
      timeLimitSeconds: timeLimitMin * 60,
      pool: filteredPool,
    })
  }

  const handleStartEndless = () => {
    onStartEndless()
  }

  const handleStartMistakes = () => {
    if (filteredWrongPool.length === 0) return
    onStartMistakes(filteredWrongPool)
  }

  const { currentIndex, totalQuestions, totalAnswered } = endlessState
  const resumeLabel = `Resume at Q ${currentIndex + 1} / ${totalQuestions}`

  const showFilter = mode === 'timed' || mode === 'mistakes'

  return (
    <div className="animate-fade-slide min-h-dvh flex flex-col" style={{ backgroundColor: '#f7f4f0' }}>
      {/* Mode tabs */}
      <div className="px-5 pt-8">
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: '#eeebe6' }}
        >
          {['endless', 'timed', 'mistakes'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 rounded-lg font-ui text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: mode === m ? '#1d4ed8' : 'transparent',
                color: mode === m ? '#ffffff' : '#a09888',
              }}
            >
              {m === 'endless' ? 'Endless' : m === 'timed' ? 'Timed' : 'Mistakes'}
            </button>
          ))}
        </div>
      </div>

      {/* Test filter bubbles — shown for Timed and Mistakes */}
      {showFilter && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#a09888' }}>
              Tests
            </span>
            <button
              onClick={toggleAll}
              className="font-ui text-xs transition-colors"
              style={{ color: '#1d4ed8' }}
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allSources.map(source => {
              const active = selectedSources.has(source)
              return (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className="py-1.5 rounded-full font-ui text-xs font-semibold transition-all duration-150 text-center"
                  style={{
                    width: '4.5rem',
                    backgroundColor: active ? '#1d4ed8' : '#ffffff',
                    color: active ? '#ffffff' : '#a09888',
                    border: active ? 'none' : '1px solid #d8d3cc',
                  }}
                >
                  {formatSourceLabel(source)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-5 pt-5 pb-8">
        {mode === 'endless' ? (
          <div className="animate-fade-slide flex flex-col gap-5">
            {/* Resume info */}
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#ffffff', border: '1px solid #e0dbd4' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#a09888' }}>
                    Progress
                  </p>
                  <p className="font-ui text-sm font-medium" style={{ color: '#1a1714' }}>
                    {resumeLabel}
                  </p>
                </div>
                {totalAnswered > 0 && (
                  <button
                    onClick={() => setShowReset(true)}
                    className="font-ui text-xs transition-colors"
                    style={{ color: '#a09888' }}
                    onMouseEnter={e => e.target.style.color = '#8a2828'}
                    onMouseLeave={e => e.target.style.color = '#a09888'}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {totalQuestions > 0 && (
                <div
                  className="mt-3 rounded-full overflow-hidden"
                  style={{ height: 3, backgroundColor: '#e8e4de' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(currentIndex / totalQuestions) * 100}%`,
                      backgroundColor: '#1d4ed8',
                      opacity: 0.6,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={handleStartEndless}
              className="w-full py-4 rounded-2xl font-ui font-semibold text-base transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {totalAnswered > 0 ? 'Continue Drilling' : 'Start Drilling'}
            </button>

            {/* Reset confirm */}
            {showReset && (
              <div
                className="p-4 rounded-xl animate-scale-in"
                style={{ backgroundColor: '#fef2f2', border: '1px solid #f0c0c0' }}
              >
                <p className="font-ui text-sm mb-3" style={{ color: '#8a2828' }}>
                  Reset all endless mode progress? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onResetProgress(); setShowReset(false) }}
                    className="flex-1 py-2.5 rounded-xl font-ui text-sm font-semibold"
                    style={{ backgroundColor: '#8a2828', color: '#fff' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowReset(false)}
                    className="flex-1 py-2.5 rounded-xl font-ui text-sm"
                    style={{ backgroundColor: '#ffffff', color: '#706860', border: '1px solid #d8d3cc' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'timed' ? (
          <div key="timed" className="animate-fade-slide flex flex-col gap-5">
            {/* Config */}
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#ffffff', border: '1px solid #d8d3cc' }}
            >
              {/* Questions slider */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#a09888' }}>
                    Questions
                  </label>
                  <span className="font-display text-2xl font-semibold" style={{ color: '#1a1714' }}>
                    {cappedNum}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={filteredPool.length}
                  value={cappedNum}
                  onChange={e => handleNumChange(Number(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: '#1d4ed8',
                    height: 4,
                  }}
                />
                <div className="flex justify-between mt-1">
                  <span className="font-ui text-xs" style={{ color: '#a09888' }}>5</span>
                  <span className="font-ui text-xs" style={{ color: '#a09888' }}>{filteredPool.length} available</span>
                </div>
              </div>

              {/* Time limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#a09888' }}>
                    Time limit
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={timeLimitMin}
                      onChange={e => handleTimeLimitChange(Number(e.target.value))}
                      className="font-display text-2xl font-semibold text-right rounded-lg px-2 py-0.5 w-16"
                      style={{
                        backgroundColor: '#f7f4f0',
                        border: '1px solid #d8d3cc',
                        color: '#1a1714',
                        outline: 'none',
                      }}
                    />
                    <span className="font-ui text-sm" style={{ color: '#a09888' }}>min</span>
                  </div>
                </div>
                <p className="font-ui text-xs" style={{ color: '#a09888' }}>
                  LSAT pace ≈ {Math.round(cappedNum * 1.33)} min · ~1 min 20 sec per question
                </p>
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartTimed}
              className="w-full py-4 rounded-2xl font-ui font-semibold text-base transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Begin Timed Session →
            </button>
          </div>
        ) : (
          <div key="mistakes" className="animate-fade-slide flex flex-col gap-5">
            {/* Wrong question count */}
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#ffffff', border: '1px solid #d8d3cc' }}
            >
              <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#a09888' }}>
                Wrong answers
              </p>
              {filteredWrongPool.length > 0 ? (
                <p className="font-ui text-sm font-medium" style={{ color: '#1a1714' }}>
                  {filteredWrongPool.length} question{filteredWrongPool.length !== 1 ? 's' : ''} from {selectedSources.size} test{selectedSources.size !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="font-ui text-sm" style={{ color: '#a09888' }}>
                  No wrong answers in the selected tests.
                </p>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={handleStartMistakes}
              disabled={filteredWrongPool.length === 0}
              className="w-full py-4 rounded-2xl font-ui font-semibold text-base transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: filteredWrongPool.length > 0 ? '#1d4ed8' : '#eeebe6',
                color: filteredWrongPool.length > 0 ? '#ffffff' : '#a09888',
                cursor: filteredWrongPool.length > 0 ? 'pointer' : 'not-allowed',
                border: filteredWrongPool.length === 0 ? '1px solid #d8d3cc' : 'none',
              }}
            >
              Drill Mistakes →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
