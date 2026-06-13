import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import HomePage, { saveRoadmap, updateSavedRoadmap } from './components/HomePage.jsx'
import OnboardingChat from './components/OnboardingChat.jsx'
import RoadmapView from './components/RoadmapView.jsx'
import SkeletonLoader from './components/SkeletonLoader.jsx'

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

  const generateRoadmap = useCallback(async (data) => {
    setProjectData(data)
    setStage(STAGES.LOADING)
    setError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_data: data }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload || payload.error) {
        throw new Error(
          payload?.error || `The agent request failed (HTTP ${res.status}).`
        )
      }
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
            <SkeletonLoader projectData={projectData} />
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
    </div>
  )
}
