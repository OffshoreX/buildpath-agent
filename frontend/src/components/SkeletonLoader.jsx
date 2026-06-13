import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STATUS_MESSAGES = [
  'Analyzing project type...',
  'Mapping phase dependencies...',
  'Identifying critical path...',
  'Calculating risk factors...',
  'Selecting tools and components...',
  'Generating your roadmap...',
]

const GHOST_CARDS = [0, 1, 2, 3, 4]

function GhostCard({ index }) {
  return (
    <div className="timeline-row">
      <div className="timeline-cell">
        <span className="timeline-stub seg-upcoming" />
        <span className="timeline-node node-ghost" />
        <span className="timeline-segment seg-upcoming" />
      </div>
      <div className="ghost-card">
        <span className="ghost-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="shimmer-bar" style={{ width: '60%', height: 18 }} />
        <span className="shimmer-bar" style={{ width: '90%' }} />
        <span className="shimmer-bar" style={{ width: '85%' }} />
        <div className="ghost-card-gap" />
        <span className="shimmer-bar shimmer-thin" style={{ width: '40%' }} />
        <span className="shimmer-bar shimmer-thin" style={{ width: '55%' }} />
        <span className="shimmer-bar shimmer-thin" style={{ width: '35%' }} />
      </div>
    </div>
  )
}

export default function SkeletonLoader({ projectData }) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  const presetType = projectData?.preset_type || 'CUSTOM'

  return (
    <div className="skeleton-page">
      <header className="skeleton-header">
        <h1 className="project-title">{projectData?.name || 'Your Project'}</h1>
        <div className="project-meta">
          <span className={`preset-badge preset-${presetType.toLowerCase()}`}>{presetType}</span>
        </div>
        <div className="skeleton-status" aria-live="polite">
          <span className="skeleton-status-dot" />
          <AnimatePresence mode="wait">
            <motion.span
              key={messageIndex}
              className="skeleton-status-text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {STATUS_MESSAGES[messageIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </header>

      <div className="timeline">
        {GHOST_CARDS.map((i) => (
          <GhostCard key={i} index={i} />
        ))}
      </div>
    </div>
  )
}
