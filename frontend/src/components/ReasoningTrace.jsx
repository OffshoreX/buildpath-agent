import { useEffect, useRef } from 'react'

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
          const lines = reasoning[s.key] || []
          return (
            <li key={s.key} className={`trace-stage trace-${st}`}>
              <div className="trace-rail">
                <Node status={st} />
                {i < STAGE_META.length - 1 && <span className="trace-connector" />}
              </div>
              <div className="trace-body">
                <div className="trace-headrow">
                  <span className="trace-name">{s.name}</span>
                  <span className="trace-role">{s.role}</span>
                </div>
                {st === 'active' && <Console lines={lines} />}
                {st === 'complete' && <div className="trace-status-line trace-done">✓ done</div>}
                {st === 'skipped' && (
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
