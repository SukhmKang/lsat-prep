import React, { useState, useMemo } from 'react'
import { questions } from '../utils/questionUtils'

export default function HomeScreen({
  onStartEndless,
  onStartTimed,
  endlessState,        // { currentIndex, totalQuestions, totalAnswered }
  onResetProgress,
}) {
  const [mode, setMode] = useState('endless')
  const [numQuestions, setNumQuestions] = useState(20)
  const [showReset, setShowReset] = useState(false)

  const timedPool = useMemo(() => questions, [])

  const cappedNum = Math.min(numQuestions, timedPool.length)
  const autoTimeLimitMin = Math.round(cappedNum * 1.33)
  const [timeLimitMin, setTimeLimitMin] = useState(autoTimeLimitMin)

  // Keep time limit in sync with num questions unless user overrides
  const [userOverrodeTime, setUserOverrodeTime] = useState(false)

  const handleNumChange = (val) => {
    const n = Math.max(5, Math.min(val, timedPool.length))
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
    })
  }

  const handleStartEndless = () => {
    onStartEndless()
  }

  const { currentIndex, totalQuestions, totalAnswered } = endlessState
  const resumeLabel = `Resume at Q ${currentIndex + 1} / ${totalQuestions}`

  return (
    <div className="animate-fade-slide min-h-dvh flex flex-col" style={{ backgroundColor: '#111318' }}>
      {/* Mode tabs */}
      <div className="px-5 pt-8">
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: '#1a1d24' }}
        >
          {['endless', 'timed'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 rounded-lg font-ui text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: mode === m ? '#b8952a' : 'transparent',
                color: mode === m ? '#111318' : '#5a5448',
              }}
            >
              {m === 'endless' ? 'Endless' : 'Timed'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-5 pb-8">
        {mode === 'endless' ? (
          <div className="animate-fade-slide flex flex-col gap-5">
            {/* Resume info */}
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#141720', border: '1px solid #1e2228' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-ui text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#5a5448' }}>
                    Progress
                  </p>
                  <p className="font-ui text-sm font-medium" style={{ color: '#e8dfc8' }}>
                    {resumeLabel}
                  </p>
                </div>
                {totalAnswered > 0 && (
                  <button
                    onClick={() => setShowReset(true)}
                    className="font-ui text-xs transition-colors"
                    style={{ color: '#5a5448' }}
                    onMouseEnter={e => e.target.style.color = '#b84a4a'}
                    onMouseLeave={e => e.target.style.color = '#5a5448'}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {totalQuestions > 0 && (
                <div
                  className="mt-3 rounded-full overflow-hidden"
                  style={{ height: 3, backgroundColor: '#1e2028' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(currentIndex / totalQuestions) * 100}%`,
                      backgroundColor: '#b8952a',
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
                backgroundColor: '#b8952a',
                color: '#111318',
                cursor: 'pointer',
              }}
            >
              {totalAnswered > 0 ? 'Continue Drilling' : 'Start Drilling'}
            </button>

            {/* Reset confirm */}
            {showReset && (
              <div
                className="p-4 rounded-xl animate-scale-in"
                style={{ backgroundColor: '#201212', border: '1px solid #4a2020' }}
              >
                <p className="font-ui text-sm mb-3" style={{ color: '#d4a0a0' }}>
                  Reset all endless mode progress? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onResetProgress(); setShowReset(false) }}
                    className="flex-1 py-2.5 rounded-xl font-ui text-sm font-semibold"
                    style={{ backgroundColor: '#b84a4a', color: '#fff' }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowReset(false)}
                    className="flex-1 py-2.5 rounded-xl font-ui text-sm"
                    style={{ backgroundColor: '#1a1d24', color: '#8a8070', border: '1px solid #2a2d35' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div key="timed" className="animate-fade-slide flex flex-col gap-5">
            {/* Config */}
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#1a1d24', border: '1px solid #2a2d35' }}
            >
              {/* Questions slider */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#5a5448' }}>
                    Questions
                  </label>
                  <span className="font-display text-2xl font-semibold" style={{ color: '#e8dfc8' }}>
                    {cappedNum}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={timedPool.length}
                  value={cappedNum}
                  onChange={e => handleNumChange(Number(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: '#b8952a',
                    height: 4,
                  }}
                />
                <div className="flex justify-between mt-1">
                  <span className="font-ui text-xs" style={{ color: '#5a5448' }}>5</span>
                  <span className="font-ui text-xs" style={{ color: '#5a5448' }}>{timedPool.length} available</span>
                </div>
              </div>

              {/* Time limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-ui text-xs font-semibold tracking-widest uppercase" style={{ color: '#5a5448' }}>
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
                        backgroundColor: '#141720',
                        border: '1px solid #2a2d35',
                        color: '#e8dfc8',
                        outline: 'none',
                      }}
                    />
                    <span className="font-ui text-sm" style={{ color: '#5a5448' }}>min</span>
                  </div>
                </div>
                <p className="font-ui text-xs" style={{ color: '#5a5448' }}>
                  LSAT pace ≈ {Math.round(cappedNum * 1.33)} min · ~1 min 20 sec per question
                </p>
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartTimed}
              className="w-full py-4 rounded-2xl font-ui font-semibold text-base transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: '#b8952a',
                color: '#111318',
                cursor: 'pointer',
              }}
            >
              Begin Timed Session →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
