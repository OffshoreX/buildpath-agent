import { useCallback, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import HomePage, { saveRoadmap, updateSavedRoadmap } from './components/HomePage.jsx'
import OnboardingChat from './components/OnboardingChat.jsx'
import RoadmapView from './components/RoadmapView.jsx'
import ReasoningTrace from './components/ReasoningTrace.jsx'

const STAGES = {
  HOME: 'home',
  ONBOARDING: 'onboarding',
  LOADING: 'loading',
  ROADMAP: 'roadmap',
  ERROR: 'error',
}

const stageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

function ErrorState({ message, onRetry, onStartOver }) {
  return (
    <div className="error-screen">
      <div className="error-card">
        <span className="error-card-label">Generation failed</span>
        <h2 className="error-card-title">The agent couldn't build your roadmap</h2>
        <p className="error-card-message">{message}</p>
        <div className="error-card-actions">
          <button type="button" className="btn-accent" onClick={onRetry}>
            Try Again
          </button>
          <button type="button" className="btn-ghost" onClick={onStartOver}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [stage, setStage] = useState(STAGES.HOME)
  const [projectData, setProjectData] = useState(null)
  const [roadmap, setRoadmap] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [initialCompleted, setInitialCompleted] = useState([])
  const [error, setError] = useState('')
  const [trace, setTrace] = useState({ active: null, status: {}, reasoning: {} })

  const generateRoadmap = useCallback(async (data) => {
    setProjectData(data)
    setError('')
    setTrace({ active: null, status: {}, reasoning: {} })
    setStage(STAGES.LOADING)

    const commit = (payload) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      saveRoadmap({
        id,
        roadmap: payload,
        project_data: data,
        completed: [],
        notes: {},
        saved_at: new Date().toISOString(),
      })
      setSavedId(id)
      setInitialCompleted([])
      setRoadmap(payload)
      setStage(STAGES.ROADMAP)
    }

    // Non-streaming fallback: the original single-agent endpoint.
    const nonStreaming = async () => {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_data: data }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload || payload.error) {
        throw new Error(payload?.error || `The agent request failed (HTTP ${res.status}).`)
      }
      commit(payload)
    }

    const parseBlock = (block) => {
      let event = 'message'
      let raw = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) raw += line.slice(5).trim()
      }
      if (!raw) return null
      try {
        return { event, data: JSON.parse(raw) }
      } catch {
        return null
      }
    }

    try {
      let res = null
      try {
        res = await fetch('/api/generate-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_data: data }),
        })
      } catch {
        res = null
      }
      if (!res || !res.ok || !res.body) {
        await nonStreaming() // SSE unavailable -> single-agent fallback
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalRoadmap = null
      let fatal = null

      const handle = ({ event, data: d }) => {
        if (event === 'stage_start') {
          setTrace((t) => ({
            active: d.stage,
            status: { ...t.status, [d.stage]: 'active' },
            reasoning: { ...t.reasoning, [d.stage]: t.reasoning[d.stage] || [] },
          }))
        } else if (event === 'stage_reasoning') {
          setTrace((t) => ({
            ...t,
            reasoning: {
              ...t.reasoning,
              [d.stage]: [...(t.reasoning[d.stage] || []), d.text],
            },
          }))
        } else if (event === 'stage_complete') {
          setTrace((t) => ({
            ...t,
            status: { ...t.status, [d.stage]: d.skipped ? 'skipped' : 'complete' },
          }))
        } else if (event === 'error') {
          if (d.fatal) fatal = d.message || 'The reasoning pipeline failed.'
          else if (d.stage) {
            setTrace((t) => ({ ...t, status: { ...t.status, [d.stage]: 'skipped' } }))
          }
        } else if (event === 'done') {
          finalRoadmap = d.roadmap
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''
        for (const b of blocks) {
          const evt = parseBlock(b)
          if (evt) handle(evt)
        }
      }
      const tail = parseBlock(buffer)
      if (tail) handle(tail)

      if (finalRoadmap) {
        commit(finalRoadmap)
        return
      }
      if (fatal) throw new Error(fatal)
      await nonStreaming() // stream ended without a roadmap -> fallback
    } catch (err) {
      setError(err.message || 'Something went wrong while generating your roadmap.')
      setStage(STAGES.ERROR)
    }
  }, [])

  const regeneratePhase = useCallback(
    async (phase) => {
      const res = await fetch('/api/regenerate-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_data: projectData,
          roadmap: {
            project_name: roadmap?.project_name,
            preset_type: roadmap?.preset_type,
            summary: roadmap?.summary,
            phases: (roadmap?.phases || []).map((p) => ({
              phase_number: p.phase_number,
              title: p.title,
            })),
          },
          phase,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload || payload.error) {
        throw new Error(
          payload?.error || `Phase regeneration failed (HTTP ${res.status}).`
        )
      }
      const nextRoadmap = {
        ...roadmap,
        phases: (roadmap?.phases || []).map((p) =>
          p.phase_number === payload.phase_number ? payload : p
        ),
      }
      setRoadmap(nextRoadmap)
      if (savedId) {
        updateSavedRoadmap(savedId, (entry) => ({ ...entry, roadmap: nextRoadmap }))
      }
      return payload
    },
    [projectData, roadmap, savedId]
  )

  // One-step undo for phase regeneration: put a snapshotted phase back.
  const restorePhase = useCallback(
    (phase) => {
      const nextRoadmap = {
        ...roadmap,
        phases: (roadmap?.phases || []).map((p) =>
          p.phase_number === phase.phase_number ? phase : p
        ),
      }
      setRoadmap(nextRoadmap)
      if (savedId) {
        updateSavedRoadmap(savedId, (entry) => ({ ...entry, roadmap: nextRoadmap }))
      }
    },
    [roadmap, savedId]
  )

  // Apply a structured edit from the follow-up chat. Phases are renumbered
  // 1..n after add/remove so the timeline stays contiguous; dependencies and
  // critical_path reference titles, so renumbering never breaks them. Returns
  // the phase_number to highlight (or null for a removal).
  const applyChatEdits = useCallback(
    (edits) => {
      if (!edits || !roadmap) return null
      const ordered = [...(roadmap.phases || [])].sort(
        (a, b) => (a.phase_number || 0) - (b.phase_number || 0)
      )
      let nextPhases = ordered
      let highlight = null

      if (edits.action === 'update_phase' && edits.phase_data) {
        nextPhases = ordered.map((p) =>
          p.phase_number === edits.phase_number
            ? { ...edits.phase_data, phase_number: edits.phase_number }
            : p
        )
        highlight = edits.phase_number
      } else if (edits.action === 'add_phase' && edits.phase_data) {
        const at = Number.isFinite(edits.phase_number)
          ? ordered.findIndex((p) => p.phase_number === edits.phase_number)
          : -1
        const insertAt = at === -1 ? ordered.length : at + 1
        nextPhases = [
          ...ordered.slice(0, insertAt),
          edits.phase_data,
          ...ordered.slice(insertAt),
        ]
        highlight = insertAt + 1 // renumbered position below
      } else if (edits.action === 'remove_phase') {
        nextPhases = ordered.filter((p) => p.phase_number !== edits.phase_number)
      } else {
        return null
      }

      nextPhases = nextPhases.map((p, i) => ({ ...p, phase_number: i + 1 }))
      const nextRoadmap = { ...roadmap, phases: nextPhases }
      setRoadmap(nextRoadmap)
      if (savedId) {
        updateSavedRoadmap(savedId, (entry) => ({ ...entry, roadmap: nextRoadmap }))
      }
      return highlight
    },
    [roadmap, savedId]
  )

  const goHome = useCallback(() => {
    setStage(STAGES.HOME)
    setProjectData(null)
    setRoadmap(null)
    setSavedId(null)
    setInitialCompleted([])
    setError('')
  }, [])

  const startOnboarding = useCallback(() => {
    setProjectData(null)
    setRoadmap(null)
    setSavedId(null)
    setInitialCompleted([])
    setError('')
    setStage(STAGES.ONBOARDING)
  }, [])

  const openSavedRoadmap = useCallback((entry) => {
    setProjectData(entry.project_data || null)
    setRoadmap(entry.roadmap)
    setSavedId(entry.id)
    setInitialCompleted(entry.completed || [])
    setError('')
    setStage(STAGES.ROADMAP)
  }, [])

  return (
    <div className="app">
      {/* All framer animations honor the OS reduced-motion setting. */}
      <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {stage === STAGES.HOME && (
          <motion.div key="home" className="stage" {...stageMotion}>
            <HomePage onStart={startOnboarding} onOpenRoadmap={openSavedRoadmap} />
          </motion.div>
        )}
        {stage === STAGES.ONBOARDING && (
          <motion.div key="onboarding" className="stage" {...stageMotion}>
            <OnboardingChat onComplete={generateRoadmap} />
          </motion.div>
        )}
        {stage === STAGES.LOADING && (
          <motion.div key="loading" className="stage" {...stageMotion}>
            <ReasoningTrace projectData={projectData} trace={trace} />
          </motion.div>
        )}
        {stage === STAGES.ROADMAP && roadmap && (
          <motion.div key="roadmap" className="stage" {...stageMotion}>
            <RoadmapView
              roadmap={roadmap}
              projectData={projectData}
              savedId={savedId}
              initialCompleted={initialCompleted}
              onRegeneratePhase={regeneratePhase}
              onRestorePhase={restorePhase}
              onApplyChatEdits={applyChatEdits}
              onStartOver={startOnboarding}
              onBackHome={goHome}
            />
          </motion.div>
        )}
        {stage === STAGES.ERROR && (
          <motion.div key="error" className="stage" {...stageMotion}>
            <ErrorState
              message={error}
              onRetry={() => generateRoadmap(projectData)}
              onStartOver={startOnboarding}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </MotionConfig>
    </div>
  )
}
