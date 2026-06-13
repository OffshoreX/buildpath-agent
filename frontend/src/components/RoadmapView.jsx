import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ProjectHeader from './ProjectHeader.jsx'
import TimelinePath from './TimelinePath.jsx'
import PhaseCard from './PhaseCard.jsx'
import { updateSavedRoadmap } from './HomePage.jsx'

export default function RoadmapView({
  roadmap,
  projectData,
  savedId,
  initialCompleted,
  onRegeneratePhase,
  onRestorePhase,
  onStartOver,
  onBackHome,
}) {
  const phases = useMemo(
    () =>
      [...(roadmap.phases || [])].sort(
        (a, b) => (a.phase_number || 0) - (b.phase_number || 0)
      ),
    [roadmap]
  )

  const [completed, setCompleted] = useState(() => new Set(initialCompleted || []))
  const [expandDirective, setExpandDirective] = useState({ action: null, nonce: 0 })
  const [geometry, setGeometry] = useState(null)
  const notesRefs = useRef({})
  const serpentineRef = useRef(null)
  const rowRefs = useRef([])

  const currentIndex = phases.findIndex((p) => !completed.has(p.phase_number))
  const allComplete = phases.length > 0 && currentIndex === -1

  const statusFor = useCallback(
    (i) => {
      if (completed.has(phases[i].phase_number)) return 'completed'
      return i === currentIndex ? 'current' : 'upcoming'
    },
    [completed, phases, currentIndex]
  )

  const statuses = useMemo(() => phases.map((_, i) => statusFor(i)), [phases, statusFor])

  // Measure the serpentine geometry from the rendered rows: node positions on
  // the center S-curve (or the left rail on mobile) and each card's inner
  // edge for its connector. Re-measured whenever the container resizes —
  // expanding sections, notes growth, and viewport changes all land there.
  useLayoutEffect(() => {
    const container = serpentineRef.current
    if (!container) return
    const mq = window.matchMedia('(max-width: 768px)')

    const compute = () => {
      const width = container.clientWidth
      const height = container.scrollHeight
      if (!width || !height) return
      const mobile = mq.matches
      const amplitude = Math.min(64, width * 0.08)
      const nodes = []
      for (let i = 0; i < phases.length; i++) {
        const row = rowRefs.current[i]
        const slot = row?.firstElementChild
        if (!row || !slot) return
        const y = row.offsetTop + 44 // aligned with the card header
        const x = mobile ? 16 : i % 2 === 0 ? width / 2 - amplitude : width / 2 + amplitude
        const edgeX =
          mobile || i % 2 === 1 ? slot.offsetLeft : slot.offsetLeft + slot.offsetWidth
        nodes.push({ x, y, edgeX })
      }
      setGeometry({ width, height, nodes })
    }

    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(container)
    mq.addEventListener('change', compute)
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', compute)
    }
  }, [phases.length])

  const markComplete = useCallback(
    (phaseNumber) => {
      setCompleted((prev) => {
        const next = new Set([...prev, phaseNumber])
        if (savedId) {
          updateSavedRoadmap(savedId, (entry) => ({ ...entry, completed: [...next] }))
        }
        return next
      })
    },
    [savedId]
  )

  const handleNotesChange = useCallback(
    (phaseNumber, value) => {
      if (savedId) {
        updateSavedRoadmap(savedId, (entry) => ({
          ...entry,
          notes: { ...(entry.notes || {}), [phaseNumber]: value },
        }))
      }
    },
    [savedId]
  )

  // Keyboard shortcuts: E expand all, C collapse all, N focus current phase notes.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target.closest('input, textarea, select, [contenteditable]')) return
      const key = e.key.toLowerCase()
      if (key === 'e') {
        setExpandDirective((prev) => ({ action: 'expand', nonce: prev.nonce + 1 }))
      } else if (key === 'c') {
        setExpandDirective((prev) => ({ action: 'collapse', nonce: prev.nonce + 1 }))
      } else if (key === 'n' && currentIndex !== -1) {
        const el = notesRefs.current[phases[currentIndex].phase_number]
        if (el) {
          e.preventDefault()
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus({ preventScroll: true })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phases, currentIndex])

  const exportJson = useCallback(() => {
    const slug = String(roadmap.project_name || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const blob = new Blob([JSON.stringify(roadmap, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug || 'project'}-roadmap.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [roadmap])

  return (
    <div className={allComplete ? 'roadmap-page roadmap-all-complete' : 'roadmap-page'}>
      <button type="button" className="btn-ghost btn-back-home" onClick={onBackHome}>
        ← Back to Home
      </button>
      <ProjectHeader
        roadmap={roadmap}
        completedCount={completed.size}
        totalCount={phases.length}
        allComplete={allComplete}
        onExport={exportJson}
        onStartOver={onStartOver}
      />

      {(roadmap.early_validation || roadmap.success_criteria) && (
        <div className="info-strip">
          {roadmap.early_validation && (
            <div className="info-card info-card-validate">
              <span className="info-card-label">Validate first</span>
              <p>{roadmap.early_validation}</p>
            </div>
          )}
          {roadmap.success_criteria && (
            <div className="info-card">
              <span className="info-card-label">Success criteria</span>
              <p>{roadmap.success_criteria}</p>
            </div>
          )}
        </div>
      )}

      {(roadmap.critical_path || []).length > 0 && (
        <div className="critical-path-strip">
          <span className="info-card-label">Critical path</span>
          <div className="critical-path-chips">
            {roadmap.critical_path.map((title, i) => (
              <span key={`${title}-${i}`} className="critical-path-item">
                <span className="critical-path-chip">{title}</span>
                {i < roadmap.critical_path.length - 1 && (
                  <span className="critical-path-arrow">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="serpentine" ref={serpentineRef}>
        <TimelinePath geometry={geometry} statuses={statuses} />
        {phases.map((phase, i) => (
          <div
            key={phase.phase_number ?? i}
            ref={(el) => {
              rowRefs.current[i] = el
            }}
            className={i % 2 === 0 ? 'serp-row serp-row-left' : 'serp-row serp-row-right'}
          >
            <div className="phase-slot">
              <PhaseCard
                phase={phase}
                status={statusFor(i)}
                index={i}
                projectName={roadmap.project_name}
                onMarkComplete={() => markComplete(phase.phase_number)}
                onRegenerate={onRegeneratePhase}
                onRestore={onRestorePhase}
                onNotesChange={handleNotesChange}
                expandDirective={expandDirective}
                registerNotesRef={(el) => {
                  notesRefs.current[phase.phase_number] = el
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <footer className="shortcut-hints">
        <span>
          <kbd>E</kbd> expand all
        </span>
        <span>
          <kbd>C</kbd> collapse all
        </span>
        <span>
          <kbd>N</kbd> notes for current phase
        </span>
      </footer>
    </div>
  )
}
