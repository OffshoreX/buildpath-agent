import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SECTIONS = [
  { key: 'checkpoints', label: 'Checkpoints' },
  { key: 'risks', label: 'Risks' },
  { key: 'tools', label: 'Tools Required' },
]

const sectionMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' },
}

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      aria-hidden="true"
      className={open ? 'chevron chevron-open' : 'chevron'}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" className="risk-icon">
      <path
        d="M7 1.6 13 12H1L7 1.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M7 5.4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r="0.7" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
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

const tagClass = (tag) => `tag tag-${String(tag).toLowerCase().replace(/\s+/g, '-')}`

const TAG_MEANINGS = {
  'critical-path': 'On the critical path — a delay here delays the whole project',
  'high-risk': 'Highest failure risk — validate this early',
  'quick-win': 'Small, fast phase to build momentum',
  dependency: 'Later phases depend on this one',
  research: 'Investigation and learning, not building',
  build: 'Hands-on construction or implementation',
  test: 'Validation and measurement',
  deploy: 'Shipping, releasing, or installing',
}

const CONFIDENCE_HINT =
  "The agent's certainty about this phase's scope, duration, and tooling — lower means expect iteration and re-planning"

const PARTS_COLUMNS = [
  { key: 'part', label: 'Part Name' },
  { key: 'use', label: 'Use' },
  { key: 'qty', label: 'Qty' },
  { key: 'price', label: 'Est. Price' },
  { key: 'supplier', label: 'Supplier' },
]

const emptyPartRow = () => ({ part: '', use: '', qty: '', price: '', supplier: '' })
const emptyFinding = () => ({ title: '', description: '', source: '' })
const emptyTest = () => ({ name: '', status: 'pending' })
const emptyDeployStep = () => ({ label: '', state: 0 })

const TEST_STATUS_NEXT = { pending: 'pass', pass: 'fail', fail: 'pending' }
const TEST_STATUS_LABEL = { pending: 'Pending', pass: 'Pass ✓', fail: 'Fail ✕' }
const DEPLOY_STATE_LABEL = ['not started', 'in progress', 'done']

// Per-phase widget rows persisted to localStorage. The setter writes through
// on every change; corrupted or empty storage falls back to the default.
function usePersistedRows(key, makeDefault) {
  const [rows, setRows] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (Array.isArray(saved) && saved.length > 0) return saved
    } catch {
      // fall through to the default
    }
    return makeDefault()
  })
  const persist = (next) => {
    localStorage.setItem(key, JSON.stringify(next))
    setRows(next)
  }
  return [rows, persist]
}

export default function PhaseCard({
  phase,
  status,
  index,
  projectName,
  onMarkComplete,
  onRegenerate,
  onRestore,
  onNotesChange,
  expandDirective,
  registerNotesRef,
}) {
  const notesKey = `buildpath-notes-${projectName}-phase-${phase.phase_number}`
  const phaseTags = (phase.tags || []).map((t) => String(t).toLowerCase())
  const keyFor = (kind) => `buildpath-${kind}-${projectName}-phase-${phase.phase_number}`
  const partsKey = keyFor('parts')
  const isBuildPhase = phaseTags.includes('build')
  const isResearchPhase = phaseTags.includes('research')
  const isTestPhase = phaseTags.includes('test')
  const isDeployPhase = phaseTags.includes('deploy')
  const [open, setOpen] = useState({ checkpoints: false, risks: false, tools: false })
  const [peek, setPeek] = useState(false) // upcoming cards stay collapsed until peeked
  const [checked, setChecked] = useState(() => new Set())
  const [notes, setNotes] = useState(() => localStorage.getItem(notesKey) || '')
  const [savedVisible, setSavedVisible] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [undoPhase, setUndoPhase] = useState(null) // pre-regeneration snapshot
  const [parts, persistParts] = usePersistedRows(partsKey, () => [
    emptyPartRow(),
    emptyPartRow(),
    emptyPartRow(),
  ])
  const [findings, persistFindings] = usePersistedRows(keyFor('findings'), () => [])
  const [tests, persistTests] = usePersistedRows(keyFor('tests'), () => [
    emptyTest(),
    emptyTest(),
    emptyTest(),
  ])
  const [deploySteps, persistDeploySteps] = usePersistedRows(keyFor('deploy'), () => [
    emptyDeployStep(),
    emptyDeployStep(),
    emptyDeployStep(),
  ])
  const notesRef = useRef(null)
  const savedTimer = useRef(null)

  // E / C keyboard shortcuts arrive as an incrementing directive from RoadmapView.
  useEffect(() => {
    if (!expandDirective?.action) return
    const value = expandDirective.action === 'expand'
    setOpen({ checkpoints: value, risks: value, tools: value })
    setPeek(value)
  }, [expandDirective])

  useEffect(() => {
    registerNotesRef?.(notesRef.current)
    return () => registerNotesRef?.(null)
  }, [registerNotesRef])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const autoResize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleNotesChange = (e) => {
    const value = e.target.value
    setNotes(value)
    localStorage.setItem(notesKey, value)
    onNotesChange?.(phase.phase_number, value)
    autoResize(e.target)
    setSavedVisible(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1400)
  }

  const toggleSection = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  const toggleCheckpoint = (i) => {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError('')
    const previous = phase
    try {
      await onRegenerate(phase)
      setUndoPhase(previous)
    } catch (err) {
      setRegenError(err.message || 'Regeneration failed.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleUndo = () => {
    if (!undoPhase) return
    onRestore?.(undoPhase)
    setUndoPhase(null)
  }

  const updatePart = (rowIndex, key, value) => {
    persistParts(parts.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)))
  }

  const addPartRow = () => {
    persistParts([...parts, emptyPartRow()])
  }

  const updateFinding = (index, key, value) => {
    persistFindings(findings.map((f, i) => (i === index ? { ...f, [key]: value } : f)))
  }

  const updateTest = (index, value) => {
    persistTests(tests.map((t, i) => (i === index ? { ...t, name: value } : t)))
  }

  const cycleTestStatus = (index) => {
    persistTests(
      tests.map((t, i) =>
        i === index ? { ...t, status: TEST_STATUS_NEXT[t.status] || 'pending' } : t
      )
    )
  }

  const updateDeployStep = (index, value) => {
    persistDeploySteps(deploySteps.map((s, i) => (i === index ? { ...s, label: value } : s)))
  }

  const cycleDeployState = (index) => {
    persistDeploySteps(
      deploySteps.map((s, i) => (i === index ? { ...s, state: (Number(s.state) + 1) % 3 } : s))
    )
  }

  const confidence = Math.round(
    Math.min(1, Math.max(0, Number(phase.confidence ?? 0))) * 100
  )
  const checkpoints = phase.checkpoints || []
  const risks = phase.risks || []
  const tools = phase.tools_required || []
  const sectionItems = { checkpoints, risks, tools }

  // Upcoming phases collapse to their essentials — number, title, duration —
  // until they become current, are peeked, or E expands everything.
  const collapsed = status === 'upcoming' && !peek

  if (collapsed) {
    return (
      <motion.article
        className="phase-card phase-upcoming phase-card-collapsed"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: index < 4 ? index * 0.15 : 0.1 }}
      >
        <button
          type="button"
          className="phase-collapsed-row"
          onClick={() => setPeek(true)}
          aria-expanded={false}
        >
          <span className="phase-number">{String(phase.phase_number).padStart(2, '0')}</span>
          <h3 className="phase-title">{phase.title}</h3>
          {phase.duration && <span className="duration-badge">{phase.duration}</span>}
          <Chevron open={false} />
        </button>
      </motion.article>
    )
  }

  return (
    <motion.article
      className={`phase-card phase-${status}`}
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index < 4 ? index * 0.15 : 0.1 }}
    >
      {status === 'completed' && (
        <span className="phase-complete-overlay" aria-label="Phase completed">
          <CheckIcon />
        </span>
      )}

      <div className="phase-card-header">
        <span className="phase-number">{String(phase.phase_number).padStart(2, '0')}</span>
        <h3 className="phase-title">{phase.title}</h3>
        {phase.duration && <span className="duration-badge">{phase.duration}</span>}
        {(phase.tags || []).map((tag) => (
          <span
            key={tag}
            className={tagClass(tag)}
            title={TAG_MEANINGS[String(tag).toLowerCase()] || undefined}
          >
            {tag}
          </span>
        ))}
        {status === 'upcoming' && (
          <button
            type="button"
            className="phase-collapse-btn"
            onClick={() => setPeek(false)}
            aria-expanded
            aria-label="Collapse phase details"
          >
            <Chevron open />
          </button>
        )}
      </div>

      <p className="phase-description">{phase.description}</p>

      {(phase.dependencies || []).length > 0 && (
        <p className="phase-dependencies">
          Depends on: {(phase.dependencies || []).join(', ')}
        </p>
      )}

      <div className="phase-divider" />

      <div className="phase-section-toggles">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={open[key] ? 'section-toggle section-toggle-open' : 'section-toggle'}
            onClick={() => toggleSection(key)}
            aria-expanded={open[key]}
          >
            <Chevron open={open[key]} />
            {label}
            <span className="section-count">{sectionItems[key].length}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open.checkpoints && (
          <motion.div key="checkpoints" className="phase-section" {...sectionMotion}>
            <ul className="checkpoint-list">
              {checkpoints.map((item, i) => (
                <li key={i}>
                  <label className={checked.has(i) ? 'checkpoint checkpoint-done' : 'checkpoint'}>
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => toggleCheckpoint(i)}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {open.risks && (
          <motion.div key="risks" className="phase-section" {...sectionMotion}>
            <ul className="risk-list">
              {risks.map((item, i) => (
                <li key={i} className="risk-item">
                  <WarningIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {open.tools && (
          <motion.div key="tools" className="phase-section" {...sectionMotion}>
            <div className="tool-chips">
              {tools.map((tool, i) => (
                <span key={i} className="tool-chip">
                  {tool}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="phase-divider" />

      <div className="confidence-row">
        <span className="confidence-label" title={CONFIDENCE_HINT}>
          Agent confidence
        </span>
        <div className="confidence-track">
          <div className="confidence-fill" style={{ '--fill': confidence / 100 }} />
        </div>
        <span className="confidence-value">{confidence}%</span>
      </div>

      {isBuildPhase && (
        <div className="parts-wrap">
          <span className="parts-label">Parts list</span>
          <table className="parts-table">
            <thead>
              <tr>
                {PARTS_COLUMNS.map((col) => (
                  <th key={col.key} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {PARTS_COLUMNS.map((col) => (
                    <td key={col.key}>
                      <input
                        type="text"
                        className="parts-input"
                        value={row[col.key] ?? ''}
                        aria-label={`${col.label}, row ${rowIndex + 1}`}
                        onChange={(e) => updatePart(rowIndex, col.key, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-ghost btn-mini parts-add" onClick={addPartRow}>
            + Add Row
          </button>
        </div>
      )}

      {isResearchPhase && (
        <div className="widget-wrap">
          <span className="widget-label">Findings</span>
          {findings.length > 0 && (
            <div className="findings-stack">
              {findings.map((finding, i) => (
                <div className="finding-card" key={i}>
                  <button
                    type="button"
                    className="finding-remove"
                    aria-label={`Remove finding ${i + 1}`}
                    onClick={() => persistFindings(findings.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                  <input
                    type="text"
                    className="inline-field finding-title"
                    placeholder="Finding title"
                    value={finding.title}
                    onChange={(e) => updateFinding(i, 'title', e.target.value)}
                  />
                  <textarea
                    className="inline-field finding-desc"
                    rows={2}
                    placeholder="What you learned"
                    value={finding.description}
                    onChange={(e) => updateFinding(i, 'description', e.target.value)}
                  />
                  <input
                    type="text"
                    className="inline-field finding-source"
                    placeholder="Link or reference"
                    value={finding.source}
                    onChange={(e) => updateFinding(i, 'source', e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn-ghost btn-mini"
            onClick={() => persistFindings([...findings, emptyFinding()])}
          >
            + Add Finding
          </button>
        </div>
      )}

      {isTestPhase && (
        <div className="widget-wrap">
          <span className="widget-label">Test checklist</span>
          <div className="tests-list">
            {tests.map((test, i) => (
              <div className="test-row" key={i}>
                <input
                  type="text"
                  className="inline-field test-input"
                  placeholder="Test name"
                  aria-label={`Test name, row ${i + 1}`}
                  value={test.name}
                  onChange={(e) => updateTest(i, e.target.value)}
                />
                <button
                  type="button"
                  className={`test-badge test-badge-${test.status}`}
                  aria-label={`Status: ${test.status}. Click to change.`}
                  onClick={() => cycleTestStatus(i)}
                >
                  {TEST_STATUS_LABEL[test.status] || 'Pending'}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost btn-mini"
            onClick={() => persistTests([...tests, emptyTest()])}
          >
            + Add Test
          </button>
        </div>
      )}

      {isDeployPhase && (
        <div className="widget-wrap">
          <span className="widget-label">Rollout steps</span>
          <div className="deploy-steps">
            {deploySteps.map((step, i) => (
              <div className="deploy-step" key={i}>
                <button
                  type="button"
                  className={`deploy-dot deploy-dot-${Number(step.state) % 3}`}
                  aria-label={`Step ${i + 1}: ${DEPLOY_STATE_LABEL[Number(step.state) % 3]}. Click to change.`}
                  onClick={() => cycleDeployState(i)}
                />
                <input
                  type="text"
                  className="inline-field deploy-input"
                  placeholder="Step label"
                  aria-label={`Step label, row ${i + 1}`}
                  value={step.label}
                  onChange={(e) => updateDeployStep(i, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost btn-mini"
            onClick={() => persistDeploySteps([...deploySteps, emptyDeployStep()])}
          >
            + Add Step
          </button>
        </div>
      )}

      <div className="notes-wrap">
        <textarea
          ref={notesRef}
          className="notes-field"
          placeholder={isBuildPhase ? 'General notes for this phase...' : 'Add notes for this phase...'}
          value={notes}
          rows={1}
          onChange={handleNotesChange}
          onFocus={(e) => autoResize(e.target)}
        />
        <span className={savedVisible ? 'notes-saved notes-saved-visible' : 'notes-saved'}>
          Saved
        </span>
      </div>

      <div className="phase-footer">
        {status === 'current' && (
          <button type="button" className="btn-accent" onClick={onMarkComplete}>
            Mark Complete
          </button>
        )}
        {status === 'upcoming' && (
          <button
            type="button"
            className="btn-accent"
            disabled
            title="Complete the earlier phases first"
          >
            Mark Complete
          </button>
        )}
        {status === 'completed' && <span className="completed-note">Completed ✓</span>}
        <button
          type="button"
          className="btn-ghost btn-regen"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? 'Regenerating…' : 'Regenerate Phase'}
        </button>
      </div>

      {regenError && <p className="regen-error">{regenError}</p>}

      {undoPhase && !regenerating && (
        <p className="regen-undo" role="status">
          Phase regenerated.{' '}
          <button type="button" className="undo-link" onClick={handleUndo}>
            Undo
          </button>
        </p>
      )}
    </motion.article>
  )
}
