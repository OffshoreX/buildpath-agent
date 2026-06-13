import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const UNIVERSAL_QUESTIONS = [
  {
    id: 'name',
    type: 'text',
    prompt: "What's your project called?",
    placeholder: 'e.g. Mesh-Networked Weather Balloons',
  },
  {
    id: 'preset_type',
    type: 'select',
    prompt: 'What type of project is this?',
    options: ['SOFTWARE', 'HARDWARE', 'RESEARCH', 'BUSINESS', 'CUSTOM'],
  },
  {
    id: 'description',
    type: 'textarea',
    prompt: "Describe what you're building in a few sentences.",
    placeholder: 'What does it do? Who is it for? What makes it tricky?',
  },
  {
    id: 'timeline',
    type: 'select',
    prompt: "What's your timeline?",
    options: ['< 1 week', '1–4 weeks', '1–3 months', '3+ months'],
  },
  {
    id: 'experience_level',
    type: 'select',
    prompt: "What's your experience level with this type of project?",
    options: ['Beginner', 'Intermediate', 'Advanced'],
  },
  {
    id: 'team_size',
    type: 'select',
    prompt: 'Solo project or team?',
    options: ['Solo', 'Small team (2–5)', 'Larger team'],
  },
  {
    id: 'resources',
    type: 'multiselect',
    prompt: 'What resources do you have available?',
    options: [
      'Limited budget',
      'Moderate budget',
      'Well-funded',
      'Lab/workshop access',
      'Cloud credits',
      'Specialized equipment',
    ],
  },
  {
    id: 'success_criteria',
    type: 'text',
    prompt: 'What does success look like for this project?',
    placeholder: 'e.g. A working demo in front of 50 people',
  },
]

const CUSTOM_QUESTIONS = [
  {
    id: 'custom_domain',
    type: 'text',
    prompt: 'What domain or field is this in?',
    placeholder: 'e.g. Bioinformatics, audio engineering, urban farming',
  },
  {
    id: 'custom_constraints',
    type: 'multiselect',
    prompt: 'What are the main constraints?',
    options: ['Time', 'Budget', 'Technical complexity', 'Physical/hardware limits', 'Team size'],
  },
  {
    id: 'custom_skills',
    type: 'text',
    prompt: 'What skills or tools are you working with?',
    placeholder: 'e.g. Python, KiCad, a CNC router, two designers',
  },
  {
    id: 'custom_requirements',
    type: 'text',
    prompt: 'Any hard requirements or non-negotiables?',
    placeholder: 'e.g. Must run offline, must cost under $200',
  },
]

const SUMMARY_LABELS = {
  name: 'Project',
  preset_type: 'Type',
  description: 'Description',
  timeline: 'Timeline',
  experience_level: 'Experience',
  team_size: 'Team',
  resources: 'Resources',
  success_criteria: 'Success criteria',
  custom_domain: 'Domain',
  custom_constraints: 'Constraints',
  custom_skills: 'Skills & tools',
  custom_requirements: 'Hard requirements',
}

const messageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

function formatAnswer(value) {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase())
}

// The typing pause is theater for the first exchange; after that it gets out
// of the way. Rewinding via Edit barely pauses at all.
const TYPING_DELAY_FIRST_MS = 1500
const TYPING_DELAY_REST_MS = 600
const TYPING_DELAY_REWIND_MS = 250

function TypingIndicator() {
  return (
    <div className="chat-row chat-row-agent" aria-label="Agent is typing">
      <span className="chat-avatar">BP</span>
      <div className="chat-bubble-agent chat-bubble-typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

function AgentMessage({ children, emphasis }) {
  return (
    <motion.div className="chat-row chat-row-agent" {...messageMotion}>
      <span className="chat-avatar">BP</span>
      <div className={emphasis ? 'chat-bubble-agent chat-bubble-emphasis' : 'chat-bubble-agent'}>
        {children}
      </div>
    </motion.div>
  )
}

function UserChip({ children, onEdit }) {
  return (
    <motion.div className="chat-row chat-row-user" {...messageMotion}>
      {onEdit && (
        <button
          type="button"
          className="chip-edit"
          title="Edit this answer — later answers will be asked again"
          aria-label="Edit this answer"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
      <div className="chat-chip-user">{children}</div>
    </motion.div>
  )
}

export default function OnboardingChat({ onComplete }) {
  const [answers, setAnswers] = useState({})
  const [order, setOrder] = useState([]) // ids of answered questions, in order
  const [textValue, setTextValue] = useState('')
  const [multiValue, setMultiValue] = useState([])
  const [otherInput, setOtherInput] = useState(false) // "Other..." picked on a select
  const [editingId, setEditingId] = useState(null) // summary field being edited inline
  const [editValue, setEditValue] = useState(null)
  // Fast path for repeat users: every question on one form. Preference sticks.
  const [formMode, setFormMode] = useState(
    () => localStorage.getItem('buildpath-onboard-mode') === 'form'
  )
  const [typing, setTyping] = useState(true)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // CUSTOM inserts its follow-up questions immediately after question 2.
  const questions = useMemo(() => {
    if (answers.preset_type === 'CUSTOM') {
      return [
        ...UNIVERSAL_QUESTIONS.slice(0, 2),
        ...CUSTOM_QUESTIONS,
        ...UNIVERSAL_QUESTIONS.slice(2),
      ]
    }
    return UNIVERSAL_QUESTIONS
  }, [answers.preset_type])

  const currentIndex = questions.findIndex((q) => !(q.id in answers))
  const current = currentIndex === -1 ? null : questions[currentIndex]
  const done = current === null

  const typingDelayRef = useRef(TYPING_DELAY_FIRST_MS)

  // Each new agent message (and the final summary) is preceded by a short
  // typing-indicator pause before it fades in.
  useEffect(() => {
    setTyping(true)
    const timer = setTimeout(() => {
      setTyping(false)
      typingDelayRef.current = TYPING_DELAY_REST_MS
    }, typingDelayRef.current)
    return () => clearTimeout(timer)
  }, [current?.id, done])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [currentIndex, done, typing])

  useEffect(() => {
    setTextValue('')
    setMultiValue([])
    setOtherInput(false)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!typing && current && (current.type === 'text' || current.type === 'textarea')) {
      inputRef.current?.focus()
    }
  }, [typing, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setOrder((prev) => [...prev, id])
  }

  const submitText = (e) => {
    e.preventDefault()
    const value = textValue.trim()
    if (!value || !current) return
    answer(current.id, value)
  }

  const toggleMulti = (option) => {
    setMultiValue((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    )
  }

  const handleGenerate = () => {
    onComplete({ ...answers })
  }

  const toggleFormMode = () => {
    setFormMode((prev) => {
      const next = !prev
      localStorage.setItem('buildpath-onboard-mode', next ? 'form' : 'chat')
      return next
    })
  }

  // Form mode writes straight into the shared answers state, keeping `order`
  // in sync so the chat view and summary stay coherent if the user switches.
  const setFormAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const toggleFormMulti = (id, option) => {
    const current = Array.isArray(answers[id]) ? answers[id] : []
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option]
    setFormAnswer(id, next)
  }

  const formComplete = questions.every((q) => {
    const value = answers[q.id]
    return Array.isArray(value)
      ? value.length > 0
      : String(value ?? '').trim().length > 0
  })

  const generateFromForm = () => {
    const trimmed = {}
    for (const [key, value] of Object.entries(answers)) {
      trimmed[key] = typeof value === 'string' ? value.trim() : value
    }
    onComplete(trimmed)
  }

  // Grow the input with its content; past 120px it scrolls internally.
  const autoGrow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  // Mid-chat edit (on an answered chip) rewinds the conversation: the
  // question and everything after it are cleared and re-asked.
  const editFrom = (id) => {
    const idx = order.indexOf(id)
    if (idx === -1) return
    typingDelayRef.current = TYPING_DELAY_REWIND_MS
    const removed = order.slice(idx)
    setOrder((prev) => prev.slice(0, idx))
    setAnswers((prev) => {
      const next = { ...prev }
      removed.forEach((key) => delete next[key])
      return next
    })
  }

  // Summary-card edit is inline: change one field in place, stay on the card.
  const startEdit = (id) => {
    const value = answers[id]
    setEditingId(id)
    setEditValue(Array.isArray(value) ? [...value] : String(value ?? ''))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue(null)
  }

  const toggleEditMulti = (option) => {
    setEditValue((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    )
  }

  const editIsValid = (q) => {
    if (!q) return false
    if (q.type === 'multiselect') return Array.isArray(editValue) && editValue.length > 0
    if (q.type === 'select') return Boolean(editValue)
    return Boolean(String(editValue ?? '').trim())
  }

  const saveEdit = () => {
    if (editingId == null) return
    const q = questions.find((item) => item.id === editingId)
    if (!editIsValid(q)) return
    const value =
      q.type === 'multiselect' ? [...editValue] : String(editValue).trim()
    const wasCustom = answers.preset_type === 'CUSTOM'
    setAnswers((prev) => {
      const next = { ...prev, [editingId]: value }
      // Leaving CUSTOM invalidates the custom follow-up answers.
      if (editingId === 'preset_type' && prev.preset_type === 'CUSTOM' && value !== 'CUSTOM') {
        CUSTOM_QUESTIONS.forEach((cq) => delete next[cq.id])
      }
      return next
    })
    if (editingId === 'preset_type' && wasCustom && value !== 'CUSTOM') {
      setOrder((prev) => prev.filter((oid) => !CUSTOM_QUESTIONS.some((cq) => cq.id === oid)))
    }
    setEditingId(null)
    setEditValue(null)
  }

  return (
    <div className="onboarding">
      <div className="onboarding-brand">
        <span className="onboarding-logo">BuildPath</span>
        <span className="onboarding-tagline">project → roadmap, in one conversation</span>
        <button type="button" className="onboarding-mode" onClick={toggleFormMode}>
          {formMode ? 'Chat mode' : 'Form mode'}
        </button>
        <span className="onboarding-counter">
          {String(Math.min(order.length + 1, questions.length)).padStart(2, '0')} /{' '}
          {String(questions.length).padStart(2, '0')}
        </span>
      </div>
      <div className="onboarding-progress" aria-hidden="true">
        <span style={{ '--fill': order.length / questions.length }} />
      </div>

      {formMode && (
        <div className="onboarding-form">
          {questions.map((q) => (
            <div className="form-field" key={q.id}>
              <label className="form-q" htmlFor={`form-${q.id}`}>
                {q.prompt}
              </label>
              {(q.type === 'text' || q.type === 'textarea') && (
                <textarea
                  id={`form-${q.id}`}
                  className="chat-input form-input"
                  rows={q.type === 'textarea' ? 3 : 2}
                  placeholder={q.placeholder || ''}
                  value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                  onChange={(e) => setFormAnswer(q.id, e.target.value)}
                />
              )}
              {q.type === 'select' && (
                <div className="chat-options">
                  {q.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        answers[q.id] === option
                          ? 'option-chip option-chip-checked'
                          : 'option-chip'
                      }
                      onClick={() => setFormAnswer(q.id, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'multiselect' && (
                <div className="chat-options">
                  {q.options.map((option) => {
                    const checked =
                      Array.isArray(answers[q.id]) && answers[q.id].includes(option)
                    return (
                      <label
                        key={option}
                        className={
                          checked ? 'option-chip option-chip-checked' : 'option-chip'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFormMulti(q.id, option)}
                        />
                        {option}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn-accent btn-generate"
            disabled={!formComplete}
            onClick={generateFromForm}
          >
            Generate Roadmap →
          </button>
        </div>
      )}

      {!formMode && (
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-messages">
          <AgentMessage>
            Hey — I'm the BuildPath agent. Answer a few questions and I'll draft a
            phase-by-phase roadmap for your project.
          </AgentMessage>

          {order.map((id) => {
            const q = questions.find((item) => item.id === id)
            if (!q) return null
            return (
              <div key={id} className="chat-exchange">
                <AgentMessage>{q.prompt}</AgentMessage>
                <UserChip onEdit={() => editFrom(id)}>{formatAnswer(answers[id])}</UserChip>
              </div>
            )
          })}

          {typing && <TypingIndicator />}

          {current && !typing && (
            <AgentMessage key={current.id} emphasis>
              {current.prompt}
            </AgentMessage>
          )}

          {done && !typing && (
            <>
              <AgentMessage>Here's what I understood from your answers:</AgentMessage>
              <motion.div className="summary-card" {...messageMotion}>
                <span className="summary-card-label">Ready to generate</span>
                <h2 className="summary-card-title">{toTitleCase(answers.name)}</h2>
                <dl className="summary-list">
                  {order
                    .filter((id) => id !== 'name')
                    .map((id) => {
                      const q = questions.find((item) => item.id === id)
                      const editing = editingId === id
                      return (
                        <div className="summary-row" key={id}>
                          <dt>{SUMMARY_LABELS[id] || id}</dt>
                          <dd>
                            {editing && q ? (
                              <div
                                className="summary-edit-form"
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                              >
                                {(q.type === 'text' || q.type === 'textarea') && (
                                  <textarea
                                    className="summary-edit-input"
                                    rows={q.type === 'textarea' ? 3 : 1}
                                    value={editValue}
                                    autoFocus
                                    onChange={(e) => {
                                      setEditValue(e.target.value)
                                      autoGrow(e.target)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        saveEdit()
                                      }
                                    }}
                                  />
                                )}
                                {q.type === 'select' && (
                                  <div className="chat-options">
                                    {q.options.map((option) => (
                                      <button
                                        key={option}
                                        type="button"
                                        className={
                                          editValue === option
                                            ? 'option-chip option-chip-checked'
                                            : 'option-chip'
                                        }
                                        onClick={() => setEditValue(option)}
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {q.type === 'multiselect' && (
                                  <div className="chat-options">
                                    {q.options.map((option) => {
                                      const checked = editValue.includes(option)
                                      return (
                                        <label
                                          key={option}
                                          className={
                                            checked
                                              ? 'option-chip option-chip-checked'
                                              : 'option-chip'
                                          }
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleEditMulti(option)}
                                          />
                                          {option}
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                                <div className="summary-edit-actions">
                                  <button
                                    type="button"
                                    className="btn-electric btn-mini"
                                    disabled={!editIsValid(q)}
                                    onClick={saveEdit}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-mini"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {Array.isArray(answers[id]) ? (
                                  <span className="summary-chips">
                                    {answers[id].map((item) => (
                                      <span key={item} className="summary-chip">
                                        {item}
                                      </span>
                                    ))}
                                  </span>
                                ) : id === 'description' ? (
                                  <span className="summary-desc">{answers[id]}</span>
                                ) : (
                                  formatAnswer(answers[id])
                                )}
                                <button
                                  type="button"
                                  className="summary-edit"
                                  onClick={() => startEdit(id)}
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                </dl>
                <button type="button" className="btn-accent btn-generate" onClick={handleGenerate}>
                  Generate Roadmap →
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>
      )}

      {!formMode && current && !typing && (
        <div className="chat-input-area">
          {(current.type === 'text' || current.type === 'textarea') && (
            <form className="chat-input-form" onSubmit={submitText}>
              <textarea
                ref={inputRef}
                className="chat-input chat-textarea"
                rows={1}
                value={textValue}
                placeholder={current.placeholder || 'Type your answer…'}
                onChange={(e) => {
                  setTextValue(e.target.value)
                  autoGrow(e.target)
                }}
                onFocus={(e) => autoGrow(e.target)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitText(e)
                  }
                }}
              />
              <button type="submit" className="btn-send" disabled={!textValue.trim()} aria-label="Send">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M2 8h11M9 4l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          )}

          {current.type === 'select' && !otherInput && (
            <div className="chat-options">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="option-chip"
                  onClick={() => answer(current.id, option)}
                >
                  {option}
                </button>
              ))}
              <button
                type="button"
                className="option-chip option-chip-other"
                onClick={() => setOtherInput(true)}
              >
                Other...
              </button>
            </div>
          )}

          {current.type === 'select' && otherInput && (
            <form className="chat-input-form" onSubmit={submitText}>
              <input
                className="chat-input"
                type="text"
                autoFocus
                value={textValue}
                placeholder="Type your own answer…"
                onChange={(e) => setTextValue(e.target.value)}
              />
              <button type="submit" className="btn-send" disabled={!textValue.trim()} aria-label="Send">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M2 8h11M9 4l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          )}

          {current.type === 'multiselect' && (
            <div className="chat-multiselect">
              <div className="chat-options">
                {current.options.map((option) => {
                  const checked = multiValue.includes(option)
                  return (
                    <label
                      key={option}
                      className={checked ? 'option-chip option-chip-checked' : 'option-chip'}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMulti(option)}
                      />
                      {option}
                    </label>
                  )
                })}
              </div>
              <button
                type="button"
                className="btn-electric"
                disabled={multiValue.length === 0}
                onClick={() => answer(current.id, [...multiValue])}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
