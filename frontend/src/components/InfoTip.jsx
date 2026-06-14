import { useEffect, useRef, useState } from 'react'

/**
 * Small "i" info button with a warm tooltip popover. Opens on hover (desktop)
 * and toggles on click/tap (mobile); dismisses on mouse-leave or outside tap.
 * Decorative-only; never submits or toggles its parent control.
 */
export default function InfoTip({ text, label = 'More information' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <span
      className="infotip"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="infotip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        i
      </button>
      {open && (
        <span className="infotip-pop" role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}
