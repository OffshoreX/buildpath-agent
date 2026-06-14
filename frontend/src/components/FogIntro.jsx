import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// How much cumulative pointer travel disperses the fog for good.
const REVEAL_DISTANCE = 1400
// Safety: dismiss if the user never interacts (covers touch + idle desktop).
const IDLE_DISMISS_MS = 8000

/**
 * One-time pre-landing screen. Warm mist covers a faint blueprint grid; moving
 * the cursor (or finger) clears a soft circle of fog, revealing the grid. Once
 * enough movement accumulates, the whole overlay fades and HomePage takes over
 * with its own entrance animations. App skips this entirely under
 * prefers-reduced-motion or when the session flag is already set.
 */
export default function FogIntro({ onReveal }) {
  const mistRef = useRef(null)
  const lastPos = useRef(null)
  const distance = useRef(0)
  const movedRef = useRef(false)
  const doneRef = useRef(false)
  const [moved, setMoved] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const dismiss = () => {
      if (doneRef.current) return
      doneRef.current = true
      onReveal()
    }

    const handle = (x, y) => {
      const mist = mistRef.current
      if (mist) {
        mist.style.setProperty('--mx', `${x}px`)
        mist.style.setProperty('--my', `${y}px`)
      }
      if (lastPos.current) {
        distance.current += Math.hypot(x - lastPos.current.x, y - lastPos.current.y)
      }
      lastPos.current = { x, y }
      if (!movedRef.current) {
        movedRef.current = true
        setMoved(true)
      }
      if (distance.current >= REVEAL_DISTANCE) dismiss()
    }

    const onMouse = (e) => handle(e.clientX, e.clientY)
    const onTouch = (e) => {
      const t = e.touches[0]
      if (t) handle(t.clientX, t.clientY)
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })

    const skipTimer = setTimeout(() => setShowSkip(true), 2000)
    const hintTimer = setTimeout(() => {
      if (!movedRef.current) setShowHint(true)
    }, 3000)
    const idleTimer = setTimeout(() => {
      if (!movedRef.current) dismiss()
    }, IDLE_DISMISS_MS)

    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('touchmove', onTouch)
      clearTimeout(skipTimer)
      clearTimeout(hintTimer)
      clearTimeout(idleTimer)
    }
  }, [onReveal])

  const skip = () => {
    if (doneRef.current) return
    doneRef.current = true
    onReveal()
  }

  return (
    <motion.div
      className="fog-intro"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Base: faint blueprint grid, revealed where the mist clears. */}
      <div className="fog-grid" />

      {/* Mist body with a cursor-following hole punched via a radial mask. */}
      <div className="fog-mist" ref={mistRef}>
        <span className="fog-sparkle fog-sparkle-1" />
        <span className="fog-sparkle fog-sparkle-2" />
        <span className="fog-sparkle fog-sparkle-3" />
      </div>

      <h1 className="fog-text">Are you ready to build?</h1>

      <span className={moved || !showHint ? 'fog-hint fog-hint-gone' : 'fog-hint'}>
        move to reveal
      </span>

      <button
        type="button"
        className={showSkip ? 'fog-skip fog-skip-shown' : 'fog-skip'}
        onClick={skip}
      >
        Skip
      </button>
    </motion.div>
  )
}
