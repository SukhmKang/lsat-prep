import React from 'react'

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function Timer({ formattedTime, isUrgent, totalSeconds, secondsLeft }) {
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'animate-timer-pulse' : ''}`}>
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            stroke="#2a2d35"
            strokeWidth="3"
          />
          {/* Progress */}
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            stroke={isUrgent ? '#b84a4a' : '#b8952a'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-ui font-semibold text-sm"
          style={{
            color: isUrgent ? '#b84a4a' : '#b8952a',
            letterSpacing: '0.02em',
          }}
        >
          {formattedTime}
        </div>
      </div>
    </div>
  )
}
