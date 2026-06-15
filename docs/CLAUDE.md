# BuildPath — Project Memory

## Architecture
- Flask backend (backend/app.py, backend/agent.py) on port 5001
- React + Vite frontend (frontend/src/) on port 5173
- Vite proxies /api to localhost:5001

## Key Files
- backend/app.py: Flask server, POST /api/generate, POST /api/regenerate-phase, GET /api/health
- backend/agent.py: Foundry agent client, uses azure-ai-projects 2.x SDK, version-adaptive (2.x primary, 1.x fallback, direct OpenAI fallback)
- frontend/src/App.jsx: State machine: home → onboarding → loading → roadmap. Saves roadmaps to localStorage key "buildpath-roadmaps"
- frontend/src/components/HomePage.jsx: Landing page, reads saved roadmaps from localStorage, delete button, click to reopen
- frontend/src/components/OnboardingChat.jsx: Sequential chat questions, typing indicator, auto-expanding textarea, summary card with Edit buttons
- frontend/src/components/RoadmapView.jsx: Main roadmap display, keyboard shortcuts E/C/N, JSON export, back to home
- frontend/src/components/PhaseCard.jsx: Expandable checkpoints/risks/tools, confidence bar, notes (localStorage), mark complete, regenerate
- frontend/src/components/TimelinePath.jsx: Vertical timeline with lighting system (completed=cyan glow, current=pulse+particle, upcoming=dark)
- frontend/src/components/SkeletonLoader.jsx: Ghost cards with shimmer, rotating status messages
- frontend/src/components/ProjectHeader.jsx: Project name, type badge, duration, progress bar
- frontend/src/index.css: Full design system with CSS variables, dark theme

## Design Context

Read `PRODUCT.md` (strategy) and `DESIGN.md` (visual system) before any UI work. Tokens live in `frontend/src/index.css`.

- **Register:** product — design serves the task; demo-speed comprehension first.
- **North Star:** "The Workshop Blueprint" — a maker's drafting table at golden hour; warm dark surfaces, exactly one illuminated element per screen (the amber timeline through the current phase).
- **Palette:** Canvas `#1a1714` (aged oak), Surface `#231f1b` (walnut); Amber `#d4a24c` for state/progress/focus (dark text on amber fills), Terracotta `#c65d3a` (dark text `#1a1714`) for the single forward action and danger. ZERO cold blues/cyans/blue-grays — every neutral is brown-shifted. Never reintroduce the cyan-era `#49c4d8`/`#050a0d` or the original `#3b82f6`/`#f97316`.
- **Type & shape:** Playfair Display 700 for headings, Inter 400/500/600 for body/labels, system mono for numerals; 6px radii, 20px card padding, paper-like cards (no glass/blur); tabular-nums on all changing numbers.
- **Key rules:** amber glow budget on the current phase only; one terracotta action per screen; every animation has a reduced-motion alternative.
- **Anti-references:** generic SaaS dashboard, neon overload of any temperature, sterile gray. Think Aesop packaging, not GitHub dashboard.

## Run Commands
- Backend: /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 backend/app.py
- Frontend: npm run dev --prefix frontend
- Build check: npm run build --prefix frontend

## Environment
- .env has AZURE_PROJECT_ENDPOINT, AZURE_PROJECT_NAME, AZURE_AGENT_ID, AZURE_MODEL_DEPLOYMENT
- Python packages installed at /Library/Frameworks/Python.framework/Versions/3.13/
- No venv — using system Python 3.13
