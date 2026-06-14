import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ProjectHeader from './ProjectHeader.jsx'
import TimelinePath from './TimelinePath.jsx'
import PhaseCard from './PhaseCard.jsx'
import FollowUpChat from './FollowUpChat.jsx'
import BlueprintTool from './BlueprintTools.jsx'
import { updateSavedRoadmap } from './HomePage.jsx'

export default function RoadmapView({
  roadmap,
  projectData,
  savedId,
  initialCompleted,
  onRegeneratePhase,
  onRestorePhase,
  onApplyChatEdits,
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
  const [flash, setFlash] = useState({ phase: null, nonce: 0 })
  const [collapsedMap, setCollapsedMap] = useState({}) // phase index -> collapsed?

  const reportCollapsed = useCallback((i, c) => {
    setCollapsedMap((prev) => (prev[i] === c ? prev : { ...prev, [i]: c }))
  }, [])
  const notesRefs = useRef({})
  const serpentineRef = useRef(null)
  const rowRefs = useRef([])

  // A chat edit applied upstream returns the phase number to highlight; pulse
  // that card's amber glow for ~1s, then clear it.
  const handleChatEdits = useCallback(
    (edits) => {
      const result = onApplyChatEdits?.(edits) || { ok: false }
      if (result.ok && result.highlight) {
        setFlash((prev) => ({ phase: result.highlight, nonce: prev.nonce + 1 }))
      }
      return result
    },
    [onApplyChatEdits]
  )

  useEffect(() => {
    if (!flash.phase) return
    const timer = setTimeout(() => setFlash({ phase: null, nonce: flash.nonce }), 1100)
    return () => clearTimeout(timer)
  }, [flash])

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

  // The blueprint "develops" as phases complete: a soft amber wash blooms over
  // the grid at each completed node. Built from the same measured geometry the
  // serpentine uses, so the glows track the nodes exactly.
  const developWash = useMemo(() => {
    if (!geometry) return 'none'
    const spots = geometry.nodes
      .filter((_, i) => statuses[i] === 'completed')
      .map(
        (n) =>
          `radial-gradient(circle 150px at ${n.x}px ${n.y}px, rgba(212,162,76,0.05), transparent)`
      )
    return spots.length ? spots.join(', ') : 'none'
  }, [geometry, statuses])

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
      if (!width) return
      const mobile = mq.matches
      const baseAmplitude = Math.min(64, width * 0.08)

      // First pass: vertical anchors and card edges.
      const anchors = []
      let contentBottom = 0
      for (let i = 0; i < phases.length; i++) {
        const row = rowRefs.current[i]
        const slot = row?.firstElementChild
        if (!row || !slot) return
        contentBottom = Math.max(contentBottom, row.offsetTop + row.offsetHeight)
        anchors.push({
          y: row.offsetTop + 44, // aligned with the card header
          edgeX:
            mobile || i % 2 === 1 ? slot.offsetLeft : slot.offsetLeft + slot.offsetWidth,
        })
      }
      // Height comes from the rows themselves, not scrollHeight — the absolutely
      // positioned SVG would otherwise keep its old (taller) height in the
      // measurement and prevent the page from shrinking when sections collapse.
      const height = contentBottom
      if (!height) return

      // Second pass: horizontal swing, clamped so the curve never kinks.
      // Across short segments (collapsed rows) the swing shrinks to at most
      // 0.3x the shortest adjacent vertical run, keeping the S gentle.
      const nodes = anchors.map((anchor, i) => {
        const dyPrev = i > 0 ? anchor.y - anchors[i - 1].y : Infinity
        const dyNext = i < anchors.length - 1 ? anchors[i + 1].y - anchor.y : Infinity
        const amplitude = Math.max(
          0,
          Math.min(baseAmplitude, 0.3 * Math.min(dyPrev, dyNext))
        )
        const x = mobile ? 16 : width / 2 + (i % 2 === 0 ? -amplitude : amplitude)
        return { x, y: anchor.y, edgeX: anchor.edgeX }
      })

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

  // Reopen a completed phase: drop it from the completed set and persist, so
  // the timeline lighting returns it to active/upcoming.
  const markIncomplete = useCallback(
    (phaseNumber) => {
      setCompleted((prev) => {
        const next = new Set(prev)
        next.delete(phaseNumber)
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

  // Exports run entirely client-side from roadmap state + the per-phase data
  // saved in localStorage (same scope/keys PhaseCard writes under).
  const exportAs = useCallback(
    (format) => {
      const scope = savedId || roadmap.project_name
      const slug =
        String(roadmap.project_name || 'project')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'project'

      const readNotes = (n) =>
        (localStorage.getItem(`buildpath-notes-${scope}-phase-${n}`) || '').trim()
      const readRows = (kind, n) => {
        try {
          const v = JSON.parse(
            localStorage.getItem(`buildpath-${kind}-${scope}-phase-${n}`) || 'null'
          )
          return Array.isArray(v) ? v : []
        } catch {
          return []
        }
      }
      const generatedLabel = roadmap.generated_at
        ? new Date(roadmap.generated_at).toLocaleDateString()
        : new Date().toLocaleDateString()

      const download = (content, ext, type) => {
        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${slug}-roadmap.${ext}`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }

      if (format === 'json') {
        download(JSON.stringify(roadmap, null, 2), 'json', 'application/json')
        return
      }

      if (format === 'markdown') {
        const L = []
        L.push(`# ${roadmap.project_name || 'Project'}`, '')
        const meta = [roadmap.preset_type, roadmap.estimated_duration, `Generated ${generatedLabel}`]
          .filter(Boolean)
          .join(' · ')
        if (meta) L.push(`*${meta}*`, '')
        if (roadmap.summary) L.push('## Summary', '', roadmap.summary, '')
        if (roadmap.success_criteria) L.push('## Success Criteria', '', roadmap.success_criteria, '')
        if (roadmap.early_validation) L.push('## Validate First', '', roadmap.early_validation, '')

        phases.forEach((p) => {
          const tags = (p.tags || []).length ? ` _(${p.tags.join(', ')})_` : ''
          L.push('', `## Phase ${p.phase_number}: ${p.title}${p.duration ? ` — ${p.duration}` : ''}${tags}`, '')
          if (p.description) L.push(p.description, '')
          if ((p.dependencies || []).length) L.push(`**Depends on:** ${p.dependencies.join(', ')}`, '')
          if ((p.checkpoints || []).length) {
            L.push('### Checkpoints', '')
            p.checkpoints.forEach((c) => L.push(`- [ ] ${c}`))
            L.push('')
          }
          if ((p.risks || []).length) {
            L.push('### Risks', '')
            p.risks.forEach((r) => L.push(`- ${r}`))
            L.push('')
          }
          if ((p.tools_required || []).length) {
            L.push('### Tools Required', '')
            p.tools_required.forEach((t) => L.push(`- ${t}`))
            L.push('')
          }
          const sources = (p.sources || []).filter((s) => s && s.url)
          if (sources.length) {
            L.push('### Sources', '')
            sources.forEach((s) => L.push(`- [${s.label || s.url}](${s.url})`))
            L.push('')
          }
          const notes = readNotes(p.phase_number)
          if (notes) L.push('### Notes', '', notes, '')
          const parts = readRows('parts', p.phase_number).filter(
            (r) => r.part || r.use || r.qty || r.price || r.supplier
          )
          if (parts.length) {
            L.push('### Parts', '', '| Part | Use | Qty | Est. Price | Supplier |', '|---|---|---|---|---|')
            parts.forEach((r) =>
              L.push(`| ${r.part || ''} | ${r.use || ''} | ${r.qty || ''} | ${r.price || ''} | ${r.supplier || ''} |`)
            )
            L.push('')
          }
          const findings = readRows('findings', p.phase_number).filter(
            (f) => f.title || f.description || f.source
          )
          if (findings.length) {
            L.push('### Findings', '')
            findings.forEach((f) =>
              L.push(`- **${f.title || 'Finding'}** — ${f.description || ''}${f.source ? ` (${f.source})` : ''}`)
            )
            L.push('')
          }
        })

        if ((roadmap.critical_path || []).length) {
          L.push('## Critical Path', '', roadmap.critical_path.join(' → '), '')
        }
        download(L.join('\n'), 'md', 'text/markdown')
        return
      }

      if (format === 'pdf') {
        const esc = (s) =>
          String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        const list = (items, cls = '') =>
          `<ul${cls ? ` class="${cls}"` : ''}>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`

        const phaseBlocks = phases
          .map((p) => {
            const parts = []
            parts.push(
              `<h2>Phase ${p.phase_number}: ${esc(p.title)}${p.duration ? ` <span class="dur">${esc(p.duration)}</span>` : ''}</h2>`
            )
            if ((p.tags || []).length)
              parts.push(`<p class="tags">${p.tags.map((t) => esc(t)).join(' · ')}</p>`)
            if (p.description) parts.push(`<p>${esc(p.description)}</p>`)
            if ((p.dependencies || []).length)
              parts.push(`<p class="dep"><strong>Depends on:</strong> ${esc(p.dependencies.join(', '))}</p>`)
            if ((p.checkpoints || []).length)
              parts.push(`<h3>Checkpoints</h3>${list(p.checkpoints, 'checks')}`)
            if ((p.risks || []).length) parts.push(`<h3>Risks</h3>${list(p.risks)}`)
            if ((p.tools_required || []).length)
              parts.push(`<h3>Tools Required</h3>${list(p.tools_required)}`)
            const sources = (p.sources || []).filter((s) => s && s.url)
            if (sources.length)
              parts.push(
                `<h3>Sources</h3><ul>${sources
                  .map((s) => `<li><a href="${esc(s.url)}">${esc(s.label || s.url)}</a></li>`)
                  .join('')}</ul>`
              )
            const notes = readNotes(p.phase_number)
            if (notes) parts.push(`<h3>Notes</h3><p>${esc(notes)}</p>`)
            return `<section class="phase">${parts.join('')}</section>`
          })
          .join('')

        const cp = (roadmap.critical_path || []).length
          ? `<section class="phase"><h2>Critical Path</h2><p>${esc(roadmap.critical_path.join('  →  '))}</p></section>`
          : ''

        const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(slug)}-roadmap</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #1a1714; background: #fff; margin: 0; line-height: 1.55; }
  .title-block { border-bottom: 2px solid #c65d3a; padding-bottom: 16px; margin-bottom: 28px; }
  .title-block h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .title-block .meta { font-size: 12px; color: #6b5f52; text-transform: uppercase; letter-spacing: 0.08em; }
  .intro { margin-bottom: 24px; }
  .intro h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5f52; margin: 16px 0 4px; }
  .intro p { margin: 0; }
  .phase { page-break-inside: avoid; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid #e6ddd0; }
  .phase h2 { font-size: 18px; margin: 0 0 6px; }
  .phase h2 .dur { font-size: 12px; font-weight: 400; color: #6b5f52; }
  .phase h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5f52; margin: 14px 0 4px; }
  .phase p { margin: 0 0 6px; }
  .tags { font-size: 11px; color: #8a7d6b; text-transform: uppercase; letter-spacing: 0.06em; }
  .dep { font-size: 13px; color: #4a4239; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 2px 0; }
  ul.checks { list-style: none; padding-left: 0; }
  ul.checks li::before { content: "\\2610"; margin-right: 8px; color: #c65d3a; }
  a { color: #b5532f; }
</style></head><body>
  <div class="title-block">
    <h1>${esc(roadmap.project_name || 'Project')}</h1>
    <div class="meta">${[esc(roadmap.preset_type || ''), esc(roadmap.estimated_duration || ''), `Generated ${esc(generatedLabel)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
  </div>
  <div class="intro">
    ${roadmap.summary ? `<h2>Summary</h2><p>${esc(roadmap.summary)}</p>` : ''}
    ${roadmap.success_criteria ? `<h2>Success Criteria</h2><p>${esc(roadmap.success_criteria)}</p>` : ''}
    ${roadmap.early_validation ? `<h2>Validate First</h2><p>${esc(roadmap.early_validation)}</p>` : ''}
  </div>
  ${phaseBlocks}
  ${cp}
</body></html>`

        // Render into a hidden iframe and print (avoids popup blockers; the
        // browser's Save-as-PDF produces a clean white document).
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
        document.body.appendChild(iframe)
        const doc = iframe.contentWindow.document
        doc.open()
        doc.write(html)
        doc.close()
        const cleanup = () => setTimeout(() => iframe.remove(), 1000)
        iframe.contentWindow.onafterprint = cleanup
        setTimeout(() => {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
          cleanup()
        }, 350)
      }
    },
    [roadmap, phases, savedId]
  )

  return (
    <div className={allComplete ? 'roadmap-page roadmap-all-complete' : 'roadmap-page'}>
      {/* Drafting-table backdrop: fixed amber grid + edge vignette, behind all content. */}
      <div className="blueprint-bg" aria-hidden="true" />

      <button type="button" className="btn-ghost btn-back-home" onClick={onBackHome}>
        ← Back to Home
      </button>
      <ProjectHeader
        roadmap={roadmap}
        completedCount={completed.size}
        totalCount={phases.length}
        allComplete={allComplete}
        onExport={exportAs}
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
        <div
          className="blueprint-develop"
          aria-hidden="true"
          style={{ backgroundImage: developWash }}
        />
        <TimelinePath geometry={geometry} statuses={statuses} />
        {phases.map((phase, i) => (
          <div
            key={phase.phase_number ?? i}
            ref={(el) => {
              rowRefs.current[i] = el
            }}
            className={i % 2 === 0 ? 'serp-row serp-row-left' : 'serp-row serp-row-right'}
          >
            <div
              className={
                flash.phase === phase.phase_number
                  ? 'phase-slot phase-slot-flash'
                  : 'phase-slot'
              }
            >
              <PhaseCard
                phase={phase}
                status={statusFor(i)}
                index={i}
                projectName={roadmap.project_name}
                storageScope={savedId || roadmap.project_name}
                onMarkComplete={() => markComplete(phase.phase_number)}
                onUncomplete={() => markIncomplete(phase.phase_number)}
                onRegenerate={onRegeneratePhase}
                onRestore={onRestorePhase}
                onNotesChange={handleNotesChange}
                onCollapsedChange={(c) => reportCollapsed(i, c)}
                expandDirective={expandDirective}
                registerNotesRef={(el) => {
                  notesRefs.current[phase.phase_number] = el
                }}
              />
            </div>
            {/* Hide the figure while the phase is collapsed (default-hidden for
                upcoming until the card reports its real state). */}
            {!(collapsedMap[i] ?? statuses[i] === 'upcoming') && (
              <BlueprintTool phaseNumber={phase.phase_number} />
            )}
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

      <FollowUpChat
        projectData={projectData}
        roadmap={roadmap}
        onApplyEdits={handleChatEdits}
      />
    </div>
  )
}
