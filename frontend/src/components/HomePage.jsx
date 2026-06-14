import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import sampleRoadmap from '../data/sampleRoadmap.js'
import BlueprintHero from './BlueprintHero.jsx'

const STORAGE_KEY = 'buildpath-roadmaps'

export function loadSavedRoadmaps() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function saveRoadmap(entry) {
  const list = loadSavedRoadmaps().filter((e) => e.id !== entry.id)
  persist([entry, ...list])
}

export function updateSavedRoadmap(id, updater) {
  const list = loadSavedRoadmaps()
  const index = list.findIndex((e) => e.id === id)
  if (index === -1) return
  list[index] = updater(list[index])
  persist(list)
}

export function deleteSavedRoadmap(id) {
  persist(loadSavedRoadmaps().filter((e) => e.id !== id))
}

const heroRise = (delay) => ({
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1], delay },
})

function formatDate(iso) {
  const date = iso ? new Date(iso) : new Date()
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function entryName(entry) {
  return entry.roadmap?.project_name || entry.project_data?.name || 'Untitled Project'
}

function entryPreset(entry) {
  return entry.roadmap?.preset_type || entry.project_data?.preset_type || 'CUSTOM'
}

function entryProgress(entry) {
  const total = entry.roadmap?.phases?.length || 0
  const completedCount = (entry.completed || []).length
  const pct = total ? Math.round((completedCount / total) * 100) : 0
  return { total, completedCount, pct }
}

// First click arms a "Delete?" confirmation; a second click within 3s
// deletes, otherwise the control reverts.
function DeleteControl({ entryId, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  // A span with role="button" gets no native key activation; Enter and
  // Space must be wired up by hand. (It can't be a real <button> because
  // it lives inside the row/panel button.)
  const activate = (e) => {
    e.stopPropagation()
    if (confirming) {
      clearTimeout(confirmTimer.current)
      onDelete(entryId)
      return
    }
    setConfirming(true)
    confirmTimer.current = setTimeout(() => setConfirming(false), 3000)
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={confirming ? 'home-delete home-delete-confirm' : 'home-delete'}
      aria-label={confirming ? 'Confirm delete roadmap' : 'Delete roadmap'}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate(e)
        }
      }}
    >
      {confirming ? 'Delete?' : 'Delete'}
    </span>
  )
}

// Every saved roadmap uses the same full card — title, type badge, date,
// progress bar, and a Continue/View CTA — regardless of progress state.
// Missing fields in older saved data default to 0 progress, never a fallback
// layout.
function RoadmapCard({ entry, onOpen, onDelete }) {
  const { total, completedCount, pct } = entryProgress(entry)
  const done = total > 0 && completedCount >= total
  return (
    <button type="button" className="home-continue" onClick={() => onOpen(entry)}>
      <span className="home-continue-main">
        <span className="home-continue-name">{entryName(entry)}</span>
        <span className="home-continue-meta">
          <span className={`preset-badge preset-${String(entryPreset(entry)).toLowerCase()}`}>
            {entryPreset(entry)}
          </span>
          <span className="home-date">
            {formatDate(entry.roadmap?.generated_at || entry.saved_at)}
          </span>
          <DeleteControl entryId={entry.id} onDelete={onDelete} />
        </span>
      </span>
      <span className="home-continue-side">
        <span className="home-progress">
          <span
            className="progress-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="progress-fill" style={{ '--fill': pct / 100 }} />
          </span>
          <span className="progress-label">
            {completedCount}/{total} · {pct}%
          </span>
        </span>
        <span className="home-continue-cta">{done ? 'View →' : 'Continue →'}</span>
      </span>
    </button>
  )
}

export default function HomePage({ onStart, onOpenRoadmap }) {
  const [saved, setSaved] = useState(loadSavedRoadmaps)

  const handleDelete = (id) => {
    deleteSavedRoadmap(id)
    setSaved(loadSavedRoadmaps())
  }

  return (
    <div className="home">
      <div className="home-hero">
        <BlueprintHero />
        <svg
          className="home-litpath"
          viewBox="0 0 220 38"
          width="220"
          height="38"
          aria-hidden="true"
        >
          <path className="litpath-line" d="M6 31 H60 L84 9 H138 L162 31 H214" fill="none" />
          <circle className="litpath-node litpath-node-1" cx="6" cy="31" r="3.5" />
          <circle className="litpath-node litpath-node-2" cx="111" cy="9" r="3.5" />
          <circle className="litpath-node litpath-node-3" cx="214" cy="31" r="3.5" />
          <circle className="litpath-halo" cx="214" cy="31" r="4" />
        </svg>
        <motion.h1 className="home-title" {...heroRise(0.55)}>
          BuildPath
        </motion.h1>
        <motion.p className="home-subtitle" {...heroRise(0.72)}>
          AI-powered project roadmaps, from idea to execution
        </motion.p>
        <motion.button
          type="button"
          className="btn-accent btn-start"
          onClick={onStart}
          {...heroRise(0.88)}
        >
          Start Planning →
        </motion.button>
      </div>

      <section className="home-saved">
        <h2 className="home-section-label">Your Roadmaps</h2>
        {saved.length === 0 ? (
          <div className="home-empty">
            <p>No roadmaps yet. Start your first one.</p>
            <span className="home-empty-hint">
              Generated roadmaps are saved here automatically — progress, notes, and all.
            </span>
            <button
              type="button"
              className="home-sample-link"
              onClick={() => onOpenRoadmap(sampleRoadmap)}
            >
              Or explore a sample roadmap →
            </button>
          </div>
        ) : (
          <div className="home-list">
            {saved.map((entry) => (
              <RoadmapCard
                key={entry.id}
                entry={entry}
                onOpen={onOpenRoadmap}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
