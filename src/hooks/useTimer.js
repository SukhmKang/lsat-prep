import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Wall-clock countdown timer. Uses Date.now() diff to avoid interval drift.
 * Ticks 4x/second for smooth MM:SS display.
 *
 * @param {number}   totalSeconds  - Duration of the countdown
 * @param {Function} onExpire      - Called once when timer reaches 0
 */
export function useTimer(totalSeconds, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [isRunning, setIsRunning] = useState(false)

  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)       // wall-clock timestamp when last resumed
  const elapsedBeforePauseRef = useRef(0) // accumulated elapsed seconds before last resume
  const onExpireRef = useRef(onExpire)
  const hasExpiredRef = useRef(false)

  // Keep onExpire ref current without recreating the timer
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const tick = useCallback(() => {
    const wallElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    const totalElapsed = elapsedBeforePauseRef.current + wallElapsed
    const remaining = Math.max(0, totalSeconds - totalElapsed)
    setSecondsLeft(remaining)
    if (remaining === 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      clearTick()
      setIsRunning(false)
      onExpireRef.current?.()
    }
  }, [totalSeconds])

  const start = useCallback(() => {
    if (hasExpiredRef.current) return
    startTimeRef.current = Date.now()
    setIsRunning(true)
    clearTick()
    intervalRef.current = setInterval(tick, 250)
  }, [tick])

  const pause = useCallback(() => {
    if (!isRunning) return
    elapsedBeforePauseRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000)
    clearTick()
    setIsRunning(false)
  }, [isRunning])

  const reset = useCallback(() => {
    clearTick()
    elapsedBeforePauseRef.current = 0
    startTimeRef.current = null
    hasExpiredRef.current = false
    setSecondsLeft(totalSeconds)
    setIsRunning(false)
  }, [totalSeconds])

  // Cleanup on unmount
  useEffect(() => () => clearTick(), [])

  const elapsedSeconds = totalSeconds - secondsLeft
  const minutes = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return {
    secondsLeft,
    elapsedSeconds,
    isRunning,
    isUrgent: secondsLeft <= 60 && secondsLeft > 0,
    isExpired: secondsLeft === 0 && hasExpiredRef.current,
    formattedTime: `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    start,
    pause,
    reset,
  }
}
