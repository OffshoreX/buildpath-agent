export default function ProjectHeader({
  roadmap,
  completedCount,
  totalCount,
  allComplete,
  onExport,
  onStartOver,
}) {
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0
  const presetType = roadmap.preset_type || 'CUSTOM'
  const generatedAt = roadmap.generated_at ? new Date(roadmap.generated_at) : new Date()
  const generatedLabel = generatedAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <header className="project-header">
      <div className="project-header-top">
        <div className="project-header-id">
          <h1 className="project-title">{roadmap.project_name}</h1>
          <div className="project-meta">
            <span className={`preset-badge preset-${presetType.toLowerCase()}`}>
              {presetType}
            </span>
            {roadmap.estimated_duration && (
              <span className="meta-item">{roadmap.estimated_duration}</span>
            )}
            <span className="meta-item">Generated {generatedLabel}</span>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-ghost" onClick={onExport}>
            Export JSON
          </button>
          <button type="button" className="btn-ghost" onClick={onStartOver}>
            New Project
          </button>
        </div>
      </div>

      {roadmap.summary && <p className="project-summary">{roadmap.summary}</p>}

      <div className="progress-row">
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={allComplete ? 'progress-fill progress-fill-complete' : 'progress-fill'}
            style={{ '--fill': pct / 100 }}
          />
        </div>
        <span className="progress-label">
          {allComplete ? 'Complete ✓' : `${completedCount}/${totalCount} phases · ${pct}%`}
        </span>
      </div>

      {allComplete && (
        <p className="header-complete" role="status">
          Roadmap complete — every phase shipped. Export it, or start the next build.
        </p>
      )}
    </header>
  )
}
