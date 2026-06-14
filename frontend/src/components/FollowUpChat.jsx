import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const PARSE_FALLBACK = "I didn't quite catch that, can you rephrase?"

function SendIcon() {
  return (
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
  )
}

const panelMotion = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
}

/**
 * A slide-out panel that lets the user converse with the agent about the
 * finished roadmap. Messages live in component state for the session. When the
 * agent returns a structured edit, onApplyEdits applies it to the roadmap and
 * returns the phase number to highlight; the panel confirms it inline.
 */
export default function FollowUpChat({ projectData, roadmap, onApplyEdits }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      content:
        "Ask me anything about your roadmap — why a phase depends on another, what parts you need, or tell me to change something (“make phase 2 shorter”, “add a testing phase”).",
    },
  ])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  const autoGrow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const send = async () => {
    const message = text.trim()
    if (!message || sending) return
    // History sent to the agent excludes the static greeting and confirmations.
    const history = messages
      .filter((m) => !m.system)
      .map((m) => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }))

    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_data: projectData,
          roadmap,
          message,
          chat_history: history,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload || payload.error || !payload.reply) {
        throw new Error(payload?.error || `Chat request failed (HTTP ${res.status}).`)
      }

      const next = [{ role: 'agent', content: payload.reply }]
      // Only confirm an edit if it actually applied cleanly; a malformed edit
      // is dropped (the reply still shows) so the roadmap is never corrupted.
      if (payload.edits) {
        const result = onApplyEdits?.(payload.edits) || { ok: false }
        if (result.ok) {
          const verb =
            payload.edits.action === 'remove_phase'
              ? 'Removed'
              : payload.edits.action === 'add_phase'
                ? 'Added'
                : 'Updated'
          const target =
            payload.edits.action === 'remove_phase'
              ? `Phase ${payload.edits.phase_number}`
              : `Phase ${result.highlight ?? payload.edits.phase_number}`
          next.push({ role: 'agent', system: true, content: `✓ ${verb} ${target}` })
        }
      }
      setMessages((prev) => [...prev, ...next])
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', content: PARSE_FALLBACK }])
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Hidden while the panel is open — the header X is the close control,
          and a bottom-right FAB would overlap the send button. */}
      {!open && (
        <button
          type="button"
          className="followup-fab"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          Ask BuildPath
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            className="followup-panel"
            {...panelMotion}
            role="complementary"
            aria-label="Ask about your project"
          >
            <header className="followup-header">
              <span className="followup-title">Ask about your project</span>
              <button
                type="button"
                className="followup-close"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className="followup-scroll" ref={scrollRef}>
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div className="followup-row followup-row-user" key={i}>
                    <div className="followup-chip-user">{m.content}</div>
                  </div>
                ) : m.system ? (
                  <div className="followup-confirm" key={i}>
                    {m.content}
                  </div>
                ) : (
                  <div className="followup-row followup-row-agent" key={i}>
                    <span className="chat-avatar">BP</span>
                    <div className="followup-bubble-agent">{m.content}</div>
                  </div>
                )
              )}
              {sending && (
                <div className="followup-row followup-row-agent">
                  <span className="chat-avatar">BP</span>
                  <div className="followup-bubble-agent chat-bubble-typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
            </div>

            <form
              className="followup-input-area"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <textarea
                ref={inputRef}
                className="chat-input chat-textarea"
                rows={1}
                placeholder="Ask a question or request a change…"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  autoGrow(e.target)
                }}
                onKeyDown={onKeyDown}
              />
              <button
                type="submit"
                className="btn-send"
                disabled={!text.trim() || sending}
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
