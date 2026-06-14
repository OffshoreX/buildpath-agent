import { useEffect, useRef, useState } from 'react'

const LINE_INTERVAL_MS = 400 // minimum on-screen time per reasoning line

// Mirrors the backend PIPELINE_STAGES keys/order.
const STAGE_META = [
  { key: 'planner', name: 'Planner', role: 'Decomposes the project into a phase skeleton' },
  { key: 'researcher', name: 'Researcher', role: 'Finds specific tools, parts, and sources' },
  { key: 'risk', name: 'Risk Analyst', role: 'Adds measurable checkpoints and failure modes' },
  { key: 'critic', name: 'Critic', role: 'Reviews coherence, critical path, and confidence' },
]

function CheckMark() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <path
        d="M2 6.2 4.8 9 10 3.4"
        fill="none"
        stroke="#1a1714"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Node({ status }) {
  if (status === 'complete') {
    return (
      <span className="trace-node trace-node-complete">
        <CheckMark />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="trace-node trace-node-active">
        <span className="trace-spinner" />
      </span>
    )
  }
  if (status === 'skipped') {
    return <span className="trace-node trace-node-skipped">–</span>
  }
  return <span className="trace-node trace-node-waiting" />
}

// The streaming console for the active stage; auto-scrolls as lines arrive.
function Console({ lines }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])
  return (
    <div className="trace-console" ref={ref} aria-live="polite">
      {lines.length === 0 ? (
        <div className="trace-line trace-line-dim">reasoning…</div>
      ) : (
        lines.map((line, i) => (
          <div className="trace-line" key={i}>
            {line}
          </div>
        ))
      )}
    </div>
  )
}

/**
 * Live reasoning trace: four agent stages run in sequence, each streaming its
 * real reasoning steps into a console beneath the active stage. `trace` is
 * driven by SSE events in App.jsx: { active, status: {stage: state},
 * reasoning: {stage: [lines]} }.
 */
export default function ReasoningTrace({ projectData, trace }) {
  const status = trace?.status || {}
  const reasoning = trace?.reasoning || {}

  // Reveal reasoning lines one at a time, paced — even when a whole stage's
  // lines arrive in a single buffered burst, they unspool readably rather than
  // dumping all at once. `shown[stage]` is how many lines are visible so far.
  const [shown, setShown] = useState({})
  useEffect(() => {
    let pending = null
    for (const s of STAGE_META) {
      if ((shown[s.key] || 0) < (reasoning[s.key] || []).length) {
        pending = s.key
        break
      }
    }
    if (!pending) return
    const t = setTimeout(() => {
      setShown((prev) => ({ ...prev, [pending]: (prev[pending] || 0) + 1 }))
    }, LINE_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [reasoning, shown])

  return (
    <div className="reasoning-trace">
      <header className="reasoning-head">
        <h1 className="project-title">{projectData?.name || 'Your project'}</h1>
        <p className="reasoning-sub">
          Four agents are reasoning through your roadmap, in sequence.
        </p>
      </header>

      <ol className="trace-stages">
        {STAGE_META.map((s, i) => {
          const st = status[s.key] || 'waiting'
          const all = reasoning[s.key] || []
          const count = shown[s.key] || 0
          const revealed = all.slice(0, count)
          const draining = count < all.length // lines still unspooling
          // Keep the console (and the stage's accent) until its lines finish
          // revealing, so a stage that "completes" mid-stream stays readable.
          const showConsole = st === 'active' || ((st === 'complete' || st === 'skipped') && draining)
          const stageClass = st === 'complete' && draining ? 'active' : st
          return (
            <li key={s.key} className={`trace-stage trace-${stageClass}`}>
              <div className="trace-rail">
                <Node status={st === 'complete' && draining ? 'active' : st} />
                {i < STAGE_META.length - 1 && <span className="trace-connector" />}
              </div>
              <div className="trace-body">
                <div className="trace-headrow">
                  <span className="trace-name">{s.name}</span>
                  <span className="trace-role">{s.role}</span>
                </div>
                {showConsole && <Console lines={revealed} />}
                {st === 'complete' && !draining && (
                  <div className="trace-status-line trace-done">✓ done</div>
                )}
                {st === 'skipped' && !draining && (
                  <div className="trace-status-line trace-skip">— skipped, kept best so far</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
